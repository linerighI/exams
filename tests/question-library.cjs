const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/question-library-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = async (name) => {
    const toast = page.locator('.toast').getByRole('button', { name: 'إغلاق', exact: true });
    if (await toast.count()) await toast.click();
    await page
      .locator('.page-surface')
      .evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/library-${name}.png`, fullPage: true });
  };
  const folder = (name) =>
    page.locator('.library-folder-card').filter({ has: page.getByText(name, { exact: true }) });
  const newFolder = async (name, color) => {
    await page
      .locator('.library-action-bar')
      .getByRole('button', { name: /مجلد جديد/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'مجلد جديد', exact: true });
    await dialog.getByLabel('اسم المجلد', { exact: true }).fill(name);
    await dialog.getByRole('radio', { name: color, exact: true }).check();
    await dialog.getByRole('button', { name: 'حفظ المجلد', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  };
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Library-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const books = await page.evaluate(async () => {
      const list = [];
      for (const [i, [title, subject]] of [
        ['الجبر والمعادلات', 'الرياضيات'],
        ['الهندسة والقياس', 'الرياضيات'],
        ['المادة والطاقة', 'العلوم'],
        ['اللغة العربية — الفصل الأول', 'اللغة العربية'],
        ['قواعد اللغة الإنجليزية', 'اللغة الإنجليزية'],
        ['تاريخ الأردن', 'التاريخ'],
      ].entries()) {
        const result = await window.desktop.request('/api/bank/import/commit', 'POST', {
          data: {
            version: 1,
            batchId: `library-${i}`,
            book: { title, subject, grade: '10', term: 'الأول', pageCount: 20 },
            questions: Array.from({ length: 26 }, (_, n) => ({
              text: `اختر الإجابة الصحيحة للسؤال ${n + 1}`,
              options: ['أول', 'ثان', 'ثالث', 'رابع'],
              correct: 0,
              explanation: 'تدريب',
              page: 1,
              difficulty: ['سهل', 'متوسط', 'صعب'][n % 3],
              chapter: n < 13 ? 'الوحدة الأولى' : 'الوحدة الثانية',
              evidence: 'تدريب',
            })),
          },
        });
        list.push(result.bookId);
      }
      return list;
    });
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الكتب وبنك الأسئلة', exact: true })
      .click();
    await page.locator('.library-book-card').first().waitFor();
    await newFolder('الرياضيات', 'أخضر');
    await newFolder('العلوم', 'بنفسجي');
    await newFolder('اللغات', 'ذهبي');
    await page.getByLabel('اختيار الجبر والمعادلات', { exact: true }).check();
    await page.getByLabel('اختيار الهندسة والقياس', { exact: true }).check();
    await page
      .locator('.library-selection')
      .getByRole('button', { name: 'نقل إلى مجلد', exact: true })
      .click();
    const state = await page.evaluate(() => window.desktop.request('/api/library/folders'));
    const math = state.folders.find((item) => item.name === 'الرياضيات');
    const science = state.folders.find((item) => item.name === 'العلوم');
    await page.getByLabel('المجلد الوجهة').selectOption(math.id);
    await page.getByRole('button', { name: 'نقل الكتب', exact: true }).click();
    await page.getByRole('dialog', { name: 'نقل الكتب', exact: true }).waitFor({ state: 'hidden' });
    assert.match(await folder('الرياضيات').innerText(), /2 كتاب/);
    await page.getByRole('button', { name: 'نقل المادة والطاقة إلى مجلد', exact: true }).click();
    await page.getByLabel('المجلد الوجهة').selectOption(science.id);
    await page.getByRole('button', { name: 'نقل الكتب', exact: true }).click();
    await page.getByRole('dialog', { name: 'نقل الكتب', exact: true }).waitFor({ state: 'hidden' });
    await shot('grid-1366');
    await folder('الرياضيات').locator('.library-folder-open').click();
    await page.waitForFunction(() => document.querySelectorAll('.library-book-card').length === 2);
    await page.getByRole('button', { name: 'عرض قائمة', exact: true }).click();
    assert.equal(await page.locator('.library-book-grid.is-list').count(), 1);
    await shot('folder-list');
    await page.getByLabel('البحث في الكتب').fill('الهندسة');
    await page.waitForFunction(() => document.querySelectorAll('.library-book-card').length === 1);
    await page.getByRole('button', { name: 'فتح الهندسة والقياس', exact: true }).click();
    await page.getByRole('heading', { name: 'الهندسة والقياس', exact: true }).waitFor();
    await page.locator('.bank-question').first().waitFor();
    assert.equal(await page.locator('.bank-question').count(), 12);
    await page.getByRole('button', { name: 'الصفحة التالية للأسئلة', exact: true }).click();
    assert.match(await page.locator('.bank-question').first().innerText(), /للسؤال 13/);
    await page.getByRole('button', { name: 'الصفحة التالية للأسئلة', exact: true }).click();
    assert.equal(await page.locator('.bank-question').count(), 2);
    await page.getByLabel('البحث في أسئلة البنك').fill('26');
    assert.equal(await page.locator('.bank-question').count(), 1);
    await page.getByRole('button', { name: 'مسح التصفية', exact: true }).click();
    await page
      .locator('.bank-chapters')
      .getByRole('button', { name: /^الوحدة الثانية/ })
      .click();
    assert.match(await page.locator('.bank-section-heading').innerText(), /13 سؤال/);
    await page.getByRole('button', { name: 'مسح التصفية', exact: true }).click();
    await page.locator('.metric-approved').click();
    assert.equal(await page.locator('.bank-question').count(), 0);
    await page.locator('.metric-all').click();
    for (const width of [1366, 1920, 760]) {
      await page.setViewportSize({ width, height: 900 });
      await shot(`bank-dashboard-${width}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'ملفات الكتاب وإعداداته', exact: true }).click();
    await page.getByRole('dialog', { name: 'ملفات الكتاب وإعداداته', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'تصدير بنك PDF محليًا', exact: true }).isVisible(),
      true,
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'إنشاء امتحان', exact: true }).click();
    await page.getByRole('dialog', { name: 'إنشاء امتحان من هذا البنك', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    // Windows-style marquee selects intersecting cards without opening review.
    await page
      .locator('.bank-select-grid')
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const grid = await page.locator('.bank-select-grid').boundingBox();
    const firstCard = await page.locator('.bank-select-card').first().boundingBox();
    await page.mouse.move(grid.x + 12, grid.y + 6);
    await page.mouse.down();
    await page.mouse.move(grid.x + grid.width - 2, firstCard.y + firstCard.height - 5, {
      steps: 8,
    });
    assert.equal(await page.locator('.bank-selection-rectangle').count(), 1);
    await page.mouse.up();
    assert.equal(await page.locator('.bank-select-card.is-selected').count(), 2);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'اعتماد المحدد', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.metric-approved strong')?.textContent === '2',
    );
    await page.getByRole('button', { name: 'مجلد جديد', exact: true }).click();
    const folderDialog = page.getByRole('dialog', { name: 'مجلد أسئلة جديد', exact: true });
    await folderDialog.getByLabel('اسم مجلد الأسئلة', { exact: true }).fill('تدريبات المعادلات');
    await folderDialog.getByRole('radio', { name: 'بنفسجي', exact: true }).check();
    await folderDialog.getByRole('button', { name: 'حفظ مجلد الأسئلة', exact: true }).click();
    await folderDialog.waitFor({ state: 'hidden' });
    const questionFolder = page
      .locator('.bank-question-folder')
      .filter({ hasText: 'تدريبات المعادلات' });
    await page.locator('.bank-question-check input').nth(0).check();
    await page.locator('.bank-question-check input').nth(1).check();
    await page.locator('.bank-select-card').first().dragTo(questionFolder);
    await page.waitForFunction(() =>
      document.querySelector('.bank-question-folder-open small')?.textContent.includes('2'),
    );
    await questionFolder.locator('.bank-question-folder-open').click();
    assert.equal(await page.locator('.bank-question').count(), 2);
    await page.getByRole('button', { name: 'تحديد هذه الصفحة', exact: true }).click();
    await shot('bank-organized-selection-1366');
    await page.getByRole('button', { name: 'نقل', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'نقل الأسئلة المحددة', exact: true })
      .getByLabel('المجلد الوجهة')
      .selectOption('');
    await page.getByRole('button', { name: 'نقل الأسئلة', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'نقل الأسئلة المحددة', exact: true })
      .waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.bank-question').count(), 0);
    await page
      .getByRole('button', { name: 'إدارة مجلد الأسئلة تدريبات المعادلات', exact: true })
      .click();
    await page.getByRole('button', { name: 'حذف المجلد', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'حذف مجلد الأسئلة', exact: true })
      .waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.bank-question').count(), 12);
    await page.locator('.bank-question-check input').first().check();
    await page.getByRole('button', { name: 'حذف', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'حذف الأسئلة المحددة', exact: true })
      .waitFor({ state: 'hidden' });
    assert.match(await page.locator('.bank-section-heading').innerText(), /25 سؤال/);
    await page
      .locator('.bank-chapter-row')
      .first()
      .getByRole('button', { name: /تعديل اسم الفصل/ })
      .click();
    await page
      .getByRole('dialog', { name: 'تعديل اسم الفصل', exact: true })
      .getByLabel('اسم الفصل', { exact: true })
      .fill('المعادلات');
    await page.getByRole('button', { name: 'حفظ اسم الفصل', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'تعديل اسم الفصل', exact: true })
      .waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('.bank-chapters').getByText('المعادلات', { exact: true }).count(),
      1,
    );
    await shot('bank-arabic-chapters-1366');
    await page.locator('.bank-question').first().click();
    await page.getByRole('dialog', { name: 'مراجعة السؤال', exact: true }).waitFor();
    await page.getByRole('button', { name: 'إغلاق مراجعة السؤال', exact: true }).click();
    await page.getByRole('button', { name: 'العودة إلى المكتبة', exact: true }).click();
    await folder('الرياضيات').getByLabel('إدارة المجلد الرياضيات', { exact: true }).click();
    await folder('الرياضيات')
      .getByRole('button', { name: 'تعديل الاسم واللون', exact: true })
      .click();
    await page.getByLabel('اسم المجلد', { exact: true }).fill('رياضيات العاشر');
    await page.getByRole('radio', { name: 'وردي', exact: true }).check();
    await page.getByRole('button', { name: 'حفظ المجلد', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'تعديل المجلد', exact: true })
      .waitFor({ state: 'hidden' });
    await folder('رياضيات العاشر')
      .getByLabel('إدارة المجلد رياضيات العاشر', { exact: true })
      .click();
    await folder('رياضيات العاشر').getByRole('button', { name: 'حذف المجلد', exact: true }).click();
    await page.getByRole('button', { name: 'حذف المجلد فقط', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'حذف المجلد', exact: true })
      .waitFor({ state: 'hidden' });
    assert.equal((await page.evaluate(() => window.desktop.request('/api/books'))).length, 6);
    assert.equal(
      (await page.evaluate((id) => window.desktop.request(`/api/books/${id}/questions`), books[0]))
        .length,
      26,
    );
    await newFolder('الرياضيات', 'أخضر');
    await folder('العلوم').locator('.library-folder-open').click();
    await page.locator('.library-action-create').click();
    await page
      .getByRole('navigation', { name: 'خطوات استيراد البنك' })
      .getByRole('button', { name: /استورد البنك/ })
      .click();
    await page.getByLabel('ملف JSON للبنك').setInputFiles({
      name: 'science.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          batchId: 'folder-import',
          book: {
            title: 'الحركة والقوى',
            subject: 'العلوم',
            grade: '10',
            term: 'الأول',
            pageCount: 10,
          },
          questions: Array.from({ length: 26 }, (_, n) => ({
            text: 'ما وحدة قياس القوة؟',
            options: ['نيوتن', 'متر', 'ثانية', 'لتر'],
            correct: 0,
            explanation: 'وحدة القوة',
            page: 1,
            difficulty: 'سهل',
            chapter: 'القوى',
            evidence: 'تعريف',
          })),
        }),
      ),
    });
    await page.getByRole('button', { name: 'معاينة الاستيراد', exact: true }).click();
    await page.getByRole('button', { name: 'حفظ البنك كمسودات', exact: false }).click();
    await page.getByRole('heading', { name: 'الحركة والقوى', exact: true }).waitFor();
    const importedFolder = await page.evaluate(async () => {
      const books = await window.desktop.request('/api/books');
      const state = await window.desktop.request('/api/library/folders');
      return state.bookFolders[books.find((book) => book.title === 'الحركة والقوى').id];
    });
    assert.equal(importedFolder, science.id);
    await page.getByRole('button', { name: 'العودة إلى المكتبة', exact: true }).click();
    await page.evaluate(async (ids) => {
      const state = await window.desktop.request('/api/library/folders');
      await window.desktop.request('/api/library/move', 'PUT', {
        bookIds: ids.slice(0, 2),
        folderId: state.folders.find((item) => item.name === 'الرياضيات').id,
      });
      await window.desktop.request('/api/library/move', 'PUT', {
        bookIds: ids.slice(3, 5),
        folderId: state.folders.find((item) => item.name === 'اللغات').id,
      });
    }, books);
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الرئيسية والمساعد', exact: true })
      .click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page
      .locator('.sidebar nav')
      .getByRole('button', { name: 'الكتب وبنك الأسئلة', exact: true })
      .click();
    await page.locator('.library-book-card').first().waitFor();
    await folder('الرياضيات').waitFor();
    await page.getByRole('button', { name: 'عرض شبكي', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'مسار المكتبة' })
      .getByRole('button', { name: 'كل الكتب', exact: true })
      .click();
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [760, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await shot(`grid-${width}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'Question library passed: marquee selection, batch approval/delete, drag-and-drop question folders, chapter renaming, persisted organization, library folder workflows, question review and responsive 760/1366/1920 layouts.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/library-failure.png', fullPage: true })
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
