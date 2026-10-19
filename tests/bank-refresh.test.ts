import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';

test('refresh repairs a corrupted draft while real bank changes still block random publication', async () => {
  const directory = mkdtempSync(join(tmpdir(),'bank-refresh-'));
  const server = await createApp({directory});
  const call = (url:string, method='GET', payload?:any, token?:string) => server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
  try {
    await call('/api/setup','POST',{school:'مدرسة الاختبار',password:'Refresh-test123'});
    const token=(await call('/api/login','POST',{role:'teacher',password:'Refresh-test123'})).json().token;
    const rows=[0,1].map(n=>({id:`bank-${n}`,bookId:'bank',text:`اختر معنى الكلمة رقم ${n}`,options:['فرحي','أملي','حزني','هدوئي'],correct:2,explanation:'شرح',page:1,difficulty:'سهل',chapter:'لغة',status:'approved'}));
    for(const q of rows)server.store.put('bank_questions',q);
    const selection=await call('/api/bank/selection','POST',{ids:rows.map(q=>q.id)},token);
    assert.equal(selection.statusCode,200);
    const input={title:'امتحان عربي',subject:'عربي',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:30,total:20,difficulty:'سهل',cameraRequired:false,opensAt:new Date(Date.now()-10000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),questions:selection.json().questions,delivery:{mode:'random',count:1,quotas:[{chapter:'لغة',difficulty:'سهل',count:1}]}};
    input.questions[0].options[2]='حزن��';
    const exam=(await call('/api/exams','POST',input,token)).json();
    const rejected=await call(`/api/exams/${exam.id}/publish`,'POST',{},token);
    assert.equal(rejected.statusCode,400);
    assert.match(rejected.json().error,/تغيّر سؤال/);
    const fresh=(await call('/api/bank/selection','POST',{ids:rows.map(q=>q.id)},token)).json().questions;
    input.questions=fresh.map((q:any,i:number)=>({...q,id:exam.questions[i].id}));
    assert.equal((await call(`/api/exams/${exam.id}`,'PUT',input,token)).statusCode,200);
    assert.equal((await call(`/api/exams/${exam.id}/publish`,'POST',{},token)).statusCode,200);
    assert.equal(server.store.get('exams',exam.id).questions[0].options[2],'حزني');
    assert.deepEqual(server.store.get('bank_questions',rows[0].id),rows[0]);
    const another=(await call('/api/exams','POST',input,token)).json();
    server.store.put('bank_questions',{...rows[0],correct:1});
    assert.equal((await call(`/api/exams/${another.id}/publish`,'POST',{},token)).statusCode,400);
  } finally {await server.app.close();rmSync(directory,{recursive:true,force:true});}
});
