import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import {
  questionKinds,
  changeQuestionKind,
  manualQuestion,
  studentQuestion,
  gradeAnswers,
} from '../src/questionFormats';
import { questionTypeExample, questionTypeGuide } from '../src/questionTypeGuide';
import { keywordSuggestion } from '../src/keywordGrading';
import { questionSchema } from '../server/questionSchema';
import { bankDocument } from '../server/bankTransfer';
import { bankPrompt } from '../src/bankExchange';
import { generate } from '../server/ai';
import type { Question, Attempt } from '../src/types';
const keyword: Question = {
  id: 'kw',
  kind: 'short',
  text: 'اشرح تأثير الجاذبية والقوة والكتلة.',
  options: [],
  correct: 0,
  explanation: 'MODEL_PRIVATE',
  page: 1,
  acceptedAnswers: [],
  keywordGrading: {
    mode: 'review',
    required: 3,
    groups: [
      { label: 'الجذب', terms: ['الجاذبية', 'التجاذب'] },
      { label: 'القوة', terms: ['قوة', 'القوة'] },
      { label: 'الكتلة', terms: ['الكتلة'] },
    ],
  },
};
test('keyword suggestions count distinct concepts, match whole phrases, flag negation, and never award marks without teacher approval', () => {
  assert.equal(keywordSuggestion(keyword, 'الجاذبية الجاذبية الجاذبية')?.count, 1);
  assert.equal(keywordSuggestion(keyword, 'اللاجاذبية')?.count, 0);
  assert.equal(keywordSuggestion(keyword, 'التَّجاذُب يسبب قُوَّة')?.count, 2);
  assert.equal(
    keywordSuggestion(keyword, 'الجاذبية لا تولد قوة')?.flags.some((v) => v.includes('نفي')),
    true,
  );
  const attempt = { answers: { kw: 'التجاذب والقوة' }, manualGrades: {} } as unknown as Attempt;
  gradeAnswers(attempt, [keyword], 20);
  assert.equal(attempt.score, null);
  assert.equal(attempt.gradingPending, true);
  attempt.manualGrades = { kw: 2 / 3 };
  gradeAnswers(attempt, [keyword], 20);
  assert.equal(attempt.score, 13.33);
  assert.equal(studentQuestion(keyword).keywordGrading, undefined);
  assert.equal(studentQuestion(keyword).keywordTarget, 3);
  assert.equal(manualQuestion(keyword), true);
  const invalid = {
    ...keyword,
    keywordGrading: {
      ...keyword.keywordGrading!,
      groups: [...keyword.keywordGrading!.groups, { label: 'تكرار', terms: ['قُوَّة'] }],
    },
  };
  assert.equal(questionSchema.safeParse(invalid).success, false);
  const next = changeQuestionKind(keyword, 'boolean');
  assert.equal(next.keywordGrading, undefined);
  assert.equal(next.acceptedAnswers, undefined);
  assert.equal(manualQuestion(next), false);
});
test('bank prompts define all nine types and preserve a selected subset without legacy four-option requirements', () => {
  const full = bankPrompt(
    { title: 'كتاب', subject: 'عربي', grade: 'العاشر', term: 'الأول' },
    200,
    '',
    'مختلط',
  );
  for (const [kind] of questionKinds) assert.ok(full.includes(`"kind": "${kind}"`), kind);
  assert.ok(full.includes('keywordGrading'));
  assert.ok(full.includes('تصحيح المعلم إلزامي'));
  const selected = bankPrompt(
    { title: 'كتاب', subject: 'عربي', grade: 'العاشر', term: 'الأول' },
    50,
    '',
    'سهل',
    false,
    ['essay', 'draw'],
  );
  assert.ok(selected.includes('"kind": "essay"'));
  assert.ok(!selected.includes('"kind": "single"'));
  assert.ok(questionTypeGuide(['essay']).includes('essay (إجابة كتابية)'));
});
test('all question types survive manual bank creation, bulk approval, import, selection, publication guards and keyword marking', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bank-types-')),
    server = await createApp({ directory });
  try {
    await server.app.ready();
    const call = async (url: string, method = 'GET', payload?: any, token?: string) => {
      const r = await server.app.inject({
        url,
        method: method as any,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      return { status: r.statusCode, data: r.json() };
    };
    await call('/api/setup', 'POST', { school: 'بنك الأنواع', password: 'password123' });
    const teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'password123' }))
      .data.token;
    const book = (
      await call(
        '/api/books/manual',
        'POST',
        { title: 'بنك يدوي', subject: 'عربي', grade: 'العاشر', term: 'الأول' },
        teacher,
      )
    ).data;
    const rows: any[] = [];
    for (const [i, [kind]] of questionKinds.entries()) {
      const q = questionTypeExample(kind, i),
        created = await call(
          `/api/books/${book.id}/questions`,
          'POST',
          { ...q, page: 1, status: 'approved' },
          teacher,
        );
      assert.equal(created.status, 200, JSON.stringify(created.data));
      assert.equal(created.data.kind, kind);
      rows.push(created.data);
    }
    const keywords = await call(
      `/api/books/${book.id}/questions`,
      'POST',
      {
        ...keyword,
        chapter: 'اسم الفصل',
        difficulty: 'سهل',
        evidence: 'مقتطف',
        status: 'approved',
      },
      teacher,
    );
    assert.equal(keywords.status, 200, JSON.stringify(keywords.data));
    rows.push(keywords.data);
    const selection = await call(
      '/api/bank/selection',
      'POST',
      { ids: rows.map((q) => q.id) },
      teacher,
    );
    assert.equal(selection.status, 200);
    assert.equal(selection.data.questions.length, 10);
    assert.deepEqual(
      selection.data.questions.find((q: any) => q.kind === 'match').pairs,
      rows.find((q) => q.kind === 'match').pairs,
    );
    assert.deepEqual(
      selection.data.questions.find((q: any) => q.keywordGrading).keywordGrading,
      keyword.keywordGrading,
    );
    const config = {
      title: 'امتحان من البنك',
      subject: 'عربي',
      grade: 'العاشر',
      section: '',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: selection.data.questions,
      delivery: {
        mode: 'random',
        count: 4,
        quotas: [{ chapter: 'اسم الفصل', difficulty: 'سهل', count: 4 }],
      },
    };
    const draft = await call('/api/exams', 'POST', config, teacher);
    assert.equal(draft.status, 200, JSON.stringify(draft.data));
    const multi = rows.find((q) => q.kind === 'multiple');
    assert.equal(
      (await call(`/api/bank/${multi.id}`, 'PUT', { ...multi, correctChoices: [1] }, teacher))
        .status,
      200,
    );
    assert.equal(
      (await call(`/api/exams/${draft.data.id}/publish`, 'POST', {}, teacher)).status,
      400,
      'changed answer key must require a refresh',
    );
    const refreshed = (
      await call('/api/bank/selection', 'POST', { ids: rows.map((q) => q.id) }, teacher)
    ).data.questions;
    await call(`/api/exams/${draft.data.id}`, 'PUT', { ...config, questions: refreshed }, teacher);
    assert.equal(
      (await call(`/api/exams/${draft.data.id}/publish`, 'POST', {}, teacher)).status,
      200,
    );
    const changed = changeQuestionKind(keywords.data, 'boolean');
    changed.options = ['صح', 'خطأ'];
    const converted = await call(
      `/api/bank/${keywords.data.id}`,
      'PUT',
      { ...keywords.data, ...changed, keywordGrading: undefined, acceptedAnswers: undefined },
      teacher,
    );
    assert.equal(converted.status, 200);
    assert.equal(converted.data.keywordGrading, undefined);
    assert.equal(converted.data.acceptedAnswers, undefined);
    const data = {
      version: 1,
      book: {
        title: 'بنك مستورد',
        subject: 'عربي',
        grade: 'العاشر',
        term: 'الأول',
        pageCount: 132,
      },
      questions: questionKinds.map(([kind], i) => questionTypeExample(kind, i)),
    };
    const preview = await call('/api/bank/import/preview', 'POST', { data }, teacher);
    assert.equal(preview.status, 200);
    assert.equal(preview.data.accepted.length, 9, JSON.stringify(preview.data.rejected));
    const committed = await call('/api/bank/import/commit', 'POST', { data }, teacher);
    assert.equal(committed.data.imported, 9);
    const imported = (
      await call(`/api/books/${committed.data.bookId}/questions`, 'GET', undefined, teacher)
    ).data;
    assert.equal(imported.length, 9);
    for (const [kind] of questionKinds) assert.ok(imported.some((q: any) => q.kind === kind));
    const html = bankDocument(
      data.book,
      [...imported, { ...keyword, status: 'approved' }].map((q) => ({ ...q, status: 'approved' })),
      { audience: 'student' },
    );
    assert.ok(!html.includes('MODEL_PRIVATE'));
    assert.ok(!html.includes('التجاذب'));
    assert.ok(html.includes('مساحة الرسم'));
    assert.ok(html.includes('أفكار صحيحة'));
    assert.ok(
      bankDocument(data.book, [{ ...keyword, status: 'approved' }], {
        audience: 'teacher',
      }).includes('التجاذب'),
    );
    const student = (
        await call(
          '/api/students',
          'POST',
          { id: 'st', name: 'طالب', grade: 'العاشر', section: 'أ' },
          teacher,
        )
      ).data,
      token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).data
        .token;
    const fixed = (
      await call(
        '/api/exams',
        'POST',
        { ...config, title: 'تصحيح مفاهيم', questions: [keyword], delivery: undefined },
        teacher,
      )
    ).data;
    await call(`/api/exams/${fixed.id}/publish`, 'POST', {}, teacher);
    const start = await call(
      '/api/attempts/start',
      'POST',
      { examId: fixed.id, cameraAvailable: false },
      token,
    );
    assert.equal(start.data.questions[0].keywordTarget, 3);
    assert.equal(start.data.questions[0].keywordGrading, undefined);
    await call(
      `/api/attempts/${start.data.attempt.id}/answers`,
      'PUT',
      { answers: [{ questionId: 'kw', choice: 'التجاذب يسبب قوة', revision: 1 }] },
      token,
    );
    const submit = await call(`/api/attempts/${start.data.attempt.id}/submit`, 'POST', {}, token);
    assert.equal(submit.data.gradingPending, true);
    assert.equal(submit.data.score, null);
    assert.equal((await call(`/api/exams/${fixed.id}/results`, 'POST', {}, teacher)).status, 400);
    const graded = await call(
      `/api/attempts/${start.data.attempt.id}/grades`,
      'PUT',
      { grades: { kw: 2 / 3 } },
      teacher,
    );
    assert.equal(graded.data.score, 13.33);
    assert.equal((await call(`/api/exams/${fixed.id}/results`, 'POST', {}, teacher)).status, 200);
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('built-in AI generation accepts mixed question formats instead of discarding non-choice answers', async () => {
  const oldFetch = globalThis.fetch;
  let instruction = '';
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    instruction += JSON.stringify(body);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    questions: questionKinds.map(([kind], i) => ({
                      ...questionTypeExample(kind, i),
                      page: 1,
                    })),
                  }),
                },
              ],
            },
          },
        ],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const questions = await generate(
      {
        id: 's',
        name: 'درس',
        pages: [
          {
            page: 1,
            text: 'هذا درس من الكتاب يشرح المفاهيم والأمثلة وتطبيقاتها بصورة مفصلة للطلاب في الصف العاشر.',
            images: [],
          },
        ],
      },
      [1],
      9,
      'مختلط',
      'gemini-test',
      new AbortController().signal,
      () => {},
      { provider: 'gemini', key: 'test' },
    );
    assert.equal(questions.length, 9);
    for (const [kind] of questionKinds)
      assert.ok(
        questions.some((q) => q.kind === kind),
        kind,
      );
    assert.ok(instruction.includes('orderCorrect'));
    assert.ok(instruction.includes('rubric'));
  } finally {
    globalThis.fetch = oldFetch;
  }
});
