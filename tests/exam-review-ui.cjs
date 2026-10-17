const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = mkdtempSync('.data/exam-review-');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react', 'katex', 'zod', 'motion/react', 'mathlive'] },
  });
  let browser;
  try {
    writeFileSync(resolve(directory, 'index.html'), '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>');
    writeFileSync(resolve(directory, 'harness.tsx'), `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import ExamEditor from '/src/ExamEditor';
      import '/src/styles.css';
      import '/src/teacherLayout.css';
      import '/src/surfaces.css';
      import '/src/schoolUpgrade.css';
      import '@fontsource/tajawal/400.css';
      import '@fontsource/tajawal/700.css';
      const questions = Array.from({length:10}, (_,i)=>({id:'q'+i,text:'سؤال المعادلات '+(i+1),options:['أ','ب','ج','د'],correct:0,explanation:'شرح الإجابة',page:1,chapter:'المعادلات',difficulty:i<3?'سهل':i<6?'صعب':'متوسط'}));
      const initial = {id:'review',title:'امتحان الرياضيات',subject:'رياضيات',grade:'10',section:'أ',term:'الأول',kind:'نصفي',duration:45,total:20,difficulty:'مختلط',cameraRequired:false,opensAt:new Date().toISOString(),closesAt:new Date().toISOString(),questions,version:1,delivery:{mode:'random',count:5,quotas:[{chapter:'المعادلات',difficulty:'سهل',count:2},{chapter:'المعادلات',difficulty:'صعب',count:1},{chapter:'المعادلات',difficulty:'متوسط',count:2}]}};
      createRoot(document.getElementById('root')).render(<main className="page-surface editor-surface"><ExamEditor initial={initial} onSave={()=>{}} onCancel={()=>{}} notify={()=>{}} /></main>);
    `);
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({ json: [] }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/.data/${basename(directory)}/index.html`);
    const review = page.locator('.random-delivery-review');
    await review.waitFor();
    assert.match(await review.innerText(), /10 سؤالًا في المجموعة/);
    assert.match(await review.innerText(), /5 سؤالًا لكل طالب/);
    assert.equal(await page.locator('.question-tabs').isVisible(), false);
    const rows = review.getByRole('row');
    assert.equal(await rows.count(), 4);
    assert.deepEqual(await rows.nth(1).getByRole('cell').allTextContents(), ['المعادلاتسهل', '3', '2']);
    await page.screenshot({ path: 'test-results/random-exam-review.png', fullPage: true });
    await page.getByRole('button', { name: 'مراجعة أسئلة المجموعة', exact: true }).click();
    assert.equal(await page.locator('.question-tabs').isVisible(), true);
    await page.locator('.question-tabs button').nth(1).click();
    assert.match(await page.locator('.teacher-question-preview').innerText(), /سؤال المعادلات 2/);
    await page.getByRole('button', { name: 'تعديل السؤال', exact: true }).click();
    assert.equal(await page.locator('.question-edit-fields').isVisible(), true);
    await page.getByRole('button', { name: 'إخفاء أسئلة المجموعة', exact: true }).click();
    assert.equal(await page.locator('.question-tabs').isVisible(), false);
    await page.getByRole('button', { name: 'تعديل التوزيع', exact: true }).click();
    await page.getByRole('checkbox', { name: 'سحب عشوائي عند بدء المحاولة' }).uncheck();
    await page.getByRole('tab').filter({ hasText: 'مراجعة الأسئلة' }).click();
    assert.equal(await review.count(), 0);
    assert.equal(await page.locator('.question-tabs').isVisible(), true);
    await page.getByRole('tab').filter({ hasText: 'إعدادات الامتحان' }).click();
    await page.getByRole('checkbox', { name: 'سحب عشوائي عند بدء المحاولة' }).check();
    await page.getByRole('tab').filter({ hasText: 'مراجعة التوزيع والمجموعة' }).click();
    assert.equal(await page.locator('.question-tabs').isVisible(), false);
    await page.setViewportSize({ width: 760, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'test-results/random-exam-review-760.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Exam review: random summary, pool editing, fixed/random switching, and narrow layout passed.');
  } finally {
    await browser?.close();
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
