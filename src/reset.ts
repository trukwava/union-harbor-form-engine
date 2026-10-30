import {Store} from './storage.js';
import path from 'node:path';
const root=path.resolve(process.cwd());
const store=new Store(process.env.DATA_FILE||path.join(root,'data','demo.json'));
await store.init();await store.reset();console.log('Reset synthetic demo data. Only this dedicated data file was changed.');
