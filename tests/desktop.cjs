const desktopDriver = require('./webview2-driver.cjs');
const { mkdtempSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = resolve(mkdtempSync('.data/desktop-'));
  const port = await desktopDriver.freePort();
  const env = {
    ...process.env,
    SCHOOL_TEST_DATA: directory,
    SCHOOL_TEST_PORT: String(port),
    SCHOOL_HEADLESS_TEST: '1',
    SCHOOL_DEVELOPMENT: process.env.SCHOOL_PACKAGED_EXE ? '0' : '1',
    SCHOOL_TEST_SAVE_DIR: resolve('test-results'),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await desktopDriver.launch({ env, executablePath: process.env.SCHOOL_PACKAGED_EXE,
    args: process.env.SCHOOL_TEST_SOFTWARE_RENDERING === '1' ? ['--software-rendering'] : [] });
  try {
    const page = await desktop.firstWindow();
    await page.waitForLoadState();
    await page.getByRole('heading', { name: 'أهلًا بك من جديد' }).waitFor();
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByRole('heading', { name: 'أهلًا بمدرستك' }).waitFor();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Desktop-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.getByRole('button', { name: 'لاحقًا، أعرف طريقي', exact: true }).click();
    await page.getByRole('button', { name: 'الوضع الكامل', exact: true }).click();
    const info = await page.evaluate(() => window.desktop.host());
    assert.ok(info.fingerprint);
    assert.equal(info.port, port);
    const settings = await page.evaluate(() => window.desktop.request('/api/settings'));
    assert.equal(settings.school, 'مدرسة محمد الشريقي');
    const pdfPath = resolve('test-results/question-bank.pdf');
    const imported = await page.evaluate(() =>
      window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'desktop-01',
          book: {
            title: 'مراجعة الرياضيات',
            subject: 'رياضيات',
            grade: 'العاشر',
            term: 'الأول',
            pageCount: 10,
          },
          questions: [
            {
              text: 'احسب \\(\\frac{1}{2} + \\sqrt{9}\\)',
              options: ['1', '2', '3.5', '4'],
              correct: 2,
              explanation: 'الجذر يساوي ثلاثة، ونضيف نصفًا.',
              page: 8,
              difficulty: 'سهل',
              chapter: 'الأعداد',
              evidence: 'مثال',
              box: null,
            },
          ],
        },
      }),
    );
    assert.ok(imported.bookId);
    assert.equal(
      await page.evaluate((id) => window.desktop.exportBankPDF(id), imported.bookId),
      true,
    );
    assert.equal(readFileSync(pdfPath).subarray(0, 5).toString(), '%PDF-');
    const invalidProvider = await page.evaluate(async () => {
      try {
        await window.desktop.openProvider('https://evil.example');
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(invalidProvider, true);
    await page.getByRole('button', { name: 'الرئيسية والمساعد', exact: true }).click();
    await page.getByRole('button', { name: '+ امتحان يدوي', exact: true }).click();
    await page.getByRole('tab', { name: 'مراجعة الأسئلة', exact: false }).click();
    await page.getByRole('button', { name: 'سؤال', exact: true }).click();
    await page.getByRole('button', { name: 'إنشاء رسم هندسي · GeoGebra' }).click();
    for (let i = 0; i < 100; i++) {
      if (await page.getByRole('button', { name: 'إرفاق صورة الرسم' }).isEnabled()) break;
      await page.waitForTimeout(300);
    }
    assert.equal(
      await page.getByRole('button', { name: 'إرفاق صورة الرسم' }).isEnabled(),
      true,
      'GeoGebra initializes in WebView2 offline',
    );
    await page.evaluate(() =>
      document
        .querySelector('iframe[title="GeoGebra"]')
        .contentWindow.postMessage(
          { type: 'geometry-build', commands: ['O=(0,0)', 'c=Circle(O,3)'] },
          '*',
        ),
    );
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'إرفاق صورة الرسم' }).click();
    await page
      .getByRole('heading', { name: 'محرر الرسومات الهندسية' })
      .waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.attached-image img').count(), 1);
    await page.getByRole('button', { name: 'العودة للامتحانات' }).click();
    const hosts = await page.evaluate(() => window.desktop.discover());
    assert.ok(hosts.length > 0);
    const wrongPin = await page.evaluate(async () => {
      try {
        await window.desktop.pair(
          '127.0.0.1',
          JSON.stringify({ code: 'BAD', fingerprint: '00'.repeat(32) }),
        );
        return false;
      } catch (e) {
        return e.message.includes('بصمة');
      }
    });
    assert.equal(wrongPin, true);
    const result = await page.evaluate(
      async (info) =>
        window.desktop.pair(
          '127.0.0.1',
          JSON.stringify({ code: info.pairCode, fingerprint: info.fingerprint }),
        ),
      info,
    );
    assert.equal(result.school, 'مدرسة محمد الشريقي');
    await page.screenshot({ path: 'test-results/desktop.png' });
    console.log(
      'Desktop passed: bundled assets, restricted WebView2 bridge, TLS host, teacher setup/login, UDP discovery, certificate pin rejection, pairing.',
    );
  } finally {
    await desktop.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
