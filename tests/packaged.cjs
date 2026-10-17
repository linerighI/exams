const { resolve, join } = require('node:path');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { dotnet, run } = require('../scripts/desktop-tools.cjs');
const directory = resolve('release/webview2-unpacked');
for (const file of ['Alshereqi Exams.exe', 'bridge.js', 'dist/index.html', 'desktop/backend.cjs',
  'runtime/node.exe', 'runtime/WebView2Installer.exe', 'worker/runtime/pdf-worker.exe',
  'worker/runtime/models/det/inference.pdmodel', 'worker/runtime/models/ar/inference.pdmodel', 'worker/runtime/models/cls/inference.pdmodel'])
  assert.ok(existsSync(join(directory, file)), 'Missing packaged file: ' + file);
assert.ok(!existsSync(join(directory, 'node_modules/electron')));
assert.ok(!readdirSync(directory).some(name => /electron|chrome_100_percent|chrome_200_percent/i.test(name)));
const manifest = JSON.parse(readFileSync(join(directory, 'runtime/manifest.json')));
assert.match(manifest.node, /^v24\./);
const sqlite = spawnSync(join(directory, 'runtime/node.exe'), ['-e', "new (require('better-sqlite3'))(':memory:').close()"], { cwd: directory, encoding: 'utf8', windowsHide: true });
assert.equal(sqlite.status, 0, sqlite.stderr);
// Release installers never accept the debugging switch. Use a separate automation
// shell against the real packaged frontend/backend/runtime for integration tests.
const automation = resolve('release/webview2-automation');
run(dotnet(), ['publish', 'desktop/native/Alshereqi.Desktop.csproj', '-c', 'Release', '-p:DesktopAutomation=true', '-o', automation]);
const result = spawnSync(process.execPath, ['tests/desktop.cjs'], { stdio: 'inherit', windowsHide: true,
  env: { ...process.env, SCHOOL_APP_ROOT: directory, SCHOOL_PACKAGED_EXE: join(automation, 'Alshereqi Exams.exe') } });
process.exitCode = result.status ?? 1;
