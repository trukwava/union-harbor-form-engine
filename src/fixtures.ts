import {DB,TemplateVersion,FormInstance,TimeEntry,Answer,marker,addDays} from './domain.js';
const at='2026-10-29T19:00:00.000Z';
const A=(value:string):Answer=>({state:'value',value});
const B:Answer={state:'blank',value:''};
const v=(key:string,version:number):TemplateVersion=>({
 id:`${key}-v${version}`,templateId:key,version,effectiveFrom:version===1?'2024-01-01':'2026-01-01',effectiveTo:null,createdAt:at,
 title:'Weekly Service-Hours Memorandum',
 variables:[
 {key:'activityCategory',label:'Service category',type:'select',required:true,help:'Controls which approved explanatory block appears in the memorandum.',choices:key==='operations'?['facilities','administration']:['outreach','programming']},
 {key:'approverRef',label:'Approver reference',type:'text',required:true,help:'Reference for a person who may review the document. Entering this does not constitute approval.',maxLength:120},
 {key:'notes',label:'Preparation notes',type:'text',required:false,help:'Optional context for the human reviewer. This is not an approval or a delivery instruction.',maxLength:2000}
 ],
 blocks:[
 {id:'intro',label:'Purpose',order:1,text:version===1?'This sample memorandum records service activities and calculated hours for the selected week.':'This revised sample memorandum records service activities, unpaid breaks, and calculated net hours for the selected week.'},
 {id:'conditions',label:key==='operations'?'Facilities reference':'Outreach reference',order:2,text:key==='operations'?'Facilities entries are informational. Equipment clearance and authorization are outside this sample workflow.':'Outreach entries are informational. Participant authorization and program approval are outside this sample workflow.'},
 {id:'review',label:'Review boundary',order:3,text:'A designated human reviewer must verify source entries before any use outside this demonstration.'}
 ],
 branches:[{blockId:'conditions',field:'activityCategory',op:'eq',value:key==='operations'?'facilities':'outreach'}],outputFields:['activityCategory','approverRef','notes'],validationRules:{requireEntry:true,maxEntries:60,requireApprover:true},status:'published'
});
const E=(id:string,serviceDate:string,activity:string,start:string,end:string,breakMinutes:number,notes=''):TimeEntry=>({id,serviceDate,activity,start,end,breakMinutes,notes});
const forms:FormInstance[]=[];
function form(i:number, templateId:'operations'|'community', weekStart:string, profileId:string, version:number, entries:TimeEntry[],complete=true, long=false):FormInstance{
 const n=`form-${String(i).padStart(2,'0')}`;return {id:n,organizationId:'union-harbor',templateId,templateVersionId:`${templateId}-v${version}`,profileId,department:templateId==='operations'?'Operations':'Community Services',weekStart,answers:{activityCategory:complete?A(templateId==='operations'?'facilities':'outreach'):B,approverRef:complete?A('REVIEWER-REF-SAMPLE-27'):B,notes:long?A('Synthetic narrative for layout testing. '.repeat(36)):B},entries,revision:1,revisions:[{number:1,at,fields:['seed']}],createdAt:at,updatedAt:at};}
const longName='Alexandria-Montgomery Genevieve de la Cruz-Washington';
export function seed():DB {
 forms.length=0;
 forms.push(form(1,'operations','2026-10-26','profile-1',1,[E('entry-1','2026-10-26','Site coordination','09:00','12:00',30,'Opening report and safety checks') ]));
 forms.push(form(2,'community','2026-10-26','profile-2',2,[E('entry-2','2026-10-27','Community workshop','10:00','14:00',30)]));
 forms.push(form(3,'operations','2024-02-26','profile-3',1,[E('entry-3','2024-02-29','Leap-day inventory','08:00','11:30',0,'Leap year fixture')]));
 forms.push(form(4,'community','2026-10-19','profile-3',1,[E('entry-4','2026-10-21','Extended community outreach activity with detailed supporting record','09:00','16:00',60,'Extended synthetic entry: '.repeat(90))],true,true));
 forms.push(form(5,'operations','2026-10-19','profile-1',2,[E('entry-5','2026-10-20','Desk coverage','11:00','13:00',0)]));
 forms.push(form(6,'community','2026-10-12','profile-2',1,[E('entry-6','2026-10-13','Weekly programming','13:00','16:15',15)]));
 forms.push(form(7,'operations','2026-10-26','profile-1',2,[],false));
 forms.push(form(8,'community','2026-10-26','profile-3',2,[E('entry-8','2026-10-28','An incomplete activity','09:00','10:00',0)],false));
 forms.push(form(9,'operations','2026-10-26','profile-1',1,[E('entry-9a','2026-10-29','Overlap case A','09:00','11:00',0),E('entry-9b','2026-10-29','Overlap case B','10:30','12:00',0)],true));
 return {organization:{id:'union-harbor',name:'Union Harbor Administration',mode:'demo'},templates:[{id:'operations',organizationId:'union-harbor',department:'Operations',name:'Operations weekly memo',description:'Facilities and general administration sample'},{id:'community',organizationId:'union-harbor',department:'Community Services',name:'Community Services weekly memo',description:'Outreach and program activities sample'}],versions:[v('operations',1),v('operations',2),v('community',1),v('community',2)],profiles:[{id:'profile-1',organizationId:'union-harbor',fullName:'Morgan Lee',role:'Administrative coordinator',department:'Operations'},{id:'profile-2',organizationId:'union-harbor',fullName:'Sam Rivera',role:'Service coordinator',department:'Community Services'},{id:'profile-3',organizationId:'union-harbor',fullName:longName,role:'Associate organizer',department:'Community Services'}],forms:[...forms],artifacts:[],audit:[{id:'seed-event',at,entityType:'organization',entityId:'union-harbor',action:'demo_seed',detail:`9 forms, 3 profiles; ${marker}`}],reviews:[]};
}
