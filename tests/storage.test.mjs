import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Store} from '../dist/src/storage.js';

test('store persists queued transactions and does not lose updates',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uh-store-'));
 try{
  const file=path.join(dir,'data.json'),store=new Store(file);
  await store.init();
  const before=await store.read(),original=before.audit.length;
  const updates=Array.from({length:20},(_,i)=>store.transact(async db=>{
   if(i===0)await new Promise(resolve=>setTimeout(resolve,20));
   db.audit.push({id:'queue-'+i,at:'2026-01-01T00:00:00.000Z',entityType:'test',entityId:'queue',action:'queued'});
   return db.audit.length;
  }));
  const snapshot=store.read();
  await Promise.all(updates);
  assert.equal((await snapshot).audit.length,original+20,'read must not overtake pending writes');
  const reopened=new Store(file);
  assert.equal((await reopened.read()).audit.length,original+20,'commits persist across instances');
  const tmp=(await fs.readdir(dir)).filter(x=>x.endsWith('.tmp'));
  assert.deepEqual(tmp,[],'successful commits must not leave temp files');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('failed transaction does not mutate persisted state or stall queue',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uh-store-fail-'));
 try{
  const store=new Store(path.join(dir,'data.json'));
  await store.init();
  const before=await store.read();
  await assert.rejects(store.transact(db=>{db.audit.push({id:'bad',at:'2026-01-01T00:00:00.000Z',entityType:'test',entityId:'bad',action:'bad'});throw new Error('abort');}),/abort/);
  assert.deepEqual(await store.read(),before);
  await store.transact(db=>{db.audit.push({id:'good',at:'2026-01-01T00:00:00.000Z',entityType:'test',entityId:'good',action:'good'});});
  const after=await store.read();
  assert.equal(after.audit.length,before.audit.length+1);
  assert.equal(after.audit.at(-1).id,'good');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
