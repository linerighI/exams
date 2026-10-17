const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');

(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/teacher-layout-')),
      SCHOOL_TEST_PORT: String(await freePort()),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const nav = page.locator('.sidebar nav');
  const go = async (name) => {
    await nav.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(250);
  };
  const shot = async (name) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/layout-${name}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  };
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Layout-test123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.evaluate(async () => {
      for (const [id, name, grade, section] of [
        ['s1', 'سارة أحمد', '10', 'أ'],
        ['s2', 'عمر خالد', '10', 'أ'],
        ['s3', 'ليان محمد', '11', 'ب'],
      ])
        await window.desktop.request('/api/students', 'POST', { id, name, grade, section });
      const base = {
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
            id: 'q1',
            text: 'ما ناتج 2 + 3؟',
            options: ['5', '6', '7', '8'],
            correct: 0,
            explanation: 'الجمع',
            page: 1,
          },
        ],
      };
      await window.desktop.request('/api/exams', 'POST', {
        ...base,
        title: 'امتحان الجبر',
        grade: '11',
      });
      const exam = await window.desktop.request('/api/exams', 'POST', {
        ...base,
        title: 'مراجعة الرياضيات',
      });
      await window.desktop.request(`/api/exams/${exam.id}/publish`, 'POST');
      await window.desktop.request('/api/bank/import/commit', 'POST', {
        data: {
          version: 1,
          batchId: 'layout-bank',
          book: {
            title: 'رياضيات الصف العاشر',
            subject: 'الرياضيات',
            grade: '10',
            term: 'الأول',
            pageCount: 5,
          },
          questions: [
            {
              ...base.questions[0],
              chapter: 'الجبر',
              difficulty: 'سهل',
              evidence: 'تدريب',
              box: null,
            },
          ],
        },
      });
    });
    // Backend events refresh the teacher's counters without changing the session.
    await page.waitForFunction(
      () => document.querySelector('.home-overview button b')?.textContent === '2',
    );
    await shot('home-1366');
    assert.equal(await page.locator('.teacher-workbench').count(), 0);
    assert.equal(await page.locator('.studio-action-card').count(), 3);
    for (const height of [768, 600, 1080]) {
      await page.setViewportSize({ width: 1366, height });
      const buttons = nav.getByRole('button');
      assert.equal(await buttons.count(), 7);
      for (let pass = 0; pass < 2; pass++)
        for (const button of await buttons.all()) {
          const label = await button.getAttribute('aria-label');
          await button.hover();
          await page.getByRole('tooltip', { name: label, exact: true }).waitFor();
          const before = await button.boundingBox();
          await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
          assert.equal(await button.locator('svg').isVisible(), true);
          assert.deepEqual(await button.boundingBox(), before);
          assert.equal(
            await button.evaluate((element) => {
              const r = element.getBoundingClientRect();
              return element.contains(
                document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
              );
            }),
            true,
          );
        }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await nav.getByRole('button', { name: 'الأدوات', exact: true }).focus();
    await page.getByRole('tooltip', { name: 'الأدوات', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('tooltip').waitFor({ state: 'hidden' });
    await go('الأدوات');
    assert.equal(await page.locator('.teacher-tool-card').count(), 8);
    assert.equal(await page.locator('.teacher-tool-card p').count(), 0);
    await shot('tools-1366');
    const launch = page.getByRole('button', {
      name: 'فتح الأداة: الآلة الحاسبة العلمية',
      exact: true,
    });
    await launch.click();
    const dialog = page.getByRole('dialog', { name: 'الآلة الحاسبة العلمية', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: '9', exact: true }).click();
    await dialog.getByRole('button', { name: 'الدالة √', exact: true }).click();
    assert.equal(await page.locator('.calculator-result').innerText(), '3');
    await shot('tool-window');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await launch.evaluate((element) => document.activeElement === element), true);
    await go('الكتب وبنك الأسئلة');
    assert.equal(await page.locator('.bank-import-window').getAttribute('open'), null);
    assert.equal(await page.getByLabel('طلب البنك: عنوان الكتاب').isVisible(), false);
    await page.locator('.library-book-open').first().click();
    await page.getByRole('heading', { name: 'رياضيات الصف العاشر', exact: true }).waitFor();
    assert.equal(await page.locator('.bank-book-actions').count(), 0);
    await page.getByRole('button', { name: 'ملفات الكتاب وإعداداته', exact: true }).click();
    assert.equal(
      await page.getByRole('button', { name: 'تصدير بنك PDF محليًا', exact: true }).isEnabled(),
      true,
    );
    await page.keyboard.press('Escape');
    await shot('bank-1366');
    await page.getByRole('button', { name: 'العودة إلى المكتبة', exact: true }).click();
    await page.locator('.library-action-create').click();
    await page.getByLabel('طلب البنك: عنوان الكتاب').fill('طلب محفوظ');
    await page.locator('.bank-import-window > summary').click();
    await page.locator('.library-action-create').click();
    assert.equal(await page.getByLabel('طلب البنك: عنوان الكتاب').inputValue(), 'طلب محفوظ');
    await page.locator('.bank-import-window > summary').click();
    await go('الامتحانات');
    assert.equal(await page.locator('.exam-card').count(), 2);
    assert.equal(
      await page.getByRole('img', { name: 'أوراق امتحان الرياضيات', exact: true }).count(),
      2,
    );
    assert.ok((await page.getByLabel('البحث في الامتحانات').boundingBox()).width > 180);
    await page.getByLabel('البحث في الامتحانات').fill('الجبر');
    await page.waitForFunction(() => document.querySelectorAll('.exam-card').length === 1);
    await page.getByLabel('البحث في الامتحانات').fill('');
    await page.waitForFunction(() => document.querySelectorAll('.exam-card').length === 2);
    await shot('exams-1366');
    const statuses = page.getByRole('navigation', { name: 'حالة الامتحان' });
    await statuses.getByRole('button', { name: /^المسودات/ }).click();
    assert.equal(await page.locator('.exam-card').count(), 1);
    await page.getByLabel('صف الامتحانات').selectOption('10');
    await page.getByRole('heading', { name: 'لا توجد امتحانات مطابقة' }).waitFor();
    await page.getByRole('button', { name: 'عرض كل الامتحانات', exact: true }).click();
    assert.equal(await page.locator('.exam-card').count(), 2);
    await go('الطلاب والصفوف');
    await page.getByRole('heading', { name: 'الطلاب والصفوف', exact: true }).waitFor();
    const classes = page.getByRole('navigation', { name: 'الصفوف والشعب' });
    assert.equal(await page.locator('tbody tr').count(), 3);
    await classes.getByRole('button', { name: /الصف 10 · أ/ }).click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.getByLabel('البحث في الطلاب').fill('سارة');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await shot('students-1366');
    await page.getByLabel('البحث في الطلاب').fill('');
    await classes.getByRole('button', { name: /الصف 11 · ب/ }).click();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.locator('.teacher-disclosure > summary').click();
    await page.getByLabel('اختيار طالب لتجربة الدخول').selectOption('s1');
    assert.equal(
      await page.getByRole('button', { name: 'دخول بصفة الطالب', exact: true }).isEnabled(),
      true,
    );
    for (const [width, height] of [
      [1920, 1080],
      [1024, 768],
      [760, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await go('الأدوات');
      await shot(`tools-${width}`);
      await go('الامتحانات');
      await shot(`exams-${width}`);
      await go('الطلاب والصفوف');
      await shot(`students-${width}`);
    }
    await go('الإعدادات');
    await page.getByRole('navigation', { name: 'أقسام الإعدادات' }).waitFor();
    await shot('settings-760');
    assert.deepEqual(errors, []);
    console.log(
      'Teacher layout passed: stable navigation at 600/768/1080 heights, portal tooltips, keyboard focus/Escape, compact tool windows, calculator, collapsed bank import with retained input, exam status/grade filters, class/section search and responsive 760/1024/1366/1920 layouts.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/layout-failure.png', fullPage: true })
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
