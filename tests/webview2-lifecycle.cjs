const { launch, freePort } = require('./webview2-driver.cjs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { mkdirSync, mkdtempSync, existsSync } = require('node:fs');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function tree(pid) {
  return JSON.parse(execFileSync('powershell', ['-NoProfile', '-File', resolve('tests/measure-process.ps1'), '-AppProcessId', String(pid)], { encoding: 'utf8', windowsHide: true })).processes;
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
(async () => {
  mkdirSync('.data', { recursive: true });
  for (const crash of [false, true]) {
    const directory = resolve(mkdtempSync('.data/lifecycle-'));
    const app = await launch({ env: { SCHOOL_TEST_DATA: directory, SCHOOL_HEADLESS_TEST: '1', SCHOOL_TEST_PORT: String(await freePort()) } });
    const page = await app.firstWindow();
    await page.evaluate(() => window.desktop.host());
    const processes = tree(app.process().pid);
    const backend = processes.find(p => p.ProcessName === 'node');
    assert.ok(backend, 'Backend belongs to the native process tree');
    if (crash) {
      process.kill(backend.Id);
      for (let i = 0; i < 50 && app.process().exitCode === null; i++) await delay(100);
      assert.notEqual(app.process().exitCode, null, 'Native host exits after an unexpected backend crash');
    }
    await app.close();
    for (let i = 0; i < 50 && alive(backend.Id); i++) await delay(100);
    assert.equal(alive(backend.Id), false, 'No orphaned backend after window close');
    // SQLite and the host port are released when the process ends.
    const Database = require('better-sqlite3');
    assert.ok(existsSync(resolve(directory, 'school/school.sqlite')));
    new Database(resolve(directory, 'school/school.sqlite')).close();
  }
  console.log('WebView2 lifecycle passed: backend ownership, clean window close, backend-crash handling, SQLite release.');
})().catch(error => { console.error(error); process.exitCode = 1; });
