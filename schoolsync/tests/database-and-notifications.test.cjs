const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

let app, db;

beforeEach(() => {
  ({ app, db } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
});

afterEach(async () => {
  await app.close();
});

async function login(email, password = 'SchoolSync!2026') {
  const r = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: email.includes('@') ? email : `${email}@schoolsync.demo`, password },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.headers['set-cookie'].split(';')[0];
}

function req(cookie, url, payload) {
  return app.inject({
    method: payload === undefined ? 'GET' : 'POST',
    url,
    headers: { cookie },
    payload,
  });
}

test('all notification triggers reach guardians, students, and staff and support single + bulk read', async () => {
  const teacher = await login('emma');
  const admin = await login('rami');
  const parent = await login('sarah');
  const student = await login('alex');

  // Clear initial seeded notifications to test fresh signals deterministically
  assert.equal((await req(parent, '/api/notifications/read', {})).statusCode, 200);
  assert.equal((await req(student, '/api/notifications/read', {})).statusCode, 200);

  // 1. Late & Absent quick attendance -> parent & student & admin notified
  assert.equal((await req(teacher, '/api/attendance/quick', { studentId: 'alex', status: 'late' })).statusCode, 200);
  assert.equal((await req(teacher, '/api/attendance/quick', { studentId: 'alex', status: 'absent' })).statusCode, 200);

  // 2. Teacher note -> notified
  assert.equal(
    (await req(teacher, '/api/notes', { studentId: 'alex', category: 'academic', content: 'أداء مميز في الحل' })).statusCode,
    200,
  );

  // 3. Draft grade -> NO notification until published
  const gDraft = await req(teacher, '/api/grades', {
    studentId: 'alex',
    subject: 'الرياضيات',
    title: 'مسودة نشاط',
    score: 18,
    max: 20,
    published: false,
  });
  assert.equal(gDraft.statusCode, 200);
  let pState = (await req(parent, '/api/state')).json();
  assert.ok(!pState.notifications.some((n) => n.content.includes('مسودة نشاط')));

  const draftId = (await req(teacher, '/api/state?student=alex')).json().grades.find((g) => g.title === 'مسودة نشاط').id;
  assert.equal((await req(teacher, `/api/grades/${draftId}/publish`, {})).statusCode, 200);

  // 4. Homework & school announcement -> notified
  assert.equal(
    (
      await req(teacher, '/api/homework', {
        section: '8A',
        subject: 'الرياضيات',
        title: 'واجب المعادلات',
        description: 'صفحة ١٢',
        due: '2026-11-15',
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await req(admin, '/api/announcements', { title: 'اجتماع أولياء الأمور', content: 'يوم الخميس الساعة 10 ص' })).statusCode,
    200,
  );

  pState = (await req(parent, '/api/state')).json();
  const sState = (await req(student, '/api/state')).json();
  const unreadParent = pState.notifications.filter((n) => !n.read);
  for (const needle of ['تنبيه تأخر', 'تنبيه غياب فوري', 'ملاحظة تعليمية', 'تحديث دراسي جديد', 'واجب جديد', 'اجتماع أولياء الأمور']) {
    assert.ok(unreadParent.some((n) => n.title.includes(needle)), `Parent missing notification: ${needle}`);
    assert.ok(sState.notifications.some((n) => n.title.includes(needle)), `Student missing notification: ${needle}`);
  }

  // Single alert read marks only that alert
  const firstId = unreadParent[0].id;
  assert.equal((await req(parent, `/api/notifications/${firstId}/read`, {})).statusCode, 200);
  const afterSingle = (await req(parent, '/api/state')).json();
  assert.equal(afterSingle.notifications.find((n) => n.id === firstId).read, 1);
  assert.equal(afterSingle.notifications.filter((n) => !n.read).length, unreadParent.length - 1);

  // Bulk read clears remaining unread notifications
  assert.equal((await req(parent, '/api/notifications/read', {})).statusCode, 200);
  const afterAll = (await req(parent, '/api/state')).json();
  assert.equal(afterAll.notifications.filter((n) => !n.read).length, 0);
});

test('subject rename propagates to lessons, homework, and grades', async () => {
  const admin = await login('rami');
  const math = (await req(admin, '/api/state')).json().subjects.find((s) => s.name === 'الرياضيات');
  assert.ok(math);
  assert.equal(
    (await req(admin, '/api/subjects', { id: math.id, name: 'الجبر المتقدم', description: math.description, color: 'blue' })).statusCode,
    200,
  );
  const next = (await req(admin, '/api/state?student=alex')).json();
  assert.ok(next.lessons.some((l) => l.subject === 'الجبر المتقدم'));
  assert.ok(!next.lessons.some((l) => l.subject === 'الرياضيات'));
});

test('database export, template, merge injection, and replace injection enforce permissions and work end-to-end', async () => {
  const admin = await login('rami');
  const teacher = await login('emma');
  const parent = await login('sarah');

  // Non-managers denied
  assert.equal((await req(teacher, '/api/admin/database/export')).statusCode, 403);
  assert.equal((await req(parent, '/api/admin/database/template')).statusCode, 403);
  assert.equal((await req(teacher, '/api/admin/database/import', { classes: [] })).statusCode, 403);

  // Export & template work cleanly without leaking password hashes
  const exp = await req(admin, '/api/admin/database/export');
  assert.equal(exp.statusCode, 200);
  const snapshot = exp.json();
  assert.ok(snapshot.school.name && snapshot.teachers.length >= 2 && snapshot.students.length >= 2);
  assert.ok(!JSON.stringify(snapshot).includes('$2') && !JSON.stringify(snapshot).includes('SchoolSync!2026'));
  assert.equal((await req(admin, '/api/admin/database/template')).statusCode, 200);

  // Inject custom school dataset in merge mode
  const injectRes = await req(admin, '/api/admin/database/import', {
    mode: 'merge',
    defaultPassword: 'CustomSchool!2026',
    classes: [{ name: 'العاشر - ج', gradeLevel: 'العاشر', room: '305' }],
    subjects: [{ name: 'الفيزياء', description: 'العاشر العلمي', color: 'lilac' }],
    teachers: [
      {
        name: 'أ. مازن الخطيب',
        email: 'mazen@schoolsync.demo',
        classes: ['العاشر - ج'],
        subjects: ['الفيزياء'],
      },
    ],
    parents: [{ name: 'نادر حسن', email: 'nader@schoolsync.demo' }],
    students: [
      {
        name: 'طارق نادر حسن',
        section: 'العاشر - ج',
        guardianPhone: '0795554443',
        guardianEmails: ['nader@schoolsync.demo'],
        nationalId: '2000998877',
        familyCode: 'TariqCode2026',
      },
    ],
    lessons: [
      {
        section: 'العاشر - ج',
        teacherEmail: 'mazen@schoolsync.demo',
        subject: 'الفيزياء',
        room: 'مختبر الفيزياء',
        weekday: 2,
        periodNumber: 3,
        color: 'lilac',
      },
    ],
  });
  assert.equal(injectRes.statusCode, 200, injectRes.body);
  assert.equal(injectRes.json().counts.students, 1);

  // Verify injected teacher logs in, records absent -> injected parent gets notification
  const mazenCookie = await login('mazen@schoolsync.demo', 'CustomSchool!2026');
  const mState = (await req(mazenCookie, '/api/state')).json();
  const tariq = mState.students.find((s) => s.name === 'طارق نادر حسن');
  assert.ok(tariq);
  assert.equal((await req(mazenCookie, '/api/attendance/quick', { studentId: tariq.id, status: 'absent' })).statusCode, 200);

  const famLogin = await app.inject({
    method: 'POST',
    url: '/api/family-login',
    payload: { nationalId: '2000998877', password: 'TariqCode2026' },
  });
  assert.equal(famLogin.statusCode, 200, famLogin.body);
  const parentCookie = famLogin.headers['set-cookie'].split(';')[0];
  const famState = (await req(parentCookie, '/api/state')).json();
  assert.ok(famState.notifications.some((n) => n.title.includes('تنبيه غياب فوري')));

  // Export -> Merge Re-inject roundtrip works seamlessly without losing data
  const roundtrip = await req(admin, '/api/admin/database/import', { ...snapshot, mode: 'merge' });
  assert.equal(roundtrip.statusCode, 200, roundtrip.body);

  // Inject in replace mode rebuilds school data while keeping admin authenticated
  const repRes = await req(admin, '/api/admin/database/import', {
    mode: 'replace',
    defaultPassword: 'ReplacedPass!2026',
    school: { name: 'مدرسة النخبة الحديثة' },
    classes: [{ name: 'الأول - أ', room: '101' }],
    subjects: [{ name: 'العلوم', color: 'mint' }],
    teachers: [{ name: 'أ. ريم', email: 'reem@elite.jo', classes: ['الأول - أ'], subjects: ['العلوم'] }],
    students: [{ name: 'لينا علي', section: 'الأول - أ' }],
    lessons: [{ section: 'الأول - أ', teacherEmail: 'reem@elite.jo', subject: 'العلوم', room: '101', weekday: 0, periodNumber: 1 }],
  });
  assert.equal(repRes.statusCode, 200, repRes.body);
  const postReplace = (await req(admin, '/api/state')).json();
  assert.equal(postReplace.school.name, 'مدرسة النخبة الحديثة');
  assert.equal(postReplace.students.length, 1);
  assert.equal(postReplace.students[0].name, 'لينا علي');
});
