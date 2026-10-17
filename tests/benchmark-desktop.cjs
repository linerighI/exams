const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function snapshot(pid) {
  return JSON.parse(execFileSync('powershell', ['-NoProfile', '-File', path.join(__dirname, 'measure-process.ps1'), '-AppProcessId', String(pid)], { encoding: 'utf8', windowsHide: true }));
}
(async () => {
  fs.mkdirSync('.data', { recursive: true });
  fs.mkdirSync('test-results', { recursive: true });
  const legacy = process.argv.includes('--electron');
  const start = performance.now();
  let app;
  if (legacy) {
    const env = { ...process.env, SCHOOL_TEST_DATA: path.resolve('.data/benchmark-electron') };
    delete env.ELECTRON_RUN_AS_NODE; delete env.SCHOOL_HEADLESS_TEST;
    if (!process.env.LEGACY_ELECTRON_EXE) throw Error('Set LEGACY_ELECTRON_EXE to a separate legacy Electron executable; Electron is no longer a project dependency.');
    app = await require('playwright')._electron.launch({ executablePath: process.env.LEGACY_ELECTRON_EXE, args: [process.env.LEGACY_ELECTRON_APP || '.tools/legacy-app'], env });
  } else {
    app = await require('./webview2-driver.cjs').launch({ visible: true, env: { SCHOOL_TEST_DATA: path.resolve('.data/benchmark-webview2'), SCHOOL_HEADLESS_TEST: '0' } });
  }
  try {
    const page = await app.firstWindow();
    await page.locator('.login-card').waitFor();
    const startupMs = performance.now() - start;
    await page.evaluate(() => {
      const label = document.createElement('div');
      label.textContent = 'Temporary performance test — this window closes automatically';
      label.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:8px;background:#203650;color:white;text-align:center;font:14px sans-serif;pointer-events:none';
      document.body.append(label);
    });
    await page.waitForTimeout(5000);
    const before = snapshot(app.process().pid);
    const begin = performance.now();
    const frames = await page.evaluate(() => new Promise(resolve => {
      const intervals = []; let previous;
      const deadline = performance.now() + 5000;
      const frame = timestamp => {
        if (previous !== undefined) intervals.push(timestamp - previous);
        previous = timestamp;
        if (timestamp >= deadline) resolve(intervals); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }));
    const after = snapshot(app.process().pid);
    const wallSeconds = (performance.now() - begin) / 1000;
    const cpuBefore = before.processes.reduce((n, p) => n + (p.CPU || 0), 0);
    const cpuAfter = after.processes.reduce((n, p) => n + (p.CPU || 0), 0);
    const result = { engine: legacy ? 'Electron' : 'WebView2', scenario: 'Visible animated welcome screen, five-second warmup, five-second sampling',
      startupMs, totalWorkingSet: after.processes.reduce((n, p) => n + p.WorkingSet64, 0),
      totalPrivateBytes: after.processes.reduce((n, p) => n + p.PrivateMemorySize64, 0),
      cpuSeconds: cpuAfter - cpuBefore, wallSeconds,
      frameIntervalMeanMs: frames.reduce((n, value) => n + value, 0) / frames.length,
      framesOver34Ms: frames.filter(value => value > 34).length, sampleCount: frames.length, ...after };
    fs.writeFileSync('test-results/' + (legacy ? 'electron' : 'webview2') + '-benchmark.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

