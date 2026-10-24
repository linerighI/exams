import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { deliveryForCount, defaultDelivery } from '../src/examDelivery';
import { defaultAppearance } from '../src/examAppearance';

test('550-question bank: 35 simultaneous students get exact 30/25 counts, fixed/shuffled modes, overlapping sets, frozen grading and restart recovery', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-controls-'));
  let server = await createApp({ directory });
  const call = async (url: string, method = 'GET', payload?: any, token?: string) => {
    const r = await server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    assert.equal(r.statusCode, 200, `${url}: ${r.body.slice(0, 500)}`);
    return r.json();
  };
  try {
    await call('/api/setup', 'POST', {
      school: 'Delivery regression',
      password: 'Delivery-Test123',
    });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Delivery-Test123' })
    ).token;
    const book = await call(
      '/api/books/manual',
      'POST',
      { title: '550 سؤال', subject: 'عربي', grade: '10', term: 'الأول' },
      teacher,
    );
    const bank = Array.from({ length: 550 }, (_, i) => ({
      id: `bank-${i}`,
      bookId: book.id,
      text: `السؤال الفريد رقم ${i}`,
      options: ['أ', 'ب', 'ج', 'د'],
      correct: i % 4,
      explanation: 'مفتاح خاص بالمعلم',
      page: 1,
      chapter: i % 2 ? 'لغة' : 'نحو',
      difficulty: i % 3 ? 'سهل' : 'متوسط',
      status: 'approved',
    }));
    for (const q of bank) server.store.put('bank_questions', q);
    const selected = (
      await call('/api/bank/selection', 'POST', { ids: bank.map((q) => q.id) }, teacher)
    ).questions;
    assert.equal(selected.length, 550);
    assert.equal(defaultDelivery(selected)?.count, 30);
    const students = [];
    for (let i = 0; i < 35; i++) {
      const student = await call(
        '/api/students',
        'POST',
        { id: `student-${i}`, name: `طالب اختبار ${i}`, grade: '10', section: 'أ' },
        teacher,
      );
      students.push({
        ...student,
        token: (await call('/api/login', 'POST', { role: 'student', code: student.code })).token,
      });
    }
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
    const base = {
      title: 'اختبار التوزيع',
      subject: 'عربي',
      grade: '10',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 30,
      total: 30,
      difficulty: 'مختلط',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      appearance: { ...defaultAppearance, referenceImage: image, imageCaption: 'مرجع لكل الأسئلة' },
    };
    const definitions = [
      { name: '550-to-30', questions: selected, delivery: deliveryForCount(selected, 30) },
      {
        name: '30-to-25',
        questions: selected.slice(0, 30),
        delivery: deliveryForCount(selected.slice(0, 30), 25),
      },
      { name: 'fixed', questions: selected.slice(0, 30) },
      { name: 'shuffle', questions: selected.slice(0, 30), shuffleQuestions: true },
      {
        name: 'repeated-single',
        questions: selected.slice(0, 1),
        delivery: deliveryForCount(selected.slice(0, 1), 1),
      },
    ];
    const records: any[] = [];
    for (const config of definitions) {
      const exam = await call(
        '/api/exams',
        'POST',
        { ...base, ...config, title: config.name },
        teacher,
      );
      await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher);
      const starts: any[] = await Promise.all(
        students.map((s) =>
          call('/api/attempts/start', 'POST', { examId: exam.id, cameraAvailable: false }, s.token),
        ),
      );
      const expected = config.delivery?.count ?? config.questions.length;
      for (const result of starts) {
        assert.equal(result.questions.length, expected);
        assert.equal(new Set(result.questions.map((q: any) => q.id)).size, expected);
        assert.equal(result.exam.appearance.referenceImage, image);
        assert.ok(
          result.questions.every(
            (q: any) => q.correct === undefined && q.explanation === undefined,
          ),
        );
      }
      if (config.name === 'fixed')
        for (const r of starts)
          assert.deepEqual(
            r.questions.map((q: any) => q.id),
            config.questions.map((q: any) => q.id),
          );
      if (config.name === 'shuffle') {
        const signatures = new Set(starts.map((r) => r.questions.map((q: any) => q.id).join(',')));
        assert.ok(signatures.size > 1);
        for (const r of starts)
          assert.deepEqual(
            r.questions.map((q: any) => q.id).sort(),
            config.questions.map((q: any) => q.id).sort(),
          );
      }
      if (config.name === '550-to-30')
        assert.equal(
          new Set(
            starts.map((r) =>
              r.questions
                .map((q: any) => q.id)
                .sort()
                .join(','),
            ),
          ).size,
          35,
        );
      const first = starts[0];
      const retry = await call(
        '/api/attempts/start',
        'POST',
        { examId: exam.id, cameraAvailable: false },
        students[0].token,
      );
      assert.deepEqual(retry.questions, first.questions);
      await call(
        `/api/attempts/${first.attempt.id}/answers`,
        'PUT',
        {
          answers: first.questions.map((q: any) => ({
            questionId: q.id,
            choice: config.questions.find((x: any) => x.id === q.id).correct,
            revision: 1,
          })),
        },
        students[0].token,
      );
      records.push({ exam, first });
    }
    assert.equal(server.store.all('attempts').length, 175);
    await server.app.close();
    server = await createApp({ directory });
    const token = (await call('/api/login', 'POST', { role: 'student', code: students[0].code }))
      .token;
    const teacher2 = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Delivery-Test123' })
    ).token;
    for (const { exam, first } of records) {
      const restored = await call(`/api/attempts/${first.attempt.id}`, 'GET', undefined, token);
      assert.deepEqual(restored.questions, first.questions);
      assert.equal(Object.keys(restored.attempt.answers).length, first.questions.length);
      assert.equal(restored.exam.appearance.referenceImage, image);
      await call(`/api/attempts/${first.attempt.id}/submit`, 'POST', {}, token);
      const graded = await call(`/api/attempts/${first.attempt.id}`, 'GET', undefined, teacher2);
      assert.equal(graded.attempt.score, 30);
    }
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
