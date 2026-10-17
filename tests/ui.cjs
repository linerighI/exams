const { chromium } = require('playwright');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const freePort = () =>
    new Promise((resolve, reject) => {
      const socket = require('node:net').createServer();
      socket.on('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const port = socket.address().port;
        socket.close(() => resolve(port));
      });
    });
  const apiPort = await freePort(),
    uiPort = await freePort();
  mkdirSync('test-results', { recursive: true });
  mkdirSync('.data', { recursive: true });
  const directory = mkdtempSync('.data/ui-');
  const env = {
    ...process.env,
    SCHOOL_DATA_DIR: directory,
    SCHOOL_API_PORT: String(apiPort),
    SCHOOL_UI_PORT: String(uiPort),
  };
  const server = spawn(process.execPath, ['--import', 'tsx', 'server/dev.ts'], {
    env,
    stdio: 'inherit',
  });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    env,
    stdio: 'inherit',
  });
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch('http://127.0.0.1:' + uiPort + '/api/status', {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    permissions: ['camera'],
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') void dialog.accept();
    else void dialog.dismiss();
  });
  const shot = async (options) => {
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          '.page-surface,.book-workspace,.ai-studio,.studio-action-card,.exchange-body,.welcome-studio,.slash-menu,.assistant-result-card',
        ),
      ].every((e) => Number(getComputedStyle(e).opacity) > 0.99),
    );
    return page.screenshot(options);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const call = async (path, method = 'GET', body, token) => {
    const response = await fetch('http://127.0.0.1:' + apiPort + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    return data;
  };
  let originalBackup, teacher;
  try {
    const status = await call('/api/status');
    if (!status.setup) throw Error('UI tests require a fresh development .data database.');
    await page.goto('http://127.0.0.1:' + uiPort);
    await page.getByRole('heading', { name: 'أهلًا بمدرستك' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'الاتصال بجهاز المدرسة' }).count(), 0);
    await page.getByAltText('وزارة التربية والتعليم الأردنية').evaluate((img) => img.decode());
    await shot({ path: 'test-results/welcome-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/welcome-1920.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('UITest-password123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await shot({ path: 'test-results/assistant-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/assistant-1920.png', fullPage: true });
    await page.route('**/api/assistant/messages', async (route) => {
      const body = route.request().postDataJSON();
      await new Promise((r) => setTimeout(r, 350));
      await route.fulfill({
        json: {
          conversation: {
            id: 'visual-chat',
            title: 'امتحان الرياضيات',
            messages: [
              { id: 'm1', role: 'user', text: body.message },
              {
                id: 'm2',
                role: 'assistant',
                text: 'لنجهّز مسودة امتحانك معًا. اختر كتاب الرياضيات وعدد الأسئلة، وسأجمع الأسئلة المناسبة من البنك.\nمثلًا، يمكن إضافة سؤال عن المعادلة \\(x^2 + y^2 = 25\\) مع رسم الدائرة.',
              },
            ],
          },
        },
      });
    });
    await page.getByLabel('رسالتك للمساعد').fill('أنشئ امتحان رياضيات للصف العاشر من 10 أسئلة');
    await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    await page.getByText('لنجهّز مسودة امتحانك معًا.', { exact: false }).waitFor();
    await page.locator('.studio-thread .katex').first().waitFor();
    const composer = await page.locator('.studio-composer').boundingBox();
    assert.ok(composer.y + composer.height < 1080, 'Composer stays visible');
    await shot({ path: 'test-results/assistant-chat-1920.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/assistant-chat-1366.png', fullPage: true });
    const orb = page.getByRole('button', { name: 'المساعد العائم', exact: true });
    const orbBox = await orb.boundingBox();
    await page.mouse.move(orbBox.x + 35, orbBox.y + 35);
    await page.mouse.down();
    await page.mouse.move(orbBox.x + 180, orbBox.y - 90, { steps: 12 });
    await page.mouse.up();
    assert.equal(await orb.getAttribute('aria-expanded'), 'false');
    assert.ok((await orb.boundingBox()).x > orbBox.x + 100);
    await orb.click();
    const orbDialog = page.getByRole('dialog', { name: 'المساعد العائم', exact: true });
    await orbDialog.getByRole('tab', {name:'المحادثة',exact:true}).click();
    await orbDialog.getByLabel('رسالة المساعد العائم').fill('جهز امتحانًا');
    await orbDialog.getByRole('button', { name: 'إرسال للمساعد العائم' }).click();
    await orbDialog.locator('.orb-message.assistant .katex').first().waitFor();
    await shot({ path: 'test-results/floating-assistant-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/floating-assistant-1920.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await orbDialog.getByRole('button', { name: 'إغلاق المساعد العائم' }).click();
    await page.getByRole('button', { name: 'محادثة جديدة', exact: true }).click();
    await page.unroute('**/api/assistant/messages');
    await page.getByRole('button', { name: 'الكتب وبنك الأسئلة', exact: true }).click();
    await page.getByRole('heading', { name: 'الكتب وبنك الأسئلة', exact: true }).waitFor();
    let aiRequests = 0;
    page.on('request', (r) => {
      if (/\/api\/(?:generate|assistant\/messages|books\/[^/]+\/process)/.test(r.url()))
        aiRequests++;
    });
    await page.locator('.library-action-create').click();
    await page.getByLabel('طلب البنك: عنوان الكتاب').fill('بنك تجريبي خارجي');
    await page.getByLabel('طلب البنك: المادة').fill('رياضيات');
    await page.getByLabel('طلب البنك: الصف').fill('العاشر');
    await shot({ path: 'test-results/bank-wizard-1366.png', fullPage: true });
    await page.getByRole('button', { name: 'التالي: اختيار المساعد' }).click();
    await page.locator('.prompt-workbench > summary').click();
    await page.getByLabel('معاينة الطلب').waitFor();
    const template = await page.getByLabel('معاينة الطلب').inputValue();
    assert.ok(!template.includes('25 سؤال'));
    assert.ok(template.includes('SVG'));
    await page.getByLabel('معاينة الطلب').fill(template + '\nملاحظة المعلم: اهتم بالتطبيق العملي.');
    await page.route('**/api/bank/prompt/rewrite', (route) =>
      route.fulfill({ json: { prompt: template + '\nصياغة معدلة: اهتم بالرسوم التوضيحية.' } }),
    );
    await page.getByLabel('تعليمات تعديل الطلب').fill('اهتم بالرسوم التوضيحية');
    await page.getByRole('button', { name: 'اقتراح تعديل', exact: true }).click();
    await page.getByLabel('اقتراح الطلب').waitFor();
    assert.ok((await page.getByLabel('معاينة الطلب').inputValue()).includes('ملاحظة المعلم'));
    await page.getByRole('button', { name: 'تطبيق التعديل', exact: true }).click();
    assert.ok((await page.getByLabel('معاينة الطلب').inputValue()).includes('صياغة معدلة'));
    await page.getByRole('button', { name: 'حفظ الطلب', exact: true }).click();
    await page.unroute('**/api/bank/prompt/rewrite');
    assert.match(await page.getByLabel('معاينة الطلب').inputValue(), /version/);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/bank-prompt-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'الملفات جاهزة؟ استورد البنك ←' }).click();
    const exchangeData = {
      version: 1,
      batchId: 'batch-01',
      book: {
        title: 'بنك تجريبي خارجي',
        subject: 'رياضيات',
        grade: 'العاشر',
        term: 'الأول',
        pageCount: 132,
      },
      questions: [
        {
          text: 'احسب \\(x^{2}\\) عندما \\(x=2\\)',
          options: ['1', '2', '3', '4'],
          correct: 3,
          explanation: 'نربع العدد',
          page: 8,
          difficulty: 'سهل',
          chapter: 'القوى',
          evidence: 'مثال',
          requiresImage: true,
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><circle cx="100" cy="100" r="60" fill="none" stroke="#557799"/><text x="170" y="100" font-size="20">x</text></svg>',
          box: null,
        },
      ],
    };
    await page.getByLabel('ملف JSON للبنك').setInputFiles({
      name: 'bank.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exchangeData)),
    });
    await page.getByRole('button', { name: 'معاينة الاستيراد', exact: true }).click();
    await page.getByRole('button', { name: 'حفظ البنك كمسودات', exact: false }).waitFor();
    await shot({ path: 'test-results/bank-import-1920.png', fullPage: true });
    assert.equal(await page.locator('.import-diagram-preview').count(), 1);
    await page.getByRole('button', { name: 'حفظ البنك كمسودات', exact: false }).click();
    await page.getByText('حُفظ 1 سؤالًا', { exact: true }).waitFor();
    assert.equal(aiRequests, 0);
    await page.getByRole('button', { name: 'العودة إلى المكتبة', exact: true }).click();
    await page.getByRole('button', { name: /رفع كتاب PDF/ }).click();
    await page.getByLabel('المادة', { exact: true }).fill('رياضيات');
    await page.getByLabel('الصف', { exact: true }).fill('العاشر');
    const reviewQuestion = {
      id: 'review-ui',
      text: 'ما هي الخطوة الأولى لحل نظام معادلة خطية وتربيعية باستخدام طريقة التعويض؟',
      options: [
        'كتابة أحد المتغيرين في المعادلة الخطية بدلالة الآخر.',
        'تعويض قيمة المتغير في المعادلة التربيعية.',
        'حل المعادلة التربيعية مباشرة.',
        'جمع المعادلتين دون تغيير المتغيرات.',
      ],
      correct: 0,
      page: 18,
      explanation: 'نكتب أحد المتغيرين بدلالة الآخر، ثم نعوض في المعادلة الثانية.',
      evidence: 'طريقة التعويض',
      difficulty: 'متوسط',
      chapter: 'الجبر',
      status: 'draft',
    };
    await page.route('**/api/books/*/questions', (route) =>
      route.fulfill({ json: [reviewQuestion] }),
    );
    await page
      .locator('.book-upload input[type=file]')
      .setInputFiles(
        'C:/Users/User/Downloads/كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول.pdf',
      );
    await page
      .getByRole('button', { name: 'تحليل الكتاب وبناء البنك', exact: true, includeHidden: true })
      .waitFor({ state: 'attached', timeout: 30000 });
    await page
      .locator('.book-content>h2')
      .filter({ hasText: 'كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول' })
      .waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.upload-error').count(), 0);
    await shot({ path: 'test-results/books-1920.png', fullPage: true });
    await page.locator('.bank-question').first().click();
    await page.getByRole('dialog', { name: 'مراجعة السؤال' }).waitFor();
    assert.equal(
      await page.locator('.bank-review-dialog textarea').count(),
      0,
      'Review starts with readable preview',
    );
    assert.equal(await page.locator('.review-option-list>button').count(), 4);
    await page.waitForTimeout(350);
    await shot({ path: 'test-results/bank-review-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/bank-review-1920.png', fullPage: true });
    await page.getByRole('tab', { name: 'تعديل', exact: true }).click();
    assert.equal(
      await page.locator('.bank-review-dialog .formula-preview').count(),
      0,
      'Edit does not duplicate each answer',
    );
    await page.getByLabel('نص السؤال', { exact: true }).fill('احسب \\(x^2\\) عندما \\(x=3\\).');
    await page.getByRole('tab', { name: 'معاينة', exact: true }).click();
    await page.locator('.bank-review-dialog .katex').first().waitFor();
    await page.getByRole('button', { name: 'إرفاق رسم من الكتاب' }).click();
    await page.locator('.visual-crop-stage img').waitFor();
    const cropBounds = await page.locator('.visual-crop-stage').boundingBox();
    await page.mouse.move(
      cropBounds.x + cropBounds.width * 0.12,
      cropBounds.y + cropBounds.height * 0.15,
    );
    await page.mouse.down();
    await page.mouse.move(
      cropBounds.x + cropBounds.width * 0.78,
      cropBounds.y + cropBounds.height * 0.6,
      { steps: 8 },
    );
    await page.mouse.up();
    assert.equal(await page.locator('.visual-crop-box').count(), 1);
    assert.equal(
      await page.getByRole('button', { name: 'إرفاق القص', exact: true }).isEnabled(),
      true,
    );
    await shot({ path: 'test-results/bank-visual-crop-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'إغلاق مراجعة السؤال' }).click();
    await page.unroute('**/api/books/*/questions');
    await page.setViewportSize({ width: 1366, height: 768 });
    teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'UITest-password123' })
    ).token;
    originalBackup = await call('/api/backup', 'GET', undefined, teacher);
    const student = await call(
      '/api/students',
      'POST',
      { id: 'qa-1001', name: 'أحمد خالد', grade: 'السابع', section: 'أ' },
      teacher,
    );
    const exam = await call(
      '/api/exams',
      'POST',
      {
        title: 'امتحان العلوم النصفي',
        subject: 'العلوم',
        grade: 'السابع',
        section: 'أ',
        term: 'الأول',
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'متوسط',
        cameraRequired: false,
        sourceId: 'ui-source',
        sourcePages: [1, 2],
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3600000).toISOString(),
        questions: [
          {
            id: 'q1',
            text: 'ما الكوكب الذي نعيش عليه؟',
            options: ['الأرض', 'المريخ', 'زحل', 'عطارد'],
            correct: 0,
            explanation: 'الأرض هي كوكبنا',
            page: 1,
          },
          {
            id: 'q2',
            text: 'كم عدد أيام الأسبوع؟',
            options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'],
            correct: 2,
            explanation: 'الأسبوع سبعة أيام',
            page: 2,
          },
        ],
      },
      teacher,
    );
    await call('/api/exams/' + exam.id + '/publish', 'POST', {}, teacher);
    await page.getByRole('button', { name: 'الامتحانات', exact: false }).first().click();
    await page.getByRole('heading', { name: 'امتحان العلوم النصفي' }).waitFor();

    await page
      .locator('.exam-card')
      .filter({ hasText: 'امتحان العلوم النصفي' })
      .getByRole('button', { name: 'فتح الامتحان' })
      .click();
    await page.getByRole('tab', { name: 'اختيار من البنك', exact: false }).click();
    assert.equal(await page.locator('.editor-section input[accept*="pdf"]').count(), 0);
    const bank = (await call('/api/books', 'GET', undefined, teacher)).find(
      (b) => b.title === 'بنك تجريبي خارجي',
    );
    const bankQuestion = (
      await call('/api/books/' + bank.id + '/questions', 'GET', undefined, teacher)
    )[0];
    await call(
      '/api/bank/' + bankQuestion.id,
      'PUT',
      { ...bankQuestion, status: 'draft' },
      teacher,
    );
    await page.getByLabel('بنك أسئلة الامتحان').selectOption(bank.id);
    await page.locator('.bank-picker-grid>button').first().waitFor();
    assert.match(await page.locator('.bank-picker-grid>button').first().innerText(), /للمراجعة/);
    await page.locator('.bank-picker-grid>button').first().click();
    await page.getByRole('dialog', { name: 'مراجعة السؤال', exact: true }).waitFor();
    await page.getByRole('button', { name: 'اعتماد السؤال', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'مراجعة السؤال', exact: true })
      .waitFor({ state: 'hidden' });
    assert.match(await page.locator('.bank-picker-grid>button').first().innerText(), /معتمد/);
    await shot({ path: 'test-results/editor-bank-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/editor-bank-1920.png', fullPage: true });
    await page.locator('.bank-picker-grid>button').first().click();
    await page.getByRole('button', { name: 'إضافة 1 إلى الامتحان', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll('.question-tabs>button').length === 3,
    );
    assert.equal(await page.locator('.question-tabs>button').count(), 3);
    await page.getByRole('button', { name: 'العودة للامتحانات' }).click();
    await orb.click();
    await orbDialog.getByRole('button', { name: 'محادثة عائمة جديدة' }).click();
    await orbDialog.getByLabel('رسالة المساعد العائم').fill('/كتاب');
    await orbDialog.getByRole('button', { name: 'إرسال للمساعد العائم' }).click();
    await orbDialog.locator('.orb-result.book').first().waitFor();
    await orbDialog
      .locator('.orb-result.book')
      .first()
      .getByRole('button', { name: 'فتح' })
      .click();
    await page.getByRole('heading', { name: 'الكتب وبنك الأسئلة', exact: true }).waitFor();
    await page.getByRole('button', { name: 'الرئيسية والمساعد', exact: true }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.getByRole('button', { name: 'الأوامر', exact: true }).click();
    await page.getByRole('listbox', { name: 'أوامر المساعد' }).waitFor();
    await shot({ path: 'test-results/slash-commands-1920.png', fullPage: true });
    await page.getByRole('option').filter({ hasText: 'استكشاف البنوك' }).click();
    assert.equal(await page.locator('.composer-command .command-token').innerText(), '/كتاب');
    await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    await page.locator('.assistant-result-card.result-book').first().waitFor();
    await page.waitForTimeout(850);
    await shot({ path: 'test-results/assistant-bank-cards-1920.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/assistant-bank-cards-1366.png', fullPage: true });
    await page.getByRole('button', { name: 'محادثة جديدة', exact: true }).click();

    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/teacher-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/teacher-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'أقسام الإعدادات' })
      .getByRole('button', { name: 'الذكاء الاصطناعي', exact: true })
      .click();
    await page.getByRole('heading', { name: 'اختر مساعدك' }).waitFor();
    const modelStatus = await call('/api/model', 'GET', undefined, teacher);
    if (modelStatus.ready) {
      await page.getByText('النموذج جاهز', { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel('النموذج المحلي', { exact: true }).inputValue(),
        modelStatus.model,
      );
      await page.getByLabel('النموذج المحلي', { exact: true }).selectOption('qwen3:1.7b');
      if (!modelStatus.models.includes('qwen3:1.7b')) {
        await page.getByText('النموذج غير مثبت', { exact: true }).waitFor();
        assert.equal(
          await page.getByRole('button', { name: 'اختبار الاتصال والتوليد' }).isDisabled(),
          true,
        );
      }
      await page.getByLabel('النموذج المحلي', { exact: true }).selectOption(modelStatus.model);
    }
    await shot({ path: 'test-results/model-settings-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'الرئيسية والمساعد', exact: true }).click();
    await page.getByRole('button', { name: '+ امتحان يدوي', exact: true }).click();
    await page.getByRole('heading', { name: 'لنصنع امتحانًا رائعًا' }).waitFor();
    await shot({ path: 'test-results/editor-1920.png', fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    await page.getByRole('button', { name: 'العودة للامتحانات' }).click();
    const mathExam = await call(
      '/api/exams',
      'POST',
      {
        ...exam,
        title: 'امتحان الرياضيات للعرض',
        questions: [
          {
            id: 'math-q',
            text: 'ما هي قيمة sin 255o مقربة إلى أقرب ثلاث منازل عشرية؟',
            options: ['0.966', '-0.966', '0.707', '-0.707'],
            correct: 1,
            explanation: 'الزاوية المرجعية هي 75o. لذلك sin 255o = -sin 75o ≈ -0.966.',
            page: 77,
          },
        ],
      },
      teacher,
    );
    await page.getByRole('button', { name: 'الامتحانات', exact: true }).click();
    await page
      .locator('.exam-card')
      .filter({ hasText: 'امتحان الرياضيات للعرض' })
      .getByRole('button', { name: 'فتح الامتحان' })
      .click();
    await page.locator('.teacher-question-preview .katex').first().waitFor();
    assert.equal(await page.locator('.preview-answers .katex').count(), 4);
    await page.getByRole('button', { name: 'تعديل السؤال', exact: true }).click();
    await page.route('**/api/geometry/generate', (route) =>
      route.fulfill({
        json: {
          objects: [
            { type: 'point', name: 'O', x: 0, y: 0 },
            { type: 'point', name: 'A', x: 3, y: 0 },
            { type: 'circle', name: 'c', center: 'O', radius: 3 },
            { type: 'segment', name: 'r', from: 'O', to: 'A' },
            { type: 'label', name: 'label', text: 'x', x: 1.5, y: 0.3 },
          ],
        },
      }),
    );
    await page.getByRole('button', { name: 'إنشاء رسم هندسي · GeoGebra' }).click();
    await page.getByRole('heading', { name: 'محرر الرسومات الهندسية' }).waitFor();
    for (let i = 0; i < 100; i++) {
      if (
        await page
          .getByRole('button', { name: 'تحليل السؤال وإنشاء رسم بالمزود المختار' })
          .isEnabled()
      )
        break;
      await page.waitForTimeout(300);
    }
    assert.equal(
      await page
        .getByRole('button', { name: 'تحليل السؤال وإنشاء رسم بالمزود المختار' })
        .isEnabled(),
      true,
      'GeoGebra loads locally',
    );
    await page.getByRole('button', { name: 'تحليل السؤال وإنشاء رسم بالمزود المختار' }).click();
    await page.waitForTimeout(600);
    await shot({ path: 'test-results/geometry-offline-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'إرفاق صورة الرسم' }).click();
    await page
      .getByRole('heading', { name: 'محرر الرسومات الهندسية' })
      .waitFor({ state: 'hidden' });
    await page.unroute('**/api/geometry/generate');
    await page.getByRole('button', { name: 'إزالة الصورة', exact: false }).click();
    await page.getByRole('button', { name: 'معاينة السؤال', exact: true }).click();
    await shot({ path: 'test-results/math-teacher-1920.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/math-teacher-1366.png', fullPage: true });
    const lastAnswer = await page.locator('.preview-answers>button').last().boundingBox();
    assert.ok(
      lastAnswer.y + lastAnswer.height < 768,
      'All four short answers fit in the teacher preview',
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
      false,
    );
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'أقسام الإعدادات' })
      .getByRole('button', { name: 'حسابات المعلمين', exact: true })
      .click();
    await page.getByRole('heading', { name: 'حسابات المعلمين', exact: true }).waitFor();
    await page.getByLabel('اسم مستخدم المعلم الجديد').fill('teacher-ui');
    await page.getByLabel('اسم المعلم الجديد').fill('معلم الواجهة');
    await page.getByLabel('كلمة مرور المعلم الجديد').fill('Teacher-ui123');
    await page.getByRole('button', { name: 'إنشاء حساب المعلم', exact: true }).click();
    await page.locator('.account-list').getByText('معلم الواجهة', { exact: true }).waitFor();
    await shot({ path: 'test-results/teacher-accounts-1366.png', fullPage: true });
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await page.getByLabel('اسم المستخدم', { exact: true }).fill('teacher-ui');
    await page.getByLabel('كلمة مرور المعلم', { exact: true }).fill('Teacher-ui123');
    await page.getByRole('button', { name: 'دخول إلى مساحتي' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.getByRole('button', { name: 'الكتب وبنك الأسئلة', exact: true }).click();
    assert.equal(await page.locator('.library-book-card').count(), 0);
    await shot({ path: 'test-results/private-teacher-library-1366.png', fullPage: true });
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await page.getByLabel('اسم المستخدم', { exact: true }).fill('admin');
    await page.getByLabel('كلمة مرور المعلم', { exact: true }).fill('UITest-password123');
    await page.getByRole('button', { name: 'دخول إلى مساحتي' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    await page.getByRole('button', { name: 'الطلاب والصفوف', exact: true }).click();
    for (const [name, slug] of [
      ['الطلاب والصفوف', 'students'],
      ['المتابعة والنتائج', 'monitor'],
      ['الامتحانات', 'exams'],
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      for (const [width, height] of [
        [1366, 768],
        [1920, 1080],
      ]) {
        await page.setViewportSize({ width, height });
        await shot({ path: `test-results/unified-${slug}-${width}.png`, fullPage: true });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
      }
    }
    await page.getByRole('button', { name: 'الطلاب والصفوف', exact: true }).click();
    await page.locator('.teacher-disclosure > summary').click();
    await page.getByLabel('اختيار طالب لتجربة الدخول').selectOption(student.id);
    await page.getByRole('button', { name: 'دخول بصفة الطالب', exact: true }).click();
    await page.getByRole('heading', { name: 'أهلًا بك، أحمد' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'المساعد العائم', exact: true }).count(),
      0,
    );
    await page.getByAltText('وزارة التربية والتعليم الأردنية').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/student-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/student-1920.png', fullPage: true });
    await page.getByRole('button', { name: 'ابدأ الامتحان' }).click();
    await page.getByRole('heading', { name: 'ما الكوكب الذي نعيش عليه؟' }).waitFor();
    await page.locator('.student-options button').nth(0).click();
    await page.getByText('تم الحفظ على جهاز المعلم', { exact: true }).waitFor();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.locator('.student-options button').nth(2).click();
    await page.getByText('محفوظة على الجهاز', { exact: true }).waitFor();
    await context.setOffline(false);
    await page.getByText('تم الحفظ على جهاز المعلم', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot({ path: 'test-results/exam-1366.png', fullPage: true });
    await page.reload();
    await page.locator('.exam-question').waitFor();
    await page.getByRole('heading', { name: 'ما الكوكب الذي نعيش عليه؟' }).waitFor();
    assert.equal(await page.locator('.student-options button.selected').count(), 1);
    await page.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد التسليم' }).click();
    await page.getByRole('heading', { name: 'تم تسليم إجاباتك بنجاح' }).waitFor();
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).token;
    assert.equal((await call('/api/attempts', 'GET', undefined, token))[0].score, null);
    await call('/api/exams/' + exam.id + '/results', 'POST', {}, teacher);
    assert.equal((await call('/api/attempts', 'GET', undefined, token))[0].score, 20);
    await call('/api/exams/' + mathExam.id + '/publish', 'POST', {}, teacher);
    await page.getByRole('button', { name: 'العودة إلى لوحة الطالب' }).click();
    await page
      .locator('.exam-card')
      .filter({ hasText: 'امتحان الرياضيات للعرض' })
      .getByRole('button', { name: 'ابدأ الامتحان' })
      .click();
    await page.locator('.exam-question .katex').first().waitFor();
    assert.equal(
      await page.locator('.student-tools').count(),
      0,
      'Math tools stay hidden when the teacher has not enabled them',
    );
    assert.equal(await page.locator('.student-options .katex').count(), 4);
    await shot({ path: 'test-results/math-student-1366.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot({ path: 'test-results/math-student-1920.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'UI passed: unified RTL layouts at 1366/1920, external bank import, bank-only editor, slash commands and cards, teacher/student login, offline save, reload/resume, submit, published score.',
    );
  } finally {
    await browser.close();
    server.kill();
    vite.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
