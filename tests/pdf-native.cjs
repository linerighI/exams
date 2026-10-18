const { launch, freePort } = require('./webview2-driver.cjs');
const { mkdirSync, mkdtempSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  mkdirSync('.data', { recursive: true });
  const directory = mkdtempSync(resolve('.data/pdf-native-'));
  const output = join(directory, 'exports');
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: directory,
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
      SCHOOL_TEST_SAVE_DIR: output,
    },
  });
  try {
    const page = await app.firstWindow();
    await page.evaluate(async () => {
      await window.desktop.host();
      await window.desktop.request('/api/setup', 'POST', {
        school: 'مدرسة اختبار PDF',
        password: 'Native-pdf123',
      });
      await window.desktop.request('/api/login', 'POST', {
        role: 'teacher',
        password: 'Native-pdf123',
      });
      await window.desktop.request('/api/students', 'POST', {
        id: 'native-pdf-student',
        name: 'طالب تجريبي',
        grade: '10',
        section: 'أ',
      });
    });
    const bank = await page.evaluate(() =>
      window.desktop.request('/api/books/manual', 'POST', {
        title: 'بنك تجريبي',
        subject: 'رياضيات',
        grade: '10',
        term: 'الأول',
      }),
    );
    const preview = await page.evaluate(
      (id) =>
        window.desktop.request(
          `/api/books/${id}/document?audience=student&approvedOnly=true&chapter=&title=${encodeURIComponent('معاينة الطالب')}`,
        ),
      bank.id,
    );
    assert.match(preview.html, /معاينة الطالب/);
    assert.equal(await page.evaluate(() => window.desktop.exportSpreadsheet('students')), true);
    assert.equal(readFileSync(join(output, 'students.xlsx')).subarray(0, 2).toString(), 'PK');
    await page.evaluate(async (id) => {
      await window.desktop.request(`/api/books/${id}/questions`, 'POST', {
        text: 'احسب \\(x^2\\) عندما x يساوي 2',
        options: ['1', '2', '3', '4'],
        correct: 3,
        explanation: 'نربّع العدد',
        evidence: 'كتبه المعلم',
        page: 1,
        difficulty: 'سهل',
        chapter: 'جبر',
        status: 'approved',
        requiresImage: false,
      });
    }, bank.id);
    assert.equal(
      await page.evaluate(() =>
        window.desktop.exportReportPDF({
          sections: ['students', 'accounts'],
          includeLoginCodes: true,
          includeAnswerDetails: false,
          includeArchived: true,
        }),
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          window.desktop.exportBankPDF(id, {
            audience: 'student',
            approvedOnly: true,
            title: 'ورقة الطالب',
            chapter: '',
          }),
        bank.id,
      ),
      true,
    );
    for (const name of [
      `school-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      'question-bank.pdf',
    ])
      assert.equal(readFileSync(join(output, name)).subarray(0, 5).toString(), '%PDF-');
    console.log(
      'Native WebView2 PDF export passed: school data and student question paper saved through real desktop bridge.',
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
