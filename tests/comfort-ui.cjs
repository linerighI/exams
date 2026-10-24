const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const { createServer } = await import('vite');
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = mkdtempSync(resolve('.data/comfort-ui-'));
  const vite = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'lucide-react',
        'driver.js',
        'motion/react',
      ],
    },
  });
  let browser;
  try {
    writeFileSync(
      resolve(directory, 'index.html'),
      '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>',
    );
    writeFileSync(
      resolve(directory, 'harness.tsx'),
      `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {Users,FileText,Settings,Activity} from 'lucide-react';
import TeacherTour from '/src/TeacherTour';import CameraCheck from '/src/CameraCheck';import ExamIntegrityIntro from '/src/ExamIntegrityIntro';import SidebarNavigation from '/src/SidebarNavigation';
import '/src/styles.css';import '/src/surfaces.css';import '/src/teacherLayout.css';import '/src/comfort.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';
window.seen={};window.activeTeacher='one';window.desktop={request:async(url,method,body)=>{if(url==='/api/preferences/onboarding'){if(method==='PUT')window.seen[window.activeTeacher]=true;return {seen:!!window.seen[window.activeTeacher]};}return {};}};
const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.denyCamera=true;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async options=>{if(window.denyCamera)throw new DOMException('Denied','NotAllowedError');return media(options);}});
function Harness(){const [teacher,setTeacher]=useState('one'),[camera,setCamera]=useState(false),[intro,setIntro]=useState(false),[result,setResult]=useState('');window.activeTeacher=teacher;return <><div className="app-shell studio-mode teacher-session-shell"><aside className="sidebar"><SidebarNavigation items={[["simple","إعداد امتحان مبسط",FileText],["students","الطلاب",Users],["exams","الامتحانات",FileText],["monitor","المتابعة والنتائج",Activity],["settings","الإعدادات",Settings]]} page="simple" disabled={false} select={()=>{}}/></aside><main className="main-shell"><div className="topbar"><TeacherTour key={teacher} teacherId={teacher}/></div><div className="page-surface"><button onClick={()=>setTeacher(teacher==='one'?'two':'one')}>تبديل الحساب</button><button onClick={()=>setCamera(true)}>فحص الكاميرا</button><button onClick={()=>setIntro(true)}>ابدأ تذكير النزاهة</button><p role="status">{result}</p></div></main></div>{camera && <CameraCheck onClose={()=>setCamera(false)} onContinue={value=>{setResult('camera:'+value);setCamera(false);}}/>}{intro && <ExamIntegrityIntro onDone={()=>{setIntro(false);setResult('intro done');}}/>}</>};createRoot(document.getElementById('root')).render(<Harness/>);`,
    );
    await vite.listen();
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--use-fake-device-for-media-stream'],
    });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      permissions: ['camera'],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = `http://127.0.0.1:${vite.httpServer.address().port}/.data/${basename(directory)}/index.html`;
    await page.goto(url);
    await page.getByRole('dialog', { name: 'مرحبًا أستاذي · لنبدأ بسهولة', exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/teacher-first-login.png' });
    await page.getByRole('button', { name: 'ابدأ الجولة القصيرة', exact: true }).click();
    await page.locator('.driver-popover').waitFor();
    await page.waitForFunction(
      () => Number(getComputedStyle(document.querySelector('.driver-popover')).opacity) > 0.95,
    );
    await page.screenshot({ path: 'test-results/teacher-tour.png' });
    for (let i = 0; i < 5; i++)
      await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('button', { name: 'جاهز للبدء', exact: true }).click();
    await page.locator('.driver-popover').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.seen.one), true);
    await page.reload();
    await page.waitForTimeout(2600);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'دليل البداية', exact: true }).click();
    await page.getByRole('button', { name: 'لاحقًا، أعرف طريقي', exact: true }).click();
    await page.getByRole('button', { name: 'تبديل الحساب', exact: true }).click();
    await page.getByRole('dialog', { name: 'مرحبًا أستاذي · لنبدأ بسهولة', exact: true }).waitFor();
    await page.getByRole('button', { name: 'لاحقًا، أعرف طريقي', exact: true }).click();
    await page.getByRole('button', { name: 'فحص الكاميرا', exact: true }).click();
    await page.getByRole('button', { name: 'السماح وفحص الكاميرا', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Windows' }).waitFor();
    await page.screenshot({ path: 'test-results/camera-permission-help.png' });
    await page.evaluate(() => (window.denyCamera = false));
    await page.getByRole('button', { name: 'إعادة الفحص', exact: true }).click();
    await page.getByText('الكاميرا جاهزة', { exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/camera-check-ready.png' });
    await page.getByRole('button', { name: 'متابعة إلى الامتحان', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'camera:true' }).waitFor();
    const started = Date.now();
    await page.getByRole('button', { name: 'ابدأ تذكير النزاهة', exact: true }).click();
    await page.getByRole('dialog', { name: 'Zunis · تذكير بالنزاهة', exact: true }).waitFor();
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.exam-entry')).opacity)>.99);
    await page.screenshot({ path: 'test-results/exam-integrity-ui.png' });
    await page.getByRole('status').filter({ hasText: 'intro done' }).waitFor();
    assert.ok(Date.now() - started >= 2900);
    await page.setViewportSize({ width: 760, height: 1000 });
    await page.getByRole('button', { name: 'دليل البداية', exact: true }).click();
    await page.screenshot({ path: 'test-results/teacher-first-login-760.png' });
    assert.equal(
      await page.locator('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Comfort UI passed: first-login tour, account isolation, replay, camera denial/retry/preview, 3-second integrity screen and 760px layout.',
    );
  } finally {
    await browser?.close();
    await vite.close();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
