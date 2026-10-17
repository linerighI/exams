const assert = require('node:assert/strict');
const https = require('node:https');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const port = await freePort();
  const call = (path, method = 'GET', payload, token) =>
    new Promise((resolve, reject) => {
      const data = payload === undefined ? undefined : JSON.stringify(payload);
      const req = https.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          rejectUnauthorized: false,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(data
              ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
              : {}),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const value = JSON.parse(body);
              if (res.statusCode >= 400) reject(Error(value.error));
              else resolve(value);
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      req.on('error', reject);
      req.end(data);
    });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/monitoring-')),
      SCHOOL_TEST_PORT: String(port),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Monitor-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Monitor-test123' })
    ).token;
    const exams = [];
    for (const title of ['مراجعة الرياضيات', 'امتحان العلوم', 'تقييم اللغة العربية']) {
      const exam = await call(
        '/api/exams',
        'POST',
        {
          title,
          subject: title.includes('علوم')
            ? 'العلوم'
            : title.includes('عربية')
              ? 'اللغة العربية'
              : 'الرياضيات',
          grade: '10',
          section: 'أ',
          term: 'الأول',
          kind: 'نصفي',
          duration: 45,
          total: 20,
          difficulty: 'سهل',
          cameraRequired: false,
          opensAt: new Date(Date.now() - 60000).toISOString(),
          closesAt: new Date(Date.now() + 86400000).toISOString(),
          questions: [
            {
              id: 'q1',
              text: 'ما ناتج الجمع 2+3؟',
              options: ['5', '6', '7', '8'],
              correct: 0,
              explanation: 'الجمع',
              page: 1,
            },
          ],
        },
        teacher,
      );
      await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher);
      exams.push(exam);
    }
    const records = [];
    for (const [id, name] of [
      ['s1', 'سارة أحمد'],
      ['s2', 'عمر خالد'],
      ['s3', 'ليان محمد'],
    ]) {
      const student = await call(
        '/api/students',
        'POST',
        { id, name, grade: '10', section: 'أ' },
        teacher,
      );
      const token = (await call('/api/login', 'POST', { role: 'student', code: student.code }))
        .token;
      const { attempt } = await call(
        '/api/attempts/start',
        'POST',
        { examId: exams[0].id, cameraAvailable: true },
        token,
      );
      await call(
        `/api/attempts/${attempt.id}/answers`,
        'PUT',
        { answers: [{ questionId: 'q1', choice: 0, revision: 1 }] },
        token,
      );
      if (id !== 's1') await call(`/api/attempts/${attempt.id}/submit`, 'POST', {}, token);
      if (id === 's3')
        await call(
          `/api/attempts/${attempt.id}/answers`,
          'PUT',
          { answers: [{ questionId: 'q1', choice: 1, revision: 2 }] },
          token,
        );
      records.push(attempt.id);
    }
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'المتابعة والنتائج', exact: true })
      .click();
    await page.getByRole('heading', { name: 'المتابعة والنتائج', exact: true }).waitFor();
    await page.locator('.monitor-exam-grid article').first().waitFor();
    assert.equal(await page.locator('.sidebar nav button').count(), 7);
    assert.equal(await page.locator('.monitor-exam-grid article').count(), 3);
    assert.equal(await page.locator('.orb-launcher').count(), 0);
    for (const [width, height] of [
      [1366, 900],
      [1920, 1080],
      [760, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator('.page-surface').evaluate((element) => element.scrollTo({ top: 0 }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/monitoring-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page
      .getByRole('button', { name: 'عرض المحاولات التي تحتاج مراجعة', exact: true })
      .click();
    await page.locator('.monitor-attempts tbody tr').filter({ hasText: 'ليان محمد' }).waitFor();
    assert.equal(await page.locator('.monitor-attempts tbody tr').count(), 1);
    await page.getByRole('button', { name: 'قبول المتأخر', exact: true }).click();
    await page.waitForFunction(
      async (id) =>
        (await window.desktop.request('/api/attempts')).find((a) => a.id === id).status !==
        'review',
      records[2],
    );
    await page.locator('.monitor-filters > button').click();
    await page.getByLabel('البحث في المحاولات').fill('سارة');
    await page.locator('.monitor-attempts tbody tr').filter({ hasText: 'سارة أحمد' }).waitFor();
    await page.getByTitle('فتح بث كاميرا الطالب', { exact: true }).click();
    const lab = page.getByRole('dialog', { name: 'غرفة المتابعة المباشرة', exact: true });
    await lab
      .getByRole('navigation', { name: 'أقسام المراقبة المباشرة' })
      .getByRole('button', { name: 'الكاميرات', exact: true })
      .waitFor();
    await lab.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
    await page.getByLabel('البحث في المحاولات').fill('');
    const card = page.locator('.monitor-exam-grid article').filter({ hasText: 'مراجعة الرياضيات' });
    await card.getByRole('button', { name: 'الدرجات', exact: true }).click();
    await page.locator('.monitor-attempts tbody tr').first().waitFor();
    assert.equal(await page.locator('.monitor-attempts tbody tr').count(), 2);
    await card.getByRole('button', { name: 'نشر النتائج', exact: true }).click();
    await page.waitForFunction(
      async (id) =>
        (await window.desktop.request('/api/exams')).find((e) => e.id === id).resultsPublished,
      exams[0].id,
    );
    await card.locator('summary').click();
    await card.getByRole('button', { name: 'إغلاق الإتاحة', exact: true }).click();
    await page.waitForFunction(
      async (id) =>
        (await window.desktop.request('/api/exams')).find((e) => e.id === id).status === 'closed',
      exams[0].id,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Monitoring passed: merged navigation, status orb review action, late-answer review, camera requests, grade filtering, publication, close availability and responsive 760/1366/1920 layouts.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/monitoring-failure.png', fullPage: true })
      .catch(() => {});
    console.error(app.diagnostics());
    throw error;
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
