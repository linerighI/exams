import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/updates-ui-'));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'lucide-react',
      'motion/react',
      'gsap',
      'katex',
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(harness, 'index.html'),
    '<html dir="rtl" lang="ar"><meta charset="UTF-8"><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `
    import React from 'react';import{createRoot}from'react-dom/client';
    import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';
    import '/src/styles.css';import '/src/surfaces.css';import '/src/personalization.css';
    import AppUpdates from '/src/AppUpdates';import Welcome from '/src/Welcome';
    let state={status:'idle',current:'1.5.4'},campaign=null;
    const listeners=new Set();const actions=[];
    const emit=(next)=>{state={...state,...next};listeners.forEach(cb=>cb({type:'app-update',state}));};
    window.__updateTest={emit,actions};
    const manifest={id:'a'.repeat(32),version:'1.5.5',hash:'b'.repeat(64),size:67108864,notes:'تحسينات للطلاب واستيراد البيانات.',createdAt:Date.now()};
    window.desktop={updateState:async()=>state,checkUpdates:async(previews,school)=>{actions.push(['check',previews,school]);emit({...manifest,status:'available',source:'github'});return state;},
      downloadUpdate:async()=>{emit({status:'ready',received:67108864});return state;},cancelUpdate:async()=>state,installUpdate:async()=>{actions.push(['install']);return state;},
      onEvent:cb=>{listeners.add(cb);return()=>listeners.delete(cb);},
      connectionState:async()=>({connected:true,local:true,school:'مدرسة الشريقي'}),studentSession:async()=>null,
      request:async(path,method)=>{
        if(path==='/api/status')return{school:'مدرسة الشريقي',setup:true};
        if(path==='/api/school-updates/publish'){actions.push(['publish']);campaign=manifest;return campaign;}
        if(path==='/api/school-updates'){if(method==='DELETE')campaign=null;return{supported:true,campaign,devices:campaign?[{studentId:'s',clientId:'student-device',name:'أحمد علي',current:'1.5.4',status:'waiting',progress:100}]:[]};}
        return {};
      }};
    const page=new URLSearchParams(location.search).get('view');
    createRoot(document.getElementById('root')).render(page==='school'?<main style={{maxWidth:1000,margin:'30px auto',padding:20}}><AppUpdates embedded manageStudents/></main>:page==='student'?<AppUpdates background student/>:<Welcome onLogin={()=>{}} onHost={()=>{}} notify={()=>{}} onResume={()=>{}}/>);
  `,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
  page.on('pageerror', (error) => console.error('UI error:', error.message));
  const url = `${vite.resolvedUrls!.local[0]}${harness.slice(resolve('.').length + 1).replace(/\\/g, '/')}/index.html`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button', { name: 'تحديث التطبيق', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'البحث عن تحديث', exact: true }).click();
  await page.getByText('الإصدار 1.5.5', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/updates-login.png', fullPage: true });
  await page.getByRole('button', { name: 'إغلاق نافذة التحديث' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(
    await page
      .getByRole('button', { name: /تحديث جديد/ })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.goto(url + '?view=school',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button', { name: 'تجهيز أحدث نسخة للطلاب' }).click();
  await page.getByRole('button', { name: 'تنزيل التحديث داخل التطبيق' }).click();
  const send = page.getByRole('button', { name: 'إرسال التحديث للطلاب' });
  await send.click();
  await page.getByText('أحمد علي', { exact: true }).waitFor();
  assert.equal(await page.getByText('بعد تسليم الامتحان', { exact: true }).count(), 1);
  assert.equal(
    await page.evaluate('window.__updateTest.actions.some(a=>a[0]==="check"&&a[2]===true)'),
    true,
  );
  assert.equal(await page.evaluate('window.__updateTest.actions.some(a=>a[0]==="publish")'), true);
  await page.screenshot({ path: 'test-results/updates-school.png', fullPage: true });
  await page.goto(url + '?view=student',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction('window.__updateTest');
  await page.evaluate(
    'window.__updateTest.emit({source:"school",status:"ready",current:"1.5.4",version:"1.5.5",size:67108864,notes:"تحسينات للطلاب واستيراد البيانات.",waiting:false,installAt:Date.now()+20000})',
  );
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByText(/يبدأ تحديث جهازك خلال/).count(), 1);
  assert.equal(
    await page.getByRole('button', { name: 'تثبيت وإعادة تشغيل التطبيق', exact: true }).count(),
    0,
  );
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.update-window')!).transform==='none' && getComputedStyle(document.querySelector('.school-update-countdown')!).opacity==='1');
  await page.screenshot({ path: 'test-results/updates-student.png', fullPage: true });
  await page.evaluate('window.__updateTest.emit({waiting:true,installAt:undefined})');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button', { name: 'تحديث التطبيق', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      `overflow at ${width}`,
    );
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button', { name: 'تحديث التطبيق', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  console.log(
    'Login updates, GSAP/genie close, teacher push, student countdown, exam deferral, mobile and reduced motion passed.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
