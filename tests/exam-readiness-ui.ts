import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createApp } from '../server/app';

mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/exam-readiness-ui-'));
const directory = mkdtempSync(join(tmpdir(), 'exam-readiness-ui-'));
const server = await createApp({ directory });
const call = async (url: string, method = 'GET', payload?: any, token?: string) => {
  const response = await server.app.inject({
    url,
    method: method as any,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
};
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'lucide-react',
      'motion/react',
      'katex',
      'driver.js',
      'gsap',
    ],
  },
});
let browser;
try {
  await call('/api/setup', 'POST', { school: 'مدرسة الاختبار', password: 'Readiness123' });
  const teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'Readiness123' }))
    .token;
  writeFileSync(
    join(harness, 'index.html'),
    '<html dir="rtl" lang="ar"><div id="root"></div><script type="module" src="./main.tsx"></script></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `import React from 'react';import {createRoot} from 'react-dom/client';import StudentRosterImport from '/src/StudentRosterImport';import '/src/styles.css';import {setToken} from '/src/api';setToken(${JSON.stringify(teacher)});createRoot(document.getElementById('root')).render(<StudentRosterImport onClose={()=>{}} onImported={async()=>{}}/>);`,
  );
  await vite.listen();
  const base = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => void d.accept());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const response = await server.app.inject({
      url: new URL(req.url()).pathname,
      method: req.method() as any,
      payload: req.postData() || undefined,
      headers: {
        authorization: req.headers().authorization || '',
        ...(req.postData() ? { 'content-type': 'application/json' } : {}),
      },
    });
    await route.fulfill({
      status: response.statusCode,
      contentType: 'application/json',
      body: response.body,
    });
  });
  await page.goto(`${base}/.data/${basename(harness)}/index.html`);
  await page.getByText('استيراد JSON بمساعدة ChatGPT أو Gemini', { exact: true }).click();
  await page.getByLabel('قائمة الطلاب JSON').fill(
    JSON.stringify({
      students: [{ name: 'سارة أحمد', grade: 'العاشر', section: 'أ', id: '001' }],
    }),
  );
  await page.getByRole('button', { name: 'استخدام JSON للمعاينة', exact: true }).click();
  await page.getByRole('button', { name: 'معاينة القائمة', exact: true }).click();
  await page.getByRole('cell', { name: 'سارة أحمد', exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/readiness-json-import.png', fullPage: true });
  await page
    .getByRole('button', { name: /اعتماد|استيراد.*طالب/ })
    .last()
    .click();
  await page.getByRole('heading', { name: 'قائمتك جاهزة', exact: true }).waitFor();
  const students = await call('/api/students', 'GET', undefined, teacher);
  assert.equal(students.length, 1);
  await call(
    '/api/teachers',
    'POST',
    {
      username: 'teacher',
      name: 'معلم الرياضيات',
      password: 'Readiness123',
      classes: ['["10","ا"]'],
    },
    teacher,
  );
  const assigned = (
    await call('/api/login', 'POST', {
      role: 'teacher',
      username: 'teacher',
      password: 'Readiness123',
    })
  ).token;
  const exam = await call(
    '/api/exams',
    'POST',
    {
      title: 'اختبار الرياضيات',
      subject: 'رياضيات',
      grade: '10',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: [
        {
          id: 'q1',
          text: 'ما ناتج جمع 2 و3؟',
          options: ['5', '4', '3', '2'],
          correct: 0,
          explanation: 'جمع',
          page: 1,
        },
        {
          id: 'q2',
          text: 'ما ناتج جمع 3 و3؟',
          options: ['6', '5', '4', '3'],
          correct: 0,
          explanation: 'جمع',
          page: 1,
        },
      ],
    },
    assigned,
  );
  await call(`/api/exams/${exam.id}/publish`, 'POST', {}, assigned);
  const session = await call('/api/login', 'POST', { role: 'student', code: students[0].code });
  await page.addInitScript((s) => {
    sessionStorage.setItem('student-session', JSON.stringify(s));
    sessionStorage.setItem('school-token', s.token);
  }, session);
  await page.goto(base);
  await page.locator('.zunis-splash button').click();
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: 'أهلًا بك، سارة' }).waitFor();
  await page.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.student-next-exam, .student-summary-item')].every(
      (el) => Number(getComputedStyle(el).opacity) > 0.99,
    ),
  );
  for (const width of [1366, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `test-results/readiness-dashboard-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).click();
  await page
    .getByRole('button', { name: 'المتابعة دون كاميرا إن سمح المعلم', exact: true })
    .click();
  await page.getByRole('heading', { name: 'ما ناتج جمع 2 و3؟' }).waitFor();
  const orbColor = () =>
    page
      .locator('.exam-indicator-orb .orb-main')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--main-bg-end').trim());
  assert.equal(await orbColor(), '#3889ed');
  await page.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
  await page.locator('.exam-status-indicator[data-tone="red"]').waitFor();
  assert.equal(await orbColor(), '#e65a71');
  await page.getByRole('button', { name: 'تعليم السؤال الحالي للمراجعة' }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'تعليم السؤال الحالي للمراجعة' })
      .getAttribute('aria-pressed'),
    'true',
  );
  // A real IndexedDB abort must report an error, then allow later writes to recover.
  await page.route('**/api/attempts/**', (route) => route.abort('failed'));
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      const result = put.apply(this, args);
      if (this.name === 'attempts') {
        IDBObjectStore.prototype.put = put;
        const transaction = this.transaction;
        queueMicrotask(() => transaction.abort());
      }
      return result;
    };
  });
  await page.locator('.student-options button').nth(2).click();
  await page.getByText('تعذر الحفظ على هذا الجهاز', { exact: true }).waitFor();
  // Rapid revisions while offline, including edits after the failed write.
  for (const choice of [3, 0, 1]) await page.locator('.student-options button').nth(choice).click();
  await page.getByText('محفوظة على الجهاز', { exact: true }).waitFor();
  const localSnapshot = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('school-exams', 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      try {
        return await new Promise<any>((resolve, reject) => {
          const r = db.transaction('attempts').objectStore('attempts').getAll();
          r.onsuccess = () => resolve(r.result[0]);
          r.onerror = () => reject(r.error);
        });
      } finally {
        db.close();
      }
    });
  assert.equal((await localSnapshot()).answers.q1, 1);
  assert.ok((await localSnapshot()).pending.q1.revision >= 4);
  await page.reload();
  await page.getByRole('heading', { name: 'ما ناتج جمع 2 و3؟' }).waitFor();
  assert.equal(
    await page.locator('.student-options button').nth(1).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'تعليم السؤال الحالي للمراجعة' })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.unroute('**/api/attempts/**');
  await page.getByText('تم الحفظ على جهاز المعلم', { exact: true }).waitFor();
  assert.equal((await call('/api/attempts', 'GET', undefined, assigned))[0].answers.q1, 1);

  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  let lostAcknowledgement = false;
  await page.route('**/api/attempts/*/answers', async (route) => {
    if (lostAcknowledgement) {
      await route.fallback();
      return;
    }
    const request = route.request();
    const response = await server.app.inject({
      url: new URL(request.url()).pathname,
      method: 'PUT',
      payload: request.postData()!,
      headers: {
        authorization: request.headers().authorization,
        'content-type': 'application/json',
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    lostAcknowledgement = true;
    await route.abort('failed');
  });
  await page.locator('.student-options button').nth(0).click();
  await page.locator('.exam-status-indicator[data-tone="red"]').waitFor();
  assert.equal(lostAcknowledgement, true);
  assert.equal((await localSnapshot()).pending.q2.choice, 0);
  await page.unroute('**/api/attempts/*/answers');
  await page.getByText('تم الحفظ على جهاز المعلم', { exact: true }).waitFor();
  assert.equal((await call('/api/attempts', 'GET', undefined, assigned))[0].revisions.q2, 1);

  await page.waitForFunction(
    () =>
      Number(getComputedStyle(document.querySelector('.student-question-content')!).opacity) > 0.99,
  );
  await page.locator('.exam-status-indicator[data-tone="green"]').waitFor();
  // Green confirms completion even with an incorrect answer; grades remain private.
  assert.equal(await orbColor(), '#29b68e');
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.locator('.page-surface').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: 'test-results/readiness-exam-1366.png', fullPage: true });
  await page.route('**/api/attempts/*/status', (route) => route.abort('failed'));
  await page.locator('.exam-status-indicator[data-tone="red"]').waitFor();
  assert.equal(await orbColor(), '#e65a71');
  await page.screenshot({ path: 'test-results/exam-orb-offline.png', fullPage: true });
  await page.unroute('**/api/attempts/*/status');
  await page.locator('.exam-status-indicator[data-tone="green"]').waitFor();
  assert.equal(await orbColor(), '#29b68e');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'السؤال 1 مجاب معلّم للمراجعة', exact: true }).click();
  await page.locator('.student-options button').nth(0).click();
  await page.getByText('تم الحفظ على جهاز المعلم', { exact: true }).waitFor();
  assert.equal(await orbColor(), '#29b68e');
  assert.equal(
    await page
      .locator('.exam-indicator-orb .orb-main')
      .evaluate((el) => getComputedStyle(el).animationPlayState),
    'paused',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.reload();
  await page.locator('.zunis-splash').waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: 'ما ناتج جمع 2 و3؟' }).waitFor();
  assert.equal(await page.locator('.student-options button.selected').count(), 1);
  await page.route('**/api/attempts/**', (route) => route.abort('failed'));
  await page.getByRole('button', { name: /تسليم الامتحان/ }).click();
  await page.getByRole('button', { name: /تأكيد التسليم|نعم.*تسليم/ }).click();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('school-exams', 1);
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<boolean>((resolve) => {
        const r = db.transaction('attempts').objectStore('attempts').getAll();
        r.onsuccess = () => resolve(r.result[0]?.submitPending === true);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await page.getByRole('heading', { name: 'ما ناتج جمع 2 و3؟' }).waitFor();
  assert.equal((await localSnapshot()).submitPending, true);
  await page.unroute('**/api/attempts/**');

  await page.getByRole('heading', { name: 'تم تسليم إجاباتك بنجاح' }).waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.student-exam-receipt')!).opacity) > 0.99,
  );
  await page.screenshot({ path: 'test-results/readiness-submitted.png', fullPage: true });
  await page.getByRole('button', { name: 'العودة إلى لوحة الطالب', exact: true }).click();
  await page.getByRole('heading', { name: 'أهلًا بك، سارة' }).waitFor();
  assert.equal((await call('/api/attempts', 'GET', undefined, assigned))[0].score, 20);
  await page.locator('[data-nav="exams"]').click();
  await page.getByRole('heading', { name: 'امتحاناتي', exact: true }).waitFor();
  await page.getByRole('button', { name: 'تم التسليم', exact: true }).first().click();
  assert.equal(await page.locator('.student-exam-card').count(), 1);
  await page.getByRole('button', { name: 'متاح الآن', exact: true }).click();
  assert.equal(await page.locator('.student-exam-card').count(), 0);
  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.student-exam-card')].every(
      (el) => Number(getComputedStyle(el).opacity) > 0.99,
    ),
  );
  await page.screenshot({ path: 'test-results/readiness-exam-list.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-nav="results"]').click();
  await page.getByRole('heading', { name: 'نتائجي', exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/readiness-results.png', fullPage: true });
  assert.equal(await page.locator('.student-result-card').count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    'Readiness UI passed: JSON paste/preview/commit, assigned-teacher exam visibility, responsive dashboard, aborted IndexedDB recovery, rapid offline revisions, reload during outage, lost acknowledgement replay, queued submission after reload, dashboard return; no browser errors.',
  );
} finally {
  await browser?.close();
  await vite.close();
  await server.app.close();
  rmSync(harness, { recursive: true, force: true });
  rmSync(directory, { recursive: true, force: true });
}
