import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Store} from './storage.js';
import {DB,FormInstance,TemplateVersion,Template,Profile,Answer,TimeEntry,Artifact,validateForm,validateTemplate,preview,cloneToWeek,normalizedAnswer,isDateOnly,monday,marker} from './domain.js';
import {renderDocx} from './docx.js';
import {renderPdf} from './pdf.js';
const root=path.resolve(process.cwd());
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||'127.0.0.1';
const store=new Store(process.env.DATA_FILE||path.join(root,'data','demo.json'));
await store.init();
const id=(prefix:string)=>prefix+'-'+crypto.randomUUID();
const now=()=>new Date().toISOString();
class RequestError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const fail=(status:number,m:string):never=>{throw new RequestError(status,m);};
const assert=(truth:any,status:number,m:string)=>{if(!truth)fail(status,m);};
const findForm=(db:DB,fid:string)=>{const f=db.forms.find(x=>x.id===fid);if(!f)fail(404,'Form not found');return f!;};
function context(db:DB,f:FormInstance){const version=db.versions.find(x=>x.id===f.templateVersionId),template=db.templates.find(x=>x.id===f.templateId),profile=db.profiles.find(x=>x.id===f.profileId);assert(version&&template&&profile&&version.templateId===template.id,422,'Broken template or profile reference');return {version:version!,template:template!,profile:profile!};}
const log=(db:DB,entityType:string,entityId:string,action:string,detail='')=>db.audit.push({id:id('audit'),at:now(),entityType,entityId,action,detail});
function verifyArtifact(a:Artifact):void {
 const computed=crypto.createHash('sha256').update(JSON.stringify(a.snapshot)).digest('hex');
 const valid=typeof a.checksum==='string'&&/^[a-f0-9]{64}$/.test(a.checksum)&&crypto.timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(a.checksum,'hex'));
 assert(valid,409,'Stored export checksum does not match its immutable document snapshot. Restore a valid backup; review and download are blocked.');
}

