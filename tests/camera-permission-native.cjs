const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { resolve } = require('node:path');
const { launch } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  for (const denied of [true, false]) {
    const app = await launch({
      args: ['--fake-camera', ...(denied ? ['--deny-camera'] : [])],
      env: {
        SCHOOL_HEADLESS_TEST: '1',
        SCHOOL_TEST_DATA: resolve(mkdtempSync('.data/camera-permission-')),
      },
    });
    try {
      const page = await app.firstWindow();
      const probe = () =>
        page.evaluate(async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const count = stream.getVideoTracks().length;
            stream.getTracks().forEach((t) => t.stop());
            return { count };
          } catch (e) {
            return { error: e.name };
          }
        });
      const first = await probe();
      if (denied) {
        assert.equal(first.error, 'NotAllowedError');
        assert.equal((await probe()).error, 'NotAllowedError');
      } else assert.equal(first.count, 1);
      assert.match(
        app.diagnostics(),
        new RegExp('Camera permission requested: ' + (denied ? 'Deny' : 'Allow')),
      );
    } finally {
      await app.close();
    }
  }
  console.log(
    'Native camera permission passed: deny is explicit and retryable; consent grants the synthetic device and capture tracks stop.',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
