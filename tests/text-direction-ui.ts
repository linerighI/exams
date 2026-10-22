import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const harness = mkdtempSync(resolve('.data/text-direction-'));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'lucide-react',
      'motion/react',
      'katex',
    ],
  },
});
let browser;
try {
  writeFileSync(
    join(harness, 'index.html'),
    '<html dir="rtl" lang="ar"><meta charset="utf-8"><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>',
  );
  writeFileSync(
    join(harness, 'main.tsx'),
    `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import '/src/styles.css';import '/src/workspace.css';import '/src/bankDashboard.css';import '/src/surfaces.css';
    import MathText from '/src/MathText';import QuestionResponse from '/src/QuestionResponse';import VisualFormulaEditor from '/src/VisualFormulaEditor';
    const english=['Muna _____ up late every morning.','My friends and I _____ usually _____ emails.','Jamal _____ meat at all; he is vegetarian.', 'Can I call you back? I _____ to someone else at the moment.', "doesn't get"];
    function Demo(){const[answer,setAnswer]=useState(''),[text,setText]=useState(english[0]);return <main style={{padding:30,maxWidth:1200,margin:'auto'}}>
      <h1>معاينة الأسئلة العربية والإنجليزية</h1><section className="book-workspace"><div className="bank-grid">{english.map((text,i)=><article key={i} className="bank-question panel"><small>للمراجعة · ضع دائرة</small><MathText text={text}/><small>متوسط · Present Simple</small></article>)}</div></section>
      <section className="student-question-content"><h2><MathText text={english[0]}/></h2><QuestionResponse question={{id:'q1',text:english[0],kind:'single',options:["doesn't get","doesn't got","don't get","isn't getting"],correct:0}} onChange={()=>{}}/></section>
      <h2><MathText text={'احسب قيمة المقدار \\\\(x^2 + 4\\\\).'} /></h2>
      <h2><MathText text={'\\\\(x^2\\\\) احسب قيمة المقدار.'} /></h2>
      <QuestionResponse question={{id:'q2',text:english[0],kind:'short',options:[],correct:0}} value={answer} onChange={setAnswer}/>
      <VisualFormulaEditor value={text} onChange={setText} tools={false} ariaLabel="تحرير السؤال"/>
    </main>};createRoot(document.getElementById('root')).render(<Demo/>);
  `,
  );
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1100 } });
  await page.goto(
    `${vite.resolvedUrls!.local[0]}${harness.slice(resolve('.').length + 1).replace(/\\/g, '/')}/index.html`,
  );
  await page.locator('.bank-question .math-text').first().waitFor();
  await page.locator('.visual-formula-parts textarea').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const cards = page.locator('.bank-question .math-text');
  for (let i = 0; i < (await cards.count()); i++) {
    assert.equal(await cards.nth(i).getAttribute('dir'), 'ltr');
    assert.equal(await cards.nth(i).evaluate((el) => getComputedStyle(el).direction), 'ltr');
  }
  // Check actual glyph positions: final punctuation must follow the last letter.
  const punctuation = await cards.first().evaluate((el) => {
    const node = el.querySelector('span')!.firstChild!;
    const text = node.textContent!;
    const lastLetter = document.createRange(),
      period = document.createRange();
    lastLetter.setStart(node, text.length - 2);
    lastLetter.setEnd(node, text.length - 1);
    period.setStart(node, text.length - 1);
    period.setEnd(node, text.length);
    return {
      lastLetter: lastLetter.getBoundingClientRect().x,
      period: period.getBoundingClientRect().x,
    };
  });
  assert.ok(punctuation.period > punctuation.lastLetter, JSON.stringify(punctuation));
  assert.equal(await page.locator('h2 .math-text[dir="rtl"]').count(), 2);
  assert.equal(await page.locator('.student-options .math-text[dir="ltr"]').count(), 4);
  const input = page.locator('.question-written input');
  assert.equal(await input.getAttribute('dir'), 'ltr');
  await input.fill('إجابة عربية');
  assert.equal(await input.getAttribute('dir'), 'rtl');
  await input.fill("doesn't get");
  assert.equal(await input.getAttribute('dir'), 'ltr');
  const editor = page.locator('.visual-formula-parts textarea');
  assert.equal(await editor.getAttribute('dir'), 'ltr');
  await editor.fill('سؤال عربي.');
  assert.equal(await editor.getAttribute('dir'), 'rtl');
  await editor.fill('Muna _____ up late every morning.');
  await page.screenshot({ path: 'test-results/text-direction.png', fullPage: true });
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      `overflow at ${width}`,
    );
  }
  console.log(
    'English punctuation, Arabic questions, answer inputs and editor direction passed in Edge.',
  );
} finally {
  await browser?.close();
  await vite.close();
  rmSync(harness, { recursive: true, force: true });
}
