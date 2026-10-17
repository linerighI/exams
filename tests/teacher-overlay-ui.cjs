const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/teacher-overlay-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const orb = () => page.getByRole('button', { name: 'المساعد العائم', exact: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Overlay123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    // Keep the UI test independent of which local AI services happen to be running.
    await page.evaluate(() =>
      window.desktop.request('/api/ai/provider', 'PUT', { provider: 'gemini' }),
    );
    await page.evaluate(async () => {
      for (const [id, grade, section] of [
        ['c10', 'العاشر', 'A'],
        ['c11', 'الحادي عشر', 'B'],
      ])
        await window.desktop.request('/api/students', 'POST', {
          id,
          name: 'طالب اختبار',
          grade,
          section,
        });
    });
    await page.evaluate(() =>
      window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'graph-overlay',
          book: { title: 'الجبر', subject: 'رياضيات', grade: '10', term: 'الأول', pageCount: 1 },
          questions: [
            {
              text: 'إذا كان \\(y=3x+4\\) و \\(y=x^{2}+3x+4\\) فكم عدد حلول النظام الحقيقية؟',
              options: ['0', '8', '-8', 'جميعها'],
              correct: 3,
              explanation: 'الجبر',
              page: 1,
              difficulty: 'سهل',
              chapter: 'المعادلات',
              evidence: 'تدريب',
            },
          ],
        },
      }),
    );
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الكتب وبنك الأسئلة', exact: true })
      .click();
    await page.getByRole('button', { name: 'فتح الجبر', exact: true }).click();
    await page.locator('.bank-question').first().click();
    const review = page.getByRole('dialog', { name: 'مراجعة السؤال', exact: true });
    await review.waitFor();
    await review.getByRole('tab', { name: 'تعديل', exact: true }).click();
    await review.locator('math-field').first().waitFor();
    assert.equal((await review.locator('math-field').count()) >= 2, true);
    for (const value of await review
      .locator('textarea')
      .evaluateAll((nodes) => nodes.map((n) => n.value)))
      assert.ok(!value.includes('\\(') && !value.includes('\\frac'));
    const equation = review.locator('math-field').first();
    await equation.click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(100);
    await page.keyboard.type('y=3x+5', { delay: 90 });
    await page.waitForFunction(() =>
      document.querySelector('math-field')?.value.replace(/\s/g, '').includes('y=3x+5'),
    );
    await page.screenshot({ path: 'test-results/visual-question-editing.png' });
    await review.getByRole('tab', { name: 'معاينة', exact: true }).click();
    await orb().click();
    await page.getByRole('tab', { name: 'لهذه الصفحة', exact: true }).click();
    await page
      .locator('.orb-quick-tools')
      .getByRole('button', { name: 'الآلة الحاسبة', exact: true })
      .click();
    const calculator = page.locator('.orb-tool-window');
    await calculator.getByRole('button', { name: '7', exact: true }).click();
    await calculator.getByRole('button', { name: '+', exact: true }).click();
    await calculator.getByRole('button', { name: '3', exact: true }).click();
    await calculator.getByRole('button', { name: '=', exact: true }).click();
    assert.match(await calculator.locator('.calculator-result').innerText(), /10/);
    assert.equal(await review.isVisible(), true);
    await page.screenshot({ path: 'test-results/question-review-calculator.png' });
    await calculator.getByRole('button', { name: 'إغلاق الأداة', exact: true }).click();
    await review.getByRole('button', { name: /رسم هندسي/ }).click();
    const geometry = page.getByRole('dialog', { name: 'مساحة الرسم · GeoGebra', exact: true });
    await geometry.waitFor();
    assert.ok(await geometry.locator('.geometry-question .katex').count());
    assert.equal(await geometry.locator('.geometry-question textarea').count(), 0);
    await geometry.getByRole('button', { name: 'اقتراح رسم للسؤال', exact: true }).click();
    await geometry.getByText(/^الرسم جاهز/).waitFor({ timeout: 60000 });
    assert.equal(await geometry.getByRole('alert').count(), 0);
    // Orb and tool stay reachable in native dialog's top layer too.
    await orb().click();
    await page
      .locator('.orb-quick-tools')
      .getByRole('button', { name: 'الآلة الحاسبة', exact: true })
      .click();
    await calculator.getByRole('button', { name: '8', exact: true }).click();
    assert.equal(await geometry.isVisible(), true);
    await page.screenshot({ path: 'test-results/geometry-orb-tools.png' });
    await calculator.getByRole('button', { name: 'إغلاق الأداة', exact: true }).click();
    await geometry.getByRole('button', { name: 'إرفاق الرسم بالسؤال', exact: true }).click();
    await geometry.waitFor({ state: 'hidden' });
    assert.equal(await review.isVisible(), true);
    await review.getByRole('button', { name: 'حفظ مسودة', exact: true }).click();
    await review.waitFor({ state: 'hidden' });
    const saved = await page.evaluate(async () => {
      const books = await window.desktop.request('/api/books');
      return (await window.desktop.request(`/api/books/${books[0].id}/questions`))[0];
    });
    assert.ok(saved.image.startsWith('data:image/png;base64,'));
    assert.ok(saved.geometryId);
    assert.ok(saved.text.replace(/\s/g, '').includes('y=3x+5'));
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الإعدادات', exact: true })
      .click();
    await page
      .locator('.settings-tabs')
      .getByRole('button', { name: 'حسابات المعلمين', exact: true })
      .click();
    await page.getByLabel('اسم مستخدم المعلم الجديد').fill('teacher7');
    await page.getByLabel('اسم المعلم الجديد').fill('معلم السابع');
    await page.getByLabel('كلمة مرور المعلم الجديد').fill('Assignments123');
    const form = page.locator('.account-admin form');
    assert.equal(await form.locator('.teacher-grade-selection input').count(), 2);
    await form.getByLabel(/العاشر · A/).check();
    await form.getByLabel(/الحادي عشر · B/).check();
    await form.getByRole('button', { name: 'إنشاء حساب المعلم', exact: true }).click();
    const account = page.locator('.account-list article').filter({ hasText: 'معلم السابع' });
    await account.getByText(/العاشر · A، الحادي عشر · B|الحادي عشر · B، العاشر · A/).waitFor();
    await account.getByRole('button', { name: 'إسناد الصفوف', exact: true }).click();
    await account.getByLabel(/الحادي عشر · B/).uncheck();
    await account.getByRole('button', { name: 'حفظ الصفوف', exact: true }).click();
    await account.getByText('العاشر · A', { exact: true }).waitFor();
    const teachers = await page.evaluate(() => window.desktop.request('/api/teachers'));
    assert.deepEqual(
      teachers.find((t) => t.username === 'teacher7').classes.map((c) => c.id),
      ['["10","ا"]'],
    );
    await page.screenshot({ path: 'test-results/teacher-grade-assignments.png' });
    assert.deepEqual(errors, []);
    console.log(
      'Native WebView2: orb above question and native dialogs, calculator alongside review, rendered math, offline polynomial generation and graph attachment passed.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/teacher-overlay-failure.png' }).catch(() => {});
    console.error(errors);
    throw error;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
