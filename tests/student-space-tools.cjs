const assert = require('node:assert/strict');
const https = require('node:https');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const port = await freePort();
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/student-space-tools-')),
      SCHOOL_HEADLESS_TEST: '1',
      SCHOOL_TEST_PORT: String(port),
    },
  });
  const page = await app.firstWindow();
  const failedRequests = [];
  page.on('requestfailed', (request) =>
    failedRequests.push([request.url(), request.failure()?.errorText]),
  );
  try {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1366, height: 768 });
    const shot = async (name) => {
      await page.waitForTimeout(550);
      await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    };
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    assert.match(
      await page.evaluate(async () => {
        try {
          await window.desktop.openTeacherResource('https://www.google.com/');
        } catch (e) {
          return e.message;
        }
      }),
      /للمعلم/,
    );
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Tools-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('button', { name: 'الأدوات', exact: true }).click();
    await page.getByRole('heading', { name: 'الأدوات', exact: true }).waitFor();
    assert.equal(await page.locator('.teacher-tool-card').count(), 8);
    assert.equal(
      await page.evaluate(() =>
        window.desktop.openTeacherResource('https://nccd.gov.jo/Ar/Pages/Publications/?type=3'),
      ),
      true,
    );
    assert.match(
      await page.evaluate(async () => {
        try {
          await window.desktop.openTeacherResource(
            'https://www.google.com/url?q=https://evil.example',
          );
        } catch (e) {
          return e.message;
        }
      }),
      /غير مسموح/,
    );
    const openTool = async (name) => {
      await page
        .locator('.teacher-tool-card')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
        .getByRole('button', { name: 'فتح الأداة' })
        .click();
    };
    const back = async () =>
      page.getByRole('button', { name: 'العودة إلى الأدوات', exact: true }).click();
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await shot(`teacher-tools-${width}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByLabel('مبحث الأدوات').selectOption('اللغة الإنجليزية');
    assert.equal(await page.locator('.teacher-tool-card').count(), 4);
    await page.getByLabel('مبحث الأدوات').selectOption('');
    await page
      .getByRole('button', { name: 'إضافة الآلة الحاسبة العلمية إلى المفضلة', exact: true })
      .click();
    await page
      .getByRole('navigation', { name: 'أقسام الأدوات' })
      .getByRole('button', { name: 'المفضلة', exact: true })
      .click();
    assert.equal(await page.locator('.teacher-tool-card').count(), 1);
    await openTool('الآلة الحاسبة العلمية');
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: 'الدالة √', exact: true }).click();
    assert.equal(await page.locator('.calculator-result').innerText(), '3');
    await shot('teacher-tools-calculator');
    await back();
    await page
      .getByRole('navigation', { name: 'أقسام الأدوات' })
      .getByRole('button', { name: 'مصادر ومراجع', exact: true })
      .click();
    assert.equal(await page.locator('.teacher-resource-card').count(), 17);
    await page.getByLabel('صف الأدوات').selectOption('10');
    await page.getByLabel('مبحث الأدوات').selectOption('الرياضيات');
    await page.getByLabel('موضوع البحث في Google').fill('تمثيل الدوال');
    await page.getByRole('button', { name: 'بحث', exact: true }).click();
    await page.getByRole('button', { name: 'المنهاج الأردني', exact: true }).click();
    assert.equal(await page.locator('.teacher-resource-card').count(), 4);
    await shot('teacher-tools-resources');
    await page
      .getByRole('navigation', { name: 'أقسام الأدوات' })
      .getByRole('button', { name: 'أدوات العمل', exact: true })
      .click();
    await openTool('محوّل الوحدات');
    assert.equal(await page.getByLabel('ناتج التحويل').innerText(), '1');
    await page.getByLabel('قيمة التحويل').fill('٥٠');
    assert.equal(await page.getByLabel('ناتج التحويل').innerText(), '0.5');
    await back();
    await openTool('الإحصاء السريع');
    await page.getByLabel('بيانات الإحصاء').fill('١، ٢، ٣، ٤');
    assert.equal(await page.locator('.tool-statistics-grid output').nth(2).innerText(), '2.5');
    await back();
    await openTool('جدول مواصفات الامتحان');
    assert.deepEqual(await page.getByTestId('allocated-count').allTextContents(), ['8', '6', '6']);
    await shot('teacher-tools-blueprint');
    await back();
    await openTool('سُلّم تقدير الأداء');
    assert.ok(await page.getByRole('button', { name: 'نسخ سلم التقدير', exact: true }).isEnabled());
    await back();
    await openTool('محرر الصيغ والمعادلات');
    assert.ok(await page.locator('.formula-preview .katex').count());
    assert.equal(await page.locator('.formula-error').count(), 0);
    await shot('teacher-tools-equations');
    await back();
    await openTool('مختبر كتابة الأسئلة');
    await page.getByLabel('نص مسودة السؤال').fill('ما ناتج \\(2+3\\)؟');
    for (let i = 0; i < 4; i++)
      await page.getByLabel(`البديل ${i + 1}`, { exact: true }).fill(String(i + 5));
    await page.getByRole('button', { name: 'إضافة إلى القائمة', exact: true }).click();
    await back();
    await openTool('مختبر كتابة الأسئلة');
    assert.equal(await page.locator('.tool-draft-list>div').count(), 1);
    await back();
    await openTool('GeoGebra · الرسم والهندسة');
    const frame = page.frameLocator('iframe[title="GeoGebra للمعلم"]');
    await frame.locator('.GeoGebraFrame').waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: 'الهندسة', exact: true }).click();
    await frame.locator('.GeoGebraFrame').waitFor({ timeout: 45000 });
    const diagramCreated = await frame
      .locator('body')
      .evaluate(() => api.evalCommand('A=(0,0)') && api.evalCommand('c=Circle(A,2)'));
    assert.equal(diagramCreated, true);
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'التقاط الرسم للسؤال', exact: true }).click();
    await page.getByAltText('معاينة الرسم الملتقط').waitFor();
    await shot('teacher-tools-geogebra');
    await page.getByRole('button', { name: 'نقل الرسم إلى مسودة السؤال', exact: true }).click();
    await page.getByAltText('رسم السؤال').waitFor();
    await page.getByLabel('نص مسودة السؤال').fill('ما نصف قطر الدائرة المرسومة إذا كان قطرها 6؟');
    for (let i = 0; i < 4; i++)
      await page.getByLabel(`البديل ${i + 1}`, { exact: true }).fill(String(i + 3));
    await page
      .getByRole('textbox', { name: 'عنوان مسودة الامتحان' })
      .fill('مسودة من مختبر الأدوات');
    await page
      .locator('.tool-writing-grid')
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await shot('teacher-tools-writing');
    await page.getByRole('button', { name: 'حفظ مسودة وفتحها للمراجعة', exact: true }).click();
    await page.getByRole('heading', { name: 'تعديل الامتحان', exact: false }).waitFor();
    const draft = await page.evaluate(async () =>
      (await window.desktop.request('/api/exams')).find(
        (e) => e.title === 'مسودة من مختبر الأدوات',
      ),
    );
    assert.equal(draft.status, 'draft');
    assert.equal(draft.questions.length, 2);
    assert.ok(draft.questions[1].image.startsWith('data:image/png;base64,'));
    assert.equal(draft.grade, '10');
    assert.equal(draft.subject, 'الرياضيات');
    const student = await page.evaluate(() =>
      window.desktop.request('/api/students', 'POST', {
        id: 'style-student',
        name: 'ليان أحمد',
        grade: '10',
        section: 'أ',
      }),
    );
    const teacher = await page.evaluate(() =>
      window.desktop.request('/api/login', 'POST', { role: 'teacher', password: 'Tools-test123' }),
    );
    const call = (path, method = 'GET', body, token = teacher.token) =>
      new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            rejectUnauthorized: false,
            headers: {
              authorization: `Bearer ${token}`,
              ...(body ? { 'content-type': 'application/json' } : {}),
            },
          },
          (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
              const result = JSON.parse(raw);
              res.statusCode < 300 ? resolve(result) : reject(Error(`${path}: ${raw}`));
            });
          },
        );
        req.on('error', reject);
        req.end(body ? JSON.stringify(body) : undefined);
      });
    const input = {
      title: 'امتحان متاح',
      subject: 'الرياضيات',
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
          id: 'style-q1',
          text: 'كم يساوي اثنان زائد ثلاثة؟',
          options: ['5', '6', '7', '8'],
          correct: 0,
          explanation: 'جمع',
          page: 1,
        },
      ],
    };
    const ready = await call('/api/exams', 'POST', input);
    await call(`/api/exams/${ready.id}/publish`, 'POST');
    const done = await call('/api/exams', 'POST', { ...input, title: 'نتيجة منشورة' });
    await call(`/api/exams/${done.id}/publish`, 'POST');
    const hidden = await call('/api/exams', 'POST', { ...input, title: 'نتيجة بانتظار المعلم' });
    await call(`/api/exams/${hidden.id}/publish`, 'POST');
    const upcoming = await call('/api/exams', 'POST', {
      ...input,
      title: 'امتحان قادم',
      opensAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await call(`/api/exams/${upcoming.id}/publish`, 'POST');
    const studentLogin = await call('/api/login', 'POST', { role: 'student', code: student.code });
    for (const exam of [done, hidden]) {
      const started = await call(
        '/api/attempts/start',
        'POST',
        { examId: exam.id, cameraAvailable: false },
        studentLogin.token,
      );
      await call(
        `/api/attempts/${started.attempt.id}/answers`,
        'PUT',
        { answers: [{ questionId: 'style-q1', choice: 0, revision: 1 }] },
        studentLogin.token,
      );
      await call(
        `/api/attempts/${started.attempt.id}/submit`,
        'POST',
        undefined,
        studentLogin.token,
      );
    }
    await call(`/api/exams/${done.id}/results`, 'POST');
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    await page.locator('.mode-switch button').nth(1).click();
    await page.getByLabel('الرقم الوطني أو رمز الطالب').fill(student.code);
    await page.getByRole('button', { name: 'دخول إلى مساحتي', exact: true }).click();
    await page.getByRole('heading', { name: 'أهلًا بك، ليان', exact: true }).waitFor();
    await page.locator('.student-summary strong').filter({ hasText: '2' }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'الأدوات', exact: true }).count(), 0);
    assert.match(
      await page.evaluate(async () => {
        try {
          await window.desktop.openTeacherResource('https://www.google.com/');
        } catch (e) {
          return e.message;
        }
      }),
      /مقفلة/,
    );
    for (const [slug, label] of [
      ['home', 'الرئيسية'],
      ['exams', 'امتحاناتي'],
      ['results', 'نتائجي'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.locator('.student-space').waitFor();
      for (const [width, height] of [
        [1366, 768],
        [1920, 1080],
        [760, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await shot(`student-${slug}-new-${width}`);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${slug} horizontal overflow at ${width}`,
        );
      }
    }
    const visible = page.locator('.student-result-card').filter({ hasText: 'نتيجة منشورة' }),
      hiddenCard = page.locator('.student-result-card').filter({ hasText: 'نتيجة بانتظار المعلم' });
    assert.match(await visible.innerText(), /20/);
    assert.match(await hiddenCard.innerText(), /بانتظار نشر النتيجة/);
    assert.equal(await hiddenCard.locator('.student-result-score>strong').count(), 0);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole('button', { name: 'امتحاناتي', exact: true }).click();
    await page.getByRole('button', { name: 'تم التسليم', exact: true }).first().count();
    await page.getByLabel('البحث في امتحاناتي').fill('غير موجود');
    assert.equal(await page.locator('.student-exam-card').count(), 0);
    await shot('student-exams-empty-new');
    await page.getByLabel('البحث في امتحاناتي').fill('');
    await page.getByLabel('لديك رمز؟').fill(ready.code);
    await page.getByRole('button', { name: 'انضمام', exact: true }).click();
    await page.locator('.exam-question').waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'Student space and teacher tools passed: eight offline tools, draft + graph handoff, references and native URL restrictions, favorites, role isolation, grade/subject context, student home/exams/results, hidden scores, exam-code entry, responsive 760/1366/1920 layouts.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/student-tools-failure.png', fullPage: true })
      .catch(() => {});
    console.error(
      JSON.stringify({
        failedRequests,
        frames: page.frames().map((frame) => frame.url()),
        diagnostics: app.diagnostics(),
      }),
    );
    throw error;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
