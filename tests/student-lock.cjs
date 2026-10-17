const assert=require('node:assert/strict');
const {mkdtempSync,mkdirSync}=require('node:fs');
const {resolve}=require('node:path');
const {launch,freePort}=require('./webview2-driver.cjs');
(async()=>{
  mkdirSync('.data',{recursive:true});
  const env={SCHOOL_TEST_DATA:resolve(mkdtempSync('.data/student-lock-')),SCHOOL_TEST_PORT:String(await freePort()),SCHOOL_HEADLESS_TEST:'1'};
  let app=await launch({env});
  try{
    let page=await app.firstWindow();await page.evaluate(()=>window.desktop.host());
    await page.evaluate(()=>window.desktop.request('/api/setup','POST',{school:'مدرسة',password:'Lock-test123'}));
    await page.evaluate(()=>window.desktop.request('/api/login','POST',{role:'teacher',password:'Lock-test123'}));
    const student=await page.evaluate(()=>window.desktop.request('/api/students','POST',{id:'locked',name:'طالب القفل',grade:'10',section:'أ'}));
    await page.evaluate(code=>window.desktop.request('/api/login','POST',{role:'student',code}),student.code);
    assert.ok(app.diagnostics().includes('Student session locked: true'));
    assert.match(await page.evaluate(async()=>{try{await window.desktop.host();}catch(e){return e.message;}}),/مقفلة/);
    assert.match(await page.evaluate(async()=>{try{await window.desktop.request('/api/login','POST',{role:'teacher',password:'Lock-test123'});}catch(e){return e.message;}}),/تسجيل|سجّل/);
    const forged=await page.evaluate(()=>new Promise(resolve=>{const listener=({data})=>{if(data.id===321987){chrome.webview.removeEventListener('message',listener);resolve(data.error);}};chrome.webview.addEventListener('message',listener);chrome.webview.postMessage({id:321987,method:'student-mode',args:[false]});}));assert.match(forged,/Unsupported desktop command/);
    await app.close();app=await launch({env});page=await app.firstWindow();
    await page.locator('.student-session-shell').waitFor();
    assert.ok(app.diagnostics().includes('Student session locked: true'));
    assert.equal((await page.evaluate(()=>window.desktop.studentSession())).student.id,'locked');
    await page.getByRole('button',{name:'تسجيل الخروج',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'خروج الطالب بإذن المعلم'});
    await dialog.getByLabel('كلمة مرور المعلم للخروج').fill('incorrect');await dialog.getByRole('button',{name:'فتح الجلسة وتسجيل الخروج'}).click();await dialog.getByRole('alert').waitFor();
    assert.equal((await page.evaluate(()=>window.desktop.studentSession())).role,'student');
    await dialog.getByLabel('كلمة مرور المعلم للخروج').fill('Lock-test123');await dialog.getByRole('button',{name:'فتح الجلسة وتسجيل الخروج'}).click();await page.getByRole('heading',{name:'أهلًا بك من جديد'}).waitFor();
    assert.equal(await page.evaluate(()=>window.desktop.studentSession()),null);
    assert.ok(app.diagnostics().includes('Student session locked: false'));
    console.log('Student lock passed: native-only unlock, role-switch rejection, saved lock after process/server restart, invalid-password rejection and authorized exit.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
