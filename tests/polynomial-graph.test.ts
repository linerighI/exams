import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polynomialGraph } from '../src/polynomialGraph';
import { mathSegments } from '../src/mathNotation';
import katex from 'katex';
test('local graph reads bounded polynomial arithmetic without solving, inventing points or executing code', () => {
  assert.deepEqual(
    polynomialGraph('إذا كان \\(y=3x+4\\) و \\(y=x^{2}+3x+4\\) فكم عدد حلول النظام؟')?.objects,
    [
      { type: 'function', name: 'f', coefficients: [4, 3] },
      { type: 'function', name: 'g', coefficients: [4, 3, 1] },
    ],
  );
  assert.deepEqual(polynomialGraph('ما مجموعة الحلول للمعادلة \\(x^{3}-64x=0\\)؟')?.objects, [
    { type: 'function', name: 'f', coefficients: [0, -64, 0, 1] },
  ]);
  assert.deepEqual(polynomialGraph('(x-2)^2/2')?.objects, [
    { type: 'function', name: 'f', coefficients: [2, -2, 0.5] },
  ]);
  for (const value of ['x^100', 'import("fs")', 'sin(x)', 'ارسم مثلثًا', 'x=3', 'x^3-2000x=0'])
    assert.equal(polynomialGraph(value), undefined, value);
});
test('math display supports raw common LaTeX and doubly escaped bank delimiters', () => {
  assert.ok(
    mathSegments('Use \\sqrt{x} then answer').some(
      (p) => !p.math && p.text.includes('then answer'),
    ),
  );
  for (const value of ['احسب \\frac{1}{2} + \\sqrt{x} ثم تابع', 'احسب \\\\(x^{3}-64x=0\\\\)']) {
    const parts = mathSegments(value);
    assert.ok(parts.some((p) => p.math));
    for (const part of parts.filter((p) => p.math))
      assert.doesNotThrow(() => katex.renderToString(part.text, { throwOnError: true }));
    assert.ok(!parts.filter((p) => !p.math).some((p) => p.text.includes('\\')));
  }
});
