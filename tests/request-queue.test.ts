import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestQueue } from '../desktop/requestQueue';

test('school request queue bounds bursts, preserves FIFO, and releases slots after failures', async () => {
  const run = createRequestQueue(4);
  let active = 0;
  let peak = 0;
  const started: number[] = [];
  const results = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) =>
      run(async () => {
        started.push(i);
        peak = Math.max(peak, ++active);
        await new Promise<void>((resolve) => setImmediate(resolve));
        active--;
        if (i === 5) throw new Error('transport failure');
        return i;
      }),
    ),
  );
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(
    started,
    Array.from({ length: 30 }, (_, i) => i),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 29);
  assert.equal(results[5].status, 'rejected');
  assert.equal(await run(async () => 42), 42);
  await assert.rejects(
    run(() => {
      throw new Error('synchronous failure');
    }),
    /synchronous failure/,
  );
  assert.equal(await run(async () => 'recovered'), 'recovered');
  assert.throws(() => createRequestQueue(0), RangeError);
});
