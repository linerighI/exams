const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const net = require('node:net');
const { launch, freePort } = require('./webview2-driver.cjs');
(async () => {
  mkdirSync('.data', { recursive: true });
  mkdirSync('test-results', { recursive: true });
  const directory = resolve(mkdtempSync('.data/webview2-security-'));
  const saveDirectory = join(directory, 'exports');
  const env = { SCHOOL_TEST_DATA: directory, SCHOOL_HEADLESS_TEST: '1', SCHOOL_TEST_PORT: String(await freePort()),
    SCHOOL_TEST_SAVE_DIR: saveDirectory, SCHOOL_TEST_OPEN_FILE: join(saveDirectory, 'school-backup-' + new Date().toISOString().slice(0, 10) + '.json') };
  const app = await launch({ env });
  try {
    const page = await app.firstWindow();
    assert.match(app.diagnostics(), /Browser security: {"devTools":false,"contextMenus":false,"browserShortcuts":false}/);
    await page.keyboard.press('F12');
    await page.keyboard.press('Control+Shift+I');
    await page.keyboard.press('Control+Shift+J');
    await page.locator('h2').click({ button: 'right' });
    assert.equal(app.browser.contexts()[0].pages().length, 1);
    assert.equal(await page.evaluate(() => Object.isFrozen(window.desktop)), true);
    const forged = await page.evaluate(() => new Promise(resolve => {
      const listener = ({ data }) => { if (data.id === 987654) { chrome.webview.removeEventListener('message', listener); resolve(data.error); } };
      chrome.webview.addEventListener('message', listener);
      chrome.webview.postMessage({ id: 987654, method: 'open-external', args: ['https://evil.example'] });
    }));
    assert.match(forged, /Unsupported desktop command/);
    assert.match(await page.evaluate(async () => { try { await window.desktop.exportCSV('forbidden'); } catch (e) { return e.message; } }), /الجهاز الرئيسي/);
    await page.locator('.mode-switch button').nth(1).click();
    assert.equal(await page.locator('.login-card form input').count(), 1);
    assert.equal(await page.locator('.pair-form').count(), 0);
    await page.evaluate(() => window.desktop.host());
    await page.evaluate(() => window.desktop.request('/api/setup', 'POST', { school: 'مدرسة اختبار', username: 'admin', password: 'Desktop-test123', name: 'المعلم' }));
    await page.evaluate(() => window.desktop.request('/api/login', 'POST', { role: 'teacher', username: 'admin', password: 'Desktop-test123' }));
    const settings = await page.evaluate(() => window.desktop.request('/api/settings'));
    await page.evaluate(settings => window.desktop.request('/api/settings', 'PUT', { ...settings, geminiKey: 'secret-webview2-test-key' }), settings);
    const reread = await page.evaluate(() => window.desktop.request('/api/settings'));
    assert.equal(reread.geminiKey, undefined);
    assert.equal(await page.evaluate(() => window.desktop.exportCSV('name,result\nطالب,95')), true);
    assert.match(readFileSync(join(saveDirectory, 'results.csv'), 'utf8'), /طالب/);
    assert.equal(await page.evaluate(() => window.desktop.saveBackup()), true);
    const backup = readFileSync(env.SCHOOL_TEST_OPEN_FILE, 'utf8');
    assert.ok(!backup.includes('secret-webview2-test-key'));
    assert.equal(await page.evaluate(() => window.desktop.readBackup()), true);
    assert.match(await page.evaluate(async () => { try { await window.desktop.exportCSV('forbidden'); } catch (e) { return e.message; } }), /الجهاز الرئيسي/);
    await page.evaluate(() => window.desktop.request('/api/login', 'POST', { role: 'teacher', username: 'admin', password: 'Desktop-test123' }));
    const student = await page.evaluate(() => window.desktop.request('/api/students', 'POST', { id: 'security-student', name: 'طالب الاختبار', grade: '10', section: 'أ' }));
    await page.evaluate(code => window.desktop.request('/api/login', 'POST', { role: 'student', code }), student.code);
    assert.match(await page.evaluate(async () => { try { await window.desktop.request('/api/settings'); } catch (e) { return e.message; } }), /صلاحية/);
    assert.match(await page.evaluate(async () => { try { await window.desktop.saveBackup(); } catch (e) { return e.message; } }), /الجهاز الرئيسي|مقفلة/);
    await page.evaluate(()=>window.desktop.request('/api/logout','POST',{password:'Desktop-test123'}));
    await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = '/index.html'; frame.id = 'bridge-test'; document.body.append(frame); });
    const frame = await page.locator('#bridge-test').contentFrame();
    assert.equal(await frame.locator('body').evaluate(() => typeof window.desktop), 'undefined');
    console.log('WebView2 security passed: native allowlist, teacher permissions, simple student login, DPAPI settings, exports, restore logout, frame isolation.');
  } finally { await app.close(); }
  const cancel = await launch({ env: { ...env, SCHOOL_TEST_CANCEL_DIALOGS: '1' } });
  try {
    const page = await cancel.firstWindow();
    await page.evaluate(() => window.desktop.host());
    await page.evaluate(() => window.desktop.request('/api/login', 'POST', { role: 'teacher', username: 'admin', password: 'Desktop-test123' }));
    assert.equal(await page.evaluate(() => window.desktop.exportCSV('cancelled')), false);
    assert.equal(await page.evaluate(() => window.desktop.saveBackup()), false);
    assert.equal(await page.evaluate(() => window.desktop.readBackup()), false);
    console.log('Native dialog cancellation passed.');
  } finally { await cancel.close(); }
  const occupiedPort = await freePort();
  const server = net.createServer(socket => socket.on('error', () => {}));
  await new Promise(resolve => server.listen(occupiedPort, '0.0.0.0', resolve));
  const busy = await launch({ env: { ...env, SCHOOL_TEST_PORT: String(occupiedPort) }, args: ['--software-rendering'] });
  try {
    const page = await busy.firstWindow();
    const error = await page.evaluate(async () => { try { await window.desktop.host(); } catch (e) { return e.message; } });
    assert.match(error, /المنفذ/);
    console.log('Software rendering launch and occupied-port error passed.');
  } finally { await busy.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

