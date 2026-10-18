const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(root, '.data', 'host-policy-ipc-'));
fs.mkdirSync(path.join(directory, 'school'));
fs.writeFileSync(path.join(directory, 'school', 'connection-mode'), 'plain');
fs.writeFileSync(path.join(directory, 'school', 'connection'), JSON.stringify({ host: '192.0.2.10', fingerprint: 'A'.repeat(64), localHost: false }));
const child = spawn(process.execPath, [path.join(root, 'desktop', 'backend.cjs')], {
  cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, SCHOOL_APP_ROOT: root, SCHOOL_DESKTOP_DATA_DIR: directory, SCHOOL_TEST_MODE: '1', SCHOOL_TEST_PORT: '59437' },
});
let checked = false, diagnostics = '';
const send = message => child.stdin.write(JSON.stringify(message) + '\n');
const timer = setTimeout(() => { console.error('Backend protocol timeout:', diagnostics); process.exitCode = 1; child.kill(); }, 20000);
child.stderr.on('data', data => diagnostics += data);
createInterface({ input: child.stdout }).on('line', line => {
  diagnostics += line + '\n';
  const message = JSON.parse(line);
  if (message.nativeId) send({ nativeId: message.nativeId, result: true });
  if (message.event === 'ready') send({ id: 1, method: 'host', args: [] });
  if (message.id === 1) {
    try { assert.match(message.error, /مرتبط بالجهاز الرئيسي/); checked = true; }
    catch (error) { console.error(error); process.exitCode = 1; }
    send({ id: 2, method: 'shutdown', args: [] });
  }
});
child.on('exit', code => {
  clearTimeout(timer);
  if (!checked || code !== 0) { console.error(diagnostics); process.exitCode = 1; }
  else console.log('Compiled desktop backend rejects promotion of a saved paired client.');
  assert.ok(directory.startsWith(path.join(root, '.data') + path.sep));
  fs.rmSync(directory, { recursive: true, force: true });
});
