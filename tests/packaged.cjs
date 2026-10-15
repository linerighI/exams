const { _electron: electron } = require('playwright');
const { mkdtempSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const https = require('node:https');
(async () => {
  mkdirSync('.data', { recursive: true });
  const directory = resolve(mkdtempSync('.data/package-'));
  const env = { ...process.env, SCHOOL_HEADLESS_TEST: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await electron.launch({
    executablePath: resolve('release/win-unpacked/Alshereqi Exams.exe'),
    env,
    timeout: 60000,
  });
  desktop.process().stderr.on('data', (data) => console.error(data.toString().slice(-1500)));
  let page;
  try {
    await desktop.evaluate(({ app }, directory) => app.setPath('userData', directory), directory);
    page = await desktop.firstWindow();
    await page.waitForLoadState();
    assert.equal(
      await desktop.evaluate(({ app }) => app.getVersion()),
      require('../package.json').version,
    );
    assert.equal(await page.evaluate(() => typeof window.desktop.request), 'function');
    await page.setViewportSize({width:1366,height:768});
    await page.getByAltText('وزارة التربية والتعليم الأردنية').evaluate(img=>img.decode());
    assert.equal(await page.getByRole('button',{name:'الاتصال بجهاز المدرسة'}).count(),0);
    await page.screenshot({path:'test-results/packaged-login-1366.png'});
    const portBusy = await new Promise((resolve, reject) => {
      const socket = require('node:net').createConnection({ host: '127.0.0.1', port: 4310 });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', (error) => {
        socket.destroy();
        if (error.code === 'ECONNREFUSED') resolve(false);
        else reject(error);
      });
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(Error('Port preflight timed out'));
      });
    });
    if (portBusy) {
      console.log(
        `Packaged ${require('../package.json').version} launch and isolated preload passed. SKIPPED master/PDF integration: port 4310 is already occupied; the running app was left untouched.`,
      );
      return;
    }
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await new Promise((r) => setTimeout(r, 3000));
    console.log(
      'Server handles',
      await desktop.evaluate(() =>
        process
          ._getActiveHandles()
          .filter((h) => typeof h.address === 'function')
          .map((h) => h.address()),
      ),
    );
    console.log('UI state', await page.locator('.error-note').allTextContents());
    await new Promise((resolve, reject) => {
      const request = https.get(
        'https://127.0.0.1:4310/api/status',
        { rejectUnauthorized: false },
        (res) => {
          let body = '';
          res.on('data', (b) => (body += b));
          res.on('end', () => {
            console.log('External status', body);
            resolve();
          });
        },
      );
      request.setTimeout(5000, () => request.destroy(new Error('HTTPS status timed out')));
      request.on('error', reject);
    });
    await page.getByRole('heading', { name: 'أهلًا بمدرستك' }).waitFor();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Packaged-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const imported = await page.evaluate(() =>
      window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'packaged-01',
          book: {
            title: 'بنك اختبار الحزمة',
            subject: 'رياضيات',
            grade: 'العاشر',
            term: 'الأول',
            pageCount: 132,
          },
          questions: [
            {
              text: 'احسب \\(x^2\\)',
              options: ['1', '2', '3', '4'],
              correct: 3,
              explanation: 'نربع العدد',
              page: 8,
              difficulty: 'سهل',
              chapter: 'الجبر',
              evidence: 'مثال',
              box: null,
            },
          ],
        },
      }),
    );
    assert.equal(imported.imported, 1);
    const document = await page.evaluate(
      (id) => window.desktop.request(`/api/books/${id}/document`),
      imported.bookId,
    );
    assert.match(document.html, /font\/woff2;base64/);
    const assistant = await page.evaluate(() =>
      window.desktop.request('/api/assistant/messages', 'POST', { message: '/كتاب' }),
    );
    assert.ok(assistant.conversation.messages.at(-1).cards.some((c) => c.kind === 'book'));
    await page.getByRole('button', { name: '+ امتحان يدوي', exact: true }).click();
    await page.getByLabel('بنك أسئلة الامتحان').waitFor();
    assert.equal(await page.locator('.editor-section input[accept*="pdf"]').count(), 0);
    await page.getByRole('button', { name: 'العودة للامتحانات' }).click();
    const modelStatus = await page.evaluate(() => window.desktop.request('/api/model'));
    if (modelStatus.ready) {
      const expected = modelStatus.models.includes('qwen3:1.7b') ? 'qwen3:1.7b' : modelStatus.model;
      assert.equal(modelStatus.model, expected);
      assert.equal(modelStatus.ready, true);
      assert.equal(
        (await page.evaluate(() => window.desktop.request('/api/settings'))).model,
        expected,
      );
    }
    const data = readFileSync('test-results/arabic-mixed.pdf').toString('base64');
    const job = await page.evaluate(
      (data) => window.desktop.request('/api/sources', 'POST', { name: 'منهج تجريبي.pdf', data }),
      data,
    );
    let result;
    for (let i = 0; i < 100; i++) {
      result = await page.evaluate((id) => window.desktop.request('/api/jobs/' + id), job.jobId);
      if (result.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.equal(result.status, 'done', result.error);
    assert.equal(result.source.pages.length, 2);
    assert.ok(result.source.pages[1].text.includes('الماء'));
    const originalBook = readFileSync(
      'C:/Users/User/Downloads/كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول.pdf',
    ).toString('base64');
    const book = await page.evaluate(
      (pdf) =>
        window.desktop.request('/api/books', 'POST', {
          title: 'كتاب الرياضيات',
          subject: 'رياضيات',
          grade: 'العاشر',
          term: 'الأول',
          pdf,
        }),
      originalBook,
    );
    assert.equal(book.pageCount, 132);
    const preview = await page.evaluate(
      (id) => window.desktop.request(`/api/books/${id}/page/8`),
      book.id,
    );
    assert.ok(preview.image.startsWith('data:image/png;base64,'));
    console.log(
      'Packaged app passed: production Electron + SQLite + HTTPS + bundled offline PDF/OCR worker on Arabic mixed PDF.',
    );
  } catch (error) {
    if (page) {
      console.error('UI diagnostic:', await page.locator('.error-note').allTextContents());
    }
    throw error;
  } finally {
    await desktop.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
