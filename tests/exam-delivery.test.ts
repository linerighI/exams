import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { assignQuestions, combinations, deliveryCapacity } from '../server/examDelivery';
import { geometryCommands } from '../src/geometry';

test('balanced random assignments are unique, private, persistent, correctly graded and scoped to assigned questions', async()=>{
  const directory=mkdtempSync(join(tmpdir(),'exam-delivery-'));
  let server=await createApp({directory});
  const call=async(url:string,method='GET',payload?:any,token?:string)=>{
    const r=await server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
    return {status:r.statusCode,data:r.json()};
  };
  const login=async()=> (await call('/api/login','POST',{role:'teacher',password:'Delivery-test123'})).data.token;
  try {
    await call('/api/setup','POST',{school:'مدرسة الاختبار',password:'Delivery-test123'});
    let teacher=await login();
    const students=[];
    for(let i=0;i<8;i++) students.push((await call('/api/students','POST',{id:`s${i}`,name:`طالب ${i}`,grade:'10',section:'أ'},teacher)).data);
    const questions=Array.from({length:7},(_,i)=>({id:`q${i}`,text:`السؤال الرياضي رقم ${i}`,options:['0','1','2','3'],correct:i%4,explanation:'شرح خاص',page:1,chapter:i<4?'جبر':'هندسة',difficulty:i<4?'سهل':'صعب'}));
    const input={title:'نماذج متوازنة',subject:'رياضيات',grade:'10',section:'أ',term:'الأول',kind:'نهائي',duration:30,total:60,difficulty:'مختلط',cameraRequired:false,calculatorAllowed:true,geogebraAllowed:true,opensAt:new Date(Date.now()-10000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),questions,delivery:{mode:'random',count:3,quotas:[{chapter:'جبر',difficulty:'سهل',count:2},{chapter:'هندسة',difficulty:'صعب',count:1}]}};
    const exam=(await call('/api/exams','POST',input,teacher)).data;
    assert.equal(deliveryCapacity(exam),18n);
    assert.equal((await call(`/api/exams/${exam.id}/publish`,'POST',undefined,teacher)).status,200);
    const tokens=await Promise.all(students.map(async s=>(await call('/api/login','POST',{role:'student',code:s.code})).data.token));
    const starts=await Promise.all(tokens.map(token=>call('/api/attempts/start','POST',{examId:exam.id,cameraAvailable:false},token)));
    const sets=new Set<string>();
    for(const start of starts) {
      assert.equal(start.status,200);assert.equal(start.data.questions.length,3);
      assert.equal(start.data.questions.filter((q:any)=>q.chapter==='جبر'&&q.difficulty==='سهل').length,2);
      assert.equal(start.data.questions.filter((q:any)=>q.chapter==='هندسة'&&q.difficulty==='صعب').length,1);
      const signature=start.data.questions.map((q:any)=>q.id).sort().join(',');assert.ok(!sets.has(signature));sets.add(signature);
      assert.ok(start.data.questions.every((q:any)=>q.correct===undefined&&q.explanation===undefined));
      assert.equal(start.data.attempt.assignedQuestions,undefined);assert.equal(start.data.attempt.assignmentRank,undefined);
      assert.equal(start.data.attempt.questionCount,3);
      assert.equal(start.data.exam.calculatorAllowed,true);assert.equal(start.data.exam.geogebraAllowed,true);
    }
    const first=starts[0].data;
    const foreign=questions.find(q=>!first.questions.some((a:any)=>a.id===q.id))!;
    assert.equal((await call(`/api/attempts/${first.attempt.id}/answers`,'PUT',{answers:[{questionId:foreign.id,choice:foreign.correct,revision:1}]},tokens[0])).status,400);
    const repeated=await Promise.all([0,1,2].map(()=>call('/api/attempts/start','POST',{examId:exam.id,cameraAvailable:false},tokens[0])));
    for(const retry of repeated){assert.equal(retry.data.attempt.id,first.attempt.id);assert.deepEqual(retry.data.questions,first.questions);}
    assert.equal(server.store.all('attempts').length,8);
    await call(`/api/attempts/${first.attempt.id}/answers`,'PUT',{answers:first.questions.map((q:any)=>({questionId:q.id,choice:questions.find(a=>a.id===q.id)!.correct,revision:1}))},tokens[0]);
    const listing=(await call('/api/exams','GET',undefined,tokens[0])).data[0];assert.deepEqual(listing.questions,[]);assert.equal(listing.delivery.quotas,undefined);
    await server.app.close();server=await createApp({directory});teacher=await login();
    const token=(await call('/api/login','POST',{role:'student',code:students[0].code})).data.token;
    const restored=(await call(`/api/attempts/${first.attempt.id}`,'GET',undefined,token)).data;
    assert.deepEqual(restored.questions,first.questions);assert.equal(Object.keys(restored.attempt.answers).length,3);
    // Even an external edit to the pool cannot change this attempt's frozen answer key.
    const changed=server.store.get('exams',exam.id);changed.questions=changed.questions.map((q:any)=>({...q,correct:(q.correct+1)%4}));server.store.put('exams',changed);
    await call(`/api/attempts/${first.attempt.id}/submit`,'POST',undefined,token);
    assert.equal((await call(`/api/attempts/${first.attempt.id}`,'GET',undefined,teacher)).data.attempt.score,60);
    assert.equal((await call(`/api/attempts/${first.attempt.id}`,'GET',undefined,token)).data.attempt.score,null);
    await call(`/api/exams/${exam.id}/results`,'POST',undefined,teacher);
    assert.equal((await call(`/api/attempts/${first.attempt.id}`,'GET',undefined,token)).data.attempt.score,60);
    const backup=(await call('/api/backup','GET',undefined,teacher)).data;
    assert.ok(JSON.stringify(backup).includes('assignedQuestions'));
  } finally {await server.app.close();rmSync(directory,{recursive:true,force:true});}
});

test('all combinations are usable once; invalid distributions, duplicates and exhaustion never silently fall back',()=>{
  assert.equal(combinations(100,50),100891344545564193334812497256n);
  const exam:any={id:'e',questions:Array.from({length:5},(_,i)=>({id:`q${i}`,text:`محتوى ${i}`,chapter:'جبر',difficulty:'سهل'})),delivery:{mode:'random',count:2,quotas:[{chapter:'جبر',difficulty:'سهل',count:2}]}};
  const attempts:any[]=[];const signatures=new Set<string>();
  for(let i=0;i<10;i++){const assignment=assignQuestions(exam,attempts);attempts.push({examId:'e',...assignment});signatures.add(assignment.assignedQuestions!.map(q=>q.id).sort().join(','));}
  assert.equal(signatures.size,10);assert.throws(()=>assignQuestions(exam,attempts),/نفدت/);
  assert.throws(()=>deliveryCapacity({...exam,delivery:{...exam.delivery,count:3}}),/مجموع/);
  assert.throws(()=>deliveryCapacity({...exam,questions:[exam.questions[0],exam.questions[0]]}),/متكررة/);
  assert.throws(()=>deliveryCapacity({...exam,delivery:{...exam.delivery,count:6,quotas:[{chapter:'جبر',difficulty:'سهل',count:6}]}}),/غير كافية/);
});

// Scientific calculator behavior is covered against the current vendored engine in student-session.test.ts.
test('polynomial graph specifications are bounded',()=>{
  assert.deepEqual(geometryCommands({objects:[{type:'function',name:'f',coefficients:[1,-2,3]}]}),['f(x)=1-2*x^1+3*x^2']);
  assert.throws(()=>geometryCommands({objects:[{type:'function',name:'f',coefficients:[1001]}]}));
});
