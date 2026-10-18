const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = mkdtempSync('.data/teacher-essentials-ui-');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'lucide-react',
        'katex',
        'zod',
        'motion/react',
        'mathlive',
        '@adi1816/genie-effect',
        '@reduxjs/toolkit',
        'mathjs',
      ],
    },
  });
  let browser;
  try {
    writeFileSync(
      resolve(directory, 'index.html'),
      '<html lang="ar" dir="rtl"><div id="root"></div><script type="module" src="./harness.tsx"></script></html>',
    );
    writeFileSync(
      resolve(directory, 'harness.tsx'),
      `
import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
import SimpleExamCreator from '/src/SimpleExamCreator'; import BankWizard from '/src/BankWizard'; import Welcome from '/src/Welcome'; import AppUpdates from '/src/AppUpdates';
import '/src/styles.css'; import '/src/surfaces.css'; import '/src/schoolUpgrade.css'; import '/src/quietWorkspace.css';
import '@fontsource/tajawal/400.css'; import '@fontsource/tajawal/700.css';
let state = {status:'idle',current:'1.4.3'}; const listeners = new Set();
const emit = next => { state={...state,...next}; listeners.forEach(fn=>fn({type:'app-update',state})); return state; };
window.installs=0; window.desktop={ request:async (url,method='GET',body)=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;},
connectionState:async()=>({connected:false,local:false}), discover:async()=>[],host:async()=>{throw Error('يوجد جهاز رئيسي يعمل بالفعل. اضغط كرة الاتصال للارتباط به.');},
onEvent:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},updateState:async()=>state,checkUpdates:async()=>emit({status:'available',version:'1.4.4',size:100,notes:'مزايا جديدة'}),
downloadUpdate:async()=>{emit({status:'downloading',received:50});return emit({status:'ready',received:100});},cancelUpdate:async()=>emit({status:'error',error:'أُلغي التنزيل'}),installUpdate:async()=>{window.installs++;return emit({status:'installing'});}};
function Harness(){const [view,setView]=useState('simple'),[notice,setNotice]=useState('');return <><nav aria-label="test views">{['simple','bank','welcome','updates'].map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav><p role="status">{notice}</p><main className="page-surface">{view==='simple'?<SimpleExamCreator onSaved={e=>setNotice(e.status)} onAdvanced={()=>{}} onBooks={()=>{}}/>:view==='bank'?<BankWizard books={[]} notify={setNotice} onImported={async()=>setNotice('blank bank saved')}/>:view==='welcome'?<Welcome onLogin={()=>{}} onHost={()=>{}} onResume={()=>{}} notify={setNotice}/>:<AppUpdates/>}</main></>};createRoot(document.getElementById('root')).render(<Harness/>);
`,
    );
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    page.setDefaultTimeout(20000);
    const errors = [],
      requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const bank = {
      id: 'bank1',
      title: 'بنك الرياضيات',
      subject: 'رياضيات',
      grade: '10',
      term: 'الأول',
      questions: 1,
    };
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=';
    const q = {
      id: 'bq1',
      text: 'اقرأ الشكل ثم اختر الإجابة',
      options: ['1', '2', '3', '4'],
      correct: 1,
      explanation: 'من الشكل',
      page: 1,
      difficulty: 'متوسط',
      chapter: 'رسم',
      status: 'approved',
      requiresImage: true,
      image,
    };
    let posts = 0,
      publishes = 0,
      savedInput;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname,
        method = route.request().method();
      requests.push(path);
      const body = method === 'GET' ? undefined : route.request().postDataJSON();
      if (path === '/api/books' && method === 'GET') return route.fulfill({ json: [bank] });
      if (path === '/api/books/manual')
        return route.fulfill({ json: { ...body, id: 'manual-bank', questions: 0 } });
      if (path === '/api/books/bank1/questions') return route.fulfill({ json: [q] });
      if (path === '/api/bank/prompt') return route.fulfill({ json: { prompt: '' } });
      if (path === '/api/exams' && method === 'POST') {
        posts++;
        savedInput = body;
        return route.fulfill({ json: { ...body, id: 'exam1', code: 'ABC123', status: 'draft' } });
      }
      if (path === '/api/exams/exam1' && method === 'PUT') {
        savedInput = body;
        return route.fulfill({ json: { ...body, id: 'exam1', code: 'ABC123', status: 'draft' } });
      }
      if (path === '/api/exams/exam1/publish') {
        publishes++;
        return route.fulfill(
          publishes === 1
            ? { status: 400, json: { error: 'اختبار إعادة المحاولة' } }
            : { json: { status: 'published' } },
        );
      }
      return route.fulfill({ json: [] });
    });
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/.data/${basename(directory)}/index.html`,
    );
    await page.getByLabel('اسم الامتحان', { exact: true }).fill('امتحان بسيط');
    await page.getByLabel('المادة', { exact: true }).fill('رياضيات');
    await page.getByLabel('الصف', { exact: true }).fill('10');
    await page.getByLabel('نص السؤال اليدوي', { exact: true }).fill('ما ناتج 2 + 3؟');
    for (let i = 0; i < 4; i++)
      await page.getByLabel(`نص الخيار ${i + 1}`, { exact: true }).fill(['1', '2', '5', '7'][i]);
    await page.getByLabel('الإجابة الصحيحة: 3', { exact: true }).check();
    await page.getByRole('button', { name: 'إضافة السؤال', exact: true }).click();
    await page.getByRole('button', { name: 'أختار من البنك', exact: true }).click();
    await page.getByLabel('البنك', { exact: true }).selectOption('bank1');
    await page.locator('.simple-bank-question input').check();
    const illustratedReview = page.locator('.simple-question-review').last();
    await illustratedReview.locator('summary').click();
    await illustratedReview.getByRole('button', { name: 'تعديل', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'يعتمد السؤال على صورة أو رسم', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'إزالة الرسم', exact: true }).click();
    await page.getByRole('button', { name: 'حفظ تعديل السؤال', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'أرفق الرسم المطلوب' }).waitFor();
    await page.getByRole('button', { name: 'إلغاء تعديل السؤال', exact: true }).click();
    await page.getByRole('checkbox', { name: 'نموذج عشوائي مختلف لكل طالب' }).check();
    await page.getByLabel('عدد الأسئلة لكل طالب').fill('1');
    await page
      .getByRole('checkbox', { name: 'راجعت الأسئلة والرسوم والإجابات والإعدادات وأعتمدها.' })
      .check();
    await page.screenshot({ path: 'test-results/simple-exam-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 760, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: 'test-results/simple-exam-760.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.getByRole('button', { name: 'نشر الامتحان للطلاب' }).click();
    await page.getByRole('alert').filter({ hasText: 'اختبار إعادة المحاولة' }).waitFor();
    await page.getByRole('button', { name: 'نشر الامتحان للطلاب' }).click();
    await page.getByRole('heading', { name: 'امتحانك جاهز للطلاب' }).waitFor();
    assert.equal(posts, 1);
    assert.equal(savedInput.questions.length, 2);
    assert.equal(savedInput.delivery.count, 1);
    assert.equal(savedInput.questions[1].image, image);
    await page.getByRole('button', { name: 'bank', exact: true }).click();
    for (const [label, text] of [
      ['عنوان الكتاب', 'بنك فارغ'],
      ['المادة', 'فيزياء'],
      ['الصف', '10'],
    ])
      await page.getByLabel('طلب البنك: ' + label, { exact: true }).fill(text);
    await page
      .getByRole('button', { name: 'إنشاء بنك فارغ يدويًا — دون ذكاء اصطناعي', exact: true })
      .click();
    await page.getByRole('status').filter({ hasText: 'أُنشئ البنك الفارغ' }).waitFor();
    await page.getByRole('checkbox', { name: 'تضمين صور ورسوم وأسئلة تعتمد على الشكل' }).uncheck();
    await page.getByRole('button', { name: 'التالي: اختيار المساعد' }).click();
    await page.locator('.prompt-workbench summary').click();
    const prompt = page.getByLabel('معاينة الطلب');
    assert.match(await prompt.inputValue(), /أسئلة دون صور/);
    await prompt.fill('نص معدل');
    assert.equal(await prompt.inputValue(), 'نص معدل');
    await page.getByRole('button', { name: 'welcome', exact: true }).click();
    await page.getByRole('button', { name: 'تشغيل الجهاز الرئيسي' }).click();
    await page
      .getByText('يوجد جهاز رئيسي يعمل بالفعل. اضغط كرة الاتصال للارتباط به.', { exact: true })
      .waitFor();
    assert.equal(await page.locator('.host-conflict-glow').count(), 1);
    await page.getByRole('button', { name: 'updates', exact: true }).click();
    await page.getByRole('button', { name: 'تحديث التطبيق', exact: true }).click();
    await page.getByRole('button', { name: 'البحث عن تحديث', exact: true }).click();
    await page.getByRole('button', { name: 'تنزيل التحديث داخل التطبيق', exact: true }).click();
    const install = page.getByRole('button', { name: 'تثبيت وإعادة تشغيل التطبيق', exact: true });
    assert.equal(await install.isDisabled(), true);
    assert.equal(await page.evaluate(() => window.installs), 0);
    await page.getByRole('checkbox', { name: 'حفظت عملي وأوافق' }).check();
    await install.click();
    assert.equal(await page.evaluate(() => window.installs), 1);
    assert.deepEqual(errors, []);
    assert.equal(
      requests.some((path) => /generate|process/.test(path)),
      false,
    );
    console.log(
      'Teacher essentials UI passed: manual creation, simple publishing/retry, diagram inclusion, prompt editing, host conflict feedback, and update install confirmation.',
    );
  } finally {
    await browser?.close();
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
