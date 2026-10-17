import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import reducer, { calcSlice, initialState } from '../src/vendor/scientific-calculator/calcSlice';
const a = calcSlice.actions;
test('vendored scientific calculator handles degree/radian trig, roots, fractions and arithmetic', () => {
  const calc = (actions: any[]) => actions.reduce((s, x) => reducer(s, x), initialState);
  const digits = (s: string) => s.split('').map((input) => a.updateCurrentOperand({ input }));
  assert.equal(
    calc([
      ...digits('25'),
      a.executeFunction({ func: 'sqrt' }),
      a.updateExpression({ operator: '+' }),
      ...digits('3'),
      a.executeFunction({ func: 'square' }),
      a.evaluateExpression(),
    ]).output,
    '14',
  );
  assert.ok(
    Math.abs(
      Number(calc([...digits('30'), a.executeFunction({ func: 'sin' })]).currentOperand) - 0.5,
    ) < 1e-12,
  );
  assert.equal(calc([...digits('100'), a.executeFunction({ func: 'log10' })]).output, '2');
  assert.equal(calc([...digits('50'), a.percent()]).output, '0.5');
  const fraction = calc([...digits('1'), a.fractionMode(), ...digits('2'), a.evaluateExpression()]);
  assert.equal(fraction.currentOperand, '0.5');
  assert.equal(reducer(fraction, a.toggleFraction()).output, '0.5');
  assert.equal(reducer(reducer(fraction, a.toggleFraction()), a.toggleFraction()).output, '1⨼2');
  assert.equal(calc([a.cycleDrgMode()]).angleMode, 'rad');
});
test('students cannot log out without their owning teacher password and exit attempts are limited', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'student-lock-'));
  const server = await createApp({ directory });
  const call = (url: string, payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: 'POST',
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', { school: 'مدرسة', password: 'Exit-test123' });
    const teacher = (await call('/api/login', { role: 'teacher', password: 'Exit-test123' })).json()
      .token;
    const student = (
      await call(
        '/api/students',
        { id: 'lock-student', name: 'طالب', grade: '10', section: 'أ' },
        teacher,
      )
    ).json();
    const token = (await call('/api/login', { role: 'student', code: student.code })).json().token;
    assert.equal((await call('/api/logout', {}, token)).statusCode, 400);
    assert.equal((await call('/api/logout', { password: 'wrong' }, token)).statusCode, 403);
    const still = await server.app.inject({
      url: '/api/exams',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(still.statusCode, 200);
    assert.equal((await call('/api/logout', { password: 'Exit-test123' }, token)).statusCode, 200);
    assert.equal(
      (
        await server.app.inject({
          url: '/api/exams',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
      403,
    );
    const next = (await call('/api/login', { role: 'student', code: student.code })).json().token;
    for (let i = 0; i < 10; i++)
      assert.equal((await call('/api/logout', { password: 'wrong' }, next)).statusCode, 403);
    assert.equal((await call('/api/logout', { password: 'wrong' }, next)).statusCode, 429);
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
