import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import ExcelJS from 'exceljs';
import {createApp} from '../server/app';
import {readDatabaseWorkbook} from '../server/databaseWorkbook';
import {openStore} from '../server/store';
import {openTenantStores} from '../server/tenants';
import {defaultAppearance,examPalettes,appearanceReadable} from '../src/examAppearance';
import {bankPrompt} from '../src/bankExchange';
export function testAudio() {
  const b=Buffer.alloc(16044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);for(let i=0;i<8000;i++)b.writeInt16LE(Math.round(Math.sin(i*Math.PI/8)*5000),44+i*2);
  return {name:'تعليمات.wav',data:'data:audio/wav;base64,'+b.toString('base64')};
}
test('question quality guide covers grounding, meaningful distractors, math validation and honest diagrams',()=>{
  const prompt=bankPrompt({title:'كتاب',subject:'فيزياء',grade:'10',term:'الأول'},100,'1-20','مختلط');
  for(const phrase of ['مخطط تغطية','المجال والجذور','عدم تكافؤ خيارين'])assert.ok(prompt.includes(phrase),phrase);
  assert.match(prompt,/لا تكرر الفكرة نفسها/);assert.match(prompt,/لا تزعم التحقق الآلي/);
  assert.ok(examPalettes.every(p=>appearanceReadable({...defaultAppearance,...p})));
  assert.equal(appearanceReadable({...defaultAppearance,accent:'#ffffff'}),false);
});
test('exam appearance and validated audio persist, hydrate offline student responses, and stay scoped',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'exam-media-')),server=await createApp({directory});
  const call=(url:string,method='GET',payload?:any,token?:string)=>server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
  try {
    await call('/api/setup','POST',{school:'مدرسة',password:'Media-test123'});const teacher=(await call('/api/login','POST',{role:'teacher',password:'Media-test123'})).json().token;
    const audio=testAudio(),appearance={...defaultAppearance,accent:examPalettes[1].accent,background:examPalettes[1].background,fontSize:'large'};
    const input={title:'استماع',subject:'عربي',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:30,total:20,difficulty:'سهل',cameraRequired:false,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),appearance,audio,questions:[{id:'q1',text:'استمع ثم اختر الإجابة',options:['أ','ب','ج','د'],correct:1,explanation:'تفسير',page:1,audio}]};
    assert.equal((await call('/api/exams','POST',{...input,appearance:{...appearance,accent:'#ffffff'}},teacher)).statusCode,400);
    assert.equal((await call('/api/exams','POST',{...input,audio:{name:'bad',data:'data:audio/wav;base64,YmFk'}},teacher)).statusCode,400);
    assert.equal(server.store.all('assets').length,0);
    const created=await call('/api/exams','POST',input,teacher);assert.equal(created.statusCode,200,created.body);const exam=created.json();
    assert.equal(exam.audio.data,undefined);assert.match(exam.audio.id,/^[a-f0-9]{32}$/);assert.equal(exam.questions[0].audio.id,exam.audio.id);assert.equal(server.store.all('assets').length,1);
    await call(`/api/exams/${exam.id}/publish`,'POST',{},teacher);
    const student=(await call('/api/students','POST',{id:'media-student',name:'طالب',grade:'10',section:'أ'},teacher)).json();
    const token=(await call('/api/login','POST',{role:'student',code:student.code})).json().token;
    assert.equal((await call(`/api/exam-audio/${exam.audio.id}`,'GET',undefined,token)).statusCode,403);
    const listing=(await call('/api/exams','GET',undefined,token)).json();assert.equal(listing[0].audio,undefined);assert.equal(listing[0].questions.length,0);
    const start=await call('/api/attempts/start','POST',{examId:exam.id,cameraAvailable:false},token);assert.equal(start.statusCode,200,start.body);
    assert.deepEqual(start.json().exam.appearance,appearance);assert.equal(start.json().exam.audio.data,audio.data);assert.equal(start.json().questions[0].audio.data,audio.data);assert.equal(start.json().questions[0].correct,undefined);
    assert.equal((await call(`/api/exam-audio/${exam.audio.id}`,'GET',undefined,token)).json().data,audio.data);
    const resumed=(await call(`/api/attempts/${start.json().attempt.id}`,'GET',undefined,token)).json();assert.equal(resumed.questions[0].audio.data,audio.data);assert.deepEqual(resumed.exam.appearance,appearance);
    await call('/api/teachers','POST',{username:'media-other',name:'آخر',password:'Other-media123'},teacher);const other=(await call('/api/login','POST',{role:'teacher',username:'media-other',password:'Other-media123'})).json().token;
    assert.equal((await call(`/api/exam-audio/${exam.audio.id}`,'GET',undefined,other)).statusCode,404);
    assert.equal((await call(`/api/records/assets/${exam.audio.id}`,'DELETE',{confirm:true},teacher)).statusCode,409);
  } finally{await server.app.close();rmSync(directory,{recursive:true,force:true});}
});
test('deletion guards active work, preserves dependent records in trash and restores them atomically',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'trash-test-')),server=await createApp({directory});
  const call=(url:string,method='GET',payload?:any,token?:string)=>server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
  try {
    await call('/api/setup','POST',{school:'مدرسة',password:'Trash-test123'});const teacher=(await call('/api/login','POST',{role:'teacher',password:'Trash-test123'})).json().token;
    const s=(await call('/api/students','POST',{id:'trash-student',name:'طالب محذوف',grade:'10',section:'أ'},teacher)).json();
    const bank={id:'a'.repeat(32),title:'بنك محذوف',grade:'10',subject:'رياضيات',term:'الأول',pageCount:1,manual:true};server.store.put('books',bank);
    const q={id:'bq1',bookId:bank.id,text:'ما حاصل جمع 2 و3؟',options:['1','3','5','7'],correct:2,explanation:'جمع',status:'approved',page:1};server.store.put('bank_questions',q);
    const input={title:'امتحان للحذف',subject:'رياضيات',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:30,total:20,difficulty:'سهل',cameraRequired:false,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),questions:[{...q,bankId:q.id}]};
    const exam=(await call('/api/exams','POST',input,teacher)).json();await call(`/api/exams/${exam.id}/publish`,'POST',{},teacher);
    const token=(await call('/api/login','POST',{role:'student',code:s.code})).json().token;const attempt=(await call('/api/attempts/start','POST',{examId:exam.id,cameraAvailable:false},token)).json().attempt;
    assert.equal((await call(`/api/records/exams/${exam.id}`,'DELETE',{confirm:true},teacher)).statusCode,409);
    assert.equal((await call(`/api/records/books/${bank.id}`,'DELETE',{confirm:true},teacher)).statusCode,409);
    assert.equal((await call(`/api/records/students/${s.id}`,'DELETE',{confirm:true},token)).statusCode,403);
    await call(`/api/attempts/${attempt.id}/answers`,'PUT',{answers:[{questionId:q.id,choice:2,revision:1}]},token);await call(`/api/attempts/${attempt.id}/submit`,'POST',{},token);
    const removedBank=await call(`/api/records/books/${bank.id}`,'DELETE',{confirm:true},teacher);assert.equal(removedBank.statusCode,200,removedBank.body);
    assert.equal(server.store.get('books',bank.id),null);assert.equal(server.store.get('bank_questions',q.id),null);assert.equal(server.store.get('exams',exam.id).questions[0].text,q.text);assert.equal(server.store.get('exams',exam.id).questions[0].bankId,undefined);
    assert.equal((await call(`/api/trash/${removedBank.json().trashId}/restore`,'POST',{},teacher)).statusCode,200);assert.ok(server.store.get('bank_questions',q.id));
    const removedExam=await call(`/api/records/exams/${exam.id}`,'DELETE',{confirm:true},teacher);assert.equal(removedExam.statusCode,200,removedExam.body);assert.equal(server.store.get('attempts',attempt.id),null);
    await call(`/api/trash/${removedExam.json().trashId}/restore`,'POST',{},teacher);assert.equal(server.store.get('attempts',attempt.id).score,20);
    assert.equal((await call(`/api/records/students/${s.id}`,'DELETE',{confirm:true},teacher)).statusCode,409);
    await call('/api/logout','POST',{password:'Trash-test123'},token);
    const removedStudent=await call(`/api/records/students/${s.id}`,'DELETE',{confirm:true},teacher);assert.equal(removedStudent.statusCode,200,removedStudent.body);
    assert.equal(server.store.get('attempts',attempt.id),null);await call(`/api/trash/${removedStudent.json().trashId}/restore`,'POST',{},teacher);assert.equal(server.store.get('students',s.id).code,s.code);assert.equal(server.store.get('attempts',attempt.id).score,20);
    const last=await call(`/api/records/exams/${exam.id}`,'DELETE',{confirm:true},teacher);const purge=await call(`/api/trash/${last.json().trashId}`,'DELETE',{confirm:true},teacher);assert.equal(purge.statusCode,200);assert.equal((await call(`/api/trash/${last.json().trashId}/restore`,'POST',{},teacher)).statusCode,404);
  } finally{await server.app.close();rmSync(directory,{recursive:true,force:true});}
});
test('whole-school Excel backup round-trips original SQLite files for every account and verifies tampering',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'whole-db-')),output=mkdtempSync(join(tmpdir(),'whole-db-restore-')),server=await createApp({directory});
  const call=(url:string,method='GET',payload?:any,token?:string)=>server.app.inject({url,method:method as any,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
  try {
    await call('/api/setup','POST',{school:'مدرسة النسخ',password:'Backup-test123'});const teacher=(await call('/api/login','POST',{role:'teacher',password:'Backup-test123'})).json().token;
    server.store.put('students',{id:'original',name:'أصلي 😀'.repeat(15000),grade:'10',section:'أ',code:'123456'});
    server.store.put('assets',{id:'audio-db',mediaKind:'exam-audio',data:testAudio().data});
    const account=(await call('/api/teachers','POST',{username:'backup-other',name:'معلم ثان',password:'Backup-other123'},teacher)).json();
    const otherStore=openStore(join(directory,'teachers',account.id));otherStore.put('students',{id:'other-student',name:'طالب الحساب الآخر',grade:'8',section:'ب',code:'654321'});otherStore.db.close();
    const other=(await call('/api/login','POST',{role:'teacher',username:'backup-other',password:'Backup-other123'})).json().token;
    assert.equal((await call('/api/exports/database','GET',undefined,other)).statusCode,403);
    const response=await call('/api/exports/database','GET',undefined,teacher);assert.equal(response.statusCode,200,response.body.slice(0,200));const bytes=Buffer.from(response.json().data,'base64'),files=await readDatabaseWorkbook(bytes);
    assert.equal(files.filter(f=>f.path.endsWith('.sqlite')).length,3);
    for(const file of files){const path=join(output,file.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,file.bytes);}
    const restored=openTenantStores(output);try{assert.ok(restored.verify('admin','Backup-test123'));assert.ok(restored.verify('backup-other','Backup-other123'));assert.equal(restored.forTeacher(account.id).get('students','other-student').code,'654321');assert.equal(restored.forTeacher('master').get('assets','audio-db').data,testAudio().data);assert.equal(restored.forTeacher('master').get('students','original').name,'أصلي 😀'.repeat(15000));}finally{restored.close();}
    const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as any);assert.equal(book.getWorksheet('كل الطلاب')!.rowCount,3);book.getWorksheet('Database Chunks')!.getRow(2).getCell(3).value='AAAA';
    const corrupt=Buffer.from(await book.xlsx.writeBuffer());await assert.rejects(()=>readDatabaseWorkbook(corrupt),/سلامة|غير صالح/);
  } finally{await server.app.close();rmSync(directory,{recursive:true,force:true});rmSync(output,{recursive:true,force:true});}
});
