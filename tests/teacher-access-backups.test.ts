import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,readFileSync,existsSync,renameSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app';
import {openTenantStores} from '../server/tenants';
import {localSecretProtection} from '../server/secrets';
import {createSnapshotBackups,decryptBackup,encryptBackup,applyPendingRestore} from '../server/snapshotBackups';
import {backupProtectionFile} from '../server/databaseWorkbook';

test('teacher QR access is private, scoped, revocable and invalidated by password changes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'teacher-qr-'));let server=await createApp({directory});
 const call=async(url:string,method='GET',payload?:any,token?:string)=>server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
 try{
  await call('/api/setup','POST',{school:'QR School',password:'Teacher123'});
  const teacher=(await call('/api/login','POST',{role:'teacher',password:'Teacher123'})).json();
  assert.equal((await call('/api/account/qr','POST',{password:'wrong'},teacher.token)).statusCode,403);
  const key=(await call('/api/account/qr','POST',{password:'Teacher123'},teacher.token)).json();
  assert.equal((await call('/api/login','POST',{role:'teacher',qrToken:key.token})).statusCode,200);
  assert.equal((await call('/api/login','POST',{role:'teacher',qrToken:key.token+'x'})).statusCode,401);
  assert.equal('loginQr' in key.account,false);
  assert.equal('password' in key.account,false);
  const replacement=(await call('/api/account/qr','POST',{password:'Teacher123'},teacher.token)).json();
  assert.equal((await call('/api/login','POST',{role:'teacher',qrToken:key.token})).statusCode,401);
  await server.app.close();server=await createApp({directory});
  const resumed=(await call('/api/login','POST',{role:'teacher',qrToken:replacement.token})).json();
  assert.equal(resumed.role,'teacher');assert.equal(resumed.teacherId,'master');
  await call('/api/account/qr','DELETE',{password:'Teacher123'},resumed.token);
  assert.equal((await call('/api/login','POST',{role:'teacher',qrToken:replacement.token})).statusCode,401);
  const third=(await call('/api/account/qr','POST',{password:'Teacher123'},resumed.token)).json();
  const changed=await call('/api/account','PUT',{name:'Teacher',currentPassword:'Teacher123',password:'Changed123'},resumed.token);
  assert.equal(changed.statusCode,200,changed.body);
  assert.equal((await call('/api/login','POST',{role:'teacher',qrToken:third.token})).statusCode,401);
 }finally{await server.app.close();rmSync(directory,{recursive:true,force:true});}
});

test('full encrypted dated backups preserve every SQLite account and restore on next startup',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'snapshot-school-')),cloud=mkdtempSync(join(tmpdir(),'snapshot-cloud-'));
 let server=await createApp({directory});
 const call=async(url:string,method='GET',payload?:any,token?:string)=>server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
 try{
  await call('/api/setup','POST',{school:'Snapshot School',password:'Teacher123'});
  let admin=(await call('/api/login','POST',{role:'teacher',password:'Teacher123'})).json().token;
  await call('/api/students','POST',{id:'s1',name:'Original Student',grade:'10',section:'أ'},admin);
  const other=(await call('/api/teachers','POST',{username:'other',name:'Other Teacher',password:'Other1234',classes:['["10","ا"]']},admin)).json();
  assert.ok(other.id);
  const otherToken=(await call('/api/login','POST',{role:'teacher',username:'other',password:'Other1234'})).json().token;
  await call('/api/books/manual','POST',{title:'Other bank',subject:'رياضيات',grade:'10',term:'الأول'},otherToken);
  assert.equal((await call('/api/backups', 'GET',undefined,otherToken)).statusCode,403);
  assert.equal((await call('/api/backups/config','PUT',{enabled:true,mode:'changes',time:'16:00',folder:cloud,password:'Portable backup phrase'},admin)).statusCode,200);
  const first=await call('/api/backups/run','POST',{},admin);assert.equal(first.statusCode,200,first.body);
  const id=first.json().id;
  const history=(await call('/api/backups','GET',undefined,admin)).json();
  assert.equal(history.snapshots[0].local,true);assert.equal(history.snapshots[0].cloud,true);
  assert.equal(history.config.sealedPassword,undefined);
  const bytes=readFileSync(join(cloud,`school-${id}.ashb`));
  assert.equal(bytes.includes(Buffer.from('Original Student')),false);
  const files=await decryptBackup(bytes,'Portable backup phrase');assert.ok(files.some(f=>f.path===`teachers/${other.id}/school.sqlite`));
  await assert.rejects(decryptBackup(bytes,'Wrong backup phrase'));
  const bad=JSON.parse(bytes.toString());bad.data=(bad.data[0]==='A'?'B':'A')+bad.data.slice(1);
  await assert.rejects(decryptBackup(Buffer.from(JSON.stringify(bad)),'Portable backup phrase'));
  await call('/api/students','POST',{id:'s2',name:'Added After Backup',grade:'10',section:'أ'},admin);
  assert.equal((await call(`/api/backups/${id}/restore`,'POST',{currentPassword:'wrong',backupPassword:'Portable backup phrase'},admin)).statusCode,403);
  const wrongPhrase=await call(`/api/backups/${id}/restore`,'POST',{currentPassword:'Teacher123',backupPassword:'Wrong backup phrase'},admin);
  assert.equal(wrongPhrase.statusCode,400);assert.match(wrongPhrase.json().error,/عبارة النسخ/);
  const restored=await call(`/api/backups/${id}/restore`,'POST',{currentPassword:'Teacher123',backupPassword:'Portable backup phrase'},admin);
  assert.equal(restored.statusCode,200,restored.body);
  assert.equal((await call('/api/students','POST',{id:'s3',name:'Blocked',grade:'10',section:'أ'},admin)).statusCode,409);
  await server.app.close();server=await createApp({directory});
  admin=(await call('/api/login','POST',{role:'teacher',password:'Teacher123'})).json().token;
  const students=(await call('/api/students','GET',undefined,admin)).json();assert.equal(students.length,1);assert.equal(students[0].id,'s1');
  const otherAgain=(await call('/api/login','POST',{role:'teacher',username:'other',password:'Other1234'})).json().token;
  const books=(await call('/api/books','GET',undefined,otherAgain)).json();assert.equal(books.length,1);assert.equal(books[0].title,'Other bank');
  assert.ok(existsSync(join(directory,'before-restore',id,'school.sqlite')));
  assert.equal(existsSync(join(directory,'pending-school-restore.json')),false);
 }finally{await server.app.close();rmSync(directory,{recursive:true,force:true});rmSync(cloud,{recursive:true,force:true});}
});

