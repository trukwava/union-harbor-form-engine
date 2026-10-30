import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import net from 'node:net';
import {spawn} from 'node:child_process';
async function freePort(){return await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});}
test('end-to-end HTTP flow persists, exports and keeps v1 pinned after v3 publication',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uh-test-'));const port=await freePort(),dataFile=path.join(dir,'demo.json');const server=spawn(process.execPath,['dist/src/server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_FILE:dataFile},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;const api=async(route,method='GET',data)=>{const r=await fetch(base+route,{method,headers:data!==undefined?{'Content-Type':'application/json'}:undefined,body:data!==undefined?JSON.stringify(data):undefined});const body=await r.json();return {status:r.status,body};};
 try{
 let running=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){running=true;break;}}catch{}await new Promise(r=>setTimeout(r,30));}assert(running,'HTTP server must start');
 const meta=(await api('/api/bootstrap')).body;assert.equal(meta.forms.length,9);assert.equal(meta.forms.filter(f=>f.ready).length,6);
 const f1=(await api('/api/forms/form-01')).body;assert.equal(f1.form.templateVersionId,'operations-v1');assert.equal(f1.document.totalHours,2.5);
 const a=(await api('/api/forms/form-01/exports','POST',{}));assert.equal(a.status,201);const art=a.body;assert.equal(art.templateVersionId,'operations-v1');
 const repeat=await api('/api/forms/form-01/exports','POST',{});assert.equal(repeat.status,201);assert.equal(repeat.body.id,art.id);assert.equal(repeat.body.reused,true);
 const noDuplicate=(await api('/api/bootstrap')).body.artifacts.filter(x=>x.formId==='form-01');assert.equal(noDuplicate.length,1,'Repeated export does not duplicate snapshots');
 const malformed=await api('/api/templates/operations/versions','POST',{definition:{title:'Incomplete',variables:[],blocks:'bad'}});assert.equal(malformed.status,422,'Bad administrator template must be rejected rather than crash');

 const receipt=await api(`/api/artifacts/${art.id}/receipt`);assert.equal(receipt.status,200);assert.equal(receipt.body.verified,true);assert.equal(receipt.body.checksum,art.checksum);
 const doc=await fetch(base+`/api/artifacts/${art.id}/docx`);assert.equal(doc.status,200);const bytes=Buffer.from(await doc.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');
 const printed=await fetch(base+`/api/artifacts/${art.id}/pdf`);assert.equal(printed.status,200,'PDF export should function in test environment with LibreOffice');assert.equal(Buffer.from(await printed.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 const bad=(await api('/api/forms/form-09/exports','POST',{}));assert.equal(bad.status,422);
 const clone=(await api('/api/forms/form-01/clone','POST',{weekStart:'2026-11-02'}));assert.equal(clone.status,201);assert.equal(clone.body.entries.length,0);assert.equal(clone.body.answers.approverRef.state,'blank');const clonePreview=(await api(`/api/forms/${clone.body.id}/preview`)).body;assert.equal(clonePreview.validation.ready,false);
 const updated=structuredClone(f1.form);updated.entries[0].activity='Edited activity';const saved=(await api('/api/forms/form-01','PUT',{baseRevision:updated.revision,answers:updated.answers,entries:updated.entries}));assert.equal(saved.status,200);assert.equal(saved.body.form.revision,2);
 const stale=await api('/api/forms/form-01','PUT',{baseRevision:1,answers:updated.answers,entries:updated.entries});assert.equal(stale.status,409);
 const template=meta.versions.find(x=>x.id==='operations-v2');const {id,templateId,version,createdAt,status,...definition}=template;const pub=await api('/api/templates/operations/versions','POST',{definition:{...definition,effectiveFrom:'2026-01-01',blocks:template.blocks.map(b=>b.id==='intro'?{...b,text:'Unique v3 approved text'}:b)}});assert.equal(pub.status,201);assert.equal(pub.body.version,3);
 const migrate=await api('/api/forms/form-05/migrate','POST',{baseRevision:1,toVersionId:pub.body.id});assert.equal(migrate.status,200);assert.equal(migrate.body.form.templateVersionId,pub.body.id);assert.equal(migrate.body.validation.ready,true);
 const oldMigration=await api('/api/forms/form-05/migrate','POST',{baseRevision:2,toVersionId:'operations-v1'});assert.equal(oldMigration.status,422,'Cannot silently downgrade a version');
 const originBlocked=await fetch(base+'/api/forms',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://malicious.example'},body:JSON.stringify({})});assert.equal(originBlocked.status,403);
 const differentPort=await fetch(base+'/api/forms',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:${port+1}'},body:JSON.stringify({})});assert.equal(differentPort.status,403,'Different local port must be rejected');
 const differentScheme=await fetch(base+'/api/forms',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://127.0.0.1:${port}'},body:JSON.stringify({})});assert.equal(differentScheme.status,403,'HTTPS origin must not be treated as same-origin HTTP');
 const sameOrigin=await fetch(base+'/api/forms',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({})});assert.notEqual(sameOrigin.status,403,'Exact same-origin request must pass origin check');
 const original=(await api('/api/forms/form-01')).body;assert.equal(original.form.templateVersionId,'operations-v1');assert.equal(original.document.templateVersion,1);
 const after=(await api('/api/bootstrap')).body;assert.equal(after.artifacts.find(x=>x.id===art.id).revision,1);assert.equal(after.artifacts.find(x=>x.id===art.id).templateVersionId,'operations-v1');
 const delivered=await api(`/api/artifacts/${art.id}/delivery`,'POST',{note:'User reported delivery'});assert.equal(delivered.status,200);assert(delivered.body.deliveredAt);const approved=await api(`/api/artifacts/${art.id}/approval`,'POST',{reviewerRef:'REVIEWER-123'});assert.equal(approved.status,200);assert(approved.body.approvedAt);
 const other=await api('/api/forms/form-01','PUT',{baseRevision:2,answers:updated.answers,entries:updated.entries});assert.equal(other.status,200);const afterEdit=(await api('/api/bootstrap')).body.artifacts.find(x=>x.id===art.id);assert.equal(afterEdit.approvedAt,approved.body.approvedAt,'Existing exported snapshot approval remains historical');
 const dbFile=JSON.parse(await fs.readFile(dataFile,'utf8'));assert.equal(dbFile.forms.find(f=>f.id==='form-01').revision,3,'Data persists on disk');
 dbFile.artifacts.find(x=>x.id===art.id).snapshot.title='UNAUTHORIZED LOCAL ALTERATION';await fs.writeFile(dataFile,JSON.stringify(dbFile));
 const corruptedDoc=await fetch(base+`/api/artifacts/${art.id}/docx`);assert.equal(corruptedDoc.status,409,'Checksum mismatch blocks download');
 const corruptedReceipt=await api(`/api/artifacts/${art.id}/receipt`);assert.equal(corruptedReceipt.status,409,'Checksum mismatch blocks verification');
 }finally{server.kill('SIGTERM');await fs.rm(dir,{recursive:true,force:true});}
});
