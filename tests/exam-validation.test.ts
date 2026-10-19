import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examIssues, issuesFromError, validationMessage } from '../src/examValidation';
import { createQuestion } from '../src/questionFormats';
test('exam errors identify fields and individual questions without discarding teacher content', () => {
  const q = createQuestion('short');
  q.text = 'اذكر تعريف القوة';
  const form = {
    title: '',
    subject: 'فيزياء',
    grade: 'العاشر',
    duration: 0,
    total: 20,
    opensAt: '2026-10-19T12:00',
    closesAt: '2026-10-19T11:00',
    questions: [q],
  };
  const issues = examIssues(form, true, false);
  for (const path of ['title', 'duration', 'closesAt', 'questions.0.acceptedAnswers', 'approved'])
    assert.ok(
      issues.some((i) => i.path.join('.') === path),
      path,
    );
  assert.equal(q.text, 'اذكر تعريف القوة');
  assert.ok(
    validationMessage(['questions', 2, 'correctChoices'], {
      code: 'custom',
      message: 'حدد إجابة صحيحة',
    }).includes('السؤال 3'),
  );
  const ready = {
    ...form,
    title: 'اختبار',
    duration: 45,
    closesAt: '2026-10-19T13:00',
    questions: [{ ...q, acceptedAnswers: ['تعريف مقبول'] }],
  };
  assert.deepEqual(examIssues(ready, true, true), []);
});

test('native-host message-only errors still target the correct question and setting',()=>{
 assert.deepEqual(issuesFromError(new Error('السؤال 3 · الإجابات المقبولة: أكمل القيمة المطلوبة.'))[0].path,['questions',2,'acceptedAnswers']);
 assert.deepEqual(issuesFromError(new Error('مجموعة الأسئلة لا توفر نماذج كافية'))[0].path,['questions']);
 assert.deepEqual(issuesFromError(new Error('المدة: تجاوزت الحد المسموح'))[0].path,['duration']);
});
