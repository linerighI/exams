import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import {
  createQuestion,
  correctAnswer,
  answerValid,
  hasAnswer,
  studentQuestion,
  matchingColumns,
  orderingOptions,
  type Answer,
} from '../src/questionFormats';
import { selectSnapshot, type Snapshot } from '../src/offline';
import type { Question } from '../src/types';

test('cached attempts cannot replace the requested exam or a reopened attempt', () => {
  const now = Date.now(),
    make = (id: string, examId: string, deadline: number) =>
      ({
        scope: 'host:teacher',
        studentId: 's',
        offset: 0,
        attempt: { id, examId, startedAt: now, deadline, submittedAt: null },
      }) as Snapshot;
  const old = make('old', 'math', now - 1000),
    live = make('live', 'arabic', now + 100000);
  assert.equal(
    selectSnapshot([old, live], 's', 'host:teacher', { examId: 'arabic' })?.attempt.id,
    'live',
  );
  assert.equal(selectSnapshot([old], 's', 'host:teacher'), undefined);
  assert.equal(selectSnapshot([old, live], 's', 'other-host'), undefined);
  assert.equal(
    selectSnapshot([old, live], 's', 'host:teacher', { examId: 'arabic', attemptId: 'reopened' }),
    undefined,
  );
  assert.equal(
    selectSnapshot([old], 's', 'host:teacher', {
      examId: 'math',
      attemptId: 'old',
      includeExpired: true,
    })?.attempt.id,
    'old',
  );
});

