import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import type { Exam } from '../src/types';
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'school-test-'));
  const server = await createApp({ directory });
  await server.app.ready();
  const call = async (path: string, method = 'GET', body?: any, token?: string) => {
    const response = await server.app.inject({
      url: path,
      method: method as any,
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: response.statusCode, data: response.json() };
  };
  await call('/api/setup', 'POST', { school: 'مدرسة اختبار', password: 'password123' });
  const teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'password123' }))
    .data.token;
  const student = (
    await call(
      '/api/students',
      'POST',
      { id: '1001', name: 'أحمد', grade: 'السابع', section: 'أ' },
      teacher,
    )
  ).data;
  const studentToken = (await call('/api/login', 'POST', { role: 'student', code: student.code }))
    .data.token;
  const input = {
    title: 'امتحان العلوم',
    subject: 'العلوم',
    grade: 'السابع',
    section: 'أ',
    term: 'الأول',
    kind: 'نصفي',
    duration: 45,
    total: 20,
    difficulty: 'متوسط',
    cameraRequired: false,
    opensAt: new Date(Date.now() - 60000).toISOString(),
    closesAt: new Date(Date.now() + 3600000).toISOString(),
    questions: [
      {
        id: 'q1',
        text: 'ما الكوكب الذي نعيش عليه؟',
        options: ['الأرض', 'المريخ', 'زحل', 'عطارد'],
        correct: 0,
        explanation: 'نعيش على الأرض',
        page: 1,
      },
      {
        id: 'q2',
        text: 'كم عدد أيام الأسبوع؟',
        options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'],
        correct: 2,
        explanation: 'سبعة أيام',
        page: 2,
      },
    ],
  };
  const exam: Exam = (await call('/api/exams', 'POST', input, teacher)).data;
  await call(`/api/exams/${exam.id}/publish`, 'POST', undefined, teacher);
  const start = () =>
    call('/api/attempts/start', 'POST', { examId: exam.id, cameraAvailable: false }, studentToken);
  const cleanup = async () => {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  };
  return {
    ...server,
    directory,
    call,
    teacher,
    student,
    studentToken,
    input,
    exam,
    start,
    cleanup,
  };
}
test('student login and exam code distinguish identity, class formats, and unpublished exams', async () => {
  const f = await fixture();
  try {
    const student = (
      await f.call(
        '/api/students',
        'POST',
        { id: '1003', name: 'طالب اختبار', grade: '٧', section: 'A' },
        f.teacher,
      )
    ).data;
    const token = (await f.call('/api/login', 'POST', { role: 'student', code: student.code })).data
      .token;
    const exams = await f.call('/api/exams', 'GET', undefined, token);
    assert.ok(exams.data.some((exam: any) => exam.id === f.exam.id));
    const started = await f.call(
      '/api/attempts/start',
      'POST',
      { code: f.exam.code, cameraAvailable: false },
      token,
    );
    assert.equal(started.status, 200);
    assert.equal(started.data.questions[0].correct, undefined);
    const wrong = await f.call('/api/login', 'POST', { role: 'student', code: f.exam.code });
    assert.equal(wrong.status, 401);
    assert.match(JSON.stringify(wrong.data), /رمز دخول الطالب/);
    const draft = (await f.call('/api/exams', 'POST', f.input, f.teacher)).data;
    const unavailable = await f.call(
      '/api/attempts/start',
      'POST',
      { code: draft.code, cameraAvailable: false },
      token,
    );
    assert.equal(unavailable.status, 409);
    assert.match(JSON.stringify(unavailable.data), /مسودة/);
  } finally {
    await f.cleanup();
  }
});
test('دورة الامتحان: الحفظ والتسليم والتصحيح ونشر النتائج دون تسريب المفتاح', async () => {
  const f = await fixture();
  try {
    const { data } = await f.start();
    assert.equal(data.questions[0].correct, undefined);
    assert.equal(data.questions[0].explanation, undefined);
    const attempt = data.attempt.id;
    const save = await f.call(
      `/api/attempts/${attempt}/answers`,
      'PUT',
      {
        answers: [
          { questionId: 'q1', choice: 0, revision: 1 },
          { questionId: 'q2', choice: 2, revision: 1 },
        ],
      },
      f.studentToken,
    );
    assert.equal(save.data.acknowledged.q1, 1);
    const submit = await f.call(
      `/api/attempts/${attempt}/submit`,
      'POST',
      undefined,
      f.studentToken,
    );
    assert.equal(submit.data.score, null);
    assert.equal(f.store.get('attempts', attempt).score, 20);
    assert.equal(
      (await f.call(`/api/attempts/${attempt}/submit`, 'POST', undefined, f.studentToken)).status,
      200,
    );
    await f.call(`/api/exams/${f.exam.id}/results`, 'POST', undefined, f.teacher);
    const result = await f.call('/api/attempts', 'GET', undefined, f.studentToken);
    assert.equal(result.data[0].score, 20);
    assert.equal((await f.start()).status, 409);
  } finally {
    await f.cleanup();
  }
});
test('صلاحيات الطالب: منع المعلم والصور ومحاولات الطلاب الآخرين', async () => {
  const f = await fixture();
  try {
    for (const path of ['/api/settings', '/api/students', '/api/backup', '/api/photos/missing'])
      assert.equal((await f.call(path, 'GET', undefined, f.studentToken)).status, 403);
    assert.equal((await f.call('/api/exams')).status, 403);
    const student = (
      await f.call(
        '/api/students',
        'POST',
        { id: '1002', name: 'سارة', grade: 'الثامن', section: 'أ' },
        f.teacher,
      )
    ).data;
    const token = (await f.call('/api/login', 'POST', { role: 'student', code: student.code })).data
      .token;
    const attempt = (await f.start()).data.attempt;
    assert.equal(
      (await f.call(`/api/attempts/${attempt.id}`, 'GET', undefined, token)).status,
      404,
    );
    assert.equal(
      (
        await f.call(
          '/api/attempts/start',
          'POST',
          { code: f.exam.code, cameraAvailable: false },
          token,
        )
      ).status,
      403,
    );
  } finally {
    await f.cleanup();
  }
});
test('الإجابات المتأخرة لا تغير الدرجة حتى مراجعة المعلم', async () => {
  const f = await fixture();
  try {
    const attempt = (await f.start()).data.attempt;
    attempt.deadline = Date.now() - 1000;
    f.store.put('attempts', attempt);
    const result = await f.call(
      `/api/attempts/${attempt.id}/answers`,
      'PUT',
      { answers: [{ questionId: 'q1', choice: 0, revision: 1 }] },
      f.studentToken,
    );
    assert.equal(result.data.late, true);
    assert.equal(f.store.get('attempts', attempt.id).score, 0);
    assert.equal(f.store.get('attempts', attempt.id).status, 'review');
    assert.equal(
      (await f.call(`/api/attempts/${attempt.id}/review`, 'POST', { accept: true }, f.studentToken))
        .status,
      403,
    );
    await f.call(`/api/attempts/${attempt.id}/review`, 'POST', { accept: true }, f.teacher);
    assert.equal(f.store.get('attempts', attempt.id).score, 10);
  } finally {
    await f.cleanup();
  }
});
test('الحفظ متكرر وآمن: تجاهل الإصدارات القديمة ورفض الأسئلة غير الموجودة', async () => {
  const f = await fixture();
  try {
    const a = (await f.start()).data.attempt.id;
    await f.call(
      `/api/attempts/${a}/answers`,
      'PUT',
      { answers: [{ questionId: 'q1', choice: 0, revision: 2 }] },
      f.studentToken,
    );
    await f.call(
      `/api/attempts/${a}/answers`,
      'PUT',
      { answers: [{ questionId: 'q1', choice: 1, revision: 1 }] },
      f.studentToken,
    );
    assert.equal(f.store.get('attempts', a).answers.q1, 0);
    assert.equal(
      (
        await f.call(
          `/api/attempts/${a}/answers`,
          'PUT',
          { answers: [{ questionId: 'fake', choice: 0, revision: 1 }] },
          f.studentToken,
        )
      ).status,
      400,
    );
    assert.equal((await f.start()).data.attempt.id, a);
  } finally {
    await f.cleanup();
  }
});
test('النسخ: تعديل امتحان بدأ بالفعل ينشئ مسودة مستقلة', async () => {
  const f = await fixture();
  try {
    await f.start();
    const modified = await f.call(
      `/api/exams/${f.exam.id}`,
      'PUT',
      { ...f.input, title: 'نسخة جديدة' },
      f.teacher,
    );
    assert.notEqual(modified.data.id, f.exam.id);
    assert.equal(modified.data.status, 'draft');
    assert.equal(f.store.get('exams', f.exam.id).title, f.input.title);
    assert.equal(modified.data.version, 2);
  } finally {
    await f.cleanup();
  }
});
test('الكاميرا الإلزامية والاستثناء وطلب التصوير اليدوي والفشل', async () => {
  const f = await fixture();
  try {
    const exam = f.store.get('exams', f.exam.id);
    exam.cameraRequired = true;
    f.store.put('exams', exam);
    assert.equal((await f.start()).status, 400);
    await f.call(
      '/api/camera/exempt',
      'POST',
      { examId: exam.id, studentId: f.student.id },
      f.teacher,
    );
    const a = (await f.start()).data.attempt;
    const request = (await f.call(`/api/attempts/${a.id}/camera`, 'POST', undefined, f.teacher))
      .data;
    assert.equal(
      (await f.call(`/api/attempts/${a.id}/camera`, 'POST', undefined, f.teacher)).status,
      400,
    );
    const pending = (await f.call(`/api/attempts/${a.id}/camera`, 'GET', undefined, f.studentToken))
      .data;
    assert.equal(pending[0].id, request.id);
    assert.equal(
      (
        await f.call(
          `/api/attempts/${a.id}/camera/${request.id}`,
          'POST',
          { error: 'الكاميرا غير متاحة' },
          f.studentToken,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await f.call(
          `/api/attempts/${a.id}/camera/${request.id}`,
          'POST',
          { error: 'مرة أخرى' },
          f.studentToken,
        )
      ).status,
      400,
    );
  } finally {
    await f.cleanup();
  }
});
test('إعادة فتح محاولة يحتفظ بأرشيفها ويسمح بمحاولة جديدة', async () => {
  const f = await fixture();
  try {
    const a = (await f.start()).data.attempt;
    await f.call(`/api/attempts/${a.id}/submit`, 'POST', undefined, f.studentToken);
    await f.call(`/api/attempts/${a.id}/reopen`, 'POST', undefined, f.teacher);
    const next = (await f.start()).data.attempt;
    assert.notEqual(next.id, a.id);
    assert.ok(f.store.db.prepare('SELECT id FROM archived_attempts WHERE id=?').get(a.id));
  } finally {
    await f.cleanup();
  }
});
test('استيراد CSV وتصدير النتائج ورفض الملف المكرر بصورة ذرية', async () => {
  const f = await fixture();
  try {
    const csv = 'رقم الطالب,الاسم,الصف,الشعبة\r\n2001,ليلى,السابع,أ\r\n2002,عمر,السابع,أ';
    assert.equal((await f.call('/api/students/import', 'POST', { csv }, f.teacher)).data.count, 2);
    const before = f.store.all('students').length;
    assert.equal(
      (
        await f.call(
          '/api/students/import',
          'POST',
          { csv: 'id,name,grade,section\n9,A,B,C\n9,D,E,F' },
          f.teacher,
        )
      ).status,
      400,
    );
    assert.equal(f.store.all('students').length, before);
    assert.ok(
      (await f.call('/api/results.csv', 'GET', undefined, f.teacher)).data.csv.includes('الدرجة'),
    );
  } finally {
    await f.cleanup();
  }
});
test('نسخ واستعادة البيانات ومنع الاستعادة أثناء امتحان نشط', async () => {
  const f = await fixture();
  try {
    const backup = (await f.call('/api/backup', 'GET', undefined, f.teacher)).data;
    const a = (await f.start()).data.attempt;
    assert.equal((await f.call('/api/restore', 'POST', backup, f.teacher)).status, 400);
    await f.call(`/api/attempts/${a.id}/submit`, 'POST', undefined, f.studentToken);
    assert.equal((await f.call('/api/restore', 'POST', backup, f.teacher)).status, 200);
    assert.equal((await f.call('/api/students', 'GET', undefined, f.teacher)).status, 403);
    assert.equal(f.store.all('attempts').length, 0);
    assert.equal(f.store.all('students')[0].id, '1001');
  } finally {
    await f.cleanup();
  }
});
test('ثلاثون طالبًا متزامنًا: بدء وحفظ وتسليم', async () => {
  const f = await fixture();
  try {
    const tokens = await Promise.all(
      Array.from({ length: 30 }, async (_, i) => {
        const s = (
          await f.call(
            '/api/students',
            'POST',
            { id: `lab-${i}`, name: `طالب ${i}`, grade: 'السابع', section: 'أ' },
            f.teacher,
          )
        ).data;
        return (await f.call('/api/login', 'POST', { role: 'student', code: s.code })).data.token;
      }),
    );
    const started = await Promise.all(
      tokens.map((token) =>
        f.call('/api/attempts/start', 'POST', { examId: f.exam.id, cameraAvailable: false }, token),
      ),
    );
    assert.ok(started.every((r) => r.status === 200));
    await Promise.all(
      started.map((r, i) =>
        f.call(
          `/api/attempts/${r.data.attempt.id}/answers`,
          'PUT',
          { answers: [{ questionId: 'q1', choice: 0, revision: 1 }] },
          tokens[i],
        ),
      ),
    );
    await Promise.all(
      started.map((r, i) =>
        f.call(`/api/attempts/${r.data.attempt.id}/submit`, 'POST', undefined, tokens[i]),
      ),
    );
    assert.equal(f.store.all('attempts').filter((a) => a.score === 10).length, 30);
  } finally {
    await f.cleanup();
  }
});
test('الاحتفاظ: حذف الصور القديمة عند تشغيل الخادم', async () => {
  const f = await fixture();
  let reopened: any;
  try {
    f.store.db
      .prepare('INSERT INTO photos VALUES (?,?,?,?)')
      .run('old', 'a', Date.now() - 31 * 86400000, 'data:image/png;base64,a');
    await f.app.close();
    reopened = await createApp({ directory: f.directory });
    assert.equal(reopened.store.db.prepare('SELECT COUNT(*) AS n FROM photos').get().n, 0);
  } finally {
    if (reopened) await reopened.app.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test('إعداد نموذج مثبت باسم جديد وحفظ صفحات المصدر عند إعادة فتح المسودة', async () => {
  const f = await fixture();
  try {
    const config = (await f.call('/api/settings', 'GET', undefined, f.teacher)).data;
    const saved = await f.call(
      '/api/settings',
      'PUT',
      { ...config, model: 'qwen3.5:4b' },
      f.teacher,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.data.model, 'qwen3.5:4b');
    assert.equal(
      (await f.call('/api/settings', 'PUT', { ...config, model: 'bad name!' }, f.teacher)).status,
      400,
    );
    const exam = await f.call(
      '/api/exams',
      'POST',
      { ...f.input, sourceId: 'source', sourcePages: [8, 9, 64] },
      f.teacher,
    );
    assert.equal(exam.status, 200);
    assert.deepEqual(f.store.get('exams', exam.data.id).sourcePages, [8, 9, 64]);
  } finally {
    await f.cleanup();
  }
});
