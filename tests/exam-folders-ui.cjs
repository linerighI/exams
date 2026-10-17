const assert=require('node:assert/strict');
const {mkdirSync,mkdtempSync}=require('node:fs');
const {resolve}=require('node:path');
const {launch,freePort}=require('./webview2-driver.cjs');
(async()=>{
 mkdirSync('.data',{recursive:true});mkdirSync('test-results',{recursive:true});
 const app=await launch({env:{SCHOOL_TEST_DATA:resolve(mkdtempSync('.data/exam-folders-')),SCHOOL_TEST_PORT:String(await freePort()),SCHOOL_HEADLESS_TEST:'1'}}),page=await app.firstWindow(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setViewportSize({width:1366,height:900});
  const splash=page.getByRole('dialog',{name:'مرحبًا بك في Zunis'});if(await splash.isVisible())await splash.getByRole('button').click();
  await page.getByRole('button',{name:'تشغيل الجهاز الرئيسي'}).click();await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Folder-test123');await page.getByRole('button',{name:'إعداد حساب المدرسة'}).click();
  await page.getByRole('heading',{name:'مرحبًا أستاذي، ماذا ننجز اليوم؟'}).waitFor();
  const exams=await page.evaluate(async()=>{const input={subject:'الرياضيات',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:45,total:20,difficulty:'متوسط',cameraRequired:false,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+86400000).toISOString(),questions:[{id:'q1',text:'ما ناتج الجمع؟',options:['1','2','3','4'],correct:0,explanation:'',page:1}]};return [await window.desktop.request('/api/exams','POST',{...input,title:'امتحان الجبر'}),await window.desktop.request('/api/exams','POST',{...input,title:'امتحان الهندسة'})];});
  await page.locator('.sidebar nav').getByRole('button',{name:'الامتحانات',exact:true}).click();await page.locator('.exam-card').filter({hasText:'امتحان الجبر'}).waitFor();
  await page.getByRole('button',{name:'مجلد جديد',exact:true}).click();await page.getByLabel('اسم مجلد الامتحانات').fill('رياضيات العاشر');await page.getByRole('button',{name:'أخضر',exact:true}).click();await page.getByRole('button',{name:'حفظ المجلد',exact:true}).click();
  const folder=page.locator('.exam-folder-tile').filter({hasText:'رياضيات العاشر'});await folder.waitFor();
  await page.locator('.exam-card').filter({hasText:'امتحان الجبر'}).dragTo(folder);
  await page.waitForFunction(async id=>!!(await window.desktop.request('/api/exam-folders')).examFolders[id],exams[0].id);
  await page.getByRole('button',{name:'فتح مجلد الامتحانات: رياضيات العاشر',exact:true}).click();assert.equal(await page.locator('.exam-card').count(),1);
  await page.screenshot({path:'test-results/exam-folders.png'});
  await page.getByRole('button',{name:'نقل الامتحان إلى مجلد: امتحان الجبر',exact:true}).click();await page.getByLabel('مجلد الامتحان الوجهة').selectOption('');await page.getByRole('button',{name:'نقل الامتحان',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.exam-card').length===0);
  await page.getByRole('button',{name:'غير مصنف',exact:false}).click();assert.equal(await page.locator('.exam-card').count(),2);
  await page.getByLabel('إدارة المجلد رياضيات العاشر').click();
  await page.getByRole('button',{name:'تعديل مجلد رياضيات العاشر',exact:true}).click();await page.getByLabel('اسم مجلد الامتحانات').fill('مراجعة الرياضيات');await page.getByRole('button',{name:'بنفسجي',exact:true}).click();await page.getByRole('button',{name:'حفظ المجلد',exact:true}).click();
  await page.getByRole('button',{name:'فتح مجلد الامتحانات: مراجعة الرياضيات',exact:true}).waitFor();
  await page.locator('.exam-card').filter({hasText:'امتحان الهندسة'}).dragTo(page.locator('.exam-folder-tile').filter({hasText:'مراجعة الرياضيات'}));
  await page.waitForFunction(async id=>!!(await window.desktop.request('/api/exam-folders')).examFolders[id],exams[1].id);
  await page.getByLabel('إدارة المجلد مراجعة الرياضيات').click();
  await page.getByRole('button',{name:'حذف مجلد مراجعة الرياضيات',exact:true}).click();await page.getByRole('button',{name:'حذف المجلد فقط',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.exam-card').length===2);
  assert.equal((await page.evaluate(()=>window.desktop.request('/api/exams'))).length,2);
  assert.deepEqual(errors,[]);console.log('Exam folders UI passed: create/color, native drag/drop, folder filtering, move dialog, rename/recolor and safe delete.');
 }catch(e){await page.screenshot({path:'test-results/exam-folders-failure.png'}).catch(()=>{});console.error(app.diagnostics());throw e;}finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
