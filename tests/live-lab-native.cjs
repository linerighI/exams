const assert = require('node:assert/strict');
const https = require('node:https');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const port = await freePort();
  const call = (path, method = 'GET', payload, token) =>
    new Promise((resolve, reject) => {
      const data = payload === undefined ? undefined : JSON.stringify(payload);
      const req = https.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          rejectUnauthorized: false,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(data
              ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
              : {}),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              const value = JSON.parse(body);
              if (res.statusCode >= 400) reject(Error(value.error));
              else resolve(value);
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      req.on('error', reject);
      req.end(data);
    });
  const app = await launch({
    args: ['--fake-camera'],
    env: {
      SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/live-native-')),
      SCHOOL_TEST_PORT: String(port),
      SCHOOL_HEADLESS_TEST: '1',
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page.getByLabel('إنشاء كلمة مرور للمعلم').fill('Native-camera123');
    await page.getByRole('button', { name: 'إعداد حساب المدرسة' }).click();
    await page.getByRole('heading', { name: 'مرحبًا أستاذي، ماذا ننجز اليوم؟' }).waitFor();
    const fixture = await page.evaluate(async () => {
      const student = await window.desktop.request('/api/students', 'POST', {
        id: 'native1',
        name: 'سارة أحمد',
        grade: '10',
        section: 'أ',
      });
      const exam = await window.desktop.request('/api/exams', 'POST', {
        title: 'بث الكاميرا',
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
            explanation: 'جمع',
            page: 1,
          },
        ],
      });
      await window.desktop.request(`/api/exams/${exam.id}/publish`, 'POST');
      return { student, exam };
    });
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    await page.locator('.mode-switch button').nth(1).click();
    await page.getByLabel('الرقم الوطني أو رمز الطالب').fill(fixture.student.code);
    await page.getByRole('button', { name: 'دخول إلى مساحتي', exact: true }).click();
    await page.getByRole('button', { name: 'امتحاناتي', exact: true }).click();
    await page.getByRole('button', { name: 'ابدأ الامتحان', exact: true }).click();
    await page.getByRole('button', {name:'السماح وفحص الكاميرا',exact:true}).click();
    await page.getByText('الكاميرا جاهزة',{exact:true}).waitFor();
    assert.match(app.diagnostics(),/Camera permission requested: Allow/);
    await page.getByRole('button',{name:'متابعة إلى الامتحان',exact:true}).click();
    await page.getByRole('dialog',{name:'Zunis · تذكير بالنزاهة',exact:true}).waitFor();
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.exam-integrity-intro')).opacity)>.99);
    await page.screenshot({path:'test-results/exam-integrity-native.png'});
    await page.locator('.exam-question').waitFor();
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Native-camera123' })
    ).token;
    let device;
    for (let i = 0; i < 30; i++) {
      device = (await call('/api/lab', 'GET', undefined, teacher)).devices.find((d) => d.attemptId);
      if (device) break;
      await page.waitForTimeout(250);
    }
    assert.ok(device);
    await call('/api/lab/watch', 'POST', { active: true }, teacher);
    await call('/api/lab/cameras', 'POST', { start: true }, teacher);
    await page.getByRole('dialog', { name: 'طلب بث الكاميرا', exact: true }).waitFor();
    await page.getByRole('button', { name: 'السماح وبدء البث', exact: true }).click();
    await page.locator('.student-live-banner').waitFor();
    let frames = [];
    for (let i = 0; i < 30; i++) {
      frames = (await call('/api/lab/frames', 'GET', undefined, teacher)).frames;
      if (frames.length) break;
      await page.waitForTimeout(250);
    }
    assert.equal(frames.length, 1);
    assert.match(frames[0].image, /^data:image\/jpeg;base64,/);
    await page.screenshot({ path: 'test-results/live-lab-native-student.png', fullPage: true });
    await call('/api/lab/watch', 'POST', { active: false }, teacher);
    await page.locator('.student-live-banner').waitFor({ state: 'hidden' });
    assert.equal((await call('/api/lab/frames', 'GET', undefined, teacher)).frames.length, 0);
    assert.deepEqual(errors, []);
    console.log(
      'Native live camera passed: WebView2 synthetic camera, consent, pinned/private bridge frame upload, teacher-only retrieval and automatic stop when room closes.',
    );
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/live-lab-native-failure.png', fullPage: true })
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
