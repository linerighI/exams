import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,basename,join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';

mkdirSync('.data',{recursive:true});mkdirSync('test-results',{recursive:true});
const directory=mkdtempSync(resolve('.data/bank-refresh-ui-'));
const correct={id:'original-question-id',bankId:'bank-question',text:'اختر الكلمة الصحيحة',options:['فرحي','أملي','حزني','هدوئي'],correct:2,explanation:'شرح',page:1,difficulty:'سهل',chapter:'لغة'};
const manual={id:'manual-question',text:'سؤال يدوي يبقى محفوظًا',options:['1','2','3','4'],correct:0,explanation:'شرح',page:1};
const exam={id:'draft',title:'امتحان عربي',subject:'عربي',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:30,total:20,difficulty:'سهل',cameraRequired:false,opensAt:new Date().toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),questions:[{...correct,options:['فرحي','أملي','حزن��','هدوئي']},manual]};
writeFileSync(join(directory,'index.html'),'<html dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>');
writeFileSync(join(directory,'harness.tsx'),`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import ExamEditor from '/src/ExamEditor';import '/src/styles.css';import '/src/surfaces.css';import '/src/teacherLayout.css';
window.desktop={request:async(url,method,body)=>{if(url==='/api/books')return[];if(url==='/api/bank/selection')return{questions:[${JSON.stringify({...correct,id:'generated-snapshot-id'})}]};if(method==='PUT'){window.put=body;return{...body,id:'draft'}};if(url.endsWith('/publish'))return{};throw Error(url)}};
function Harness(){const[notice,setNotice]=useState('');return <main className="page-surface"><p role="status">{notice}</p><ExamEditor initial={${JSON.stringify(exam)}} onSave={e=>window.saved=e} onCancel={()=>{}} notify={setNotice}/></main>}createRoot(document.getElementById('root')).render(<Harness/>);`);
const vite=await createServer({server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','lucide-react','katex','motion/react']}});
let browser;
try {
  await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(20000);
  await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}/.data/${basename(directory)}/index.html`);
  await page.locator('.approval input').check();
  assert.equal(await page.getByRole('button',{name:'اعتماد ونشر الامتحان',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'تحديث الأسئلة من البنك',exact:true}).click();
  await page.getByRole('status').filter({hasText:'حُدّثت الأسئلة'}).waitFor();
  assert.equal(await page.locator('.approval input').isChecked(),false);
  await page.locator('.approval input').check();
  await page.getByRole('button',{name:'اعتماد ونشر الامتحان',exact:true}).click();
  await page.waitForFunction(()=>Boolean((window as any).saved));
  const saved=await page.evaluate(()=>(window as any).saved);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.questions[0])),correct);
  assert.deepEqual(saved.questions[1],manual);
  await page.waitForTimeout(500);await page.screenshot({path:'test-results/bank-refresh-repaired.png'});
  console.log('Bank refresh UI passed: intact Arabic restored, original question IDs/manual question retained, approval reset and publication succeeds.');
} finally {await browser?.close();await vite.close();rmSync(directory,{recursive:true,force:true});}
