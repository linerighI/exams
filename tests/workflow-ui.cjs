const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const ExcelJS = require('exceljs');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const app = await launch({
      env: {
        SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/workflow-ui-')),
        SCHOOL_TEST_PORT: String(await freePort()),
        SCHOOL_HEADLESS_TEST: '1',
      },
    }),
    page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const nav = (name) => page.locator('.sidebar nav').getByRole('button', { name, exact: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const splash = page.getByRole('dialog', { name: 'مرحبًا بك في Zunis' });
    if (await splash.isVisible()) await splash.getByRole('button').click();
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Workflow123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await nav('الأدوات').click();
    assert.equal(
      await page.locator('.workflow-guide,.tools-workflow,.tool-workflow-navigation').count(),
      0,
    );
    await page.getByRole('button', { name: 'المساعد العائم', exact: true }).click();
    await page.getByRole('tab', { name: 'مساري', exact: true }).click();
    await page.getByRole('region', { name: 'مسار الأدوات' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.orb-add-tool select')?.disabled);
    const start = await page.evaluate(() => window.desktop.request('/api/workspace'));
    assert.deepEqual(start.workflow, ['blueprint', 'writer', 'geometry']);
    const source = page.locator('.teacher-tool-card').filter({
      has: page.getByRole('button', { name: 'فتح الأداة: الإحصاء السريع', exact: true }),
    });
    await source.dragTo(page.locator('.workflow-tool-drop'));
    await page.waitForFunction(async () => {
      const v = await window.desktop.request('/api/workspace');
      return v.workflow.includes('statistics');
    });
    await page.screenshot({ path: 'test-results/tools-workflow.png' });
    await page.getByRole('button', { name: 'إغلاق المساعد العائم', exact: true }).click();
    await page
      .getByRole('button', { name: 'فتح الأداة: جدول مواصفات الامتحان', exact: true })
      .click();
    const planner = page.getByRole('dialog', { name: 'جدول مواصفات الامتحان', exact: true });
    const bounds = await planner.boundingBox();
    assert.ok(bounds.width <= 770);
    assert.equal(await page.locator('.tool-workflow-navigation').count(), 0);
    assert.equal(await page.locator('.blueprint-help').getAttribute('open'), null);
    await page.screenshot({ path: 'test-results/compact-blueprint.png' });
    await page.getByRole('button', { name: 'العودة إلى الأدوات', exact: true }).click();
    await page
      .getByRole('button', { name: 'فتح الأداة: محرر الصيغ والمعادلات', exact: true })
      .click();
    await page.getByRole('button', { name: 'أضف إلى مسودة السؤال', exact: false }).click();
    await page.getByRole('dialog', { name: 'مختبر كتابة الأسئلة' }).waitFor();
    await page.waitForFunction(() =>
      document.querySelector('[aria-label="نص مسودة السؤال"]')?.value.includes('احسب'),
    );
    await page.getByRole('button', { name: 'العودة إلى الأدوات', exact: true }).click();
    await nav('الطلاب والصفوف').click();
    await page.getByRole('button', { name: 'استيراد Excel أو CSV', exact: true }).click();
    const workbook = new ExcelJS.Workbook(),
      sheet = workbook.addWorksheet('طلاب المدرسة');
    sheet.addRow(['اسم الطالب', 'الرقم الوطني', 'الصف', 'الشعبة']);
    sheet.addRow(['أحمد اختبار', '0123456789', 'العاشر', 'أ']);
    sheet.addRow(['عمر اختبار', '9876543210', 'العاشر', 'ب']);
    await page.getByLabel('ملف قائمة الطلاب').setInputFiles({
      name: 'school.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'معاينة القائمة', exact: true }).click();
    await page.getByText('2 طالب جديد', { exact: true }).waitFor();
    assert.ok(!(await page.locator('.roster-review').innerText()).includes('0123456789'));
    await page.screenshot({ path: 'test-results/student-roster-preview.png' });
    await page.getByRole('button', { name: 'اعتماد القائمة', exact: true }).click();
    await page.getByText('قائمتك جاهزة', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'عرض الطلاب والصفوف', exact: true }).click();
    await page.locator('.table-card').getByText('أحمد اختبار', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'المساعد العائم', exact: true }).click();
    await page.getByRole('tab', { name: 'لهذه الصفحة', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('.orb-context-stats')?.textContent.includes('2 طالب'),
    );
    await page
      .locator('.orb-context-guide')
      .getByRole('button', { name: 'فتح بنك الأسئلة', exact: true })
      .click();
    await page.locator('.library-action-create').click();
    await page.getByRole('button', { name: /افتح المساعد/ }).click();
    await page.getByRole('button', { name: 'تعديل الطلب بمدار Gemini', exact: true }).click();
    await page.getByLabel('تعليمات تعديل الطلب').fill('اجعل التعليمات أوضح');
    await page.getByRole('button', { name: 'اقتراح تعديل عبر Gemini', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'مفتاح API' }).waitFor();
    await page.screenshot({ path: 'test-results/prompt-orb-editor.png' });
    await page.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
    await page.getByRole('button', { name: 'Powered by Zunis', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Zunis · حالة الحماية' })
      .getByText('HTTPS', { exact: false })
      .waitFor();
    await page.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
    const students = await page.evaluate(() => window.desktop.request('/api/students'));
    assert.equal(students.length, 2);
    assert.ok(students.every((s) => s.loginMethod === 'national'));
    const nationalLogin = await page.evaluate(async () => {
      const session = await window.desktop.request('/api/login', 'POST', {
        role: 'student',
        code: '٠١٢٣٤٥٦٧٨٩',
      });
      const forbidden = await window.desktop.request('/api/workspace').then(
        () => false,
        () => true,
      );
      await window.desktop.request('/api/logout', 'POST', { password: 'Workflow123' });
      return { role: session.role, name: session.student.name, forbidden };
    });
    assert.deepEqual(nationalLogin, { role: 'student', name: 'أحمد اختبار', forbidden: true });
    assert.deepEqual(errors, []);
    console.log(
      'Workflow UI passed: native drag/drop and saved sequence, equation transfer, XLSX review/commit, live cross-page counts, contextual orb navigation, Gemini-specific editor and Zunis HTTPS status.',
    );
  } catch (e) {
    await page.screenshot({ path: 'test-results/workflow-failure.png' }).catch(() => {});
    console.error(app.diagnostics());
    throw e;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
