const fs = require('node:fs');
const path = require('node:path');
const { root, dotnet, run, nodeScript } = require('./desktop-tools.cjs');
(async () => {
  // Fail before distributing a package missing the existing offline OCR feature.
  await require('./check-worker.cjs')();
  nodeScript('scripts/create-icon.cjs');
  nodeScript('scripts/build-desktop.cjs');
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/prepare-distribution.ps1']);
  const stage = path.join(root, 'release', 'webview2-unpacked');
  const expected = path.join(root, 'release') + path.sep;
  if (!stage.startsWith(expected)) throw Error('Invalid distribution directory');
  // Clear only the explicitly checked generated staging directory.
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  run(dotnet(), ['publish', 'desktop/native/Alshereqi.Desktop.csproj', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '-o', stage]);
  for (const directory of ['dist', 'worker', 'speech']) {
    fs.cpSync(path.join(root, directory), path.join(stage, directory), { recursive: true,
      filter: source => {
        if (directory === 'speech') return !['sherpa-onnx-whisper-tiny','base-encoder.onnx','base-decoder.onnx'].includes(path.basename(source));
        if (directory !== 'worker') return true;
        const parts = path.relative(path.join(root, directory), source).split(path.sep);
        // Keep the frozen executable/models, excluding source build trees and C++ headers.
        return !['build', 'dist'].includes(parts[0]) && !parts.includes('__pycache__') &&
          !(parts[0] === 'runtime' && parts.includes('include'));
      } });
  }
  fs.mkdirSync(path.join(stage, 'desktop'), { recursive: true });
  fs.copyFileSync('desktop/backend.cjs', path.join(stage, 'desktop/backend.cjs'));
  fs.mkdirSync(path.join(stage, 'runtime'), { recursive: true });
  fs.copyFileSync(process.execPath, path.join(stage, 'runtime/node.exe'));
  fs.copyFileSync('package.json', path.join(stage, 'package.json'));
  fs.copyFileSync('package-lock.json', path.join(stage, 'package-lock.json'));
  // Install only production Node modules, then build/download the SQLite addon for this Node ABI.
  run(process.execPath, [process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage });
  run(process.execPath, [process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    'rebuild', 'better-sqlite3'], { cwd: stage });
  fs.copyFileSync('.tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe', path.join(stage, 'runtime/WebView2Installer.exe'));
  const version = require('../package.json').version;
  fs.writeFileSync(path.join(stage, 'runtime/manifest.json'), JSON.stringify({ node: process.version, architecture: 'x64',
    webview2InstallerSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync('.tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe')).digest('hex') }, null, 2));
  run(process.env.MAKENSIS || path.join(root, '.tools/nsis/Bin/makensis.exe'), [`/DAPP_VERSION=${version}`, 'scripts/webview2-installer.nsi']);
  console.log(`Offline installer: release/Alshereqi-Exams-WebView2-${version}-Setup.exe`);
})().catch(error => { console.error(error.message); process.exit(1); });
