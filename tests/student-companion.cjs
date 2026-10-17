const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/student-companion-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [],
    calls = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Companion-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const fixture = await page.evaluate(async () => {
      const student = await window.desktop.request('/api/students', 'POST', {
        id: 'companion-student',
        name: 'سارة أحمد',
        grade: '10',
        section: 'أ',
      });
      const input = {
        title: 'امتحان رفيقي',
        subject: 'الرياضيات',
        grade: '10',
        section: 'أ',
        term: 'الأول',
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'سهل',
        cameraRequired: false,
        calculatorAllowed: true,
        geogebraAllowed: false,
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 86400000).toISOString(),
        questions: Array.from({ length: 4 }, (_, i) => ({
          id: `companion-q${i}`,
          text: `اختر العدد ${i + 2} من البدائل.`,
          options: [String(i + 2), String(i + 3), String(i + 4), String(i + 5)],
          correct: 0,
          explanation: 'المطابقة',
          page: 1,
        })),
      };
      const exam = await window.desktop.request('/api/exams', 'POST', input);
      await window.desktop.request(`/api/exams/${exam.id}/publish`, 'POST');
      return { student, exam };
    });
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    await page.locator('.mode-switch button').nth(1).click();
    await page.getByLabel('الرقم الوطني أو رمز الطالب').fill(fixture.student.code);
    await page.getByRole('button', { name: 'دخول إلى مساحتي', exact: true }).click();
    await page.getByRole('heading', { name: 'أهلًا بك، سارة', exact: true }).waitFor();
    // Observe real bridge requests; the immutable desktop API continues to execute normally.
    await page.exposeFunction('recordCompanionCall', (path) => calls.push(path));
    await page.evaluate(() => {
      const original = chrome.webview.postMessage.bind(chrome.webview);
      chrome.webview.postMessage = (message) => {
        if (message.method === 'request') void window.recordCompanionCall(message.args[0]);
        original(message);
      };
    });
    const shot = async (name) => {
      await page
        .locator('.page-surface')
        .evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/student-indicator-${name}.png`, fullPage: true });
    };
    assert.equal(
      await page
        .locator('.student-companion, #student-guide-panel, .student-guide-invitation')
        .count(),
      0,
    );
    await shot('home');
    await page.getByRole('button', { name: 'امتحاناتي', exact: true }).click();
    await page
      .locator('.exam-card')
      .filter({ hasText: 'امتحان رفيقي' })
      .getByRole('button', { name: 'ابدأ الامتحان', exact: true })
      .click();
    const indicator = page.locator('.exam-status-indicator');
    await page.locator('.exam-status-indicator.is-blue').waitFor();
    const timer = page.locator('.exam-navigation .timer');
    assert.ok(
      (await indicator.boundingBox()).y >=
        (await timer.boundingBox()).y + (await timer.boundingBox()).height,
    );
    assert.equal(await indicator.locator('button,input,textarea').count(), 0);
    await indicator.click();
    assert.equal(await page.locator('#student-guide-panel, .guide-conversation').count(), 0);
    await page.getByRole('button', { name: 'تعليم السؤال الحالي للمراجعة', exact: true }).click();
    await page.locator('.question-map button.flagged').waitFor();
    const attempts = await page.evaluate(() => window.desktop.request('/api/attempts'));
    assert.equal(Object.keys(attempts[0].answers).length, 0);
    await page.reload();
    await page.locator('.question-map button.flagged').waitFor();
    await page.getByRole('button', { name: /^السؤال 4 / }).click();
    await page.locator('.exam-status-indicator.is-red').waitFor();
    await page.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'هل تريد تسليم الامتحان؟' }).count(), 0);
    await page.getByRole('button', { name: 'الآلة الحاسبة', exact: true }).click();
    await page.getByRole('dialog', { name: 'الآلة الحاسبة', exact: true }).waitFor();
    await page.getByLabel('إغلاق أداة الرياضيات').click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: new RegExp(`^السؤال ${i + 1} `) }).click();
      await page.locator('.student-options button').first().click();
    }
    await page.locator('.exam-status-indicator.is-green').waitFor();
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [760, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await shot(`exam-${width}`);
      const t = await timer.boundingBox(),
        orb = await indicator.boundingBox();
      assert.ok(orb.y >= t.y + t.height, 'indicator stays below timer');
      assert.equal(await page.locator('.student-companion, #student-guide-panel').count(), 0);
    }
    await page.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد التسليم', exact: true }).click();
    await page.getByRole('heading', { name: 'تم تسليم إجاباتك بنجاح' }).waitFor();
    await page.getByRole('button', { name: 'العودة إلى لوحة الطالب', exact: true }).click();
    await page.getByRole('button', { name: 'نتائجي', exact: true }).click();
    assert.equal(await page.locator('.student-companion, #student-guide-panel').count(), 0);
    assert.equal(
      calls.some((path) => /\/api\/(assistant|ai|geometry\/generate)/.test(path)),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Student indicator passed: no student chat/help in any page, fixed status below timer, blue/red/green states, review recovery, permitted calculator and confirmed submission at 760/1366/1920.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/companion-failure.png', fullPage: true })
      .catch(() => {});
    console.error(app.diagnostics());
    throw error;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
