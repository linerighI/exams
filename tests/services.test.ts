import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { subjectService, subjectServiceGuide, layers } from '../src/serviceCatalog';
import { numericChoice, mathQuestionIssues } from '../src/mathQuality';
import { mathDiagramSvg } from '../src/mathDiagrams';
import { bankPrompt } from '../src/bankExchange';
import { createApp } from '../server/app';
import katex from '../src/mathRenderer';
test('versioned subject services route English, Arabic, physics and chemistry prompts', () => {
  assert.deepEqual(
    layers.map((l) => [l.name, l.version]),
    [
      ['Zunis', 1],
      ['Animato', 1],
      ['LANED', 1],
    ],
  );
  for (const subject of ['الرياضيات', 'فِيزياء', 'الكيمياء', 'Physics', 'Chemistry', 'علوم'])
    assert.equal(subjectService(subject), 'math');
  assert.equal(subjectService('اللغة الإنجليزية'), 'english');
  assert.equal(subjectService('لغة عربية'), 'arabic');
  assert.match(subjectServiceGuide('math'), /SI/);
  assert.match(
    bankPrompt({ title: 'English', subject: 'English', grade: '10', term: 'الأول' }, 10, '', 'سهل'),
    /Write question text/,
  );
  assert.match(
    bankPrompt({ title: 'Physics', subject: 'فيزياء', grade: '10', term: 'الأول' }, 10, '', 'سهل'),
    /LANED 1 · math/,
  );
});
test('bounded arithmetic detects numeric equivalents without evaluating code or equating units', () => {
  for (const [text, n] of [
    ['\\(\\frac{1}{2}\\)', 0.5],
    ['50%', 0.5],
    ['١/٢', 0.5],
    ['-2^2', -4],
    ['(-2)^2', 4],
    ['2^-2', 0.25],
    ['1e3', 1000],
  ] as const)
    assert.equal(numericChoice(text), n, text);
  for (const text of [
    'x+x',
    '2 m',
    '2 s',
    '1/0',
    '2^1000',
    'import("fs")',
    'a=1',
    '1;2',
    'NaN',
    'Infinity',
    '2**3',
    Array(200).fill('(').join(''),
  ])
    assert.equal(numericChoice(text), undefined, text);
  assert.equal(
    mathQuestionIssues({ text: 'اختر', options: ['0.5', '\\(\\frac{1}{2}\\)', '2', '3'] }).length,
    1,
  );
  assert.equal(
    mathQuestionIssues({ text: 'اختر', options: ['2 m', '2 s', '0', '0.0000000000001'] }).length,
    0,
  );
  assert.equal(
    mathQuestionIssues({ text: 'اختر', options: ['0.333333', '1/3', '1', '2'] }).length,
    0,
  );
});
test('math audit identifies broken notation and missing required drawings, without claiming to solve', () => {
  assert.doesNotThrow(() =>
    katex.renderToString('\\ce{2 H2 + O2 -> 2 H2O}', { throwOnError: true, trust: false }),
  );
  assert.deepEqual(mathQuestionIssues({ text: 'وازن \\(\\ce{H2 + O2 -> H2O}\\)' }), []);
  assert.ok(
    mathQuestionIssues({ text: 'احسب \\(\\notarealcommand{x}\\)' }).some((i) => i.field === 'text'),
  );
  assert.ok(mathQuestionIssues({ text: 'احسب \\(x^2' }).some((i) => i.field === 'text'));
  assert.ok(
    mathQuestionIssues({ text: 'حسب الشكل', requiresImage: true }).some((i) => i.field === 'image'),
  );
  assert.deepEqual(
    mathQuestionIssues({
      text: 'احسب \\(\\frac{1}{2}+x^2\\)',
      explanation: '\\(x=2\\)',
      options: ['1', '2', '3', '4'],
    }),
    [],
  );
});
test('math diagrams use bounded supplied data and remain safe static SVG', () => {
  const graph = mathDiagramSvg({ type: 'function', coefficients: [0, -4, 0, 1], range: 10 });
  assert.match(graph, /viewBox="0 0 500 330"/);
  assert.ok(!/script|foreignObject|NaN|Infinity/.test(graph));
  const triangle = mathDiagramSvg({ type: 'triangle', width: 4, height: 3 });
  assert.match(triangle, /4 cm/);
  assert.match(triangle, /3 cm/);
  assert.ok(!triangle.includes('5 cm'), 'Do not leak the hypotenuse answer');
  const forces = mathDiagramSvg({ type: 'forces', fx: -8, fy: 5 });
  assert.match(forces, /Fx = -8 N/);
  assert.match(forces, /Fy = 5 N/);
  assert.ok(!forces.includes('resultant'));
  for (const data of [
    { type: 'triangle', width: 0, height: 1 },
    { type: 'forces', fx: 0, fy: 0 },
    { type: 'function', coefficients: [Infinity], range: 10 },
    { type: 'function', coefficients: [0, 1], range: 0 },
  ])
    assert.throws(() => mathDiagramSvg(data as any));
});
test('LANED enforces math publication and bank approval checks; local graphs never call AI', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'math-services-')),
    server = await createApp({ directory }),
    originalFetch = globalThis.fetch;
  const call = async (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'Math School', password: 'Service123' });
    const admin = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Service123' })
    ).json().token;
    assert.equal((await call('/api/services')).statusCode, 403);
    assert.equal((await call('/api/services', 'GET', undefined, admin)).json().subjects.length, 3);
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error('No AI for a local graph');
    };
    const graph = await call('/api/geometry/generate', 'POST', { prompt: 'y=x^2-4' }, admin);
    assert.equal(graph.statusCode, 200, graph.body);
    assert.equal(graph.json().origin, 'local');
    assert.equal(calls, 0);
    const q = {
      id: 'q',
      text: 'اختر الجواب',
      options: ['0.5', '1/2', '2', '3'],
      correct: 0,
      explanation: 'نصف',
      page: 1,
    };
    const checked = await call('/api/services/math/check', 'POST', q, admin);
    assert.equal(checked.json().requiresTeacherReview, true);
    assert.equal(checked.json().issues[0].field, 'options.1');
    const exam = (
      await call(
        '/api/exams',
        'POST',
        {
          title: 'Math',
          subject: 'رياضيات',
          grade: '10',
          section: 'أ',
          term: 'الأول',
          kind: 'نصفي',
          duration: 45,
          total: 20,
          difficulty: 'سهل',
          cameraRequired: false,
          opensAt: new Date().toISOString(),
          closesAt: new Date(Date.now() + 3600000).toISOString(),
          questions: [q],
        },
        admin,
      )
    ).json();
    const blocked = await call(`/api/exams/${exam.id}/publish`, 'POST', {}, admin);
    assert.equal(blocked.statusCode, 400, blocked.body);
    assert.deepEqual(blocked.json().issues[0].path, ['questions', 0, 'options', 1]);
    const missing = (
      await call(
        '/api/exams',
        'POST',
        {
          ...exam,
          id: undefined,
          questions: [{ ...q, options: ['1', '2', '3', '4'], requiresImage: true }],
        },
        admin,
      )
    ).json();
    assert.equal(missing.questions[0].requiresImage, true);
    const missingBlocked = await call(`/api/exams/${missing.id}/publish`, 'POST', {}, admin);
    assert.equal(missingBlocked.statusCode, 400);
    assert.deepEqual(missingBlocked.json().issues[0].path, ['questions', 0, 'image']);
    const bank = (
      await call(
        '/api/books/manual',
        'POST',
        { title: 'Math Bank', subject: 'رياضيات', grade: '10', term: 'الأول' },
        admin,
      )
    ).json();
    const stored = {
      ...q,
      id: 'bank-q',
      bookId: bank.id,
      status: 'draft',
      chapter: 'جبر',
      difficulty: 'سهل',
      evidence: 'مراجعة',
      requiresImage: false,
    };
    server.store.put('bank_questions', stored);
    assert.equal(
      (await call('/api/bank/bank-q', 'PUT', { ...stored, status: 'approved' }, admin)).statusCode,
      400,
    );
    assert.equal(
      (
        await call(
          `/api/books/${bank.id}/questions/bulk`,
          'POST',
          { ids: ['bank-q'], action: 'approve' },
          admin,
        )
      ).statusCode,
      400,
    );
    assert.equal(server.store.get('bank_questions', 'bank-q').status, 'draft');
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: 's', name: 'طالب', grade: '10', section: 'أ' },
        admin,
      )
    ).json();
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    assert.equal((await call('/api/services/math/check', 'POST', q, token)).statusCode, 403);
  } finally {
    globalThis.fetch = originalFetch;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