test('a cloud-folder-only snapshot restores on another machine and resets its old sealed backup phrase',async()=>{
 const source=mkdtempSync(join(tmpdir(),'snapshot-source-')),target=mkdtempSync(join(tmpdir(),'snapshot-target-')),cloud=mkdtempSync(join(tmpdir(),'snapshot-transfer-'));
 let first=openTenantStores(source),second=openTenantStores(target);
 try{
  first.create('source','Source Teacher','Source123',true);
  const protection=localSecretProtection(source);
  const original=createSnapshotBackups({directory:source,protection,snapshot:()=>[...first.databaseSnapshot(),...backupProtectionFile(source)],canRun:()=>{}});
  original.configure({password:'Portable backup phrase',folder:cloud});const snapshot=await original.run();
  second.create('target','Target Teacher','Target123',true);
  const manager=createSnapshotBackups({directory:target,protection:localSecretProtection(target),snapshot:()=>second.databaseSnapshot(),canRun:()=>{}});
  manager.configure({enabled:true,password:'Different target phrase',folder:cloud});
  assert.equal(manager.history()[0].local,false);assert.equal(manager.history()[0].cloud,true);
  await manager.stageRestore(snapshot.id,'Portable backup phrase');second.close();
  assert.equal(applyPendingRestore(target),true);second=openTenantStores(target);
  assert.equal(second.account('master')?.name,'Source Teacher');
  const recovered=createSnapshotBackups({directory:target,protection:localSecretProtection(target),snapshot:()=>second.databaseSnapshot(),canRun:()=>{}});
  assert.equal(recovered.config().hasPassword,false);assert.equal(recovered.config().enabled,false);
  recovered.configure({enabled:true,password:'Portable backup phrase'});await recovered.run();
 }finally{first.close();second.close();for(const directory of [source,target,cloud])rmSync(directory,{recursive:true,force:true});}
});

test('scheduled backups defer active exams, preserve edits during encryption, and retry cloud folder copies',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'snapshot-schedule-')),cloudParent=mkdtempSync(join(tmpdir(),'snapshot-drive-')),cloud=join(cloudParent,'sync');mkdirSync(cloud);
 const tenancy=openTenantStores(directory);let clock=new Date(2026,9,20,16,1).getTime(),active=false;
 try{
  tenancy.create('admin','Admin','Teacher123',true);
  const manager=createSnapshotBackups({directory,protection:localSecretProtection(directory),snapshot:()=>tenancy.databaseSnapshot(),canRun:()=>{if(active)throw Error('active exams');},now:()=>clock});
  manager.configure({enabled:true,mode:'changes',time:'16:00',folder:cloud,password:'Portable backup phrase'});
  manager.markChanged();clock+=300001;active=true;await manager.tick();assert.equal(manager.history().length,0);
  active=false;const taking=manager.run();manager.markChanged();await taking;clock+=300001;await manager.tick();assert.equal(manager.history().length,2);
  renameSync(cloud,cloud+'-offline');clock++;await manager.run();assert.equal(manager.history().filter(s=>s.local).length,3);assert.match(manager.config().lastError!,/محلي/);
  renameSync(cloud+'-offline',cloud);await manager.syncCloud();assert.equal(manager.history().every(s=>s.local&&s.cloud),true);
  manager.configure({mode:'daily',time:'16:00'});clock+=86400000;await manager.tick();const total=manager.history().length;await manager.tick();assert.equal(manager.history().length,total);
  const files=tenancy.databaseSnapshot();const bad=await encryptBackup([...files,{path:'../outside.sqlite',bytes:Buffer.from('x')}],'Portable backup phrase');await assert.rejects(decryptBackup(bad,'Portable backup phrase'));
 }finally{tenancy.close();rmSync(directory,{recursive:true,force:true});rmSync(cloudParent,{recursive:true,force:true});}
});
