// Exercise a real old-source -> new-source restart on disposable school data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(result.stderr || `${command} failed`);
}
(async () => {
  fs.mkdirSync(path.join(root, '.data'), { recursive: true });
  const temporary = fs.mkdtempSync(path.join(root, '.data', 'upgrade-153-'));
  const source = path.join(temporary, 'legacy');
  fs.mkdirSync(source);
  const archive = path.join(temporary, 'legacy.tar');
  run('git', [
    'archive',
    '--format=tar',
    `--output=${archive}`,
    '9079fbf',
    'server',
    'src',
    'package.json',
  ]);
  run('tar', ['-xf', archive, '-C', source]);
  const bundle = (entry, name) => {
    const outfile = path.join(temporary, name + '.cjs');
    esbuild.buildSync({
      entryPoints: [entry],
      outfile,
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
    });
    return require(outfile).createApp;
  };
  const oldApp = bundle(path.join(source, 'server/app.ts'), 'old-server');
  const newApp = bundle(path.join(root, 'server/app.ts'), 'new-server');
  const directory = path.join(temporary, 'school');
  let server;
  const call = async (url, method = 'GET', payload, token) => {
    const response = await server.app.inject({
      url,
      method,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  try {
    server = await oldApp({ directory });
    await call('/api/setup', 'POST', {
      school: 'مدرسة اختبار الترقية',
      password: 'Upgrade-test123',
    });
    let teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Upgrade-test123' })
    ).token;
    const student = {
      id: 'legacy-student',
      name: 'طالب محفوظ',
      grade: '10',
      section: 'أ',
      code: '123456',
    };
    server.store.put('students', student);
    const bank = await call(
      '/api/books/manual',
      'POST',
      { title: 'بنك محفوظ', subject: 'عربي', grade: '10', term: 'الأول' },
      teacher,
    );
    await call(
      `/api/books/${bank.id}/questions`,
      'POST',
      {
        text: 'ما مضاد الحزن؟',
        options: ['الفرح', 'القلق', 'الخوف', 'الغضب'],
        correct: 0,
        explanation: 'الفرح مضاد الحزن.',
        page: 1,
        chapter: 'معاني',
        difficulty: 'سهل',
        status: 'approved',
        requiresImage: false,
        evidence: 'إعداد المعلم',
      },
      teacher,
    );
    const exam = await call(
      '/api/exams',
      'POST',
      {
        title: 'امتحان قديم',
        subject: 'عربي',
        grade: '10',
        section: 'أ',
        term: 'الأول',
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'سهل',
        cameraRequired: false,
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3600000).toISOString(),
        questions: [
          {
            id: 'old-q',
            text: 'ما مضاد الحزن؟',
            options: ['الفرح', 'القلق', 'الخوف', 'الغضب'],
            correct: 0,
            explanation: 'الفرح مضاد الحزن.',
            page: 1,
          },
        ],
      },
      teacher,
    );
    await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher);
    let studentLogin = await call('/api/login', 'POST', { role: 'student', code: student.code });
    const started = await call(
      '/api/attempts/start',
      'POST',
      { examId: exam.id, cameraAvailable: false },
      studentLogin.token,
    );
    await call(
      `/api/attempts/${started.attempt.id}/answers`,
      'PUT',
      { answers: [{ questionId: 'old-q', choice: 0, revision: 1 }] },
      studentLogin.token,
    );
    const submitted = await call(
      `/api/attempts/${started.attempt.id}/submit`,
      'POST',
      {},
      studentLogin.token,
    );
    assert.equal(submitted.score, null); // Student grades remain hidden until publication.
    assert.equal(server.store.get('attempts', started.attempt.id).score, 20);
    await server.app.close();
    server = await newApp({ directory });
    teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'Upgrade-test123' }))
      .token;
    assert.deepEqual((await call('/api/students', 'GET', undefined, teacher))[0], student);
    assert.equal(
      (await call(`/api/books/${bank.id}/questions`, 'GET', undefined, teacher))[0].text,
      'ما مضاد الحزن؟',
    );
    const persisted = (await call('/api/exams', 'GET', undefined, teacher)).find(
      (e) => e.id === exam.id,
    );
    assert.equal(persisted.questions[0].kind, undefined);
    assert.equal(persisted.questions[0].correct, 0);
    const attempt = await call(`/api/attempts/${started.attempt.id}`, 'GET', undefined, teacher);
    assert.equal(attempt.attempt.score, 20);
    assert.equal(attempt.attempt.answers['old-q'], 0);
    studentLogin = await call('/api/login', 'POST', { role: 'student', code: student.code });
    assert.equal(studentLogin.student.id, student.id);
    assert.equal(
      (await call('/api/settings', 'GET', undefined, teacher)).school,
      'مدرسة اختبار الترقية',
    );
    console.log(
      '1.5.2 -> 1.5.3 upgrade passed: teacher login, school settings, student code, bank, legacy question, answers and marks preserved.',
    );
  } finally {
    await server?.app.close();
    const expected = path.join(root, '.data') + path.sep;
    if (!path.resolve(temporary).startsWith(expected)) throw Error('Invalid test cleanup path');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
