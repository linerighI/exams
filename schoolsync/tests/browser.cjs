/**
 * End-to-end Playwright mobile verification (`390x844` & `320x740` Arabic RTL)
 * covering Family alerts, Blue Orb live pulse, Teacher 1-tap attendance &
 * Student Profile notes/grades, and Dual-Admin (Assistant + Principal) setup.
 */
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  mkdirSync('output/playwright', { recursive: true });
  let app, vite, browser;
  try {
    ({ app } = require('../server/app.cjs').createApp({ demo: true }));
    await app.listen({ port: 4321, host: '127.0.0.1' });
    const { createServer } = await import('vite');
    vite = await createServer({
      configFile: 'schoolsync/vite.config.ts',
      server: { port: 5181, proxy: { '/api': { target: 'http://127.0.0.1:4321', ws: true } } },
    });
    await vite.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: 'ar-JO',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const shot = async (name) => {
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => innerWidth), 390, 'Mobile viewport must not expand');
      assert.ok(
        (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
        `Horizontal overflow detected on ${name}`,
      );
      await page.screenshot({ path: `output/playwright/schoolsync-${name}.png`, fullPage: true });
    };

    const openProfile = async () => {
      await page.getByRole('button', { name: 'فتح الملف الشخصي', exact: true }).click();
      await page.getByRole('heading', { name: 'حسابي.' }).waitFor();
    };

    const logout = async () => {
      await openProfile();
      await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
      await page.locator('[data-portal="family"]').waitFor();
    };

    const familySignIn = async (nationalId, code) => {
      await page.locator('[data-portal="family"]').click();
      await page.getByRole('textbox', { name: 'الرقم الوطني للطالب', exact: true }).fill(nationalId);
      await page.locator('input[type="password"], input[autocomplete="current-password"]').fill(code);
      await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    };

    const staffLogin = async (roleOrEmail) => {
      await page.locator('[data-portal="staff"]').click();
      if (roleOrEmail === 'teacher' || roleOrEmail === 'admin') {
        await page
          .getByRole('button', {
            name: roleOrEmail === 'teacher' ? 'تجربة المعلم' : 'تجربة الإدارة',
            exact: true,
          })
          .click();
      } else {
        await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(roleOrEmail);
        await page.getByLabel('كلمة المرور', { exact: true }).fill('SchoolSync!2026');
        await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
      }
      await page.locator('.staff-space').waitFor();
    };

    await page.goto('http://127.0.0.1:5181');
    await page.locator('[data-portal="family"]').waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('.connection-orb-button .orb-host').count(), 1);
    await page.locator('.connection-orb-button').click();
    await page.getByRole('heading', { name: 'اتصال الخادم والنفق السحابي', exact: true }).waitFor();
    await page.getByRole('button', { name: 'إغلاق لوحة الاتصال', exact: true }).click();
    await shot('login-roles');

    // 1. Parent sign-in, sibling switcher, Blue Orb & tabs
    await familySignIn('0000000001', 'YousefDemo2026');
    await page.getByRole('button', { name: 'متابعة يوم يوسف', exact: true }).waitFor();
    assert.equal(await page.locator('.student-pass').count(), 2);
    await page.getByRole('button', { name: 'الطالب التالي', exact: true }).click();
    await page.getByRole('button', { name: 'متابعة يوم عمر', exact: true }).click();
    await page.locator('.selected-child-bar strong').filter({ hasText: 'عمر أحمد' }).waitFor();
    await page.getByRole('heading', { name: 'أهلاً، ليلى' }).waitFor();
    await shot('family-home');
    assert.equal(await page.locator('.orb-main').count(), 1);
    assert.equal(await page.locator('.timer-art,.tool-grid').count(), 0);

    await page.getByRole('button', { name: 'اختيار الطالب', exact: true }).click();
    const chooser = page.getByRole('dialog');
    await chooser.getByRole('button', { name: 'الطالب التالي', exact: true }).click();
    await chooser.getByRole('button', { name: 'متابعة يوم يوسف', exact: true }).click();
    await page.locator('.selected-child-bar strong').filter({ hasText: 'يوسف أحمد' }).waitFor();

    // Open Blue Orb Day Companion
    await page.getByRole('button', { name: 'فتح رفيق يومك', exact: true }).click();
    await page.getByRole('heading', { name: 'نبض اليوم المدرسي', exact: true }).waitFor();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });

    // Separate Grades & Attendance tabs; clean Profile
    await page.getByRole('button', { name: 'العلامات', exact: true }).click();
    await page.getByRole('heading', { name: 'العلامات.' }).waitFor();
    await shot('grades-tab');
    await page.getByRole('button', { name: 'الحضور', exact: true }).click();
    await page.getByRole('heading', { name: 'الحضور والغياب.' }).waitFor();
    await shot('attendance-tab');
    await openProfile();
    assert.equal(await page.locator('.learning-overview,.attendance-overview,.grade-chart').count(), 0);
    await page.getByRole('switch', { name: 'المظهر الداكن' }).check();
    await shot('family-dark');
    await page.getByRole('switch', { name: 'المظهر الداكن' }).uncheck();

    // Homework monitoring (no submit button on Parent account) & Alerts (no 2-way messaging)
    await page.getByRole('button', { name: 'اليوم', exact: true }).click();
    await page.locator('.mini-card.lavender').click();
    await page.getByRole('heading', { name: 'الواجبات.' }).waitFor();
    await page.getByRole('button').filter({ hasText: 'خطوات صغيرة في عالم الجبر' }).click();
    await page.getByRole('dialog').getByText('لم يُسلّم بعد', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'تسليم الواجب', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'التنبيهات', exact: true }).click();
    await page.getByRole('heading', { name: 'التنبيهات.' }).waitFor();
    assert.equal(await page.locator('input[name="recipient"], .contact-row').count(), 0, 'Two-way chat removed');

    // 320px compact mobile viewport overflow check
    await page.setViewportSize({ width: 320, height: 740 });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => innerWidth), 320);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 320, '320px overflow');
    await page.setViewportSize({ width: 390, height: 844 });
    await logout();

    // 2. Teacher mobile flow: Students navbar, 1-tap toggle, preview, Student Profile notes & marks
    await staffLogin('teacher');
    await page.getByRole('heading', { name: 'أهلاً، سارة' }).waitFor();
    assert.equal(await page.locator('.selected-child-bar,.attendance-overview,.learning-overview').count(), 0);
    assert.equal(await page.locator('.bottom-nav').getByRole('button', { name: 'العلامات', exact: true }).count(), 0);
    assert.equal(await page.locator('.bottom-nav').getByRole('button', { name: 'الحضور', exact: true }).count(), 0);

    await page.getByRole('button', { name: 'الطلاب', exact: true }).click();
    await page.getByRole('heading', { name: 'الطلاب.' }).waitFor();
    await page.getByRole('switch', { name: 'تبديل حضور يوسف أحمد', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'وإشعار ولي الأمر فوراً' }).waitFor();
    await shot('teacher-students');

    // Explicit read-only Family Preview
    await page.getByRole('button', { name: 'معاينة ولي أمر يوسف أحمد', exact: true }).click();
    await page.getByRole('dialog').getByText('معاينة للقراءة فقط', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });

    // Open Student Profile, add behavioral note & published mark
    await page.getByRole('button', { name: 'ملف يوسف أحمد', exact: true }).click();
    await page.getByRole('heading', { name: 'يوسف أحمد', exact: true }).waitFor();
    await page.getByPlaceholder('اكتب ملاحظة سلوكية أو صفية أثناء الحصة...').fill('مشاركة ممتازة أثناء الحصة');
    await page.getByRole('button', { name: 'حفظ وإرسال التنبيه لولي الأمر', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم حفظ الملاحظة' }).waitFor();

    await page.getByRole('button', { name: 'إضافة علامة', exact: true }).click();
    await page.getByPlaceholder('مثال: اختبار الشهر الأول').fill('اختبار الشهر الأول');
    await page.getByRole('spinbutton', { name: 'العلامة', exact: true }).fill('94');
    await page.getByRole('button', { name: 'حفظ العلامة', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم حفظ العلامة ونشرها لولي الأمر' }).waitFor();
    await shot('teacher-student-profile');
    await logout();

    // 3. Verify parent immediately receives Absence Alert + Behavioral Note
    await familySignIn('0000000001', 'YousefDemo2026');
    await page.getByRole('button', { name: 'متابعة يوم يوسف', exact: true }).click();
    await page.getByRole('button', { name: 'التنبيهات', exact: true }).click();
    await page.locator('.alert-card.urgent').filter({ hasText: 'تنبيه غياب فوري' }).waitFor();
    await page.locator('.alert-card').filter({ hasText: 'مشاركة ممتازة أثناء الحصة' }).waitFor();
    await shot('parent-alerts');
    await logout();

    // 4. Assistant Principal & Principal Administration Flow
    await staffLogin('tareq@schoolsync.demo');
    await shot('staff-dashboard-canvas');
    await page.getByRole('button', { name: 'الإدارة', exact: true }).click();
    await page.getByRole('heading', { name: 'إدارة المدرسة.' }).waitFor();

    const addClassForm = page.locator('form', { has: page.getByRole('button', { name: 'حفظ الشعبة', exact: true }) });
    await addClassForm.locator('input[name="name"]').fill('الصف التاسع - ج');
    await addClassForm.getByRole('button', { name: 'حفظ الشعبة', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تمت إضافة الشعبة' }).waitFor();

    const addSubjectForm = page.locator('form', { has: page.getByRole('button', { name: 'إضافة مادة جديدة', exact: true }) });
    await addSubjectForm.locator('input[name="name"]').fill('التربية الإسلامية');
    await addSubjectForm.getByRole('button', { name: 'إضافة مادة جديدة', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تمت إضافة المادة الدراسية' }).waitFor();
    await shot('admin-canvas-classes');

    await page.getByRole('button', { name: 'المعلمون والطاقم' }).click();
    await page.locator('.teacher-row-card').filter({ hasText: 'سارة خالد' }).click();
    await page.locator('.teacher-detail-card .chip-pill', { hasText: 'الصف التاسع - ج' }).click();
    await page.locator('.teacher-detail-card .chip-pill', { hasText: 'التربية الإسلامية' }).click();
    await page.getByRole('button', { name: 'حفظ الصفوف والمواد للمعلم', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم حفظ تعيينات المعلم' }).waitFor();
    await shot('admin-canvas-teacher');

    await page.getByRole('button', { name: 'الطلاب والعائلة' }).click();
    const assignForm = page.locator('form', {
      has: page.getByRole('button', { name: 'حفظ وإنشاء الحساب تلقائياً', exact: true }),
    });
    await assignForm.locator('select[name="studentId"]').selectOption('demo-student-2');
    await assignForm.locator('input[name="nationalId"]').fill('2007700099');
    await assignForm.getByRole('button', { name: 'حفظ وإنشاء الحساب تلقائياً', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم حفظ الرقم الوطني وإنشاء حساب الطالب تلقائياً' }).waitFor();

    await page.getByRole('button', { name: 'الجدول', exact: true }).click();
    await page.getByRole('heading', { name: 'الجدول الرئيسي.' }).waitFor();
    await page.getByRole('button', { name: 'الفلاتر والإعدادات', exact: true }).click();
    await page.getByRole('button', { name: 'ترتيب تلقائي حسب الصف', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم ترتيب الصفوف تلقائياً' }).waitFor();
    await page.getByRole('button', { name: 'إغلاق اللوحة', exact: true }).click();
    await page.getByRole('button', { name: 'بطاقات الحصص', exact: true }).click();
    await page.getByRole('button', { name: 'النسخة الرسمية', exact: true }).click();
    await page.getByRole('heading', { name: 'الجدول المدرسي العام', exact: true }).waitFor();
    await page.getByRole('button', { name: 'الجدول العام', exact: true }).click();
    await page.waitForTimeout(300);
    const orderedRowNames = await page.locator('.pro-matrix-table tbody .matrix-sec-col strong').allTextContents();
    assert.deepEqual(
      orderedRowNames.map((t) => t.trim()).filter((t) => ['6B', '8A', 'الصف التاسع - ج'].includes(t)),
      ['6B', '8A', 'الصف التاسع - ج'],
      'Expected grades sorted ascending: 6B -> 8A -> 9C',
    );
    await shot('assistant-schedule');
    await logout();

    // Verify Tablet (820x1180) and Desktop (1366x840) responsive modes cleanly
    await staffLogin('admin');
    await page.getByRole('button', { name: 'الجدول', exact: true }).click();
    await page.getByRole('heading', { name: 'الجدول الرئيسي.' }).waitFor();
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(700);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 820, 'Tablet horizontal overflow');
    await page.screenshot({ path: 'output/playwright/schoolsync-tablet-schedule.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 840 });
    await page.waitForTimeout(500);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 1366, 'Desktop horizontal overflow');
    await page.screenshot({ path: 'output/playwright/schoolsync-desktop-schedule.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await logout();

    // Sign in with auto-provisioned unified student account (<first5>@Alshereqi.Edu)
    await familySignIn('2007700099', '20077@Alshereqi.Edu');
    await page.locator('.selected-child-bar strong').filter({ hasText: 'زين عبد الله' }).waitFor();
    await shot('unified-student-phone');

    await context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: Mobile Jordanian SchoolSync e2e verified cleanly with zero browser runtime errors.');
  } finally {
    await browser?.close();
    await vite?.close();
    await app?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
