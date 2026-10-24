import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
const require = createRequire(import.meta.url);
const { launch, freePort } = require('./webview2-driver.cjs');
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
for (const early of [false, true]) {
  const directory = mkdtempSync(resolve('.data/startup-native-'));
  let app: any;
  try {
    app = await launch({
      executablePath: resolve('.tools/startup-native/Alshereqi Exams.exe'),
      env: {
        SCHOOL_APP_ROOT: process.cwd(),
        SCHOOL_NODE_EXECUTABLE: process.execPath,
        SCHOOL_TEST_DATA: directory,
        SCHOOL_TEST_PORT: String(await freePort()),
        SCHOOL_TEST_STARTUP_DELAY_MS: '6500',
        SCHOOL_HEADLESS_TEST: '1',
      },
      startupTimeoutMs: 45000,
    });
    const page: Page = await app.firstWindow();
    await page.waitForURL('**/boot.html');
    await page.locator('.startup-loading .startup-art svg').waitFor();
    const started = await page.evaluate(() => sessionStorage.getItem('zunis-started-at'));
    assert.ok(started);
    if (!early) {
      await page.waitForFunction(() => {
        const g = document.querySelector('.startup-art svg >g:last-child');
        return g && Number(g.getAttribute('opacity')) > 0.99;
      });
      await page.screenshot({ path: 'test-results/zunis-native-loader.png' });
      await page.waitForURL('**/index.html', { timeout: 45000 });
      await page.waitForFunction(() => Boolean(document.querySelector('#root')?.children.length));
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zunis-started-at')), started);
      assert.equal(
        await page.locator('.zunis-splash').count(),
        0,
        'Completed native artwork must not replay after loading',
      );
      const connection = await page.evaluate(() => (window as any).desktop.connectionState());
      assert.equal(connection.connected, false);
      assert.ok(app.diagnostics().includes('Startup complete'));
    }
    await app.close();
    if (app.process().exitCode === null)
      await new Promise<void>((resolve) => app.process().once('exit', () => resolve()));
    assert.ok(
      app.process().exitCode !== null || app.process().signalCode !== null,
      'Native test process must exit',
    );
  } finally {
    await app?.close().catch(() => {});
    // WebView2 can briefly retain its test-profile handles after the host exits.
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 100 });
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
      // Keep the disposable profile for inspection rather than killing unrelated browser processes.
      console.warn('Windows still holds the temporary test profile; preserved:', directory);
    }
  }
}
console.log(
  'Native startup passed: bundled loading artwork during delayed backend, trusted boot-to-app navigation, retained timeline without replay, desktop bridge ready, and safe close during startup.',
);
