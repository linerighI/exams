import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { workspaceKnowledge } from '../server/assistantWorkspace';

test('expanded assistant knows the app, opens tools offline and applies only reviewed, fresh, tenant-owned proposals', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-workspace-')),
    server = await createApp({ directory }),
    original = globalThis.fetch;
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Workspace123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Workspace123' })
    ).json().token;
    await call(
      '/api/teachers',
      'POST',
      { username: 'other', name: 'معلم ثان', password: 'Other-test123' },
      token,
    );
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'other',
        password: 'Other-test123',
      })
    ).json().token;
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '1', name: 'اسم خاص', grade: '10', section: 'أ' },
        token,
      )
    ).json();
    const st = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    const imported = (
      await call(
        '/api/bank/import/commit',
        'POST',
        {
          data: {
            version: 1,
            batchId: 'workspace',
            book: {
              title: 'الجبر',
              subject: 'الرياضيات',
              grade: '10',
              term: 'الأول',
              pageCount: 10,
            },
            questions: [1, 2].map((n) => ({
              text: `احسب ${n}+2`,
              options: ['3', '4', '5', '6'],
              correct: 0,
              explanation: 'جمع',
              chapter: 'المعادلات',
              difficulty: 'سهل',
              page: 1,
              evidence: 'مثال',
            })),
          },
        },
        token,
      )
    ).json();
    const bookId = imported.bookId;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error('offline');
    };
    const send = async (message: string, extra: any = {}) => {
      const r = await call('/api/assistant/messages', 'POST', { message, ...extra }, token);
      assert.equal(r.statusCode, 200, r.body);
      return r.json();
    };
    const last = (r: any) => r.conversation.messages.at(-1);
    assert.equal(last(await send('/أدوات')).cards.length, 8);
    assert.equal(last(await send('افتح الحاسبة')).cards[0].tool, 'calculator');
    assert.equal(last(await send('/مراقبة')).cards[0].kind, 'live_room');
    assert.match(last(await send('/جاهزية', { bookId })).cards[0].subtitle, /2 للمراجعة/);
    assert.ok(
      last(await send('/دليل المجلدات')).cards.some((c: any) => c.subtitle.includes('السحب')),
    );
    assert.equal(calls, 0);
    let desired: any = { action: 'bank_action', operation: 'approve_questions', bookId, reply: '' };
    let repair = false,
      modelCalls = 0,
      latest: any;
    globalThis.fetch = async (url: any, init: any) => {
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      latest = JSON.parse(init.body);
      modelCalls++;
      assert.equal(latest.options.num_ctx, 8192);
      assert.ok(!init.body.includes(student.code));
      if (repair && modelCalls === 1)
        return new Response(JSON.stringify({ message: { content: '{"reply":' } }));
      return new Response(JSON.stringify({ message: { content: JSON.stringify(desired) } }));
    };
    const proposal = last(await send('اعتمد أسئلة البنك', { bookId })).cards[0];
    assert.equal(proposal.kind, 'proposal');
    assert.equal(proposal.examples.length, 2);
    assert.ok(server.store.all('bank_questions').every((q) => q.status === 'draft'));
    assert.ok(JSON.parse(latest.messages[1].content).workspace.selectedBank.id === bookId);
    assert.equal(
      (await call(`/api/assistant/proposals/${proposal.id}`, 'GET', undefined, other)).statusCode,
      404,
    );
    assert.equal(
      (await call(`/api/assistant/proposals/${proposal.id}/apply`, 'POST', {}, st)).statusCode,
      403,
    );
    assert.equal(
      (await call(`/api/assistant/proposals/${proposal.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    assert.ok(server.store.all('bank_questions').every((q) => q.status === 'approved'));
    assert.equal(
      (await call(`/api/assistant/proposals/${proposal.id}/apply`, 'POST', {}, token)).json()
        .alreadyApplied,
      true,
    );
    desired = {
      action: 'bank_action',
      operation: 'create_folder',
      bookId,
      folderName: 'مراجعة نهائية',
      color: 'mint',
      reply: '',
    };
    const folder = last(await send('أنشئ مجلدًا في البنك', { bookId })).cards[0];
    assert.equal(
      (await call(`/api/assistant/proposals/${folder.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    const folderState = server.store.getSetting(`bank-organization:${bookId}`);
    assert.equal(folderState.folders[0].color, 'mint');
    desired = {
      action: 'bank_action',
      operation: 'move_questions',
      bookId,
      folderName: 'مراجعة نهائية',
      reply: '',
    };
    const move = last(await send('انقل أسئلة البنك إلى المجلد', { bookId })).cards[0];
    const q = server.store.all('bank_questions')[0];
    server.store.put('bank_questions', { ...q, text: 'تغير السؤال' });
    assert.equal(
      (await call(`/api/assistant/proposals/${move.id}/apply`, 'POST', {}, token)).statusCode,
      409,
    );
    assert.deepEqual(server.store.getSetting(`bank-organization:${bookId}`).questionFolders, {});
    const fresh = last(await send('انقل أسئلة البنك إلى المجلد', { bookId })).cards[0];
    assert.equal(
      (await call(`/api/assistant/proposals/${fresh.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    assert.equal(
      Object.keys(server.store.getSetting(`bank-organization:${bookId}`).questionFolders).length,
      2,
    );
    desired = { action: 'list_students', query: 'طالب_1', reply: '' };
    const foundStudent = last(await send('أريد عرض طالب اسمه اسم خاص')).cards[0];
    assert.equal(foundStudent.title, 'اسم خاص');
    desired = {
      action: 'bank_action',
      operation: 'create_folder',
      bookId,
      folderName: 'منتهي',
      reply: '',
    };
    const expired = last(await send('أنشئ مجلدًا في البنك', { bookId })).cards[0];
    const saved = server.store.getSetting(`assistant-proposal:${expired.id}`);
    server.store.setSetting(`assistant-proposal:${expired.id}`, { ...saved, expiresAt: 0 });
    assert.equal(
      (await call(`/api/assistant/proposals/${expired.id}/apply`, 'POST', {}, token)).statusCode,
      409,
    );
    server.store.setSetting(`assistant-proposal:${expired.id}`, {
      ...saved,
      path: '/api/settings',
    });
    assert.equal(
      (await call(`/api/assistant/proposals/${expired.id}/apply`, 'POST', {}, token)).statusCode,
      400,
    );
    const draft = (await call('/api/bank/exam', 'POST', { bookId, count: 1 }, token)).json();
    desired = { action: 'exam_action', operation: 'publish_exam', examId: draft.id, reply: '' };
    const publish = last(await send('انشر الامتحان')).cards[0];
    assert.equal(server.store.get('exams', draft.id).status, 'draft');
    assert.equal(
      (await call(`/api/assistant/proposals/${publish.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    const started = await call(
      '/api/attempts/start',
      'POST',
      { examId: draft.id, cameraAvailable: true },
      st,
    );
    assert.equal(started.statusCode, 200, started.body);
    desired = { action: 'exam_action', operation: 'close_exam', examId: draft.id, reply: '' };
    const close = last(await send('أغلق إتاحة الامتحان')).cards[0];
    assert.match(close.subtitle, /المحاولات التي بدأت تستمر/);
    assert.equal(
      (await call(`/api/assistant/proposals/${close.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    assert.equal(server.store.get('exams', draft.id).status, 'closed');
    assert.ok(server.store.all('attempts').some((a) => a.examId === draft.id && !a.submittedAt));
    desired = { action: 'exam_action', operation: 'publish_results', examId: draft.id, reply: '' };
    const results = last(await send('انشر نتائج الامتحان')).cards[0];
    assert.equal(
      (await call(`/api/assistant/proposals/${results.id}/apply`, 'POST', {}, token)).statusCode,
      200,
    );
    assert.equal(server.store.get('exams', draft.id).resultsPublished, true);
    desired = { action: 'reply', reply: 'بث الكاميرا منخفض الإطارات ويحتاج موافقة الطالب.' };
    repair = true;
    modelCalls = 0;
    const repaired = await send('ما فائدة التدريب المتدرج؟');
    assert.equal(repaired.performance.repaired, true);
    assert.equal(modelCalls, 2);
    const context = JSON.parse(latest.messages[1].content);
    assert.ok(
      last(await send('كيف تعمل الكاميرا؟')).cards.some((c: any) =>
        c.subtitle.includes('دون صوت أو تسجيل'),
      ),
    );
    assert.equal(context.workspace, undefined);
    assert.ok(!JSON.stringify(context).includes(bookId));
    assert.ok(
      JSON.stringify(workspaceKnowledge('كيف أستخدم GeoGebra والحاسبة؟')).includes('أدوات المعلم'),
    );
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
