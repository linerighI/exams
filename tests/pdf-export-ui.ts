import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createApp } from '../server/app';
import sharp from 'sharp';

mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/pdf-ui-')),
  database = mkdtempSync(join(tmpdir(), 'pdf-preview-'));
const server = await createApp({ directory: database });
const inject = async (url: string, method = 'GET', payload?: any, token?: string) => {
  const r = await server.app.inject({
    url,
    method: method as any,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  assert.equal(r.statusCode, 200, r.body.slice(0, 300));
  return r.json();
};
let browser;
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'lucide-react'],
  },
});
try {
  await inject('/api/setup', 'POST', {
    school: 'مدرسة الشريقي النموذجية',
    password: 'Pdf-render123',
  });
  const teacher = (
    await inject('/api/login', 'POST', { role: 'teacher', password: 'Pdf-render123' })
  ).token;
  const bank = await inject(
    '/api/books/manual',
    'POST',
    {
      title: 'الرياضيات · بنك المراجعة الشاملة',
      subject: 'الرياضيات',
      grade: 'العاشر',
      term: 'الأول',
    },
    teacher,
  );
  const diagram =
    'data:image/png;base64,' +
    (
      await sharp(
        Buffer.from(
          '<svg width="440" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="440" height="180" fill="#f1f8fa"/><path d="M45 145H405 M60 160V15 M85 120L170 45L270 105L370 25" stroke="#247f96" fill="none" stroke-width="3"/><circle cx="170" cy="45" r="5" fill="#d78d37"/></svg>',
        ),
      )
        .png()
        .toBuffer()
    ).toString('base64');
  const questions = Array.from({ length: 10 }, (_, i) => ({
    id: `q${i}`,
    bookId: bank.id,
    text:
      i % 2
        ? `السؤال ${i + 1}: إذا كان \\(f(x)=x^2-4x+3\\) فما قيمة \\(f(2)\\)؟`
        : `السؤال ${i + 1}: بالاعتماد على الشكل البياني، احسب معدل التغير بين النقطتين المحددتين.`,
    options: ['\\(\\frac{1}{2}\\)', '\\(-1\\)', '\\(\\sqrt{3}\\)', '\\(2x+1\\)'],
    correct: 1,
    explanation: 'نعوض في العلاقة ثم نبسّط للحصول على الناتج الصحيح \\(-1\\).',
    page: i + 1,
    difficulty: 'متوسط',
    chapter: i < 6 ? 'الدوال والمعادلات' : 'الهندسة',
    status: i === 9 ? 'draft' : 'approved',
    ...(i % 2 ? {} : { image: diagram }),
  }));
  for (const q of questions) server.store.put('bank_questions', q);
  for (let i = 0; i < 45; i++)
    server.store.put('students', {
      id: `2026-${i + 1}`,
      name: `الطالب التجريبي ${i + 1}`,
      grade: i % 2 ? 'العاشر' : 'التاسع',
      section: 'أ',
      code: `DEMO-${i.toString().padStart(6, '0')}`,
    });
  const exam = {
    id: 'demo-exam',
    title: 'اختبار الرياضيات الشهري',
    subject: 'الرياضيات',
    grade: 'العاشر',
    section: 'أ',
    term: 'الأول',
    kind: 'نصفي',
    duration: 45,
    total: 20,
    status: 'published',
    questions,
    code: 'DEMO-EXAM',
    opensAt: new Date().toISOString(),
    closesAt: new Date(Date.now() + 3600000).toISOString(),
  };
  server.store.put('exams', exam);
  for (let i = 0; i < 45; i++)
    server.store.put('attempts', {
      id: `demo-attempt-${i}`,
      examId: exam.id,
      studentId: `2026-${i + 1}`,
      score: 12 + (i % 9),
      status: 'submitted',
      startedAt: Date.now() - 1800000,
      deadline: Date.now(),
      submittedAt: Date.now(),
      answers: { q0: 1 },
      revisions: { q0: 1 },
      lateAnswers: {},
    });
  for (let i = 0; i < 15; i++) server.store.audit(`عملية تجريبية ${i + 1}`);
  const reportOptions = {
    sections: ['students', 'results', 'exams', 'banks', 'activity', 'accounts'],
    includeLoginCodes: true,
    includeAnswerDetails: false,
    includeArchived: true,
  };
  const report = (await inject('/api/reports/document', 'POST', reportOptions, teacher)).html;
  const teacherBank = (
    await inject(`/api/books/${bank.id}/document?audience=teacher`, 'GET', undefined, teacher)
  ).html;
  const studentBank = (
    await inject(`/api/books/${bank.id}/document?audience=student`, 'GET', undefined, teacher)
  ).html;
  writeFileSync(
    join(harness, 'index.html'),
    '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>',
  );
  writeFileSync(
    join(harness, 'harness.tsx'),
    `import React from 'react';import {createRoot} from 'react-dom/client';import PDFExport from '/src/PDFExport';import '/src/styles.css';import '/src/surfaces.css';import '/src/schoolUpgrade.css';import '/src/quietWorkspace.css';import '/src/teacherLayout.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/700.css';window.saved=[];window.desktop={request:async(url,method='GET',body)=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return r.json();},exportBankPDF:async(id,options)=>{window.saved.push({id,options});return true;},exportReportPDF:async(options)=>{window.saved.push({options});return true;}};createRoot(document.getElementById('root')).render(<main className="page-surface"><PDFExport notify={()=>{}}/><PDFExport bank={${JSON.stringify({ id: bank.id, title: bank.title, chapters: ['الدوال والمعادلات', 'الهندسة'] })}} notify={()=>{}}/></main>);`,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const response = await server.app.inject({
      url: new URL(req.url()).pathname + new URL(req.url()).search,
      method: req.method() as any,
      payload: req.postData() || undefined,
      headers: { authorization: `Bearer ${teacher}`, 'content-type': 'application/json' },
    });
    await route.fulfill({
      status: response.statusCode,
      contentType: 'application/json',
      body: response.body,
    });
  });
  await page.goto(
    `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/${harness.split(/[\\/]/).slice(-2).join('/')}/index.html`,
  );
  await page.getByRole('button', { name: 'تصدير بيانات المدرسة PDF', exact: true }).click();
  await page.getByLabel('تضمين رموز دخول الطلاب ورموز الامتحانات').check();
  await page.getByRole('button', { name: 'معاينة المستند', exact: true }).click();
  await page
    .frameLocator('iframe[title="معاينة PDF"]')
    .getByRole('heading', { name: 'تقرير بيانات المدرسة', exact: true })
    .waitFor();
  await page.screenshot({ path: 'test-results/pdf-report-ui.png' });
  await page.getByRole('button', { name: 'حفظ PDF', exact: true }).click();
  assert.equal(await page.evaluate(() => (window as any).saved[0].options.includeLoginCodes), true);
  await page.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
  await page.getByRole('button', { name: 'تصدير بنك PDF محليًا', exact: true }).click();
  await page.getByLabel('نوع النسخة').selectOption('student');
  await page.getByRole('button', { name: 'معاينة المستند', exact: true }).click();
  await page
    .frameLocator('iframe[title="معاينة PDF"]')
    .getByText('ورقة أسئلة', { exact: false })
    .waitFor();
  assert.equal(await page.frameLocator('iframe[title="معاينة PDF"]').locator('.key').count(), 0);
  await page.screenshot({ path: 'test-results/pdf-bank-ui.png' });
  await page.setViewportSize({ width: 760, height: 1000 });
  await page.screenshot({ path: 'test-results/pdf-bank-ui-760.png' });
  assert.equal(
    await page.locator('.pdf-export').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    true,
  );
  await page.getByRole('button', { name: 'حفظ PDF', exact: true }).click();
  assert.equal(await page.evaluate(() => (window as any).saved.at(-1).options.audience), 'student');
  assert.deepEqual(errors, []);
  const doc = await browser.newPage();
  for (const [name, html] of [
    ['school-report', report],
    ['teacher-bank', teacherBank],
    ['student-bank', studentBank],
  ]) {
    await doc.setContent(html, { waitUntil: 'load' });
    await doc.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    });
    assert.equal(
      await doc
        .locator('.question-image')
        .evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0)),
      true,
    );
    await doc.pdf({
      path: `test-results/${name}.pdf`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  }
  console.log(
    'PDF export UI passed: previews, credential option, teacher/student settings, native save arguments, 760px layout; generated three sample PDFs.',
  );
} finally {
  await browser?.close();
  await vite.close();
  await server.app.close();
  rmSync(harness, { recursive: true, force: true });
  rmSync(database, { recursive: true, force: true });
}
