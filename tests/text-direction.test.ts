import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textDirection } from '../src/textDirection';
import { printMath } from '../server/printDocument';

test('English exam prose keeps its reading direction around blanks and punctuation', () => {
  for (const text of [
    'Muna _____ up late every morning.',
    'Can I call you back? I _____ to someone else at the moment.',
    "doesn't get",
    '1. _____ my car to work at the moment.',
    '“Now, Salma _____ what you mean.”',
    'Choose the Arabic word «كتاب».',
    '\\(x^2\\) is positive.',
    '',
    '-12',
  ])
    assert.equal(textDirection(text), 'ltr', text);
});

test('Arabic questions stay RTL even when a number or formula comes first', () => {
  for (const text of [
    'اختر الإجابة الصحيحة.',
    '1. أكمل الفراغ _____.',
    '\\(x^2 + 4\\) احسب قيمة المقدار.',
    'x^2 احسب القيمة.',
    'اختر الكلمة English المناسبة.',
  ])
    assert.equal(textDirection(text), 'rtl', text);
});

test('printed question content isolates English and Arabic while keeping math and escaping', () => {
  assert.match(printMath('Muna _____ up late every morning.'), /dir="ltr"/);
  assert.match(printMath('احسب \\(x^2\\).'), /class="print-text" dir="rtl"/);
  assert.match(printMath('احسب \\(x^2\\).'), /dir="ltr" class="formula"/);
  assert.match(printMath('<script>bad</script>'), /&lt;script&gt;/);
  assert.ok(!printMath('<script>bad</script>').includes('<script>'));
});
