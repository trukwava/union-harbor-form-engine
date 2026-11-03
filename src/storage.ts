import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {seed} from './fixtures.js';
import {DB} from './domain.js';

/**
 * Single-process, single-organization demo store.
 * Reads and writes share a queue so HTTP requests cannot observe an
 * intermediate in-memory mutation or overtake a pending commit.
 * Not a multi-process database or a production transaction engine.
 */
export class Store {
 file:string;
 queue:Promise<void>=Promise.resolve();
 constructor(file:string){this.file=file;}

 private ordered<T>(fn:()=>Promise<T>):Promise<T>{
  const work=this.queue.then(fn);
  this.queue=work.then(()=>{},()=>{});
  return work;
 }

 async init():Promise<void>{
  return this.ordered(async()=>{
   await fs.mkdir(path.dirname(this.file),{recursive:true});
   try{await fs.access(this.file);}
   catch(e:any){
    if(e?.code!=='ENOENT')throw e;
    await this.writeAtomic(seed());
   }
  });
 }

 private async readDisk():Promise<DB>{
  return JSON.parse(await fs.readFile(this.file,'utf8')) as DB;
 }
 async read():Promise<DB>{
  return this.ordered(()=>this.readDisk());
 }

 private async writeAtomic(data:DB):Promise<void>{
  await fs.mkdir(path.dirname(this.file),{recursive:true});
  const temporary=this.file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  let created=false;
  try{
   const handle=await fs.open(temporary,'wx',0o600);
   created=true;
   try{
    await handle.writeFile(JSON.stringify(data,null,2),'utf8');
    await handle.sync();
   }finally{await handle.close();}
   await fs.rename(temporary,this.file);
   // Best-effort directory sync: some platforms cannot fsync directories.
   try{
    const directory=await fs.open(path.dirname(this.file),'r');
    try{await directory.sync();}finally{await directory.close();}
   }catch{/* unsupported on some platforms */}
  }catch(error){
   if(created)await fs.unlink(temporary).catch(()=>{});
   throw error;
  }
 }
 async write(data:DB):Promise<void>{
  return this.ordered(()=>this.writeAtomic(data));
 }

 async transact<T>(fn:(data:DB)=>T|Promise<T>):Promise<T>{
  return this.ordered(async()=>{
   const data=await this.readDisk();
   const result=await fn(data);
   await this.writeAtomic(data);
   return result;
  });
 }

 async reset():Promise<void>{
  return this.ordered(()=>this.writeAtomic(seed()));
 }
}
