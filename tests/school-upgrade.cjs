const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/school-upgrade-')),
      SCHOOL_HEADLESS_TEST: '1',
      SCHOOL_TEST_PORT: String(await freePort()),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1366, height: 768 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    };
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Upgrade-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.getByRole('navigation', { name: 'أقسام الإعدادات' }).count();
    const imported = await page.evaluate(() =>
      window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'upgrade-ui',
          book: {
            title: 'بنك رياضيات معتمد',
            subject: 'رياضيات',
            grade: '10',
            term: 'الأول',
            pageCount: 20,
          },
          questions: Array.from({ length: 12 }, (_, i) => ({
            text: `ما ناتج العملية ${i}+2؟`,
            options: [String(i + 2), String(i + 3), String(i + 4), String(i + 5)],
            correct: 0,
            explanation: 'نجمع اثنين إلى العدد',
            page: i + 1,
            difficulty: i < 8 ? 'سهل' : 'متوسط',
            chapter: i < 8 ? 'الجبر' : 'الهندسة',
            evidence: 'تدريب جمع',
            box: null,
          })),
        },
      }),
    );
    await page.evaluate(async (id) => {
      const qs = await window.desktop.request(`/api/books/${id}/questions`);
      for (const q of qs)
        await window.desktop.request(`/api/bank/${q.id}`, 'PUT', { ...q, status: 'approved' });
    }, imported.bookId);
    const student = await page.evaluate(() =>
      window.desktop.request('/api/students', 'POST', {
        id: 'student-upgrade',
        name: 'طالب الاختبار',
        grade: '10',
        section: 'أ',
      }),
    );
    await page.getByLabel('مزود الذكاء الاصطناعي').selectOption('openai');
    await page.waitForFunction(
      async () => (await window.desktop.request('/api/settings')).aiProvider === 'openai',
    );
    await shot('upgrade-home-1366');
    await page.getByRole('button', { name: 'إعدادات المساعد' }).click();
    const tabs = page.getByRole('navigation', { name: 'أقسام الإعدادات' });
    await tabs.getByRole('button', { name: 'الذكاء الاصطناعي', exact: true }).click();
    await page.getByRole('button', { name: /ChatGPT · OpenAI/ }).waitFor();
    await shot('upgrade-settings-ai-1366');
    for (const name of ['المدرسة', 'اتصال الطلاب', 'حسابات المعلمين', 'النسخ الاحتياطي']) {
      await tabs.getByRole('button', { name, exact: true }).click();
      await page.locator('.settings-content').waitFor();
    }
    await shot('upgrade-settings-backup-1366');
    await tabs.getByRole('button', { name: 'المدرسة', exact: true }).click();
    await shot('upgrade-settings-school-1366');
    await page.getByRole('button', { name: 'الرئيسية والمساعد', exact: true }).click();
    await page.getByRole('button', { name: '+ امتحان يدوي', exact: true }).click();
    await page.getByLabel('بنك أسئلة الامتحان').selectOption(imported.bookId);
    await page.getByRole('button', { name: 'تحديد المجموعة المعتمدة للسحب العشوائي' }).click();
    await page.getByRole('button', { name: 'إضافة 12 إلى الامتحان' }).click();
    await page.getByRole('tab', { name: /إعدادات الامتحان/ }).click();
    assert.equal(await page.getByLabel('سحب عشوائي عند بدء المحاولة').isChecked(), true);
    await page.getByLabel('السماح بالآلة الحاسبة', { exact: true }).check();
    await page.getByLabel('السماح بـ GeoGebra للرسم والاستكشاف', { exact: true }).check();
    await shot('upgrade-exam-distribution-1366');
    await page.locator('.approval input').check();
    await page.getByRole('button', { name: 'اعتماد ونشر الامتحان' }).click();
    await page.waitForFunction(async () =>
      (await window.desktop.request('/api/exams')).some((e) => e.status === 'published'),
    );
    const exam = await page.evaluate(async () =>
      (await window.desktop.request('/api/exams')).find((e) => e.status === 'published'),
    );
    assert.equal(exam.delivery.count, 6);
    assert.equal(exam.questions.length, 12);
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    await page.locator('.mode-switch button').nth(1).click();
    await page.getByLabel('الرقم الوطني أو رمز الطالب').fill(student.code);
    await page.getByRole('button', { name: 'دخول إلى مساحتي' }).click();
    await page
      .locator('.exam-card')
      .filter({ hasText: exam.title })
      .first()
      .getByRole('button', { name: 'ابدأ الامتحان', exact: true })
      .click();
    await page.getByRole('button', { name: 'الآلة الحاسبة', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: 'الدالة √', exact: true }).click();
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: 'الدالة x²', exact: true }).click();
    await page.getByRole('button', { name: '=', exact: true }).click();
    assert.equal(await page.locator('.calculator-result').innerText(), '14');
    const equalsBounds = await page.getByRole('button', { name: '=', exact: true }).boundingBox();
    assert.ok(
      equalsBounds && equalsBounds.y + equalsBounds.height <= 768,
      'Calculator keys fit a 768px screen',
    );
    await shot('upgrade-student-calculator');
    await page.getByLabel('إغلاق أداة الرياضيات').click();
    await page.getByRole('button', { name: 'GeoGebra', exact: true }).click();
    const frame = page.frameLocator('iframe[title="GeoGebra للطالب"]');
    await frame.locator('.GeoGebraFrame').waitFor({ timeout: 45000 });
    await shot('upgrade-student-geogebra');
    await page.getByLabel('إغلاق أداة الرياضيات').click();
    assert.equal(await page.locator('.question-map button').count(), 6);
    await shot('upgrade-student-exam');
    const controlsBounds = await page.locator('.question-controls').boundingBox();
    assert.ok(
      controlsBounds && controlsBounds.y + controlsBounds.height <= 768,
      'Question navigation fits a 768px screen',
    );
    assert.ok(app.diagnostics().includes('Student session locked: true'));
    assert.ok(await page.locator('.exam-status-indicator.is-blue').count());
    await page.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
    await page.locator('.exam-status-indicator.is-red').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'هل تريد تسليم الامتحان؟' }).count(), 0);
    await page.reload();
    await page.locator('.exam-status-indicator').waitFor();
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: new RegExp(`^السؤال ${i + 1} `) }).click();
      await page.locator('.student-options button').first().click();
    }
    await page.locator('.exam-status-indicator.is-green').waitFor();
    await shot('upgrade-student-exam-complete');
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    const exit = page.getByRole('dialog', { name: 'خروج الطالب بإذن المعلم' });
    await exit.getByLabel('كلمة مرور المعلم للخروج').fill('wrong-password');
    await exit.getByRole('button', { name: 'فتح الجلسة وتسجيل الخروج' }).click();
    await exit.getByRole('alert').waitFor();
    assert.ok(await page.locator('.student-session-shell').count());
    await exit.getByLabel('كلمة مرور المعلم للخروج').fill('Upgrade-test123');
    await exit.getByRole('button', { name: 'فتح الجلسة وتسجيل الخروج' }).click();
    await page.getByRole('heading', { name: 'أهلًا بك من جديد' }).waitFor();
    assert.ok(app.diagnostics().includes('Student session locked: false'));
    assert.deepEqual(errors, []);
    console.log(
      'School upgrade UI passed: provider switch, five settings sections, approved bank pool, balanced random delivery, teacher-controlled calculator and offline GeoGebra.',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
