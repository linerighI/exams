import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeKey, sectionKey } from '../server/classMatch';
test('class names and Arabic/English sections match without widening access', () => {
  for (const value of ['10', '١٠', '۱۰', 'العاشر', 'الصف العاشر', 'العاشر الأساسي']) assert.equal(gradeKey(value), '10');
  assert.equal(sectionKey('D'), sectionKey('د'));
  assert.equal(sectionKey('A'), sectionKey('أ'));
  assert.equal(sectionKey('الشعبة أ'), sectionKey('أ'));
  assert.notEqual(gradeKey('التاسع'), gradeKey('العاشر'));
  assert.notEqual(sectionKey('C'), sectionKey('D'));
});
