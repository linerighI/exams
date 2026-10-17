import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateQuestions, convertUnit, describeNumbers } from '../src/teacherUtilities';
import { teacherResources, trustedTeacherResource } from '../src/teacherResources';

test('teacher unit conversions preserve metric dimensions and handle temperature offsets', () => {
  assert.equal(convertUnit('length', '١٠٠', 'cm', 'm'), 1);
  assert.equal(convertUnit('mass', '1', 'kg', 'g'), 1000);
  assert.equal(convertUnit('area', '2', 'dunum', 'm2'), 2000);
  assert.equal(convertUnit('volume', '1', 'm3', 'l'), 1000);
  assert.equal(convertUnit('temperature', '32', 'f', 'c'), 0);
  assert.equal(convertUnit('temperature', '273.15', 'k', 'c'), 0);
  assert.equal(convertUnit('temperature', '١٠٠', 'c', 'f'), 212);
  assert.throws(() => convertUnit('temperature', '-1', 'k', 'c'), /الصفر المطلق/);
  assert.throws(() => convertUnit('mass', '5', 'm', 'kg'));
  for (const input of ['', 'Infinity', '1+2', '1e999'])
    assert.throws(() => convertUnit('length', input, 'cm', 'm'));
});
test('statistics parse Arabic digits and compute median and population spread without silently skipping invalid data', () => {
  const s = describeNumbers('١، ٢، ٣، ٤');
  assert.deepEqual(
    { ...s, populationSD: undefined },
    {
      count: 4,
      sum: 10,
      mean: 2.5,
      median: 2.5,
      min: 1,
      max: 4,
      range: 3,
      populationSD: undefined,
    },
  );
  assert.ok(Math.abs(s.populationSD - Math.sqrt(1.25)) < 1e-12);
  assert.equal(describeNumbers('٣٫٥ ٣٫٥ ٣٫٥').populationSD, 0);
  assert.equal(describeNumbers('-5 -2 -3').median, -3);
  for (const input of ['', '1, missing, 3', '1/2', Array(1002).fill('1').join(' ')])
    assert.throws(() => describeNumbers(input));
});
test('exam blueprint allocation preserves totals for unequal weights and excludes zero weights', () => {
  assert.deepEqual(allocateQuestions(20, [4, 3, 3]), [8, 6, 6]);
  assert.deepEqual(allocateQuestions(5, [1, 1, 1]), [2, 2, 1]);
  assert.deepEqual(allocateQuestions(3, [0, 1, 1]), [0, 2, 1]);
  for (let count = 1; count <= 100; count++) {
    const result = allocateQuestions(count, [3, 9, 0, 5, 1]);
    assert.equal(
      result.reduce((a, b) => a + b, 0),
      count,
    );
    assert.equal(result[2], 0);
    assert.ok(result.every(Number.isInteger));
  }
  for (const [count, weights] of [
    [0, [1]],
    [3, [0, 0]],
    [3, [-1, 2]],
    [101, [1]],
    [3, [Infinity]],
  ] as [number, number[]][])
    assert.throws(() => allocateQuestions(count, weights));
});
test('native teacher resources accept catalog destinations and bounded searches, rejecting URL launcher escapes', () => {
  for (const r of teacherResources)
    assert.equal(trustedTeacherResource(r.url), new URL(r.url).href);
  assert.ok(
    trustedTeacherResource('https://www.google.com/search?q=math%20grade%2010').includes('math'),
  );
  for (const url of [
    'file:///C:/Windows/System32/cmd.exe',
    'javascript:alert(1)',
    'http://www.google.com/',
    'https://www.google.com.evil.example/search?q=x',
    'https://www.google.com/url?q=https://evil.example',
    'https://www.google.com/search?q=x&redirect=evil',
    'https://user:password@www.google.com/',
    'https://www.google.com:444/',
    'https://www.google.com/#fragment',
    'https://moe.gov.jo/unapproved',
  ])
    assert.throws(() => trustedTeacherResource(url));
});
