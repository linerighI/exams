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
      await page.waitForTimeout(1100);
      assert.equal(await page.evaluate(() => innerWidth), 390, 'Mobile viewport must not expand');
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
    const staffLogin = async (role) => {
      await page.locator('[data-portal="staff"]').click();
      await page.getByRole('button', { name: 'متابعة', exact: true }).click();
      await page
        .getByRole('button', {
          name: role === 'teacher' ? 'تجربة المعلم' : 'تجربة الإدارة',
          exact: true,
        })
        .click();
      await page.locator('.staff-space').waitFor();
    };
    await page.goto('http://127.0.0.1:5181');
    await page.locator('[data-portal="family"]').waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('.orb-main').count(), 0);
    await shot('login-roles');
    await page.locator('[data-portal="staff"]').click();
    assert.equal(await page.locator('[data-portal="staff"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-portal="family"]').click();
    await page.getByRole('button', { name: 'متابعة', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'الرقم الوطني للطالب', exact: true })
      .fill('0000000001');
    await page.getByLabel('رمز الدخول', { exact: true }).fill('YousefDemo2026');
    await shot('family-login');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await page.getByRole('button', { name: 'متابعة يوم يوسف', exact: true }).waitFor();
    await shot('family-chooser');
    assert.equal(await page.locator('.student-pass').count(), 2);
    await page.getByRole('button', { name: 'الطالب التالي', exact: true }).click();
    await page.getByRole('button', { name: 'متابعة يوم عمر', exact: true }).click();
    await page.locator('.selected-child-bar strong').filter({ hasText: 'عمر أحمد' }).waitFor();
    await page.getByRole('heading', { name: 'أهلاً، ليلى' }).waitFor();
    await shot('family-home');
    assert.equal(await page.locator('.orb-main').count(), 1);
    assert.equal(
      await page.locator('.timer-art,.tool-grid').count(),
      0,
      'Parent day must not contain student timers or teacher tools',
    );
    await page.getByRole('button', { name: 'اختيار الطالب', exact: true }).click();
    const chooser = page.getByRole('dialog');
    await chooser.getByRole('button', { name: 'الطالب التالي', exact: true }).click();
    await chooser.getByRole('button', { name: 'متابعة يوم يوسف', exact: true }).click();
    await page.locator('.selected-child-bar strong').filter({ hasText: 'يوسف أحمد' }).waitFor();
    await page.getByRole('button', { name: 'العلامات', exact: true }).click();
    await page.getByRole('heading', { name: 'العلامات.' }).waitFor();
    await shot('grades-tab');
    await page.locator('.learning-chart g[role="button"]').first().click();
    await page
      .getByRole('combobox', { name: 'تصفية حسب المادة', exact: true })
      .selectOption({ label: 'الرياضيات' });
    await page.getByRole('button', { name: 'الحضور', exact: true }).click();
    await page.getByRole('heading', { name: 'الحضور والغياب.' }).waitFor();
    await shot('attendance-tab');
    assert.equal(await page.locator('.attendance-ring strong').innerText(), '—');
    await openProfile();
    assert.equal(
      await page.locator('.learning-overview,.attendance-overview,.grade-chart').count(),
      0,
      'Academic meters must not live in profile',
    );
    await page.getByRole('switch', { name: 'المظهر الداكن' }).check();
    await shot('family-dark');
    await page.getByRole('switch', { name: 'المظهر الداكن' }).uncheck();
    await page.getByRole('button', { name: 'اليوم', exact: true }).click();
    await page
      .getByRole('button')
      .filter({ has: page.getByRole('heading', { name: 'واجبات بخطوات واضحة' }) })
      .click();
    await page.getByRole('heading', { name: 'الواجبات.' }).waitFor();
    await page
      .getByRole('button')
      .filter({ has: page.getByRole('heading', { name: 'خطوات صغيرة في عالم الجبر' }) })
      .click();
    await page.getByRole('dialog').getByText('لم يُسلّم بعد', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'تسليم الواجب', exact: true }).count(),
      0,
      'Family accounts monitor work instead of impersonating students',
    );
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'الرسائل', exact: true }).click();
    await page.getByRole('heading', { name: 'المحادثات.' }).waitFor();
    await page.locator('.contact-row').filter({ hasText: 'سارة خالد' }).click();
    await page
      .getByRole('textbox', { name: 'رسالتك', exact: true })
      .fill('شكراً لكم، يسعدني متابعة يوم أبنائي من هنا.');
    await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
    await page.getByText('شكراً لكم، يسعدني متابعة يوم أبنائي من هنا.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'اليوم', exact: true }).click();
    await page.getByRole('button', { name: 'فتح رفيق يومك', exact: true }).click();
    await page.getByRole('heading', { name: 'رفيق يومك', exact: true }).waitFor();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => innerWidth), 320);
    await page.screenshot({
      path: 'output/playwright/schoolsync-family-small.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await logout();
    await staffLogin('teacher');
    await page.getByRole('heading', { name: 'أهلاً، سارة' }).waitFor();
    assert.equal(
      await page.locator('.selected-child-bar').count(),
      0,
      'Staff must not have the family child switcher',
    );
    await page.getByRole('button', { name: 'أعمال الصف', exact: true }).click();
    await page.getByRole('heading', { name: 'أعمال الصف.' }).waitFor();
    await shot('teacher-version');
    assert.equal(
      await page.locator('.selected-child-bar,.attendance-overview,.learning-overview').count(),
      0,
      'Normal staff pages must not contain family profile or meter screens',
    );
    assert.equal(
      await page
        .locator('.bottom-nav')
        .getByRole('button', { name: 'العلامات', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator('.bottom-nav')
        .getByRole('button', { name: 'الحضور', exact: true })
        .count(),
      0,
    );
    await page.getByRole('button', { name: 'الشعب والطلاب', exact: true }).click();
    await page.getByRole('heading', { name: 'الشعب والطلاب.' }).waitFor();
    await page
      .locator('.school-roster-student')
      .filter({ hasText: 'يوسف أحمد' })
      .getByRole('button', { name: 'معاينة ولي الأمر', exact: true })
      .click();
    await page.getByRole('dialog').getByText('معاينة للقراءة فقط', { exact: true }).waitFor();
    await shot('explicit-family-preview');
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'أعمال الصف', exact: true }).click();
    await page.getByRole('heading', { name: 'أعمال الصف.' }).waitFor();

    await page.getByRole('button', { name: 'إضافة علامة', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'العنوان', exact: true })
      .fill('إنجاز موثّق من اختبار الواجهة');
    await page.getByRole('spinbutton', { name: 'العلامة', exact: true }).fill('93');
    await page.getByRole('button', { name: 'حفظ ومشاركة', exact: true }).click();
    await page.getByRole('button', { name: 'نشر العلامة', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'تم الحفظ والمشاركة بنجاح' }).waitFor();
    await logout();
    await staffLogin('admin');
    await page.getByRole('button', { name: 'إدارة المدرسة', exact: true }).click();
    await page.getByRole('heading', { name: 'إدارة المدرسة.' }).waitFor();
    await page.getByRole('button', { name: 'ربط ولي أمر', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'الطالب', exact: true })
      .selectOption('demo-student-1');
    await page
      .getByRole('textbox', { name: 'البريد الحالي لولي الأمر الموثّق', exact: true })
      .fill('sarah@schoolsync.demo');
    await page.getByRole('button', { name: 'حفظ ومشاركة', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'دخول العائلة', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'الطالب', exact: true })
      .selectOption('demo-student-1');
    await page
      .getByRole('textbox', { name: 'الرقم الوطني للطالب', exact: true })
      .fill('0000000099');
    await page.getByLabel('رمز دخول الطالب', { exact: true }).fill('AdamDemo2026');
    await shot('family-access-admin');
    await page.getByRole('button', { name: 'حفظ ومشاركة', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await logout();
    await page.getByRole('button', { name: 'متابعة', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'الرقم الوطني للطالب', exact: true })
      .fill('0000000099');
    await page.getByLabel('رمز الدخول', { exact: true }).fill('AdamDemo2026');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await page.getByRole('button', { name: 'متابعة يوم آدم', exact: true }).waitFor();
    assert.equal(
      await page.locator('.student-pass').count(),
      3,
      'New verified family access joins the existing sibling account',
    );
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: Arabic role/login flow, national-ID family account, sibling cards and switching, separate grades/attendance tabs, clean profile, homework monitoring, messaging, dark mode, 320px RTL, separate teacher/admin dashboards and explicit read-only family preview, teacher publishing, admin provisioning, shared family login; no browser runtime errors.',
    );
  } finally {
    await browser?.close();
    await vite?.close();
    await app?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
