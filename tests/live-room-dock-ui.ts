import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/live-dock-ui-'));
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
      '@remotion/player',
      'remotion',
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(harness, 'index.html'),
    '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./main.tsx"></script></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import FloatingAssistant from '/src/FloatingAssistant';import LiveLab from '/src/LiveLab';import {gsap} from 'gsap';import '/src/styles.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';window.watch=[];window.desktop={request:async(path,method,body)=>{if(path==='/api/lab/watch'){window.watch.push(body.active);return {}}if(path==='/api/lab')return {devices:[]};if(path==='/api/lab/frames')return {frames:[]};return {}},speechStatus:async()=>({ready:false}),onEvent:()=>()=>{}};window.animations=()=>gsap.globalTimeline.getChildren(true,true,true).filter(t=>t.isActive()).length;function Harness(){const[count,setCount]=useState(0),[mounted,setMounted]=useState(true);window.startRoom=()=>setCount(3);window.endRoom=()=>setCount(0);window.removeDock=()=>setMounted(false);return <><main style={{padding:60}}><h1>مساحة المعلم</h1><p>أسئلتك وطلابك وامتحاناتك في مكان واحد.</p><button>إنشاء امتحان</button></main>{mounted&&<><LiveLab attempts={Array.from({length:count},(_,i)=>({id:'a'+i,deadline:Date.now()+900000,answers:{}}))}/><FloatingAssistant teacherId="dock-test" page="exams" navigate={()=>{}} openExam={()=>{}} updated={()=>{}}/></>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.setDefaultTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/.data/${basename(harness)}/index.html`,
  );
  await page.locator('.assistant-orb').waitFor();
  assert.equal(await page.locator('.live-lab-launcher').count(), 0);
  await page.evaluate(() => (window as any).startRoom());
  const chip = page.getByRole('button', { name: 'فتح المراقبة المباشرة', exact: true });
  await chip.waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.live-room-edge')!).opacity) > 0.3,
  );
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.orb-room-chip')!).transform === 'none',
  );
  await page.screenshot({ path: 'test-results/live-room-combined-dock.png' });
  const ball = page.locator('.assistant-orb'),
    before = await ball.boundingBox(),
    box = await chip.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 250, box!.y - 180, { steps: 8 });
  await page.mouse.up();
  const after = await ball.boundingBox();
  assert.ok(after!.x - before!.x > 240);
  assert.ok(after!.y - before!.y < -180);
  assert.equal(await page.locator('dialog[open]').count(), 0, 'Dragging must not open monitoring');
  await chip.click();
  const room = page.getByRole('dialog', { name: 'غرفة المتابعة المباشرة' });
  await room.waitFor();
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('dialog[open]')!).transform === 'none',
  );
  assert.equal(
    await room.locator('.assistant-orb').count(),
    0,
    'Dock must stay outside the transforming native window',
  );
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.live-room-edge')!).opacity) < 0.01,
  );
  await page.screenshot({ path: 'test-results/live-room-genie-open.png' });
  assert.ok(await page.evaluate(() => (window as any).watch.includes(true)));
  await room.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
  await room.waitFor({ state: 'detached' });
  assert.equal(await ball.evaluate((el) => el === document.activeElement), true);
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.live-room-edge')!).opacity) > 0.3,
  );
  assert.ok(await page.evaluate(() => (window as any).watch.includes(false)));
  await ball.click();
  await page.getByRole('dialog', { name: 'المساعد العائم', exact: true }).waitFor();
  await page.getByRole('button', { name: 'تصغير المساعد العائم', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'المساعد العائم', exact: true })
    .waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const r = document.querySelector('.orb-room-chip')!.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth;
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(
    await page.evaluate(() => {
      const el = document.querySelector('.orb-room-chip') as HTMLElement;
      return Math.abs(el.getBoundingClientRect().left - parseFloat(el.style.left)) < 1;
    }),
    'Attached chip must move with the ball without a CSS position lag',
  );
  await page.screenshot({ path: 'test-results/live-room-dock-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await chip.click();
  await room.waitFor();
  await page.keyboard.press('Escape');
  await room.waitFor({ state: 'detached' });
  await page.evaluate(() => (window as any).endRoom());
  await chip.waitFor({ state: 'detached' });
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.live-room-edge')!).opacity) < 0.01,
  );
  await page.evaluate(() => (window as any).removeDock());
  assert.equal(await page.locator('.live-room-edge').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).animations()), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Combined room dock passed: single launcher, shared dragging without accidental opening, native genie window, edge glow hides/restores, watch cleanup, assistant minimize, mobile bounds, reduced motion, StrictMode and GSAP cleanup.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
