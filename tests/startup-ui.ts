import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const folder = mkdtempSync(resolve('.data/startup-ui-'));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'gsap',
      'remotion',
      '@remotion/player',
      'lucide-react',
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(folder, 'index.html'),
    '<html dir="rtl" lang="ar"><div id="root"></div><script type="module" src="./main.tsx"></script></html>',
  );
  writeFileSync(
    join(folder, 'main.tsx'),
    `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ZunisSplash} from '/src/Zunis';import StartupScreen from '/src/StartupScreen';import {gsap} from 'gsap';import '/src/styles.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/500.css';window.animations=()=>gsap.globalTimeline.getChildren(true,true,true).filter(t=>t.isActive()).length;function Harness(){const[mode,setMode]=useState('closed'),[key,setKey]=useState(0);window.showStartup=(m='welcome')=>{window.started=performance.now();setMode(m);setKey(k=>k+1)};window.removeStartup=()=>setMode('closed');return <><button onClick={()=>{sessionStorage.removeItem('zunis-welcome');window.showStartup('welcome')}}>عرض البداية</button>{mode==='welcome'&&<ZunisSplash key={key}/ >}{mode==='loading'&&<StartupScreen key={key} loading/>}{mode==='resume'&&<StartupScreen key={key} elapsed={2.5} onDone={()=>setMode('closed')}/>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/.data/${basename(folder)}/index.html`,
  );
  await page.getByRole('button', { name: 'عرض البداية' }).click();
  await page.getByRole('dialog', { name: 'مرحبًا بك في Zunis' }).waitFor();
  await page.waitForFunction(() => {
    const g = document.querySelector('.startup-art svg >g:last-child');
    return g && Number(g.getAttribute('opacity')) > 0.99;
  });
  await page.screenshot({ path: 'test-results/zunis-app-startup.png' });
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  const elapsed = await page.evaluate(() => performance.now() - (window as any).started);
  assert.ok(elapsed > 3400 && elapsed < 5000, String(elapsed));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('zunis-welcome')), '1');
  assert.equal(await page.evaluate(() => (window as any).animations()), 0);
  await page.evaluate(() => (window as any).showStartup());
  assert.equal(await page.locator('.zunis-splash').count(), 0, 'Do not replay in the same session');
  await page.getByRole('button', { name: 'عرض البداية' }).click();
  await page.locator('.startup-enter').click();
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => performance.now() - (window as any).started < 2200));
  await page.evaluate(() => (window as any).showStartup('resume'));
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  assert.ok(
    await page.evaluate(() => performance.now() - (window as any).started < 2300),
    'Resume the native loading timeline rather than replaying it',
  );
  await page.evaluate(() => (window as any).showStartup('loading'));
  await page.getByRole('status', { name: 'جارٍ تشغيل التطبيق' }).waitFor();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('school-startup-status', { detail: 'جارٍ استعادة الاتصال المحفوظ…' }),
    ),
  );
  await page.getByText('جارٍ استعادة الاتصال المحفوظ…', { exact: true }).waitFor();
  await page.waitForTimeout(4500);
  assert.equal(
    await page.locator('.startup-loading').count(),
    1,
    'Loading screen stays until real readiness',
  );
  await page.screenshot({ path: 'test-results/zunis-app-loading.png' });
  await page.evaluate(() => (window as any).removeStartup());
  assert.equal(await page.evaluate(() => (window as any).animations()), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'عرض البداية' }).click();
  await page.locator('.startup-enter').click();
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => (window as any).animations()), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => (window as any).showStartup('loading'));
  await page.locator('.startup-art svg').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => (window as any).removeStartup());
  assert.deepEqual(errors, []);
  console.log(
    'Startup UI passed: four-second welcome, skip, session persistence, native timeline resume, real loading status, no premature dismissal, reduced motion, mobile bounds and StrictMode cleanup.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(folder, { recursive: true, force: true });
}
