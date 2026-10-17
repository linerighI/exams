const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/assistant-workspace-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Assistant-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const bookId = await page.evaluate(async () => {
      const r = await window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'assistant-ui',
          book: {
            title: 'بنك الرياضيات',
            subject: 'الرياضيات',
            grade: '10',
            term: 'الأول',
            pageCount: 10,
          },
          questions: [
            {
              text: 'ما ناتج 2+2؟',
              options: ['4', '5', '6', '7'],
              correct: 0,
              explanation: 'جمع',
              page: 1,
              difficulty: 'سهل',
              chapter: 'الجبر',
              evidence: 'مثال',
            },
          ],
        },
      });
      return r.bookId;
    });
    const send = async (message) => {
      await page.getByLabel('رسالتك للمساعد').fill(message);
      await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    };
    await send('أنشئ مجلدًا باسم مراجعة داخل بنك الرياضيات، ولونه أخضر.');
    const apply = page.getByRole('button', { name: 'تطبيق الاقتراح', exact: true });
    await apply.waitFor();
    assert.equal(
      (await page.evaluate((id) => window.desktop.request(`/api/books/${id}/organization`), bookId))
        .folders.length,
      0,
    );
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/assistant-proposal-review.png' });
    await apply.click();
    await page.getByRole('button', { name: 'تم التطبيق', exact: true }).waitFor();
    const state = await page.evaluate(
      (id) => window.desktop.request(`/api/books/${id}/organization`),
      bookId,
    );
    assert.equal(state.folders[0].name, 'مراجعة');
    assert.equal(state.folders[0].color, 'mint');
    await send('/جاهزية');
    await page.locator('.result-value').filter({ hasText: '0 / 1' }).waitFor();
    await send('افتح الحاسبة');
    const calculatorCard = page.locator('.result-tool').last();
    await calculatorCard.getByRole('button', { name: 'فتح التفاصيل' }).click();
    const calculator = page.getByRole('dialog', { name: 'الآلة الحاسبة العلمية', exact: true });
    await calculator.waitFor();
    await page.keyboard.press('Escape');
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الرئيسية والمساعد', exact: true })
      .click();
    await send('/مراقبة');
    await page.locator('.result-live_room').getByRole('button', { name: 'فتح التفاصيل' }).click();
    await page.getByRole('dialog', { name: 'غرفة المتابعة المباشرة', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log(
      'Assistant WebView2 passed: grounded readiness, review-before-apply folder proposal, persisted result, calculator deep link and live-room action.',
    );
  } catch (e) {
    await page.screenshot({ path: 'test-results/assistant-workspace-failure.png' }).catch(() => {});
    console.error(app.diagnostics());
    throw e;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
