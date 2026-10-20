const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function launch(options = {}) {
  const root = path.resolve(__dirname, '..');
  const port = await freePort();
  const packaged = Boolean(options.executablePath);
  const startupAttempts = Math.ceil((options.startupTimeoutMs || 30000) / 200);
  const executable = options.executablePath || process.env.SCHOOL_TEST_EXECUTABLE || path.join(root, 'desktop/native/bin/dev/Alshereqi Exams.exe');
  const child = spawn(executable, ['--test-mode', '--debug-port', String(port), ...(options.args || [])], {
    windowsHide: !options.visible, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(packaged ? {} : { SCHOOL_APP_ROOT: root, SCHOOL_NODE_EXECUTABLE: process.execPath, SCHOOL_DEVELOPMENT: '1' }),
      ...options.env },
  });
  let output = '', failure;
  child.stdout.on('data', data => output = (output + data).slice(-8000));
  child.stderr.on('data', data => output = (output + data).slice(-8000));
  child.on('error', error => failure = error);
  let browser;
  try {
    let available = false;
    for (let i = 0; i < startupAttempts; i++) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw Error('WebView2 exited: ' + output);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { available = true; break; }
      } catch { }
      await delay(200);
    }
    if (!available) throw Error('WebView2 test debugger did not start: ' + output);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    let page;
    for (let i = 0; i < startupAttempts; i++) {
      page = context.pages().find(p => p.url().startsWith('https://app.alshereqi.invalid/'));
      if (page) break;
      await delay(200);
    }
    if (!page) throw Error('App did not navigate to bundled assets: ' + output);
    page.setDefaultTimeout(20000);
    page.on('dialog', dialog => { if(dialog.type()==='beforeunload')void dialog.accept();else void dialog.dismiss(); });
    await page.waitForFunction(() => Boolean(window.desktop));
    return {
      firstWindow: async () => page,
      process: () => child,
      browser,
      diagnostics: () => output,
      close: async () => {
        try { await page.evaluate(() => window.close()); } catch { }
        for (let i = 0; i < 40 && child.exitCode === null; i++) await delay(100);
        if (child.exitCode === null) child.kill();
        await browser.close().catch(() => {});
      },
    };
  } catch (error) { child.kill(); await browser?.close().catch(() => {}); throw error; }
}
module.exports = { launch, freePort };
