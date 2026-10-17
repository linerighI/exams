const fs = require('node:fs');
const path = require('node:path');
const { root, dotnet, run } = require('./desktop-tools.cjs');
const { launch, freePort } = require('../tests/webview2-driver.cjs');
// Two isolated visible test clients share a private school server. No production data or sessions.
(async () => {
  if (!fs.existsSync(path.join(root,'dist/index.html')) || !fs.existsSync(path.join(root,'desktop/backend.cjs')))
    throw Error('Run npm run build first.');
  run(dotnet(), ['build','desktop/native/Alshereqi.Desktop.csproj','-c','Debug','-p:DesktopAutomation=true','-o','desktop/native/bin/dual']);
  fs.mkdirSync(path.join(root,'.data'),{recursive:true});
  const directory=fs.mkdtempSync(path.join(root,'.data/dual-demo-'));
  const port=String(await freePort());
  const environment={SCHOOL_APP_ROOT:root,SCHOOL_NODE_EXECUTABLE:process.execPath,SCHOOL_DEVELOPMENT:'1',SCHOOL_HEADLESS_TEST:'0',SCHOOL_TEST_PORT:port};
  const executablePath=path.join(root,'desktop/native/bin/dual/Alshereqi Exams.exe');
  const password='Demo12345';
  let teacher,student;
  const close=async()=>{await student?.close();await teacher?.close();};
  process.once('SIGINT',()=>{void close().finally(()=>process.exit(0));});
  process.once('SIGTERM',()=>{void close().finally(()=>process.exit(0));});
  try {
    teacher=await launch({visible:true,executablePath,args:['--demo-role','teacher'],env:{...environment,SCHOOL_TEST_DATA:path.join(directory,'teacher')}});
    const t=await teacher.firstWindow();
    await t.evaluate(()=>sessionStorage.setItem('zunis-welcome','1'));
    const host=await t.evaluate(()=>window.desktop.host());
    await t.evaluate(password=>window.desktop.request('/api/setup','POST',{school:'مدرسة تجريبية — اختبار المعلم والطالب',username:'admin',name:'المعلم التجريبي',password}),password);
    // Login through the UI so the React session and backend share the same authenticated state.
    await t.reload();
    await t.getByRole('button',{name:'تشغيل الجهاز الرئيسي'}).click();
    await t.getByLabel('كلمة مرور المعلم',{exact:true}).fill(password);
    await t.getByRole('button',{name:'دخول إلى مساحتي',exact:true}).click();
    await t.getByRole('heading',{name:'مرحبًا أستاذي، ماذا ننجز اليوم؟'}).waitFor();
    const fixture=await t.evaluate(async()=>{
      const student=await window.desktop.request('/api/students','POST',{id:'demo-student',name:'طالب تجريبي',grade:'العاشر',section:'أ'});
      const exam=await window.desktop.request('/api/exams','POST',{title:'امتحان تجريبي — رياضيات',subject:'الرياضيات',grade:'العاشر',section:'أ',term:'الأول',kind:'نصفي',duration:45,total:20,difficulty:'مختلط',cameraRequired:false,calculatorAllowed:true,geogebraAllowed:true,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+86400000).toISOString(),questions:[{id:'q1',text:'ما ناتج 7 + 5؟',options:['10','11','12','13'],correct:2,page:1,explanation:'7 + 5 = 12'},{id:'q2',text:'ما مساحة مربع طول ضلعه 4 سم؟',options:['8 سم²','12 سم²','16 سم²','20 سم²'],correct:2,page:1,explanation:'المساحة = طول الضلع × نفسه'},{id:'q3',text:'حل المعادلة: x + 3 = 8',options:['3','4','5','6'],correct:2,page:1,explanation:'نطرح 3 من الطرفين'}]});
      await window.desktop.request(`/api/exams/${exam.id}/publish`,'POST',{approved:true});
      return {student,exam};
    });
    student=await launch({visible:true,executablePath,args:['--demo-role','student'],env:{...environment,SCHOOL_TEST_DATA:path.join(directory,'student')}});
    const s=await student.firstWindow();
    await s.evaluate(async ({host})=>{sessionStorage.setItem('zunis-welcome','1');await window.desktop.connectTeacher('127.0.0.1',host.pairCode);localStorage.setItem('school-scope',host.fingerprint);},{host});
    await s.reload();
    await s.locator('.mode-switch button').nth(1).click();
    await s.getByLabel('الرقم الوطني أو رمز الطالب').fill(fixture.student.code);
    await s.getByRole('button',{name:'دخول إلى مساحتي',exact:true}).click();
    await s.locator('.exam-card').filter({hasText:fixture.exam.title}).getByRole('button',{name:'ابدأ الامتحان',exact:true}).click();
    await s.locator('.exam-status-indicator').waitFor();
    await t.locator('.sidebar nav').getByRole('button',{name:'المتابعة والنتائج',exact:true}).click();
    const attempts=await t.evaluate(()=>window.desktop.request('/api/attempts'));
    if(attempts.length!==1 || attempts[0].studentId!==fixture.student.id)throw Error('The student attempt did not reach the teacher.');
    console.log('READY: teacher on the left, student on the right. Both use the same isolated test school.');
    console.log('Teacher username: admin | Password / student logout password: '+password);
    console.log('Student login code: '+fixture.student.code);
    console.log('Desktop lockdown is disabled only in these clearly labelled test windows.');
    console.log('Close the student window first, then the teacher; or press Ctrl+C in this terminal.');
    await new Promise(resolve=>{const a=teacher.process(),b=student.process();let ended=0;const done=()=>{if(++ended===2)resolve();};a.once('exit',done);b.once('exit',done);if(a.exitCode!==null)done();if(b.exitCode!==null)done();});
    await close();
  } catch(error) {console.error(teacher?.diagnostics()||'');console.error(student?.diagnostics()||'');await close();throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
