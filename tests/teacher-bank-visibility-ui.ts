import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createApp } from '../server/app';

const directory=mkdtempSync(join(tmpdir(),'teacher-bank-visible-'));
let server=await createApp({directory});
const call=async(url:string,method='GET',payload?:any,token?:string)=>{
 const result=await server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
 assert.equal(result.statusCode,200,result.body);return result.json();
};
const vite=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','lucide-react','motion/react','katex','driver.js','gsap']}});
let browser;
try {
 await call('/api/setup','POST',{school:'مدرسة اختبار ظهور الامتحانات',password:'Visibility123'});
 const admin=(await call('/api/login','POST',{role:'teacher',password:'Visibility123'})).token;
 const student=await call('/api/students','POST',{id:'school-student',name:'سارة أحمد',grade:'العاشر الأساسي',section:'الشعبة أ'},admin);
 await call('/api/students','POST',{id:'other-grade',name:'طالب صف آخر',grade:'التاسع',section:'ب'},admin);
 const teachers=[];
 for(const username of ['math','science','unrelated']) {
  const account=await call('/api/teachers','POST',{username,name:username,password:'Visibility123',classes:[username==='unrelated'?'["9","ب"]':'["10","ا"]']},admin);
  const token=(await call('/api/login','POST',{role:'teacher',username,password:'Visibility123'})).token;
  const grade=username==='unrelated'?'التاسع':'الصف العاشر';
  const imported=await call('/api/bank/import/commit','POST',{data:{version:1,batchId:`bank-${username}`,book:{title:`بنك ${username}`,subject:username==='math'?'رياضيات':'علوم',grade,term:'الأول',pageCount:2},questions:[1,2,3].map(n=>({id:`q${n}`,text:`سؤال بنك ${username} رقم ${n}`,options:['4','3','2','1'],correct:0,explanation:'الجواب أربعة',page:1,difficulty:'سهل',chapter:'الوحدة الأولى',evidence:'مراجعة',requiresImage:false,box:null}))}},token);
  const questions=await call(`/api/books/${imported.bookId}/questions`,'GET',undefined,token);
  for(const q of questions)await call(`/api/bank/${q.id}`,'PUT',{...q,status:'approved'},token);
  const exam=await call('/api/bank/exam','POST',{bookId:imported.bookId,count:2,title:`امتحان بنك ${username}`,section:username==='unrelated'?'ب':'A'},token);
  assert.ok(exam.delivery,'Bank draft must use random question delivery');
  assert.ok(exam.questions.every((q:any)=>q.bankId));
  teachers.push({account,token,exam});
 }
 const session=await call('/api/login','POST',{role:'student',code:student.code});
 assert.equal((await call('/api/exams','GET',undefined,session.token)).length,0,'Drafts stay private');
 const {exam:other,token:otherToken}=teachers[2];await call(`/api/exams/${other.id}/publish`,'POST',{},otherToken);
 assert.equal((await call('/api/exams','GET',undefined,session.token)).length,0,'Other classes stay private');
 await vite.listen();
 const base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(s=>{sessionStorage.setItem('student-session',JSON.stringify(s));sessionStorage.setItem('school-token',s.token);},session);
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const result=await server.app.inject({url:url.pathname+url.search,method:req.method() as any,payload:req.postData()||undefined,headers:{authorization:req.headers().authorization||'',...(req.postData()?{'content-type':'application/json'}:{})}});
  await route.fulfill({status:result.statusCode,contentType:'application/json',body:result.body});
 });
 await page.goto(base);
 await page.locator('.zunis-splash button').click();
 await page.getByRole('heading',{name:'أهلًا بك، سارة'}).waitFor();
 assert.equal(await page.locator('.student-exam-card').count(),0);
 for(const {token,exam} of teachers.slice(0,2))await call(`/api/exams/${exam.id}/publish`,'POST',{},token);
 await page.getByText('امتحان بنك math',{exact:true}).first().waitFor({timeout:15000});
 await page.getByText('امتحان بنك science',{exact:true}).first().waitFor({timeout:15000});
 assert.equal(await page.getByText('امتحان بنك unrelated',{exact:true}).count(),0);
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/teacher-bank-student-visible.png',fullPage:true});
 const exams=await call('/api/exams','GET',undefined,session.token);
 assert.equal(exams.length,2);assert.ok(exams.every((e:any)=>e.questions.length===0));
 const started=await call('/api/attempts/start','POST',{examId:teachers[0].exam.id,cameraAvailable:false},session.token);
 assert.equal(started.attempt.examId,teachers[0].exam.id);assert.equal(started.questions.length,2);
 assert.ok(started.questions.every((q:any)=>q.text.includes('math')),'Student gets the selected teacher bank, never another subject');
 await call(`/api/attempts/${started.attempt.id}/answers`,'PUT',{answers:started.questions.map((q:any)=>({questionId:q.id,choice:0,revision:1}))},session.token);
 await call(`/api/attempts/${started.attempt.id}/submit`,'POST',{},session.token);
 assert.equal((await call('/api/attempts','GET',undefined,teachers[0].token))[0].score,20);
 assert.equal((await call('/api/attempts','GET',undefined,teachers[1].token)).length,0,'Teacher results stay isolated');
 await page.close();await server.app.close();server=await createApp({directory});
 const resumed=await call('/api/login','POST',{role:'student',code:student.code});
 assert.equal((await call('/api/exams','GET',undefined,resumed.token)).length,2);
 assert.equal((await call('/api/attempts','GET',undefined,resumed.token)).length,1);
 assert.deepEqual(errors,[]);
 console.log('Teacher-bank visibility passed: two non-admin teachers, imported/approved banks, random drafts hidden until publish, already-signed-in student receives both exams without reload, other class hidden, correct selected bank, teacher-scoped results and restart persistence; no browser errors.');
} finally { await browser?.close();await vite.close();await server.app.close();rmSync(directory,{recursive:true,force:true}); }
