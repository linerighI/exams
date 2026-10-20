import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/student-workspace-'));
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
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(harness, 'index.html'),
    '<html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./main.tsx"></script></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import '/src/styles.css';import '/src/App';import '/src/comfort.css';import '/src/teacherLayout.css';import '/src/surfaces.css';import '/src/schoolUpgrade.css';
import StudentSpace from '/src/StudentSpace';import SidebarNavigation from '/src/SidebarNavigation';import SchoolBrand from '/src/SchoolBrand';import MinistryBrand from '/src/MinistryBrand';
import {LayoutDashboard,BookOpen,BarChart3,GraduationCap,Bell,LogOut} from 'lucide-react';
import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/500.css';import '@fontsource/tajawal/700.css';import '@fontsource/tajawal/800.css';
import {ScrollTrigger} from 'gsap/ScrollTrigger';window.triggerCount=()=>ScrollTrigger.getAll().length;
const now=Date.now(),student={id:'s1',name:'سارة أحمد',grade:'العاشر',section:'أ'};
const exam={id:'math',title:'اختبار الرياضيات',subject:'رياضيات',term:'الأول',grade:'العاشر',section:'أ',duration:45,total:20,status:'published',opensAt:new Date(now-60000).toISOString(),closesAt:new Date(now+3600000).toISOString()};
const exams=[exam,{...exam,id:'arabic',title:'العربية لغتي',subject:'لغة عربية',duration:30,total:30,opensAt:new Date(now+86400000).toISOString(),closesAt:new Date(now+90000000).toISOString()},{...exam,id:'physics',title:'القوى والحركة',subject:'فيزياء',resultsPublished:true}];
const attempt={id:'done1',examId:'physics',examTitle:'القوى والحركة',startedAt:now-600000,submittedAt:now-300000,score:18};
function Harness(){const [page,setPage]=useState('dashboard'),[state,setState]=useState('normal');window.setScenario=setState;const connected=state!=='offline';const items=state==='empty'?[]:exams;const attempts=state==='empty'?[]:state==='active'?[{...attempt,id:'active1',examId:'math',submittedAt:undefined}]:[attempt];return <div className="app-shell studio-mode student-session-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><GraduationCap size={27}/></div><div>مدرسة الشريقي</div></div><div className="workspace-label">مساحة الطالب</div><SidebarNavigation items={[["dashboard","الرئيسية",LayoutDashboard],["exams","امتحاناتي",BookOpen],["results","نتائجي",BarChart3]]} page={page} disabled={false} select={setPage}/><button className="logout"><LogOut size={18}/></button></aside><div className="main-shell"><header className="topbar"><div className="breadcrumb"><span className="header-branding"><MinistryBrand/><SchoolBrand/></span>مساحة الطالب</div><div className="topbar-actions"><Bell size={18}/><strong>سارة أحمد</strong></div></header><main><div className="page-surface"><StudentSpace page={page} student={student} exams={items} attempts={attempts} connected={connected} busy={state==='busy'} navigate={setPage} start={(exam,code)=>window.lastStart={examId:exam?.id,code}} resume={attempt=>window.lastResume=attempt.id}/></div></main></div></div>};createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);
`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  await page.goto(`${base}/.data/${basename(harness)}/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'أهلًا بك، سارة' }).waitFor();
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.student-next-exam')!).opacity === '1',
  );
  await page.locator('img').evaluateAll((images) =>
    images.forEach((element) => {
      const img = element as HTMLImageElement;
      img.src = '/branding/' + img.src.split('/').pop();
    }),
  );
  await page.screenshot({ path: 'test-results/student-dashboard-redesign.png', fullPage: true });
  assert.ok(
    await page
      .locator('.student-exam-ticket .student-cover-paper > strong')
      .evaluate((el) => el.clientHeight >= 20),
  );
  const baselineTriggers = await page.evaluate(() => (window as any).triggerCount());
  assert.ok(baselineTriggers > 0);
  await page.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).click();
  assert.equal(await page.evaluate(() => (window as any).lastStart.examId), 'math');
  await page.getByLabel('رمز الامتحان', { exact: true }).fill('AR-234');
  await page.getByRole('button', { name: 'الانضمام بالرمز' }).click();
  assert.equal(await page.evaluate(() => (window as any).lastStart.code), 'AR-234');
  await page.evaluate(() => (window as any).setScenario('offline'));
  assert.equal(
    await page.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).isDisabled(),
    true,
  );
  assert.equal(await page.getByRole('button', { name: 'الانضمام بالرمز' }).isDisabled(), true);
  await page.evaluate(() => (window as any).setScenario('active'));
  await page.locator('.student-launch').click();
  assert.equal(await page.evaluate(() => (window as any).lastResume), 'active1');
  await page.evaluate(() => (window as any).setScenario('normal'));
  for (const width of [760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.student-preflight').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.student-preflight')!).opacity === '1',
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
            .map((el) => ({ cls: el.className, w: el.getBoundingClientRect().width }))
            .slice(0, 12),
        ),
      ),
    );
    await page.locator('.student-page-heading').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/student-dashboard-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('[data-nav="exams"]').click();
  await page.getByRole('heading', { name: 'امتحاناتي', exact: true }).waitFor();
  await page.getByRole('button', { name: 'متاح الآن', exact: true }).click();
  assert.equal(await page.locator('.student-exam-card').count(), 1);
  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  assert.equal(await page.locator('.student-exam-card').count(), 3);
  await page.getByRole('textbox', { name: 'البحث في امتحاناتي' }).fill('العربية');
  assert.equal(await page.locator('.student-exam-card').count(), 1);
  await page.locator('[data-nav="results"]').click();
  assert.equal(
    await page
      .locator('.student-result-score')
      .innerText()
      .then((t) => t.includes('18')),
    true,
  );
  await page.locator('[data-nav="dashboard"]').click();
  await page.getByRole('button', { name: '1 نتائج منشورة' }).click();
  await page.getByRole('heading', { name: 'نتائجي', exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-nav="dashboard"]').click();
  await page.waitForFunction(() => (window as any).triggerCount() === 0);
  await page.evaluate(() => (window as any).setScenario('empty'));
  await page.getByRole('heading', { name: 'لا يوجد امتحان متاح حاليًا' }).waitFor();
  await page.screenshot({ path: 'test-results/student-dashboard-empty.png', fullPage: true });
  await page.evaluate(() => (window as any).setScenario('normal'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-nav="exams"]').click();
    await page.locator('[data-nav="dashboard"]').click();
  }
  assert.equal(await page.evaluate(() => (window as any).triggerCount()), baselineTriggers);
  await page.locator('[data-nav="results"]').click();
  assert.equal(await page.evaluate(() => (window as any).triggerCount()), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Student workspace passed: start/resume, code join, offline guards, responsive RTL, filters/search, result visibility, reduced motion and ScrollTrigger cleanup.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
