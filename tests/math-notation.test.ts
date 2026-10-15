import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { mathSegments } from '../src/mathNotation';
test('legacy question notation is typeset without changing Arabic prose or stored values', () => {
  const text = 'ما هي قيمة sin 255o مقربة إلى أقرب ثلاث منازل عشرية؟';
  const segments = mathSegments(text);
  assert.ok(segments.some((s) => s.math && s.text.includes('\\sin 255^{\\circ}')));
  for (const source of [text, 'احسب x2 + y²', '\\(\\frac{1}{2} + \\sqrt{x}\\)', '-0.966'])
    for (const s of mathSegments(source))
      if (s.math) assert.doesNotThrow(() => katex.renderToString(s.text, { throwOnError: true }));
  assert.deepEqual(mathSegments('الصف العاشر كتاب الطالب'), [{ text: 'الصف العاشر كتاب الطالب' }]);
  assert.equal(mathSegments('-0.966')[0].math, true);
});
