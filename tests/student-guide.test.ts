import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedGuideAction,
  findHelpTopic,
  guideTone,
  helpTopics,
  studentGuideAnswer,
  type GuideContext,
  type GuideExam,
} from '../src/studentGuide';
const exam: GuideExam = {
  id: 'exam-1',
  total: 4,
  answered: 1,
  missing: [2, 3, 4],
  flagged: [1],
  current: 1,
  remaining: 610,
  online: true,
  pending: 0,
  frozen: false,
  finished: false,
  finishRequested: false,
  modalOpen: false,
  calculator: false,
  geometry: false,
};
const base: GuideContext = {
  name: 'ليان',
  page: 'dashboard',
  connected: true,
  available: 2,
  active: 1,
  published: 1,
  waiting: 2,
  exam: null,
};
test('static student help recognizes Arabic variations and does not route answer requests to a solver', () => {
  assert.equal(findHelpTopic('هَلْ إِجَابَاتِي مَحْفُوظَة؟'), 'save');
  assert.equal(findHelpTopic('أين الآلة الحاسبة؟'), 'calculator');
  assert.equal(findHelpTopic('انقطع الاتصال'), 'connection');
  assert.equal(findHelpTopic('لماذا لا تظهر درجتي'), 'results');
  for (const query of [
    'احسب 2+2',
    'ما ناتج 3+4؟',
    'اعطني الإجابة الصحيحة لهذا السؤال',
    'حل لي السؤال',
  ])
    assert.equal(findHelpTopic(query), 'help');
  assert.equal(findHelpTopic('<script>alert(1)</script>'), null);
  assert.match(studentGuideAnswer('help', base).text, /لا أقدّم حل السؤال/);
  assert.match(studentGuideAnswer(null, base).text, /استخدام التطبيق/);
});
test('all prerecorded topics return complete replies and context-safe actions', () => {
  for (const c of [
    base,
    { ...base, exam },
    { ...base, exam: { ...exam, frozen: true } },
    { ...base, exam: { ...exam, finished: true } },
  ]) {
    for (const topic of helpTopics) {
      const reply = studentGuideAnswer(topic.id, c);
      assert.ok(reply.text.length > 20, topic.id);
      for (const action of reply.actions || [])
        assert.equal(allowedGuideAction(action.id, c), true, `${topic.id}: ${action.id}`);
    }
  }
});
test('guide uses real progress and distinguishes queued local answers from confirmed delivery', () => {
  const c = { ...base, exam: { ...exam, pending: 2, online: false } };
  const progress = studentGuideAnswer('progress', c);
  assert.match(progress.text, /1 من 4/);
  assert.match(progress.text, /2، 3، 4/);
  const save = studentGuideAnswer('save', c);
  assert.match(save.text, /2 إجابات محفوظة على هذا الجهاز/);
  assert.match(save.text, /تنتظر تأكيد/);
  assert.match(studentGuideAnswer('connection', c).text, /لا يوقف وقت الامتحان/);
  assert.match(studentGuideAnswer('time', c).text, /11 دقائق/);
  const sent = studentGuideAnswer('save', { ...base, exam });
  assert.match(sent.text, /لا توجد إجابات بانتظار الإرسال/);
  assert.match(studentGuideAnswer('results', base).text, /1 نتائج منشورة و2 امتحانات/);
  assert.match(
    studentGuideAnswer('save', { ...base, exam: { ...exam, saveState: 'saving' } }).text,
    /جارٍ كتابة/,
  );
  assert.match(
    studentGuideAnswer('save', { ...base, exam: { ...exam, saveState: 'error' } }).text,
    /لا أستطيع تأكيد/,
  );
  assert.equal(guideTone({ ...base, exam: { ...exam, saveState: 'error' } }), 'red');
});
test('teacher tool permissions, submission freeze and exam navigation restrictions are enforced in guide actions', () => {
  const c = { ...base, exam };
  for (const id of ['calculator', 'geometry', 'results', 'exams', 'home', 'resume'] as const)
    assert.equal(allowedGuideAction(id, c), false);
  assert.deepEqual(studentGuideAnswer('calculator', c).actions, []);
  assert.deepEqual(studentGuideAnswer('geometry', c).actions, []);
  assert.equal(
    allowedGuideAction('calculator', { ...base, exam: { ...exam, calculator: true } }),
    true,
  );
  assert.equal(
    allowedGuideAction('geometry', { ...base, exam: { ...exam, geometry: true } }),
    true,
  );
  const frozen = { ...base, exam: { ...exam, frozen: true, calculator: true, geometry: true } };
  for (const id of ['submit', 'mark', 'calculator', 'geometry'] as const)
    assert.equal(allowedGuideAction(id, frozen), false);
  assert.equal(allowedGuideAction('missing', frozen), true);
  assert.equal(allowedGuideAction('results', { ...base, exam: { ...exam, finished: true } }), true);
  assert.equal(allowedGuideAction('mark', base), false);
});
test('orb colors represent progress and connection without suggesting answer correctness', () => {
  assert.equal(guideTone(base), 'blue');
  assert.equal(guideTone({ ...base, connected: false }), 'red');
  assert.equal(guideTone({ ...base, exam }), 'blue');
  assert.equal(guideTone({ ...base, exam: { ...exam, current: 4 } }), 'red');
  assert.equal(guideTone({ ...base, exam: { ...exam, finishRequested: true } }), 'red');
  assert.equal(guideTone({ ...base, exam: { ...exam, answered: 4, missing: [] } }), 'green');
  assert.equal(guideTone({ ...base, exam: { ...exam, finished: true, online: false } }), 'green');
  assert.match(studentGuideAnswer('colors', base).text, /لا يعني أن الإجابات صحيحة/);
});
