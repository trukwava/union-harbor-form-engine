import fs from 'node:fs/promises';
import path from 'node:path';
import {seed} from './fixtures.js';
import {DB} from './domain.js';
export class Store {
 file:string; queue:Promise<any>=Promise.resolve();
 constructor(file:string){this.file=file;}
 async init(){await fs.mkdir(path.dirname(this.file),{recursive:true});try {await fs.access(this.file);}catch{await this.write(seed());}}
 async read():Promise<DB>{return JSON.parse(await fs.readFile(this.file,'utf8'));}
 async write(data:DB):Promise<void>{await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+process.pid+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2),'utf8');await fs.rename(tmp,this.file);}
 async transact<T>(fn:(data:DB)=>T|Promise<T>):Promise<T>{const work=this.queue.then(async()=>{const data=await this.read();const result=await fn(data);await this.write(data);return result;});this.queue=work.catch(()=>{});return work;}
 async reset(){return this.transact(db=>{Object.assign(db,seed());return {ok:true};});}
}
