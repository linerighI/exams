const {launch,freePort}=require('./webview2-driver.cjs');
const {mkdtempSync,mkdirSync,readFileSync}=require('node:fs');
const {resolve,join}=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 mkdirSync('.data',{recursive:true});mkdirSync('test-results',{recursive:true});
 const directory=resolve(mkdtempSync('.data/startup-recovery-'));
 const executablePath=resolve('desktop/native/bin/startup-test/Alshereqi Exams.exe');
 const port=await freePort();
 const env={SCHOOL_APP_ROOT:process.cwd(),SCHOOL_NODE_EXECUTABLE:process.execPath,SCHOOL_DEVELOPMENT:'1',SCHOOL_TEST_DATA:directory,SCHOOL_HEADLESS_TEST:'1',SCHOOL_TEST_PORT:String(port)};
 let app;
 try{
  // Deliberately exceed the old hard-coded 30-second startup deadline.
  app=await launch({executablePath,startupTimeoutMs:60000,env:{...env,SCHOOL_TEST_STARTUP_DELAY_MS:'35000'}});
  let page=await app.firstWindow();
  await page.locator('.login-card').waitFor();
  assert.match(app.diagnostics(),/Startup slow: continuing to wait for the existing backend; no restart/);
  const boot=app.diagnostics();
  assert.equal((boot.match(/Startup stage: بدء خدمة التطبيق/g)||[]).length,1,'a slow startup must not create duplicate backends');
  console.log('Delayed startup passed: ready after 35 seconds without closing/relaunching or duplicating the backend.');
  await page.evaluate(async()=>{
    await window.desktop.host();
    await window.desktop.request('/api/setup','POST',{school:'اختبار الاستعادة',password:'Recovery123'});
    await window.desktop.request('/api/login','POST',{role:'teacher',password:'Recovery123'});
    const s=await window.desktop.request('/api/students','POST',{id:'startup-student',name:'طالب الاختبار',grade:'10',section:'أ'});
    await window.desktop.request('/api/login','POST',{role:'student',code:s.code});
  });
  await app.close();app=undefined;
  for(let i=0;i<2;i++){
   app=await launch({executablePath,env});page=await app.firstWindow();
   const session=await page.evaluate(()=>window.desktop.studentSession());
   assert.equal(session.student.id,'startup-student');
   const status=await page.evaluate(()=>window.desktop.request('/api/status'));
   assert.equal(status.school,'اختبار الاستعادة');
   await app.close();app=undefined;
  }
  console.log('Saved local student startup passed twice: restored school, account and connection with the same database.');
  assert.doesNotMatch(readFileSync(join(directory,'desktop.log'),'utf8'),/Startup failed|TimeoutException/);
 }finally{await app?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
