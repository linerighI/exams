const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync } = require('node:fs');
const assert = require('node:assert/strict');
const { freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const apiPort = await freePort(),
    uiPort = await freePort();
  const env = {
    ...process.env,
    SCHOOL_DATA_DIR: mkdtempSync('.data/live-lab-ui-'),
    SCHOOL_API_PORT: String(apiPort),
    SCHOOL_UI_PORT: String(uiPort),
  };
  const server = spawn(process.execPath, ['--import', 'tsx', 'server/dev.ts'], {
    env,
    stdio: 'pipe',
  });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    env,
    stdio: 'pipe',
  });
  let browser, teacher, student;
  const output = [];
  for (const child of [server, vite])
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => output.push(String(chunk)));
  const call = async (path, method = 'GET', body, token) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    return data;
  };
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${uiPort}/api/status`)).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const studentContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      permissions: ['camera'],
    });
    teacher = await teacherContext.newPage();
    student = await studentContext.newPage();
    const errors = [];
    teacher.on('pageerror', (error) => errors.push(error.message));
    student.on('pageerror', (error) => errors.push(error.message));
    for (const page of [teacher, student]) {
      page.setDefaultTimeout(25000);
      page.on('dialog', (dialog) => dialog.accept());
    }
    await teacher.goto(`http://127.0.0.1:${uiPort}`);
    await teacher.getByLabel('إنشاء كلمة مرور للمعلم').fill('Camera-test123');
    await teacher.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await teacher.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Camera-test123' })
    ).token;
    const person = await call(
      '/api/students',
      'POST',
      { id: 'live-1', name: 'سارة أحمد', grade: '10', section: 'أ' },
      token,
    );
    const exam = await call(
      '/api/exams',
      'POST',
      {
        title: 'امتحان المتابعة المباشرة',
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
            text: 'ما ناتج 2+3؟',
            options: ['5', '6', '7', '8'],
            correct: 0,
            explanation: 'الجمع',
            page: 1,
          },
        ],
      },
      token,
    );
    await call(`/api/exams/${exam.id}/publish`, 'POST', {}, token);
    await student.goto(`http://127.0.0.1:${uiPort}`);
    await student.locator('.mode-switch button').nth(1).click();
    await student.getByLabel('الرقم الوطني أو رمز الطالب').fill(person.code);
    await student.getByRole('button', { name: 'دخول إلى مساحتي', exact: true }).click();
    await student.getByRole('button', { name: 'امتحاناتي', exact: true }).click();
    await student.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).click();
    await student.locator('.exam-question').waitFor();
    await teacher.getByRole('button', { name: 'فتح المراقبة المباشرة', exact: true }).click();
    const lab = teacher.getByRole('dialog', { name: 'غرفة المتابعة المباشرة', exact: true });
    await lab.waitFor();
    await lab.locator('.lab-device').filter({ hasText: 'سارة أحمد' }).waitFor();
    await lab.locator('.lab-device').filter({ hasText: 'سارة أحمد' }).click();
    await lab.getByRole('heading', { name: 'سارة أحمد', exact: true }).waitFor();
    await lab.getByRole('button', { name: 'كل الأجهزة', exact: true }).click();
    await student.locator('.student-options button').first().click();
    await lab
      .getByRole('navigation', { name: 'أقسام المراقبة المباشرة' })
      .getByRole('button', { name: 'الإجابات', exact: true })
      .click();
    await lab.locator('.lab-answer-list progress[value="1"]').waitFor();
    await lab
      .getByRole('navigation', { name: 'أقسام المراقبة المباشرة' })
      .getByRole('button', { name: 'الكاميرات', exact: true })
      .click();
    await lab.getByRole('button', { name: 'طلب بث الكاميرات', exact: true }).click();
    await student.getByRole('dialog', { name: 'طلب بث الكاميرا', exact: true }).waitFor();
    await student.evaluate(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.labStreams = [];
      navigator.mediaDevices.getUserMedia = async (options) => {
        const stream = await original(options);
        window.labStreams.push(stream);
        return stream;
      };
    });
    await student.getByRole('button', { name: 'السماح وبدء البث', exact: true }).click();
    await student.locator('.student-live-banner').waitFor();
    await lab.getByAltText('بث سارة أحمد', { exact: true }).waitFor();
    await teacher.screenshot({ path: 'test-results/live-lab-cameras-1366.png', fullPage: true });
    await student.screenshot({
      path: 'test-results/live-lab-student-broadcast.png',
      fullPage: true,
    });
    assert.equal(
      await lab.getByAltText('بث سارة أحمد').evaluate((image) => image.naturalWidth),
      480,
    );
    const first = (await call('/api/lab/frames', 'GET', undefined, token)).frames[0].at;
    await teacher.waitForTimeout(2200);
    const next = (await call('/api/lab/frames', 'GET', undefined, token)).frames[0].at;
    assert.ok(next > first, 'camera is continuously updating');
    await lab.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
    await student.locator('.student-live-banner').waitFor({ state: 'hidden' });
    assert.equal(
      await student.evaluate(() =>
        window.labStreams.every((stream) =>
          stream.getTracks().every((track) => track.readyState === 'ended'),
        ),
      ),
      true,
    );
    assert.equal((await call('/api/lab/frames', 'GET', undefined, token)).frames.length, 0);
    await teacher.getByRole('button', { name: 'فتح المراقبة المباشرة', exact: true }).click();
    await lab
      .getByRole('navigation', { name: 'أقسام المراقبة المباشرة' })
      .getByRole('button', { name: 'الكاميرات', exact: true })
      .click();
    await lab.getByRole('button', { name: 'طلب بث الكاميرات', exact: true }).click();
    await student.getByRole('dialog', { name: 'طلب بث الكاميرا', exact: true }).waitFor();
    await student.getByRole('button', { name: 'السماح وبدء البث', exact: true }).click();
    await student.locator('.student-live-banner').waitFor();
    await lab.getByAltText('بث سارة أحمد').waitFor();
    await student.getByRole('button', { name: 'تسليم الامتحان', exact: true }).click();
    await student.getByRole('button', { name: 'تأكيد التسليم', exact: true }).click();
    await student.getByRole('heading', { name: 'تم تسليم إجاباتك بنجاح' }).waitFor();
    await student.locator('.student-live-banner').waitFor({ state: 'hidden' });
    await lab.getByAltText('بث سارة أحمد').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(
      'Live lab UI passed: real student presence/answers, device drilldown, live fake-camera frames update, consent and visible broadcast, close-room track cleanup, repeated requests and automatic stop after submission.',
    );
  } catch (error) {
    await teacher
      ?.screenshot({ path: 'test-results/live-lab-teacher-failure.png', fullPage: true })
      .catch(() => {});
    await student
      ?.screenshot({ path: 'test-results/live-lab-student-failure.png', fullPage: true })
      .catch(() => {});
    console.error(output.slice(-10).join(''));
    throw error;
  } finally {
    await browser?.close();
    server.kill();
    vite.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
