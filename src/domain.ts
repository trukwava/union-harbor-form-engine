/* Pure, deterministic domain rules. No model-generated rules or arbitrary code evaluation. */
export type Answer = { state: 'blank'|'unknown'|'na'|'value'; value: string };
export type VariableDefinition = { key:string; label:string; type:'text'|'select'; required:boolean; help:string; choices?: string[]; maxLength?:number };
export type BranchRule = { blockId:string; field:string; op:'eq'|'neq'|'in'|'exists'; value?:string|string[] };
export type ApprovedTextBlock = { id:string; label:string; text:string; order:number };
export type TemplateVersion = { id:string; templateId:string; version:number; effectiveFrom:string; effectiveTo:string|null; createdAt:string; title:string; variables:VariableDefinition[]; blocks:ApprovedTextBlock[]; branches:BranchRule[]; outputFields:string[]; validationRules:{ requireEntry:boolean; maxEntries:number; requireApprover:boolean }; status:'published' };
export type Template = {id:string; organizationId:string; department:string; name:string; description:string};
export type Profile = {id:string; organizationId:string; fullName:string; role:string; department:string};
export type TimeEntry = {id:string; serviceDate:string; activity:string; start:string; end:string; breakMinutes:number|string; notes:string};
export type Revision = {number:number; at:string; fields:string[]};
export type FormInstance = {id:string; organizationId:string; templateId:string; templateVersionId:string; profileId:string; department:string; weekStart:string; answers:Record<string,Answer>; entries:TimeEntry[]; revision:number; revisions:Revision[]; createdAt:string; updatedAt:string; cloneOf?:string};
export type ValidationIssue = {code:string; path:string; message:string};
export type ValidationResult = {ready:boolean; errors:ValidationIssue[]; totalMinutes:number; totalHours:number; entryMinutes:Record<string,number>};
export type Snapshot = {title:string; organization:string; marker:string; templateName:string; templateVersion:number; weekStart:string; department:string; preparer:string; role:string; fields:{label:string; value:string}[]; blocks:{label:string; text:string}[]; entries:{serviceDate:string; activity:string; start:string; end:string; breakMinutes:number; hours:number; notes:string}[]; totalHours:number; footer:string; formId:string; revision:number};
export type Artifact = {id:string; formId:string; templateVersionId:string; revision:number; createdAt:string; checksum:string; filename:string; snapshot:Snapshot; deliveredAt?:string; deliveredNote?:string; approvedAt?:string; reviewerRef?:string; reviewNote?:string};
export type AuditEvent = {id:string; at:string; entityType:string; entityId:string; action:string; detail?:string};
export type DB = { organization:{id:string;name:string;mode:'demo'}; templates:Template[]; versions:TemplateVersion[]; profiles:Profile[]; forms:FormInstance[]; artifacts:Artifact[]; audit:AuditEvent[]; reviews:{id:string;artifactId:string;state:'delivered_by_user'|'approved_by_reviewer';at:string;reference:string}[] };