const send=(res:any,status:number,data:any)=>{const json=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(json);};
async function input(req:any){let str='';for await (const part of req){str+=part;if(str.length>262144)fail(413,'Request body exceeds 256 KB');}try{return str?JSON.parse(str):{};}catch{fail(400,'Malformed JSON');}}
function safeStr(x:any,max=4000):string{assert(typeof x==='string'&&x.length<=max,422,`Expected text no longer than ${max} characters`);return x;}
function updatedAnswers(raw:any,version:TemplateVersion):Record<string,Answer>{assert(raw&&typeof raw==='object'&&!Array.isArray(raw),422,'Invalid answers');const allowed=new Set(version.variables.map(x=>x.key));const out:Record<string,Answer>={};for(const [k,x]of Object.entries(raw)){assert(allowed.has(k),422,'Unexpected answer field: '+k);const a=normalizedAnswer(x);assert(a.value.length<=8000,422,'Answer too long');out[k]=a;}for(const def of version.variables)out[def.key]??={state:'blank',value:''};return out;}
function updatedEntries(raw:any):TimeEntry[]{assert(Array.isArray(raw)&&raw.length<=300,422,'Entries must be an array (max 300)');const seen=new Set<string>();return raw.map((x:any)=>{assert(x&&typeof x==='object',422,'Invalid entry');const entry:TimeEntry={id:safeStr(x.id||id('entry'),120),serviceDate:safeStr(x.serviceDate??'',12),activity:safeStr(x.activity??'',500),start:safeStr(x.start??'',8),end:safeStr(x.end??'',8),breakMinutes:x.breakMinutes??'',notes:safeStr(x.notes??'',4000)};assert(!seen.has(entry.id),422,'Duplicate time-entry ID');seen.add(entry.id);assert(['number','string'].includes(typeof entry.breakMinutes),422,'Invalid break value');return entry;});}
function meta(db:DB){return {organization:db.organization,marker,templates:db.templates,versions:db.versions,profiles:db.profiles,forms:db.forms.map(f=>{const c=context(db,f),v=validateForm(f,c.version,c.profile);return {id:f.id,weekStart:f.weekStart,department:f.department,templateId:f.templateId,templateVersionId:f.templateVersionId,preparer:c.profile.fullName,revision:f.revision,ready:v.ready,issues:v.errors.length,hours:v.totalHours,createdAt:f.createdAt,updatedAt:f.updatedAt,cloneOf:f.cloneOf,exportCount:db.artifacts.filter(a=>a.formId===f.id).length};}),artifacts:db.artifacts.map(({snapshot,...rest})=>rest)};}
async function route(req:any,res:any){
 const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`),pathname=url.pathname,method=req.method||'GET';
 if(pathname==='/health'&&method==='GET')return send(res,200,{ok:true,mode:'synthetic_demo',timestamp:now()});
 if(pathname==='/'&&method==='GET')return file(res,path.join(root,'public/index.html'),'text/html; charset=utf-8');
 if(pathname==='/styles.css'&&method==='GET')return file(res,path.join(root,'public/styles.css'),'text/css; charset=utf-8');
 if(pathname==='/app.js'&&method==='GET')return file(res,path.join(root,'dist/public/app.js'),'text/javascript; charset=utf-8');
 if(!pathname.startsWith('/api/'))return fail(404,'Not found');
 // Reject cross-origin write attempts. Single-organization local demo; not production auth.
 if(method!=='GET'){
  const origin=req.headers.origin;
  if(origin){
   let site:URL;
   try{site=new URL(origin);}catch{fail(403,'Invalid Origin header');}
   const authority=String(req.headers.host||'');
   let requestHost:URL;
   try{requestHost=new URL('http://'+authority);}catch{fail(403,'Invalid Host header');}
   assert(site!.protocol==='http:'&&site!.host===requestHost!.host&&site!.username===''&&site!.password==='',403,'Cross-origin mutation blocked');
  }
  assert((req.headers['content-type']||'').startsWith('application/json'),415,'JSON content type required');
 }
 if(pathname==='/api/bootstrap'&&method==='GET')return send(res,200,meta(await store.read()));
 if(pathname==='/api/demo/reset'&&method==='POST'){assert(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress),403,'Demo reset restricted to loopback');await store.reset();return send(res,200,{ok:true,warning:'Synthetic data only; existing demo records replaced'});}
 if(pathname==='/api/forms'&&method==='POST'){const b=await input(req);const created=await store.transact(db=>{const t=db.templates.find(t=>t.id===b.templateId),p=db.profiles.find(p=>p.id===b.profileId);assert(t&&p&&t.organizationId===db.organization.id&&p.organizationId===db.organization.id,422,'Template/profile not found');assert(isDateOnly(b.weekStart)&&monday(b.weekStart)===b.weekStart,422,'Select a Monday');const v=db.versions.filter(x=>x.templateId===t!.id&&x.effectiveFrom<=b.weekStart&&(!x.effectiveTo||x.effectiveTo>=b.weekStart)).sort((a,b)=>b.version-a.version)[0];assert(v,422,'No published template version effective for that week');const instant=now(),f:FormInstance={id:id('form'),organizationId:db.organization.id,templateId:t!.id,templateVersionId:v!.id,profileId:p!.id,department:t!.department,weekStart:b.weekStart,answers:Object.fromEntries(v!.variables.map(x=>[x.key,{state:'blank',value:''}])),entries:[],revision:0,revisions:[],createdAt:instant,updatedAt:instant};db.forms.unshift(f);log(db,'form',f.id,'created',`Pinned ${v!.id}`);return f;});return send(res,201,created);}
 const formMatch=pathname.match(/^\/api\/forms\/([^/]+)(?:\/(preview|clone|exports|migrate))?$/);
 if(formMatch){const fid=decodeURIComponent(formMatch[1]),action=formMatch[2];
 if(!action&&method==='GET'){const db=await store.read();const f=findForm(db,fid),c=context(db,f);return send(res,200,{form:f,...preview(f,c.version,c.template,c.profile),artifacts:db.artifacts.filter(a=>a.formId===fid).map(({snapshot,...rest})=>rest)});}
 if(action==='preview'&&method==='GET'){const db=await store.read(),f=findForm(db,fid),c=context(db,f);return send(res,200,preview(f,c.version,c.template,c.profile));}
 if(!action&&method==='PUT'){const b=await input(req);return send(res,200,await store.transact(db=>{const f=findForm(db,fid),c=context(db,f);assert(Number.isInteger(b.baseRevision)&&b.baseRevision===f.revision,409,'Stale edit. Reload the latest revision before saving.');const answers=updatedAnswers(b.answers,c.version),entries=updatedEntries(b.entries);f.answers=answers;f.entries=entries;f.updatedAt=now();f.revision++;f.revisions.push({number:f.revision,at:f.updatedAt,fields:['answers','entries']});log(db,'form',fid,'draft_saved',`Revision ${f.revision}`);return {form:f,...preview(f,c.version,c.template,c.profile)};}));}
 if(action==='clone'&&method==='POST'){const b=await input(req);return send(res,201,await store.transact(db=>{const f=findForm(db,fid),clone=cloneToWeek(f,id('form'),b.weekStart,now());db.forms.unshift(clone);log(db,'form',clone.id,'cloned',`From ${fid}, approvals and entries reset`);return clone;}));}
 if(action==='migrate'&&method==='POST'){const b=await input(req);return send(res,200,await store.transact(db=>{const f=findForm(db,fid);assert(Number.isInteger(b.baseRevision)&&b.baseRevision===f.revision,409,'Stale edit: reload before migration');const target=db.versions.find(v=>v.id===b.toVersionId);assert(target&&target.templateId===f.templateId,422,'Migration must use a version of the same template');assert(target!.effectiveFrom<=f.weekStart&&(!target!.effectiveTo||target!.effectiveTo>=f.weekStart),422,'Selected version is not effective for this service week');assert(target!.version>db.versions.find(v=>v.id===f.templateVersionId)!.version,422,'Migration must select a newer version');f.templateVersionId=target!.id;f.answers=Object.fromEntries(target!.variables.map(def=>[def.key,f.answers[def.key]??{state:'blank',value:''}]));f.updatedAt=now();f.revision++;f.revisions.push({number:f.revision,at:f.updatedAt,fields:['templateVersionId','answer_schema']});log(db,'form',fid,'explicit_template_migration',`Revalidated against ${target!.id}; existing exports unchanged`);const c=context(db,f);return {form:f,...preview(f,c.version,c.template,c.profile)};}));}
 if(action==='exports'&&method==='POST'){const b=await input(req);assert(!b||typeof b==='object',422,'Invalid export request');return send(res,201,await store.transact(db=>{const f=findForm(db,fid),c=context(db,f),p=preview(f,c.version,c.template,c.profile);assert(p.validation.ready,422,'Cannot export: resolve validation errors first');const doc=p.document,checksum=crypto.createHash('sha256').update(JSON.stringify(doc)).digest('hex');const existing=db.artifacts.find(a=>a.formId===fid&&a.revision===f.revision&&a.templateVersionId===f.templateVersionId&&a.checksum===checksum);
 if(existing){verifyArtifact(existing);return {id:existing.id,checksum:existing.checksum,revision:existing.revision,templateVersionId:existing.templateVersionId,filename:existing.filename,reused:true};}
 const a={id:id('artifact'),formId:fid,templateVersionId:f.templateVersionId,revision:f.revision,createdAt:now(),checksum,filename:`sample-memorandum-${f.weekStart}-${f.id}.docx`,snapshot:doc};db.artifacts.unshift(a);log(db,'artifact',a.id,'export_snapshot_created',`sha256 ${checksum.slice(0,14)}; template ${f.templateVersionId}; revision ${f.revision}`);return {id:a.id,checksum:a.checksum,revision:a.revision,templateVersionId:a.templateVersionId,filename:a.filename,reused:false};}));}
 }
 const artifactMatch=pathname.match(/^\/api\/artifacts\/([^/]+)\/(docx|pdf|receipt|delivery|approval)$/);
 if(artifactMatch){const artifactId=decodeURIComponent(artifactMatch[1]),action=artifactMatch[2];
 if(action==='receipt'&&method==='GET'){const db=await store.read(),a=db.artifacts.find(x=>x.id===artifactId);assert(a,404,'Export snapshot not found');verifyArtifact(a!);return send(res,200,{id:a!.id,formId:a!.formId,revision:a!.revision,templateVersionId:a!.templateVersionId,checksum:a!.checksum,createdAt:a!.createdAt,verified:true,scope:'stored_snapshot_only'});}
 if(['docx','pdf'].includes(action)&&method==='GET'){const db=await store.read(),a=db.artifacts.find(x=>x.id===artifactId);assert(a,404,'Export snapshot not found');verifyArtifact(a!);try{const bytes=action==='pdf'?await renderPdf(a!.snapshot):renderDocx(a!.snapshot);res.writeHead(200,{'Content-Type':action==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="${a!.filename.replace(/\.docx$/,'.'+action)}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);}catch(e:any){return fail(503,action==='pdf'?'PDF conversion unavailable. Install LibreOffice or use your browser Print → Save as PDF. '+e.message:e.message);}}
 if(['delivery','approval'].includes(action)&&method==='POST'){const b=await input(req);return send(res,200,await store.transact(db=>{const a=db.artifacts.find(x=>x.id===artifactId);assert(a,404,'Export snapshot not found');verifyArtifact(a!);if(action==='delivery'){assert(!a!.deliveredAt,409,'Delivery already recorded');a!.deliveredAt=now();a!.deliveredNote=safeStr(b.note||'',300);db.reviews.push({id:id('review'),artifactId,state:'delivered_by_user',at:a!.deliveredAt,reference:a!.deliveredNote||'User-reported delivery'});log(db,'artifact',artifactId,'user_reported_delivery','No actual delivery performed');}else{assert(a!.deliveredAt,422,'Record user-reported delivery first');assert(!a!.approvedAt,409,'Approval already recorded');a!.reviewerRef=safeStr(b.reviewerRef,120);assert(a!.reviewerRef.trim(),422,'Reviewer reference is required');a!.approvedAt=now();a!.reviewNote=safeStr(b.note||'',300);db.reviews.push({id:id('review'),artifactId,state:'approved_by_reviewer',at:a!.approvedAt,reference:a!.reviewerRef});log(db,'artifact',artifactId,'user_reported_reviewer_approval','No electronic signature or independent verification');}const {snapshot,...data}=a!;return data;}));}
 }
 if(pathname==='/api/templates'&&method==='POST'){const b=await input(req);return send(res,201,await store.transact(db=>{const t:Template={id:id('template'),organizationId:db.organization.id,department:safeStr(b.department,100),name:safeStr(b.name,150),description:safeStr(b.description||'',400)};assert(t.name.trim()&&t.department.trim(),422,'Template name and department required');const version:TemplateVersion={...b.definition,id:id('version'),templateId:t.id,version:1,createdAt:now(),status:'published'};const errors=validateTemplate(version);assert(errors.length===0,422,errors.join('; '));db.templates.push(t);db.versions.push(version);log(db,'template',t.id,'created','Created with v1');return {template:t,version};}));}
 const versionMatch=pathname.match(/^\/api\/templates\/([^/]+)\/versions$/);
 if(versionMatch&&method==='POST'){const templateId=decodeURIComponent(versionMatch[1]),b=await input(req);return send(res,201,await store.transact(db=>{assert(db.templates.some(t=>t.id===templateId),404,'Template not found');const latest=Math.max(0,...db.versions.filter(v=>v.templateId===templateId).map(v=>v.version));const version:TemplateVersion={...b.definition,id:id('version'),templateId,version:latest+1,createdAt:now(),status:'published'};const errors=validateTemplate(version);assert(errors.length===0,422,errors.join('; '));db.versions.push(version);log(db,'template',templateId,'version_published',`v${version.version}; effective ${version.effectiveFrom}`);return version;}));}
 if(pathname==='/api/audit'&&method==='GET'){const db=await store.read();return send(res,200,{audit:db.audit.slice(-100).reverse(),reviews:db.reviews});}
 return fail(404,'Unknown API operation');
}
async function file(res:any,filename:string,type:string){try{const bytes=await fs.readFile(filename);res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(bytes);}catch{fail(404,'Static file missing; run npm run build');}}
const server=http.createServer(async(req:any,res:any)=>{try{await route(req,res);}catch(err:any){const code=err instanceof RequestError?err.status:500;if(code===500)console.error('Request failed:',err?.message);if(!res.headersSent)send(res,code,{error:code===500?'Internal server error':err.message});else res.end();}});
server.listen(port,host,()=>console.log(`Union Harbor synthetic demo: http://${host}:${port} · ${marker}`));
