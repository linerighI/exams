/**
 * Launches either the SchoolSync Server WebView2 app (`server`) or Client WebView2 app (`client`).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { root } = require('../../scripts/desktop-tools.cjs');

const target = process.argv[2] === 'server' ? 'server' : 'client';
const exeName = target === 'server' ? 'SchoolSync Server.exe' : 'SchoolSync Client.exe';
const exePath = path.join(root, 'schoolsync/desktop/bin', target, exeName);

if (!fs.existsSync(exePath)) {
  console.error(`Missing ${exePath}. Run "npm run schoolsync:desktop:build" first.`);
  process.exit(1);
}

const child = spawn(exePath, process.argv.slice(3), {
  cwd: root,
  stdio: 'inherit',
  windowsHide: false,
  env: {
    ...process.env,
    SCHOOLSYNC_APP_ROOT: root,
    SCHOOLSYNC_NODE_EXECUTABLE: process.execPath,
  },
});

child.on('error', (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
