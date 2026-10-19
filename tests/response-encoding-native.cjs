const assert = require('node:assert/strict');
const {mkdtempSync,mkdirSync} = require('node:fs');
const {resolve} = require('node:path');
const {launch,freePort} = require('./webview2-driver.cjs');
(async()=>{
  mkdirSync('.data',{recursive:true});
  const app=await launch({executablePath:process.env.SCHOOL_PACKAGED_EXE,env:{
    SCHOOL_TEST_DATA:mkdtempSync(resolve('.data/native-utf8-')),SCHOOL_HEADLESS_TEST:'1',SCHOOL_TEST_PORT:String(await freePort()),
  }});
  try {
    const page=await app.firstWindow();
    const options=['فرحي','أملي','حزني','هدوئي'].map(word=>(word+' '+ 'كلمة عربية '.repeat(20)).trim());
    const result=await page.evaluate(async options=>{
      await window.desktop.host();
      await window.desktop.request('/api/setup','POST',{school:'مدرسة النص العربي',password:'Native-utf8-test123'});
      await window.desktop.request('/api/login','POST',{role:'teacher',password:'Native-utf8-test123'});
      const questions=Array.from({length:100},(_,i)=>({id:`utf8-${i}`,text:`ما معنى الكلمة في السؤال رقم ${i} 😀؟`,options,correct:2,explanation:'شرح عربي صحيح',page:1}));
      const created=await window.desktop.request('/api/exams','POST',{title:'اختبار النقل العربي',subject:'عربي',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:30,total:20,difficulty:'سهل',cameraRequired:false,opensAt:new Date().toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),questions});
      const listed=(await window.desktop.request('/api/exams')).find(e=>e.id===created.id);
      return {created:created.questions,listed:listed.questions};
    },options);
    for(const rows of [result.created,result.listed]){
      assert.equal(rows.length,100);
      for(const q of rows){assert.deepEqual(q.options,options);assert.ok(q.text.includes('😀'));}
      assert.equal(JSON.stringify(rows).includes('\uFFFD'),false);
    }
    console.log('Native UTF-8 passed: large POST and GET responses preserve all 100 Arabic/emoji questions and choices through real TLS and WebView2.');
  } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
