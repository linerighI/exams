const path = require('node:path');
const { spawn } = require('node:child_process');
const { root, nodeScript } = require('./desktop-tools.cjs');
try { nodeScript('scripts/build-desktop.cjs'); } catch (e) { console.error(e.message); process.exit(1); }
const child = spawn(path.join(root, 'desktop/native/bin/dev/Alshereqi Exams.exe'), process.argv.slice(2), {
  cwd: root, stdio: 'inherit', windowsHide: false,
  env: { ...process.env, SCHOOL_APP_ROOT: root, SCHOOL_NODE_EXECUTABLE: process.execPath, SCHOOL_DEVELOPMENT: '1' },
});
child.on('error', e => { console.error(e); process.exitCode = 1; });
child.on('exit', code => process.exit(code ?? 1));
// The host's Windows Job Object owns backend/OCR cleanup if the terminal is closed.
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