export const marker = 'SAMPLE — NOT AN OFFICIAL FORM';
export function isDateOnly(s:string):boolean { if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s; }
export function addDays(date:string, days:number):string {const d = new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function monday(date:string):string { const d=new Date(date+'T12:00:00Z');const day=d.getUTCDay();return addDays(date,-((day+6)%7)); }
export function minutes(time:string):number|null {if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null; const [h,m]=time.split(':').map(Number);return h*60+m;}
export function normalizedAnswer(x:any):Answer {if(!x || typeof x !== 'object')return {state:'blank',value:''}; const state=['blank','unknown','na','value'].includes(x.state)?x.state:'blank';return {state, value:state==='value'?String(x.value??''):''} as Answer;}
export function formatAnswer(a:Answer|undefined):string {if(!a||a.state==='blank')return '[UNFILLED]'; if(a.state==='unknown')return '[UNKNOWN]';if(a.state==='na')return '[NOT APPLICABLE]';return a.value===''?'[UNFILLED]':a.value;}
const valueOf=(a:Answer|undefined)=>a?.state==='value'?a.value:undefined;
export function ruleMatches(rule:BranchRule, answers:Record<string,Answer>):boolean {const v=valueOf(answers[rule.field]);switch(rule.op){case 'eq':return v!==undefined&&v===rule.value;case 'neq':return v!==undefined&&v!==rule.value;case 'in':return v!==undefined&&Array.isArray(rule.value)&&rule.value.includes(v);case 'exists':return v!==undefined&&v.trim()!=='';default:return false;}}
export function selectedBlocks(v:TemplateVersion, answers:Record<string,Answer>) {return [...v.blocks].sort((a,b)=>a.order-b.order).filter(block=>v.branches.filter(r=>r.blockId===block.id).every(r=>ruleMatches(r,answers)));}
export function validateTemplate(v:TemplateVersion):string[] {
 const errors:string[]=[];
 const object=(x:any):boolean=>x!==null && typeof x==='object' && !Array.isArray(x);
 const string=(x:any,max:number):boolean=>typeof x==='string' && x.trim().length>0 && x.length<=max;
 if(!object(v))return ['Template definition must be an object'];
 if(!string(v.title,180))errors.push('Document title must be 1–180 characters');
 if(typeof v.effectiveFrom!=='string'||!isDateOnly(v.effectiveFrom))errors.push('Effective date must be valid');
 if(v.effectiveTo!==null && v.effectiveTo!==undefined && (typeof v.effectiveTo!=='string'||!isDateOnly(v.effectiveTo)||v.effectiveTo<v.effectiveFrom))errors.push('Effective-through date must be >= effective-from');
 if(!Array.isArray(v.variables)||!Array.isArray(v.blocks)||!Array.isArray(v.branches)||!Array.isArray(v.outputFields)){
  errors.push('Variables, blocks, branches, and outputFields must be arrays');return errors;
 }
 if(v.variables.length>40||v.blocks.length>40||v.branches.length>80||v.outputFields.length>40)errors.push('Template limits exceeded');
 const keys=new Set<string>();
 for(const x of v.variables){
  if(!object(x)){errors.push('Invalid variable definition');continue;}
  if(typeof x.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(x.key)){errors.push('Invalid variable key');continue;}
  if(keys.has(x.key))errors.push('Duplicate variable: '+x.key);keys.add(x.key);
  if(!['text','select'].includes(x.type)||typeof x.required!=='boolean'||!string(x.label,120)||!string(x.help,1500))errors.push('Invalid variable definition: '+x.key);
  if(x.maxLength!==undefined&&(!Number.isInteger(x.maxLength)||x.maxLength<1||x.maxLength>8000))errors.push('Invalid maximum length: '+x.key);
  if(x.type==='select'&&(!Array.isArray(x.choices)||x.choices.length<1))errors.push('Select variable requires choices: '+x.key);
  if(x.choices!==undefined&&(!Array.isArray(x.choices)||x.choices.length>30||x.choices.some((c:any)=>!string(c,150))||new Set(x.choices).size!==x.choices.length))errors.push('Invalid choices: '+x.key);
 }
 const blockIds=new Set<string>();
 for(const b of v.blocks){
  if(!object(b)||!string(b.id,60)||!string(b.label,120)||!string(b.text,8000)||!Number.isInteger(b.order)||b.order<0||b.order>10000){errors.push('Invalid approved text block');continue;}
  if(blockIds.has(b.id))errors.push('Duplicate approved block: '+b.id);blockIds.add(b.id);
 }
 for(const r of v.branches){
  if(!object(r)||!['eq','neq','in','exists'].includes(r.op)||!keys.has(r.field)||!blockIds.has(r.blockId)){errors.push('Invalid branch rule');continue;}
  if(r.op==='in'&&(!Array.isArray(r.value)||r.value.length<1||r.value.length>30||r.value.some((x:any)=>typeof x!=='string'||x.length>150)))errors.push('Invalid in-rule');
  if(['eq','neq'].includes(r.op)&&typeof r.value!=='string')errors.push('Invalid comparison rule');
  if(r.op==='exists'&&r.value!==undefined)errors.push('Exists rule does not accept a value');
 }
 const seenOutput=new Set<string>();
 for(const field of v.outputFields){
  if(typeof field!=='string'||!keys.has(field))errors.push('Unknown output field: '+String(field));
  if(seenOutput.has(field))errors.push('Duplicate output field: '+field);seenOutput.add(field);
 }
 const rule=v.validationRules;
 if(!object(rule)||!Number.isInteger(rule.maxEntries)||rule.maxEntries<1||rule.maxEntries>300||typeof rule.requireEntry!=='boolean'||typeof rule.requireApprover!=='boolean')errors.push('Invalid validation rules');
 else if(rule.requireApprover&&!keys.has('approverRef'))errors.push('Approver reference variable is required by validation rules');
 return errors;
}
export function validateForm(form:FormInstance,v:TemplateVersion,profile:Profile):ValidationResult {const errors:ValidationIssue[]=[];const add=(code:string,path:string,message:string)=>errors.push({code,path,message});let totalMinutes=0;const entryMinutes:Record<string,number>={};if(form.organizationId!==profile.organizationId)add('scope','profileId','Profile outside organization');if(form.templateId!==v.templateId||form.templateVersionId!==v.id)add('pin','templateVersionId','Template-version pin mismatch');if(!isDateOnly(form.weekStart)||monday(form.weekStart)!==form.weekStart)add('week','weekStart','Choose a Monday to start the service week');if(!profile.fullName.trim())add('profile','profileId','Preparer name is required');for(const def of v.variables){const a=normalizedAnswer(form.answers[def.key]);if(def.required&&(a.state!=='value'||!a.value.trim()))add('required',`answers.${def.key}`,`${def.label} requires a supplied value (unknown / N/A are not sufficient)`);if(a.state==='value'&&a.value.length>(def.maxLength??2000))add('length',`answers.${def.key}`,`${def.label} exceeds its maximum length`);if(a.state==='value'&&def.type==='select'&&!def.choices?.includes(a.value))add('choice',`answers.${def.key}`,`Choose an approved ${def.label} option`);}
if(v.validationRules.requireApprover){const a=normalizedAnswer(form.answers.approverRef);if(a.state!=='value'||!a.value.trim())add('approver','answers.approverRef','Approver reference is required');}
if(v.validationRules.requireEntry&&form.entries.length===0)add('entries','entries','Add at least one service entry');if(form.entries.length>v.validationRules.maxEntries)add('count','entries','Too many service entries');const slots:Record<string,{s:number;e:number;id:string}[]>={};for(let i=0;i<form.entries.length;i++){const e=form.entries[i],p=`entries.${i}`;if(!isDateOnly(e.serviceDate)||!isDateOnly(form.weekStart)||e.serviceDate<form.weekStart||e.serviceDate>addDays(form.weekStart,6))add('date',`${p}.serviceDate`,'Service date must fall within the selected week');if(!e.activity?.trim())add('activity',`${p}.activity`,'Activity is required');if((e.activity||'').length>500||(e.notes||'').length>4000)add('length',p,'Entry text is too long');const s=minutes(e.start),end=minutes(e.end);if(s===null||end===null||s>=end){add('interval',p,'Provide valid times with end after start (same day)');continue;}
const b=(e.breakMinutes===''||e.breakMinutes===null||e.breakMinutes===undefined)?NaN:(typeof e.breakMinutes==='number'?e.breakMinutes:Number(e.breakMinutes));if(!Number.isInteger(b)||b<0||b>end-s){add('break',`${p}.breakMinutes`,'Break must be a non-negative whole number no longer than the interval');continue;}const net=end-s-b;entryMinutes[e.id]=net;totalMinutes+=net;(slots[e.serviceDate]??=[]).push({s,e:end,id:e.id});}
for(const [date,day] of Object.entries(slots)){day.sort((a,b)=>a.s-b.s);for(let j=1;j<day.length;j++)if(day[j].s<day[j-1].e)add('overlap','entries',`Entries overlap on ${date} (${day[j-1].id} and ${day[j].id})`);}return {ready:errors.length===0,errors,totalMinutes,totalHours:totalMinutes/60,entryMinutes};}
export function snapshot(form:FormInstance,v:TemplateVersion,t:Template,profile:Profile,validated:ValidationResult):Snapshot {const blocks=selectedBlocks(v,form.answers).map(x=>({label:x.label,text:x.text}));return {title:v.title,organization:'Union Harbor Administration (fictional)',marker,templateName:t.name,templateVersion:v.version,weekStart:form.weekStart,department:form.department,preparer:profile.fullName,role:profile.role,fields:v.outputFields.map(key=>{const a=form.answers[key];const optional=v.variables.find(x=>x.key===key)?.required===false;return {label:v.variables.find(x=>x.key===key)?.label??key,value:optional&&(!a||a.state==='blank')?'Not supplied':optional&&a?.state==='unknown'?'Unknown (declared)':formatAnswer(a)};}),blocks,entries:form.entries.map(x=>({serviceDate:x.serviceDate,activity:x.activity,start:x.start,end:x.end,breakMinutes:Number(x.breakMinutes),hours:(validated.entryMinutes[x.id]??0)/60,notes:x.notes})),totalHours:validated.totalHours,footer:'Prepared for manual review and delivery only. No signature or approval is implied.',formId:form.id,revision:form.revision};}
export function preview(form:FormInstance,v:TemplateVersion,t:Template,profile:Profile):{validation:ValidationResult;document:Snapshot}{const validation=validateForm(form,v,profile);return {validation,document:snapshot(form,v,t,profile,validation)};}
export function cloneToWeek(source:FormInstance,newId:string,weekStart:string,now:string):FormInstance {if(!isDateOnly(weekStart)||monday(weekStart)!==weekStart||weekStart===source.weekStart)throw new Error('Choose a different Monday');return {id:newId,organizationId:source.organizationId,templateId:source.templateId,templateVersionId:source.templateVersionId,profileId:source.profileId,department:source.department,weekStart,answers:Object.fromEntries(Object.entries(source.answers).map(([k,v])=>[k,k==='approverRef'||k==='notes'?{state:'blank',value:''}:v])),entries:[],revision:0,revisions:[],createdAt:now,updatedAt:now,cloneOf:source.id};}
