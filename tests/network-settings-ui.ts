import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/network-ui-'));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
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
    `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import ConnectionDialog from '/src/ConnectionDialog';import {gsap} from 'gsap';import '/src/styles.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';
window.networkHosting=false;window.choice='';window.failPrefs=false;window.activeAnimations=()=>gsap.globalTimeline.getChildren(true,true,true).length;window.target='10.0.0.2';window.desktop={networkState:async()=>({adapters:[{name:'Ethernet',address:'10.0.0.3',netmask:'255.255.255.0'},{name:'Wi-Fi',address:'192.168.137.8',netmask:'255.255.255.0'}],preferredAddress:window.choice,host:window.target,hosting:window.networkHosting,pairingCode:window.networkHosting?'ABCD-EFGH-JKLM':undefined,port:4310}),networkPreferences:async(value)=>{if(window.failPrefs)throw Error('تعذر حفظ التفضيل');window.choice=value;return window.desktop.networkState()},discover:async()=>[{host:'10.0.0.2',school:'مدرسة تجريبية',pairingVersion:1}],connectTeacher:async(host,code)=>({connected:true,local:false,host,school:'مدرسة تجريبية'})};function Harness(){const[open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>فتح كرة الاتصال</button>{open&&<ConnectionDialog connection={{connected:false,local:false}} tone="blue" onConnected={()=>{}} onClose={()=>setOpen(false)}/>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.setDefaultTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/.data/${basename(harness)}/index.html`,
  );
  const baseline = await page.evaluate(() => (window as any).activeAnimations());
  await page.getByRole('button', { name: 'فتح كرة الاتصال' }).click();
  await page.getByRole('tab', { name: 'إعدادات الشبكة' }).click();
  const preference = page.getByRole('combobox', { name: 'أولوية البحث في الشبكات' });
  await preference.selectOption('192.168.137.8');
  await page.getByRole('status').filter({ hasText: 'تم حفظ' }).waitFor();
  assert.equal(await page.evaluate(() => (window as any).choice), '192.168.137.8');
  assert.equal(await page.evaluate(() => (window as any).target), '10.0.0.2');
  await page.getByRole('button', { name: 'كيفية الاتصال بـ Wi-Fi أو Hotspot' }).click();
  await page.getByText('Ethernet + Wi-Fi + Hotspot', { exact: true }).waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.network-panel')!).opacity) > 0.99,
  );
  await page.screenshot({ path: 'test-results/network-settings-desktop.png' });
  await page.evaluate(()=>{(window as any).networkHosting=true});
  await page.getByRole('button',{name:'تحديث',exact:true}).click();
  await page.getByText('رمز ربط أجهزة الطلاب',{exact:true}).waitFor();
  await page.getByText('ABCD-EFGH-JKLM',{exact:true}).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'test-results/network-settings-mobile.png', fullPage: true });
  await page.evaluate(() => {
    (window as any).failPrefs = true;
  });
  await preference.selectOption('');
  await page.getByRole('alert').filter({ hasText: 'تعذر حفظ التفضيل' }).waitFor();
  await page.getByRole('tab', { name: 'الاتصال بالمعلم' }).click();
  await page.getByRole('button', { name: /مدرسة تجريبية/ }).waitFor();
  await page.getByLabel('رمز الاتصال', { exact: true }).fill('ABCD-EFGH-JKLM');
  await page.getByRole('button', { name: 'الاتصال بجهاز المعلم', exact: true }).click();
  await page.getByRole('heading', { name: 'أهلًا بك في الصف' }).waitFor();
  await page.getByRole('button', { name: 'متابعة إلى تسجيل الدخول' }).click();
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'فتح كرة الاتصال' }).click();
  await page.getByRole('tab', { name: 'إعدادات الشبكة' }).click();
  await page.getByRole('button', { name: 'كيفية الاتصال بـ Wi-Fi أو Hotspot' }).click();
  await page.getByText('Ethernet + Wi-Fi + Hotspot', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'إغلاق لوحة الاتصال' }).click();
  assert.equal(await page.evaluate(() => (window as any).activeAnimations()), baseline);
  assert.deepEqual(errors, []);
  console.log(
    'Network settings UI passed: preferences preserve target, save failure, connection tab pairing, Remotion guide, mobile layout, reduced motion, StrictMode cleanup.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
