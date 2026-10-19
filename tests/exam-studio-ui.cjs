const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const net = require('node:net');
const free = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
(async () => {
  mkdirSync('test-results', { recursive: true });
  mkdirSync('.data', { recursive: true });
  const apiPort = await free(),
    uiPort = await free(),
    directory = mkdtempSync('.data/studio-ui-'),
    env = {
      ...process.env,
      SCHOOL_DATA_DIR: directory,
      SCHOOL_API_PORT: String(apiPort),
      SCHOOL_UI_PORT: String(uiPort),
    };
  const server = spawn(process.execPath, ['--import', 'tsx', 'server/dev.ts'], {
      env,
      stdio: 'pipe',
    }),
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
      env,
      stdio: 'pipe',
    });
  let browser;
  const logs = [];
  for (const c of [server, vite]) {
    c.stdout.on('data', (x) => logs.push(String(x)));
    c.stderr.on('data', (x) => logs.push(String(x)));
  }
  const base = `http://127.0.0.1:${uiPort}`;
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + '/api/status', { signal: AbortSignal.timeout(1000) })).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    const call = async (path, method = 'GET', body, token) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const d = await r.json();
      assert.ok(r.ok, JSON.stringify(d));
      return d;
    };
    console.log('Studio test: server ready');
    await call('/api/setup', 'POST', { school: 'مدرسة الاختبار', password: 'password123' });
    const teacher = await call('/api/login', 'POST', { role: 'teacher', password: 'password123' });
    const question = {
      id: 'q1',
      text: 'ما مضاد كلمة الحزن؟',
      options: ['القلق', 'الفرح', 'الغضب', 'الضيق'],
      correct: 1,
      explanation: 'الفرح مضاد الحزن',
      page: 1,
    };
    const exam = await call(
      '/api/exams',
      'POST',
      {
        title: 'العربية لغتي',
        subject: 'عربي',
        grade: 'العاشر',
        section: 'أ',
        term: 'الأول',
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'متوسط',
        cameraRequired: false,
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3600000).toISOString(),
        questions: [question, { ...question, id: 'q2', text: 'مرادف سعيد هو؟' }],
      },
      teacher.token,
    );
    writeFileSync(
      'test-results/exam-studio-harness.html',
      `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
 import React from 'react';import{createRoot}from'react-dom/client';import ExamEditor from '/src/ExamEditor.tsx';import StudentExam from '/src/StudentExam.tsx';import{setToken}from'/src/api.ts';import '/src/styles.css';import '/src/surfaces.css';import '/src/schoolBrand.css';import '/src/teacherEasy.css';import '/src/teacherLayout.css';import '@fontsource/tajawal/400.css';import '@fontsource/tajawal/500.css';import '@fontsource/tajawal/700.css';
 import QuestionResponse from '/src/QuestionResponse.tsx';import SimpleExamCreator from '/src/SimpleExamCreator.tsx';import{createQuestion,studentQuestion}from'/src/questionFormats.ts';
 import ExamBankPicker from '/src/ExamBankPicker.tsx';import NoticeToast from '/src/NoticeToast.tsx';import MorphMark from '/src/MorphMark.tsx';import ExamAppearanceEditor from '/src/ExamAppearanceEditor.tsx';window.mountPicker=()=>{setToken(window.__token);root.render(React.createElement(ExamBankPicker,{existing:[],notify:m=>window.__notice=m,onAdd:q=>window.__picked=q}))};window.mountNotice=message=>root.render(React.createElement(NoticeToast,{message,onClose:()=>{window.__noticeClosed=true;root.render(null)}}));function AppearanceFixture(){const[a,setA]=React.useState();return React.createElement(ExamAppearanceEditor,{value:a,onChange:setA})};window.mountAppearance=()=>root.render(React.createElement(AppearanceFixture));window.mountMorph=shape=>root.render(React.createElement(MorphMark,{shape}));
 import QuestionComposer from '/src/QuestionComposer.tsx';import BookQuestionReview from '/src/BookQuestionReview.tsx';import BankWizard from '/src/BankWizard.tsx';import{api}from'/src/api.ts';
 window.mountBankComposer=bookId=>{setToken(window.__token);root.render(React.createElement('main',{style:{maxWidth:900,padding:28,margin:'auto'}},React.createElement(QuestionComposer,{bank:true,onSave:async q=>{window.__bankCreated=await api('/api/books/'+bookId+'/questions','POST',q)}})))};window.mountBankReview=(q,bookId)=>{setToken(window.__token);root.render(React.createElement(BookQuestionReview,{question:q,bookId,onClose:()=>window.__bankClosed=true,onSaved:async()=>{window.__bankReviewed=true},notify:m=>window.__notice=m}))};window.mountBankWizard=()=>{setToken(window.__token);root.render(React.createElement('main',{style:{padding:28,maxWidth:1000,margin:'auto'}},React.createElement(BankWizard,{books:[],onImported:async()=>{},notify:m=>window.__notice=m}))) };
 import ExamIntegrityIntro from '/src/ExamIntegrityIntro.tsx';import StudentRosterImport from '/src/StudentRosterImport.tsx';window.mountIntro=()=>root.render(React.createElement(ExamIntegrityIntro,{onDone:()=>{window.__introDone=true;root.render(null)}}));window.mountRoster=()=>{setToken(window.__token);root.render(React.createElement(StudentRosterImport,{onClose:()=>{},onImported:async()=>{window.__rosterDone=true}}))};
 import ManualGrading from '/src/ManualGrading.tsx';window.mountGrading=attempt=>{setToken(window.__token);root.render(React.createElement(ManualGrading,{attempt,onSaved:()=>window.__graded=true,notify:m=>window.__notice=m}))};
 setToken(window.__token);const root=createRoot(document.getElementById('root'));window.mountStudent=(snapshot)=>root.render(React.createElement(StudentExam,{key:crypto.randomUUID(),snapshot,notify:m=>{window.__notice=m;},onExit:()=>{}}));root.render(React.createElement('main',{className:'editor-surface',style:{padding:28,maxWidth:1500,margin:'auto'}},React.createElement(ExamEditor,{initial:window.__exam,onSave:e=>{window.__saved=e;},onCancel:()=>{},notify:m=>{window.__notice=m;}})));
 function ResponseFixture({q}){const[a,setA]=React.useState();return React.createElement(QuestionResponse,{question:studentQuestion(q),value:a,onChange:answer=>{window.__answer=answer;setA(answer);}})}window.mountResponse=(kind,patch={})=>{window.__answer=undefined;root.render(React.createElement(ResponseFixture,{key:crypto.randomUUID(),q:{...createQuestion(kind),...patch}}))};window.mountSimple=()=>{setToken(window.__token);root.render(React.createElement(SimpleExamCreator,{onSaved:()=>{},onAdvanced:()=>{},onBooks:()=>{}}))};
 </script></body></html>`,
    );
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
      errors = [];
    p.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('Page error:', e.message);
    });
    await p.addInitScript(
      ({ exam, token }) => {
        window.__exam = exam;
        window.__token = token;
      },
      { exam, token: teacher.token },
    );
    console.log('Studio test: browser ready');
    p.setDefaultTimeout(60000);
    p.on('console', (m) => {
      if (m.type() === 'error') console.log('Browser:', m.text());
    });
    await p.goto(base + '/test-results/exam-studio-harness.html', {
      waitUntil: 'commit',
      timeout: 60000,
    });
    console.log('Studio test: page loaded');
    await p.locator('.question-studio').waitFor();
    console.log('Studio test: editor mounted');
    assert.equal(await p.locator('.qs-outline-item').count(), 2);
    await p.getByRole('tab', { name: 'الإعدادات والمظهر', exact: false }).click();
    await p.locator('[data-exam-field="title"]').fill('');
    await p.getByRole('button', { name: 'حفظ كمسودة', exact: true }).click();
    await p.locator('.exam-issues button').filter({ hasText: 'أدخل اسم الامتحان' }).click();
    await p.waitForFunction(
      () => document.activeElement?.getAttribute('data-exam-field') === 'title',
    );
    await p.locator('[data-exam-field="title"]').fill('العربية لغتي');
    await p.waitForFunction(() => {
      const a = document
          .querySelector('.exam-stages button[aria-selected="true"]')
          .getBoundingClientRect(),
        b = document.querySelector('.exam-stages .selection-indicator').getBoundingClientRect();
      return Math.abs(a.x - b.x) < 2 && Math.abs(a.width - b.width) < 2;
    });
    await p.locator('.exam-personalization>summary').click();
    await p.getByRole('button', { name: 'أخضر مريح', exact: true }).click();
    await p.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.appearance-preview')).backgroundColor ===
        'rgb(241, 248, 244)',
    );
    await p
      .locator('.appearance-colors label')
      .filter({ hasText: 'حجم الخط' })
      .locator('select')
      .selectOption('large');
    await p.waitForFunction(
      () => getComputedStyle(document.querySelector('.appearance-question')).fontSize === '21px',
    );
    await p.getByRole('button', { name: 'إعادة المظهر الافتراضي', exact: true }).click();
    await p.locator('.exam-personalization>summary').click();
    await p.getByRole('tab', { name: 'بناء الامتحان', exact: false }).click();
    await p.getByRole('button', { name: 'أضف سؤالًا', exact: true }).click();
    const source = p.locator('.qs-type-menu button').filter({ hasText: 'توصيل' });
    await source.hover();
    await p.waitForTimeout(400);
    const sourceBox = await source.boundingBox(),
      targetBox = await p.locator('.qs-question-meta').boundingBox();
    await p.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await p.mouse.down();
    await p.mouse.move(sourceBox.x + sourceBox.width / 2 - 15, sourceBox.y + sourceBox.height / 2, {
      steps: 5,
    });
    await p.mouse.move(targetBox.x + 30, targetBox.y + 15, { steps: 20 });
    await p.mouse.up();
    await p.waitForTimeout(250);
    await p.screenshot({ path: 'test-results/exam-studio-drop.png', fullPage: true });
    assert.equal(await p.locator('.qs-outline-item').count(), 3, 'Type drop adds a question');
    await p.getByRole('button', { name: 'حفظ كمسودة', exact: true }).click();
    await p.locator('.exam-issues button').filter({ hasText: 'السؤال 3' }).first().click();
    await p.waitForFunction(() => document.activeElement?.closest('.qs-prompt-editor'));
    const text = p.locator('.qs-prompt-editor textarea');
    await text.fill('صل الكلمات بمرادفاتها');
    const pairs = p.locator('.qs-pair input');
    for (const [i, v] of ['سعيد', 'مسرور', 'منزل', 'بيت'].entries()) await pairs.nth(i).fill(v);
    const beforeMorph = await p.locator('.qs-preview-switch path').getAttribute('d');
    await p.getByRole('button', { name: 'معاينة الطالب', exact: true }).click();
    await p.waitForTimeout(450);
    const afterMorph = await p.locator('.qs-preview-switch path').getAttribute('d');
    assert.notEqual(afterMorph, beforeMorph);
    assert.ok(!afterMorph.includes('NaN'));
    await p.locator('[data-match-left="0"]').click();
    await p.locator('[data-match-right="1"]').click();
    assert.equal(await p.locator('.response-match-grid>svg path').count(), 1);
    await p.locator('[data-match-left="1"]').dragTo(p.locator('[data-match-right="0"]'));
    assert.equal(await p.locator('.response-match-grid>svg path').count(), 2);
    await p.getByRole('button', { name: 'العودة للتحرير', exact: true }).click();
    await p.getByRole('button', { name: 'رفع السؤال 3', exact: true }).click();
    assert.ok((await p.locator('.qs-select-question').nth(1).innerText()).includes('صل الكلمات'));
    const handle = p.getByRole('button', { name: 'اسحب السؤال 2 لترتيبه' });
    await handle.hover(); // Wait for the preceding layout transition before grabbing its handle.
    const from = await handle.boundingBox(),
      to = await p.locator('.qs-outline-item').first().boundingBox();
    await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await p.mouse.down();
    await p.mouse.move(to.x + 20, to.y + 5, { steps: 18 });
    await p.mouse.up();
    await p.waitForTimeout(400);
    assert.ok(
      (await p.locator('.qs-select-question').first().innerText()).includes('صل الكلمات'),
      'Pointer drag reorders questions',
    );
    await p.getByRole('button', { name: 'نسخ السؤال', exact: true }).click();
    assert.equal(await p.locator('.qs-outline-item').count(), 4);
    await p.getByRole('button', { name: 'حذف السؤال', exact: true }).click();
    await p.getByRole('button', { name: 'تراجع', exact: true }).click();
    assert.equal(await p.locator('.qs-outline-item').count(), 4);
    await p.getByRole('button', { name: 'حفظ كمسودة', exact: true }).click();
    await p.waitForFunction(() => window.__saved);
    assert.equal((await p.evaluate(() => window.__saved)).questions[0].kind, 'match');
    await p.screenshot({ path: 'test-results/exam-studio-desktop.png', fullPage: true });
    await p.setViewportSize({ width: 390, height: 1000 });
    await p.screenshot({ path: 'test-results/exam-studio-mobile.png', fullPage: true });
    assert.ok(
      await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Mobile fits viewport',
    );
    await p.setViewportSize({ width: 1440, height: 1100 });
    await p.getByRole('tab', { name: /الإعدادات والمظهر/ }).click();
    await p.getByLabel('اسم الامتحان', { exact: true }).fill('العربية لغتي · تحديث');
    await p.getByRole('tab', { name: /مراجعة ونشر/ }).click();
    await p.locator('.qs-final-review').waitFor();
    // Real student component + durable queue, including an offline answer and a reload.
    const student = await call(
        '/api/students',
        'POST',
        { id: 's1', name: 'طالب اختبار', grade: 'العاشر', section: 'أ' },
        teacher.token,
      ),
      login = await call('/api/login', 'POST', { role: 'student', code: student.code });
    await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher.token);
    const started = await call(
      '/api/attempts/start',
      'POST',
      { examId: exam.id, cameraAvailable: false },
      login.token,
    );
    const snapshot = {
      ...started,
      scope: 'test',
      studentId: student.id,
      offset: started.serverNow - Date.now(),
      answers: {},
      revisions: {},
      pending: {},
      submitPending: false,
    };
    await p.evaluate(
      async ({ token, snapshot }) => {
        const { setToken } = await import('/src/api.ts');
        setToken(token);
        window.mountStudent(snapshot);
      },
      { token: login.token, snapshot },
    );
    await p.locator('.student-exam-theme').waitFor();
    assert.equal(await p.getByText('الفرح مضاد الحزن', { exact: true }).count(), 0);
    const firstKind = started.questions[0].kind;
    assert.equal(firstKind, 'match');
    await p.locator('[data-match-left="0"]').click();
    await p.locator('[data-match-right="1"]').click();
    await p.waitForTimeout(900);
    const restored = await call(
      `/api/attempts/${started.attempt.id}`,
      'GET',
      undefined,
      login.token,
    );
    assert.ok(restored.attempt.answers[started.questions[0].id]);
    await p.context().setOffline(true);
    const choiceIndex = started.questions.findIndex((q) => !q.kind || q.kind === 'single');
    await p.locator('.question-map button').nth(choiceIndex).click();
    await p.locator('.response-choices button').first().click();
    await p.waitForTimeout(650);
    await p.evaluate(
      async ({ studentId }) => {
        const { findSnapshot } = await import('/src/offline.ts');
        const cached = await findSnapshot(studentId, 'test');
        if (!cached) throw Error('No offline snapshot');
        window.mountStudent(cached);
      },
      { studentId: student.id },
    );
    await p.context().setOffline(false);
    await p.waitForTimeout(3400);
    const synced = await call(`/api/attempts/${started.attempt.id}`, 'GET', undefined, login.token);
    assert.equal(synced.attempt.answers[started.questions[choiceIndex].id], 0);
    for (const kind of ['short', 'essay']) {
      await p.evaluate((kind) => window.mountResponse(kind), kind);
      await p.locator(kind === 'short' ? 'input' : 'textarea').fill('إجابة كتابية');
      assert.equal(await p.evaluate(() => window.__answer), 'إجابة كتابية');
    }
    await p.evaluate(() => window.mountResponse('blank', { blankAnswers: ['أول', 'ثان'] }));
    await p.locator('input').nth(0).fill('مبتدأ');
    await p.locator('input').nth(1).fill('خبر');
    assert.deepEqual(await p.evaluate(() => window.__answer), ['مبتدأ', 'خبر']);
    await p.evaluate(() =>
      window.mountResponse('multiple', { options: ['أول', 'ثان', 'ثالث'], correctChoices: [0, 2] }),
    );
    await p.locator('.response-choices button').nth(0).click();
    await p.locator('.response-choices button').nth(2).click();
    assert.deepEqual(await p.evaluate(() => window.__answer), [0, 2]);
    await p.evaluate(() => window.mountResponse('boolean'));
    await p.locator('.response-choices button').nth(1).click();
    assert.equal(await p.evaluate(() => window.__answer), 1);
    await p.evaluate(() =>
      window.mountResponse('order', { options: ['الفكرة', 'المسودة', 'المراجعة'] }),
    );
    await p.getByRole('button', { name: 'خفض العنصر 1', exact: true }).click();
    await p.getByRole('button', { name: 'اعتماد هذا الترتيب', exact: true }).click();
    assert.equal((await p.evaluate(() => window.__answer)).length, 3);
    const priorOrder = await p.evaluate(() => window.__answer);
    await p.locator('.response-rank').first().dragTo(p.locator('.response-rank').last());
    assert.notDeepEqual(await p.evaluate(() => window.__answer), priorOrder);
    await p.evaluate(() => window.mountResponse('draw'));
    const ink = p.locator('.response-ink');
    await ink.scrollIntoViewIfNeeded();
    const box = await ink.boundingBox();
    await p.mouse.move(box.x + 20, box.y + 20);
    await p.mouse.down();
    await p.mouse.move(box.x + 150, box.y + 100, { steps: 10 });
    await p.mouse.up();
    await p.getByLabel('وصف الإجابة', { exact: true }).fill('شرح الرسم');
    assert.ok((await p.evaluate(() => window.__answer)).strokes[0].length > 1);
    assert.equal((await p.evaluate(() => window.__answer)).text, 'شرح الرسم');
    await p.evaluate(() => window.mountSimple());
    await p.locator('.simple-exam .question-studio').waitFor();
    await p.getByRole('button', { name: 'حفظ كمسودة', exact: true }).click();
    await p.locator('.exam-issues button').filter({ hasText: 'أدخل الصف' }).click();
    await p.waitForFunction(
      () => document.activeElement?.getAttribute('data-exam-field') === 'grade',
    );
    await p.getByRole('button', { name: 'أضف سؤالًا', exact: true }).click();
    await p.locator('.qs-type-menu button').filter({ hasText: 'صح أو خطأ' }).click();
    await p.locator('.qs-prompt-editor textarea').fill('هل العبارة صحيحة؟');
    assert.equal(await p.locator('.qs-outline-item').count(), 1);
    const manualExam = await call(
      '/api/exams',
      'POST',
      {
        ...exam,
        title: 'تصحيح الكتابة والرسم',
        questions: [
          { ...question, id: 'essay-q', kind: 'essay', options: [], rubric: 'الفكرة واللغة' },
          { ...question, id: 'draw-q', kind: 'draw', options: [], rubric: 'الدقة' },
        ],
      },
      teacher.token,
    );
    await call(`/api/exams/${manualExam.id}/publish`, 'POST', {}, teacher.token);
    const manualStart = await call(
      '/api/attempts/start',
      'POST',
      { examId: manualExam.id, cameraAvailable: false },
      login.token,
    );
    await call(
      `/api/attempts/${manualStart.attempt.id}/answers`,
      'PUT',
      {
        answers: [
          { questionId: 'essay-q', choice: 'إجابة تحتاج مراجعة', revision: 1 },
          {
            questionId: 'draw-q',
            choice: {
              strokes: [
                [
                  [0.1, 0.1],
                  [0.8, 0.8],
                ],
              ],
              text: 'وصف الرسم',
            },
            revision: 1,
          },
        ],
      },
      login.token,
    );
    const manualAttempt = await call(
      `/api/attempts/${manualStart.attempt.id}/submit`,
      'POST',
      {},
      login.token,
    );
    await p.evaluate((attempt) => window.mountGrading(attempt), manualAttempt);
    await p.getByRole('button', { name: 'تصحيح الإجابات', exact: true }).click();
    await p.getByRole('dialog').waitFor();
    assert.equal(
      await p.locator('.manual-grading-list textarea').first().inputValue(),
      'إجابة تحتاج مراجعة',
    );
    assert.equal(await p.locator('.manual-grading-list .response-ink polyline').count(), 1);
    await p.locator('.manual-grading-list select').nth(0).selectOption('1');
    await p.locator('.manual-grading-list select').nth(1).selectOption('0.5');
    await p.getByRole('button', { name: 'حفظ التصحيح', exact: true }).click();
    await p.waitForFunction(() => window.__graded);
    const gradeResult = await call(
      `/api/attempts/${manualAttempt.id}`,
      'GET',
      undefined,
      teacher.token,
    );
    assert.equal(gradeResult.attempt.score, 15);
    assert.equal(
      (await call(`/api/attempts/${manualAttempt.id}`, 'GET', undefined, login.token)).attempt
        .manualGrades,
      undefined,
    );
    const typedBank = await call(
      '/api/books/manual',
      'POST',
      { title: 'بنك الكتابة', subject: 'عربي', grade: 'العاشر', term: 'الأول' },
      teacher.token,
    );
    await p.evaluate((id) => window.mountBankComposer(id), typedBank.id);
    await p.getByLabel('نوع السؤال', { exact: true }).selectOption('short');
    await p
      .getByLabel('نص السؤال اليدوي', { exact: true })
      .fill('اشرح أثر الجاذبية والقوة والكتلة.');
    await p.locator('.keyword-editor>summary').click();
    await p.locator('.keyword-editor input[type=checkbox]').check();
    await p.getByLabel('اسم الفكرة 1', { exact: true }).fill('الجذب');
    await p.getByLabel('مرادفات الفكرة 1', { exact: true }).fill('الجاذبية|التجاذب');
    await p.getByRole('button', { name: 'إضافة فكرة', exact: true }).click();
    await p.getByLabel('اسم الفكرة 2', { exact: true }).fill('القوة');
    await p.getByLabel('مرادفات الفكرة 2', { exact: true }).fill('قوة|القوة');
    await p.getByLabel('عدد الأفكار اللازمة للدرجة الكاملة', { exact: true }).fill('2');
    await p
      .getByLabel('تفسير إجابة السؤال', { exact: true })
      .fill('تفسير خاص بالمعلم لا يظهر للطالب.');
    await p
      .getByRole('checkbox', { name: 'راجعت السؤال والإجابة وأعتمده للاستخدام', exact: true })
      .check();
    await p.getByRole('button', { name: 'إضافة السؤال', exact: true }).click();
    await p.waitForFunction(() => window.__bankCreated);
    await p
      .locator('.save-receipt')
      .getByText('حُفظ السؤال. يمكنك كتابة السؤال التالي.', { exact: true })
      .waitFor();
    await p.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'نص السؤال اليدوي',
    );
    const createdBankQuestion = await p.evaluate(() => window.__bankCreated);
    assert.equal(createdBankQuestion.keywordGrading.required, 2);
    await p.evaluate(({ q, id }) => window.mountBankReview(q, id), {
      q: createdBankQuestion,
      id: typedBank.id,
    });
    await p.getByRole('tab', { name: 'تعديل', exact: true }).click();
    await p.getByRole('button', { name: 'إضافة فكرة', exact: true }).click();
    await p.getByLabel('اسم الفكرة 3', { exact: true }).fill('الكتلة');
    await p.getByLabel('مرادفات الفكرة 3', { exact: true }).fill('الكتلة');
    await p.getByLabel('عدد الأفكار اللازمة للدرجة الكاملة', { exact: true }).fill('3');
    await p.screenshot({ path: 'test-results/keyword-bank-editor.png', fullPage: true });
    await p.getByRole('button', { name: 'اعتماد السؤال', exact: true }).click();
    await p.waitForFunction(() => window.__bankReviewed);
    const updatedBankQuestion = (
      await call(`/api/books/${typedBank.id}/questions`, 'GET', undefined, teacher.token)
    )[0];
    assert.equal(updatedBankQuestion.keywordGrading.required, 3);
    await p.evaluate(() => window.mountPicker());
    await p.getByLabel('بنك أسئلة الامتحان', { exact: true }).selectOption(typedBank.id);
    const pick = p.locator('.bank-picker-grid > button').first();
    await pick.waitFor();
    const unpicked = await pick.locator('.bank-pick-check path').getAttribute('d');
    await pick.click();
    await p.waitForTimeout(450);
    assert.equal(await pick.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await pick.locator('.bank-pick-check path').getAttribute('d'), unpicked);
    await p.locator('.bank-selection-bar .primary').click();
    await p.waitForFunction(() => window.__picked?.length === 1);
    await p.evaluate(() => window.mountBankWizard());
    await p.getByLabel('طلب البنك: عنوان الكتاب', { exact: true }).fill('بنك متنوع');
    await p.getByLabel('طلب البنك: المادة', { exact: true }).fill('عربي');
    await p.getByLabel('طلب البنك: الصف', { exact: true }).fill('العاشر');
    assert.equal(await p.locator('.bank-type-selection input').count(), 9);
    for (const label of [
      'ضع دائرة',
      'اختيارات متعددة',
      'صح أو خطأ',
      'إجابة قصيرة',
      'أكمل الفراغ',
      'توصيل',
      'ترتيب بالسحب',
    ])
      await p
        .locator('.bank-type-selection')
        .getByRole('checkbox', { name: label, exact: true })
        .uncheck();
    await p.getByRole('button', { name: 'التالي: اختيار المساعد', exact: true }).click();
    await p.locator('.prompt-workbench>summary').click();
    const typePrompt = await p.getByLabel('معاينة الطلب', { exact: true }).inputValue();
    assert.ok(typePrompt.includes('"kind": "essay"'));
    assert.ok(typePrompt.includes('"kind": "draw"'));
    assert.ok(!typePrompt.includes('"kind": "single"'));
    const keywordExam = await call(
      '/api/exams',
      'POST',
      {
        ...exam,
        title: 'امتحان مفاهيم',
        questions: [{ ...updatedBankQuestion, id: 'keyword-ui' }],
      },
      teacher.token,
    );
    await call(`/api/exams/${keywordExam.id}/publish`, 'POST', {}, teacher.token);
    const keywordStart = await call(
      '/api/attempts/start',
      'POST',
      { examId: keywordExam.id, cameraAvailable: false },
      login.token,
    );
    assert.equal(keywordStart.questions[0].keywordTarget, 3);
    assert.ok(!JSON.stringify(keywordStart.questions).includes('التجاذب'));
    await p.evaluate((q) => window.mountResponse('short', q), keywordStart.questions[0]);
    await p.locator('.keyword-student-hint').waitFor();
    assert.ok((await p.locator('.keyword-student-hint').innerText()).includes('3'));
    assert.ok(!(await p.locator('body').innerText()).includes('التجاذب'));
    await p.screenshot({ path: 'test-results/keyword-student-hint.png' });
    await call(
      `/api/attempts/${keywordStart.attempt.id}/answers`,
      'PUT',
      { answers: [{ questionId: 'keyword-ui', choice: 'الجاذبية تسبب قوة', revision: 1 }] },
      login.token,
    );
    const keywordAttempt = await call(
      `/api/attempts/${keywordStart.attempt.id}/submit`,
      'POST',
      {},
      login.token,
    );
    assert.equal(keywordAttempt.gradingPending, true);
    await p.evaluate((attempt) => {
      window.__graded = false;
      window.mountGrading(attempt);
    }, keywordAttempt);
    await p.getByRole('button', { name: 'تصحيح الإجابات', exact: true }).click();
    await p.locator('.keyword-suggestion').waitFor();
    await p.getByRole('button', { name: 'اعتماد المقترح بعد مراجعة المعنى', exact: true }).click();
    await p.getByRole('button', { name: 'حفظ التصحيح', exact: true }).click();
    await p.waitForFunction(() => window.__graded);
    assert.equal(
      (await call(`/api/attempts/${keywordAttempt.id}`, 'GET', undefined, teacher.token)).attempt
        .score,
      13.33,
    );
    await p.evaluate(() => window.mountRoster());
    const ExcelJS = require('exceljs'),
      roster = new ExcelJS.Workbook();
    roster.addWorksheet('Students').addRows([
      ['اسم الطالبة', 'الصف'],
      ['سارة استيراد', 'العاشر'],
    ]);
    await p.getByLabel('ملف قائمة الطلاب', { exact: true }).setInputFiles({
      name: 'students.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await roster.xlsx.writeBuffer()),
    });
    await p.getByRole('button', { name: 'معاينة القائمة', exact: true }).click();
    await p.locator('.roster-review').getByText('سارة استيراد', { exact: true }).waitFor();
    assert.ok((await p.locator('.roster-review').innerText()).includes('دخول برمز الطالب'));
    await p.screenshot({ path: 'test-results/excel-import-no-id.png', fullPage: true });
    await p.getByRole('button', { name: 'اعتماد القائمة', exact: true }).click();
    await p.waitForFunction(() => window.__rosterDone);
    await p.evaluate(() => window.mountIntro());
    await p.getByRole('dialog', { name: 'Zunis · تذكير بالنزاهة', exact: true }).waitFor();
    assert.equal(await p.locator('.integrity-trace circle').count(), 2);
    await p.waitForTimeout(600);
    await p.screenshot({ path: 'test-results/gsap-exam-start.png' });
    await p.waitForFunction(() => window.__introDone);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.evaluate(() => {
      window.__introDone = false;
      window.mountIntro();
    });
    await p.getByRole('dialog', { name: 'Zunis · تذكير بالنزاهة', exact: true }).waitFor();
    assert.equal(
      await p
        .locator('.integrity-trace circle')
        .first()
        .evaluate((el) => el.style.strokeDashoffset),
      '',
    );
    await p.waitForFunction(() => window.__introDone);
    await p.evaluate(() => window.mountAppearance());
    await p.locator('.exam-personalization>summary').click();
    await p.getByRole('button', { name: 'أخضر مريح', exact: true }).click();
    await p.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.appearance-preview')).backgroundColor ===
        'rgb(241, 248, 244)',
    );
    await p.evaluate(() => window.mountMorph('plus'));
    const quietPlus = await p.locator('.morph-mark path').getAttribute('d');
    await p.evaluate(() => window.mountMorph('check'));
    await p.waitForFunction(
      (previous) => document.querySelector('.morph-mark path').getAttribute('d') !== previous,
      quietPlus,
    );
    assert.equal(await p.locator('.morph-mark path').getAttribute('d'), 'M4 12L9 17L20 6');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.evaluate(() => window.mountMorph('eye'));
    for (const shape of ['edit', 'plus', 'check', 'working']) {
      await p.evaluate((shape) => window.mountMorph(shape), shape);
      await p.waitForTimeout(40);
    }
    assert.ok(!(await p.locator('.morph-mark path').getAttribute('d')).includes('NaN'));
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.waitForTimeout(100);
    const stopped = await p.locator('.morph-mark').evaluate((el) => getComputedStyle(el).transform);
    await p.waitForTimeout(180);
    assert.equal(
      await p.locator('.morph-mark').evaluate((el) => getComputedStyle(el).transform),
      stopped,
    );
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.evaluate(() => window.mountNotice('تم حفظ المسودة بنجاح'));
    await p.getByRole('status').filter({ hasText: 'تم حفظ المسودة بنجاح' }).waitFor();
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'test-results/gsap-save-feedback.png' });
    await p.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await p.waitForFunction(() => window.__noticeClosed);
    await p.goto(base, { waitUntil: 'domcontentloaded' });
    await p.locator('.prism-login .login-card').waitFor();
    await p.locator('.prism-caption').waitFor();
    await p.waitForTimeout(700);
    await p.screenshot({ path: 'test-results/gsap-login.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'Exam and bank UI passed: GSAP morphing, Flip step indicators, appearance transitions, save receipts, notifications, reduced motion, guided errors, Excel import, login, drag/drop, all answer types, offline recovery and grading',
    );
  } catch (e) {
    console.error(logs.slice(-8).join(''));
    throw e;
  } finally {
    if (browser) await browser.close();
    server.kill();
    vite.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
