import fs from 'node:fs/promises';
import path from 'node:path';
import {seed} from './fixtures.js';
import {validateForm,snapshot} from './domain.js';
import {renderDocx} from './docx.js';
import {renderPdf} from './pdf.js';
const db=seed();const dest=path.join(process.cwd(),'samples');await fs.mkdir(dest,{recursive:true});
const outputs:any[]=[];
for(const [id,name] of [['form-01','weekly-memorandum-v1'],['form-04','weekly-memorandum-long-content']] as [string,string][]){
 const f=db.forms.find(x=>x.id===id)!;const v=db.versions.find(x=>x.id===f.templateVersionId)!;const t=db.templates.find(x=>x.id===f.templateId)!;const p=db.profiles.find(x=>x.id===f.profileId)!;const result=validateForm(f,v,p);if(!result.ready)throw new Error(`Fixture ${id} invalid`);const doc=snapshot(f,v,t,p,result);
 await fs.writeFile(path.join(dest,name+'.docx'),renderDocx(doc));await fs.writeFile(path.join(dest,name+'.json'),JSON.stringify(doc,null,2));try{await fs.writeFile(path.join(dest,name+'.pdf'),await renderPdf(doc));}catch(e){console.warn(`PDF sample not produced: ${e}`);}
 outputs.push({fixture:id,templateVersion:v.id,expectedNetHours:result.totalHours,docx:name+'.docx'});
}
await fs.writeFile(path.join(dest,'expected-outputs.json'),JSON.stringify(outputs,null,2));console.log('Generated',outputs);
