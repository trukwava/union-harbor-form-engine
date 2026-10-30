import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import child from 'node:child_process';
import {renderDocx} from './docx.js';
import {Snapshot} from './domain.js';
export async function renderPdf(s:Snapshot):Promise<any>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'union-harbor-pdf-'));
 try {const input=path.join(dir,'memo.docx');await fs.writeFile(input,renderDocx(s));
 await new Promise<void>((resolve,reject)=>{const bin=process.env.LIBREOFFICE_BIN||'libreoffice';const c=child.spawn(bin,['-env:UserInstallation=file://'+path.join(dir,'lo-profile'),'--headless','--convert-to','pdf','--outdir',dir,input],{stdio:'ignore'});const t=setTimeout(()=>{c.kill();reject(new Error('PDF conversion timed out'))},15000);c.on('error',e=>{clearTimeout(t);reject(e)});c.on('exit',code=>{clearTimeout(t);code===0?resolve():reject(new Error('PDF conversion failed'))});});
 return await fs.readFile(path.join(dir,'memo.pdf'));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
