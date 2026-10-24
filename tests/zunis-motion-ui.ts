import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/zunis-motion-'));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'motion/react',
      'lucide-react',
      'gsap',
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(harness, 'index.html'),
    '<html dir="rtl" lang="ar"><div id="root"></div><script type="module" src="./main.tsx"></script></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';import ExamIntegrityIntro from '/src/ExamIntegrityIntro';import {ZunisSplash} from '/src/Zunis';import {gsap} from 'gsap';import '/src/styles.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';window.activeAnimations=()=>gsap.globalTimeline.getChildren(true,true,true).length;window.prepareCount=0;function Harness(){const[open,setOpen]=useState(false);const[ready,setReady]=useState(true);window.releaseExam=()=>setReady(true);window.closeIntro=()=>setOpen(false);window.startWaiting=()=>{window.prepareCount=0;setReady(false);window.started=performance.now();setOpen(true)};const done=useCallback(()=>{window.elapsed=performance.now()-window.started;setOpen(false)},[]);return <><ZunisSplash/><button onClick={()=>{window.started=performance.now();setOpen(true)}}>بدء الامتحان التجريبي</button>{open&&<ExamIntegrityIntro onDone={done} ready={ready} onPrepared={()=>{window.prepareCount++}} title="اختبار الرياضيات" calculatorAllowed/>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo:
      process.env.RECORD_ZUNIS === '1'
        ? { dir: 'test-results/cinematic-video', size: { width: 1280, height: 800 } }
        : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/.data/${basename(harness)}/index.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  const baseline = await page.evaluate(() => (window as any).activeAnimations());
  await page.getByRole('button', { name: 'بدء الامتحان التجريبي' }).click();
  await page.getByRole('dialog', { name: 'Zunis · تذكير بالنزاهة' }).waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.entry-camera')!).opacity) > 0.95,
  );
  await page.screenshot({ path: 'test-results/zunis-camera-intro.png' });
  await page.waitForFunction(() => {
    const circle = document.querySelector('.exam-entry .integrity-trace circle');
    return !!circle && Number.parseFloat(getComputedStyle(circle).strokeDashoffset) < 0.1;
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.entry-feature')].every(
      (el) => Number(getComputedStyle(el).opacity) > 0.99,
    ),
  );
  await page.screenshot({ path: 'test-results/zunis-cinematic-intro.png' });
  await page.locator('.exam-entry').waitFor({ state: 'detached' });
  assert.ok(
    await page.evaluate(() => (window as any).elapsed >= 2800 && (window as any).elapsed < 5000),
  );
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  assert.equal(
    await page
      .getByRole('button', { name: 'بدء الامتحان التجريبي' })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.evaluate(() => (window as any).startWaiting());
  await page.waitForFunction(() => (window as any).prepareCount === 1);
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.exam-entry').count(), 1, 'Loading must stay covered');
  await page.keyboard.press('Escape');
  assert.equal(
    await page.locator('.exam-entry').count(),
    1,
    'Escape must not reveal an unloaded exam',
  );
  await page.evaluate(() => (window as any).releaseExam());
  await page.locator('.exam-entry').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => (window as any).prepareCount), 1);
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  await page.evaluate(() => (window as any).startWaiting());
  await page.getByRole('dialog', { name: 'Zunis · تذكير بالنزاهة' }).waitFor();
  await page.evaluate(() => (window as any).closeIntro());
  await page.waitForTimeout(4200);
  assert.equal(
    await page.evaluate(() => (window as any).prepareCount),
    0,
    'Unmount cancels preparation',
  );
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  await page.evaluate(() => (window as any).releaseExam());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'بدء الامتحان التجريبي' }).click();
  await page.getByRole('heading', { name: 'ابدأ بثقة. أجب بأمانة.' }).waitFor();
  assert.equal(
    await page.locator('.entry-camera').evaluate((el) => getComputedStyle(el).display),
    'none',
  );
  await page.locator('.exam-entry').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  assert.deepEqual(errors, []);
  const video = page.video();
  await context.close();
  if (video) copyFileSync(await video.path(), 'test-results/zunis-cinematic.webm');
  console.log(
    'Zunis motion passed: three-second intro, shield/letter animation, focus restoration, reduced motion, timeline cleanup, no browser errors.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
