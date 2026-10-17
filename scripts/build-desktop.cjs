const { dotnet, run, nodeScript } = require('./desktop-tools.cjs');
try {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Use Node.js 24 to build the desktop app.');
  // Fail clearly on an Electron-ABI addon left over from an older install.
  const Database = require('better-sqlite3');
  new Database(':memory:').close();
  require('./setup-speech.cjs').check();
  nodeScript('scripts/create-icon.cjs');
  nodeScript('node_modules/typescript/bin/tsc', ['--noEmit']);
  nodeScript('node_modules/vite/bin/vite.js', ['build']);
  require('esbuild').buildSync({ entryPoints: ['desktop/backend.ts'], bundle: true, platform: 'node',
    format: 'cjs', packages: 'external', outfile: 'desktop/backend.cjs',
    define: { 'import.meta.url': '__backendModuleUrl' },
    banner: { js: 'const __backendModuleUrl = require("node:url").pathToFileURL(__filename).href;' } });
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/close-desktop.ps1']);
  run(dotnet(), ['build', 'desktop/native/Alshereqi.Desktop.csproj', '-c', 'Debug', '-o', 'desktop/native/bin/dev']);
} catch (error) {
  console.error(error.message);
  if (/NODE_MODULE_VERSION|bindings|compiled/.test(error.message)) console.error('Run npm rebuild better-sqlite3 to replace the old Electron SQLite binary.');
  process.exit(1);
}