const questions: Question[] = [
  {
    ...createQuestion('single'),
    text: 'السؤال الأول',
    options: ['ألف', 'باء', 'جيم', 'دال'],
    correct: 1,
  },
  {
    ...createQuestion('multiple'),
    text: 'اختر الإجابتين',
    options: ['واحد', 'اثنان', 'ثلاثة'],
    correctChoices: [0, 2],
  },
  { ...createQuestion('boolean'), text: 'العبارة صحيحة', correct: 0 },
  {
    ...createQuestion('short'),
    text: 'ما اسم المدرسة؟',
    acceptedAnswers: ['مَدرسة السلام', 'السلام'],
  },
  { ...createQuestion('blank'), text: 'أكمل الفراغين', blankAnswers: ['مبتدأ', 'خبر'] },
  {
    ...createQuestion('match'),
    text: 'صل العناصر معًا',
    pairs: [
      { left: 'سعيد', right: 'مسرور' },
      { left: 'منزل', right: 'بيت' },
    ],
  },
  {
    ...createQuestion('order'),
    text: 'رتب الخطوات التالية',
    options: ['أولًا', 'ثانيًا', 'ثالثًا'],
    orderCorrect: [0, 1, 2],
  },
  { ...createQuestion('essay'), text: 'اكتب فقرة مفيدة', rubric: 'الفكرة واللغة' },
  { ...createQuestion('draw'), text: 'ارسم مثلثًا واضحًا', rubric: 'رسم الأضلاع الثلاثة' },
];
const answers: Answer[] = [
  1,
  [2, 0],
  0,
  'مدرسة   السلام',
  ['مبتدأ', 'خبر'],
  {
    pairs: [
      matchingColumns(questions[5]).right.indexOf('مسرور'),
      matchingColumns(questions[5]).right.indexOf('بيت'),
    ],
  },
  questions[6].options.map((v) => orderingOptions(questions[6]).indexOf(v)),
  'إجابة الطالب',
  {
    strokes: [
      [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    ],
    text: 'رسم',
  },
];
test('all formats validate and grade without leaking keys into student questions', () => {
  questions.forEach((q, i) => {
    assert.ok(answerValid(q, answers[i]), q.kind);
    assert.ok(hasAnswer(studentQuestion(q), answers[i]), q.kind);
    assert.equal(correctAnswer(q, answers[i]), i < 7);
    const safe = studentQuestion(q);
    for (const key of [
      'correct',
      'explanation',
      'correctChoices',
      'acceptedAnswers',
      'blankAnswers',
      'pairs',
      'orderCorrect',
      'rubric',
    ])
      assert.equal((safe as any)[key], undefined, key);
  });
  assert.equal(answerValid(questions[0], '1'), false);
  assert.equal(answerValid(questions[1], [0, 0]), false);
  assert.equal(answerValid(questions[5], { pairs: [0, 0] }), false);
  assert.equal(answerValid(questions[8], { strokes: [[[2, 0.2]]], text: '' }), false);
  assert.equal(hasAnswer(questions[7], '  '), false);
  assert.equal(hasAnswer(questions[5], { pairs: [0, -1] }), false);
});

test('mixed format exam survives save, assignment, sync, late review, manual grading and result publication', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'exam-formats-')),
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
    await call('/api/setup', 'POST', { school: 'اختبار', password: 'password123' });
    const teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'password123' }))
      .data.token;
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: 's1', name: 'طالب', grade: 'العاشر', section: 'أ' },
        teacher,
      )
    ).data;
    const st = (await call('/api/login', 'POST', { role: 'student', code: student.code })).data
      .token;
    const input = {
      title: 'امتحان متنوع',
      subject: 'عربي',
      grade: 'العاشر',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 18,
      difficulty: 'متوسط',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions,
    };
    const created = await call('/api/exams', 'POST', input, teacher);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const exam = created.data;
    const updated = await call(`/api/exams/${exam.id}`, 'PUT', input, teacher);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.questions[5].pairs[0].right, 'مسرور');
    assert.equal((await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher)).status, 200);
    const started = await call(
      '/api/attempts/start',
      'POST',
      { examId: exam.id, cameraAvailable: false },
      st,
    );
    assert.equal(started.status, 200);
    const id = started.data.attempt.id;
    for (const q of started.data.questions)
      for (const key of [
        'correct',
        'explanation',
        'correctChoices',
        'acceptedAnswers',
        'blankAnswers',
        'pairs',
        'orderCorrect',
        'rubric',
      ])
        assert.equal(q[key], undefined);
    const restored = await call(`/api/attempts/${id}`, 'GET', undefined, st);
    assert.equal(restored.data.questions[3].acceptedAnswers, undefined);
    assert.equal(
      (
        await call(
          `/api/attempts/${id}/answers`,
          'PUT',
          { answers: [{ questionId: questions[0].id, choice: 'invalid', revision: 1 }] },
          st,
        )
      ).status,
      400,
    );
    const sync = await call(
      `/api/attempts/${id}/answers`,
      'PUT',
      { answers: questions.map((q, i) => ({ questionId: q.id, choice: answers[i], revision: 1 })) },
      st,
    );
    assert.equal(sync.status, 200, JSON.stringify(sync.data));
    const status = await call(`/api/attempts/${id}/status`, 'GET', undefined, st);
    assert.equal(status.status, 200);
    assert.equal(status.data.questions, undefined);
    assert.equal(status.data.attempt.answers, undefined);
    assert.deepEqual(
      (await call(`/api/attempts/${id}`, 'GET', undefined, st)).data.attempt.answers[
        questions[8].id
      ],
      answers[8],
    );
    const submitted = await call(`/api/attempts/${id}/submit`, 'POST', {}, st);
    assert.equal(submitted.data.gradingPending, true);
    assert.equal(submitted.data.score, null);
    assert.equal((await call(`/api/exams/${exam.id}/results`, 'POST', {}, teacher)).status, 400);
    assert.equal(
      (await call(`/api/attempts/${id}/grades`, 'PUT', { grades: { [questions[7].id]: 1 } }, st))
        .status,
      403,
    );
    assert.equal(
      (
        await call(
          `/api/attempts/${id}/grades`,
          'PUT',
          { grades: { [questions[0].id]: 1 } },
          teacher,
        )
      ).status,
      400,
    );
    const graded = await call(
      `/api/attempts/${id}/grades`,
      'PUT',
      { grades: { [questions[7].id]: 1, [questions[8].id]: 0.5 } },
      teacher,
    );
    assert.equal(graded.data.score, 17);
    assert.equal(graded.data.gradingPending, false);
    assert.equal((await call(`/api/exams/${exam.id}/results`, 'POST', {}, teacher)).status, 200);
    assert.equal((await call(`/api/attempts/${id}`, 'GET', undefined, st)).data.attempt.score, 17);
    const late = await call(
      `/api/attempts/${id}/answers`,
      'PUT',
      { answers: [{ questionId: questions[0].id, choice: 0, revision: 2 }] },
      st,
    );
    assert.equal(late.data.late, true);
    const reviewed = await call(`/api/attempts/${id}/review`, 'POST', { accept: true }, teacher);
    assert.equal(reviewed.data.score, 15);
    const other = await call(
      '/api/exams',
      'POST',
      { ...input, title: 'امتحان آخر', subject: 'رياضيات' },
      teacher,
    );
    await call(`/api/exams/${other.data.id}/publish`, 'POST', {}, teacher);
    const second = await call(
      '/api/attempts/start',
      'POST',
      { examId: other.data.id, cameraAvailable: false },
      st,
    );
    assert.equal(second.data.attempt.examId, other.data.id);
    assert.notEqual(second.data.attempt.id, id);
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
