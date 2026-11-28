/**
 * Isolated Sandbox Launcher (`npm run schoolsync:sandbox`):
 * Starts an in-memory demo SchoolSync server (`--demo --sandbox --memory` on port 4325)
 * alongside Vite (port 5185) so roles, 3D campus wings, and principal tools can be tested
 * safely without creating accounts or affecting the live `.data` database.
 */
const { existsSync } = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');

const API_PORT = process.env.SCHOOLSYNC_SANDBOX_API_PORT || '4325';
const WEB_PORT = process.env.SCHOOLSYNC_SANDBOX_WEB_PORT || '5185';
const rootDir = path.resolve(__dirname, '../..');
const serverEntry = path.resolve(__dirname, '../server/app.cjs');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  console.error(`[sandbox] Could not find Vite CLI at ${viteBin}`);
  process.exit(1);
}

console.log('\n=== SchoolSync Isolated Sandbox ===');
console.log(`Frontend URL : http://127.0.0.1:${WEB_PORT}`);
console.log(`Sandbox API  : http://127.0.0.1:${API_PORT} (SQLite :memory:)`);
console.log('Safety       : Zero writes to live schoolsync-live.sqlite\n');

const sharedEnv = {
  ...process.env,
  SCHOOLSYNC_PORT: API_PORT,
  SCHOOLSYNC_API_PORT: API_PORT,
  SCHOOLSYNC_WEB_PORT: WEB_PORT,
};

const apiProc = spawn(
  process.execPath,
  [serverEntry, '--demo', '--sandbox', '--memory', '--port', API_PORT],
  { cwd: rootDir, env: sharedEnv, stdio: 'inherit' },
);

const viteProc = spawn(
  process.execPath,
  [viteBin, '--config', 'schoolsync/vite.config.ts'],
  { cwd: rootDir, env: sharedEnv, stdio: 'inherit' },
);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!apiProc.killed) apiProc.kill();
  if (!viteProc.killed) viteProc.kill();
  process.exit(code);
}

apiProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[sandbox] API exited (${code ?? 0})`);
    shutdown(code ?? 1);
  }
});

viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[sandbox] Vite exited (${code ?? 0})`);
    shutdown(code ?? 1);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
