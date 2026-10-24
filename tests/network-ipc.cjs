const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline');
const {mkdtempSync,mkdirSync,rmSync,writeFileSync} = require('node:fs');
const {resolve,join} = require('node:path');
const dgram = require('node:dgram');
(async()=>{
 mkdirSync('.data',{recursive:true}); const directory=mkdtempSync(resolve('.data/network-ipc-'));
 const socket=dgram.createSocket('udp4');await new Promise(r=>socket.bind(0,'127.0.0.1',r));const port=socket.address().port-1;socket.close();
 const children=[];
 function client(name){let next=0,resolveReady,rejectReady,log='';const pending=new Map();const ready=new Promise((r,j)=>{resolveReady=r;rejectReady=j});
  const child=spawn(process.execPath,process.env.NETWORK_TEST_COMPILED==='1'?['desktop/backend.cjs']:['--import','tsx','desktop/backend.ts'],{cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,SCHOOL_TEST_MODE:'1',SCHOOL_TEST_PORT:String(port),SCHOOL_DESKTOP_DATA_DIR:join(directory,name)}});children.push(child);
  child.stderr.on('data',data=>log+=data); const send=m=>child.stdin.write(JSON.stringify(m)+'\n');
  createInterface({input:child.stdout}).on('line',line=>{try{const m=JSON.parse(line);if(m.nativeId)send({nativeId:m.nativeId,result:true});else if(m.event==='ready')resolveReady();else if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}catch(e){rejectReady(e)}});
  child.on('exit',()=>{rejectReady(Error(log));for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(log))}});
  const rpc=(method,...args)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>reject(Error(`Timeout ${method}: ${log}`)),30000);pending.set(id,{resolve,reject,timer});send({id,method,args})});
  return {ready,rpc,child};
 }
 try{
  const teacher=client('teacher');await teacher.ready;const hosting=await teacher.rpc('host');assert.ok(hosting.pairCode);
  let network=await teacher.rpc('network-state');assert.equal(network.hosting,true);assert.equal(network.pairingCode,hosting.pairCode);assert.ok(Array.isArray(network.adapters));
  const preferred=network.adapters[0]?.address||'';network=await teacher.rpc('network-preferences',preferred);assert.equal(network.preferredAddress,preferred);
  await assert.rejects(()=>teacher.rpc('network-preferences','198.51.100.123'),/غير متاحة/);
  const pupil=client('student');await pupil.ready;const devices=await pupil.rpc('discover');assert.ok(devices.length);assert.equal(devices.length,1,'Same teacher on multiple interfaces deduplicates');
  await assert.rejects(()=>pupil.rpc('connect-teacher',devices[0].host,'AAAA-AAAA-AAAA'),/غير صحيح/);
  const paired=await pupil.rpc('connect-teacher',devices[0].host,hosting.pairCode);assert.equal(paired.connected,true);
  const before=await pupil.rpc('connection-state');await pupil.rpc('network-preferences','');const after=await pupil.rpc('connection-state');assert.equal(after.host,before.host);assert.equal(after.fingerprint,before.fingerprint);assert.equal(after.connected,true);
  assert.ok((await pupil.rpc('request','/api/status')).school);
  if(network.adapters.length){
   mkdirSync(join(directory,'stale','school'),{recursive:true});
   writeFileSync(join(directory,'stale','school','connection-mode'),'plain');
   writeFileSync(join(directory,'stale','school','connection'),JSON.stringify({host:'192.0.2.125',fingerprint:hosting.fingerprint,localHost:false}));
   const stale=client('stale');await stale.ready;const recovered=await stale.rpc('connection-state');assert.equal(recovered.connected,true);assert.notEqual(recovered.host,'192.0.2.125');assert.equal(recovered.fingerprint,hosting.fingerprint);await stale.rpc('shutdown');
  }

  await assert.rejects(()=>pupil.rpc('host'),/مرتبط بالجهاز الرئيسي/);
  await pupil.rpc('shutdown');await teacher.rpc('shutdown');
  const restored=client('teacher');await restored.ready;assert.equal((await restored.rpc('network-state')).preferredAddress,preferred);await restored.rpc('shutdown');
  console.log('Network desktop IPC passed: adapter inventory, persisted preferences, multi-interface discovery, secure pairing, unchanged live connection, request transport, second-host prevention.');
 }finally{for(const child of children){if(child.exitCode===null)child.kill();}await new Promise(r=>setTimeout(r,300));rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
