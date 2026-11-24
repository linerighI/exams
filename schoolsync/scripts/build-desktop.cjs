/**
 * Builds both SchoolSync webapps (`dist` & `dist-console`) and compiles the two
 * native Windows WebView2 Desktop hosts (`SchoolSync Server.exe` & `SchoolSync Client.exe`).
 */
const fs = require('node:fs');
const path = require('node:path');
const { root, dotnet, run, nodeScript } = require('../../scripts/desktop-tools.cjs');

try {
  nodeScript('node_modules/typescript/bin/tsc', ['-p', 'schoolsync/tsconfig.json']);
  nodeScript('node_modules/vite/bin/vite.js', ['build', '--config', 'schoolsync/vite.config.ts']);
  nodeScript('node_modules/vite/bin/vite.js', ['build', '--config', 'schoolsync/vite.console.config.ts']);

  const dotnetBin = dotnet();
  const serverOut = path.join(root, 'schoolsync/desktop/bin/server');
  const clientOut = path.join(root, 'schoolsync/desktop/bin/client');

  run(dotnetBin, [
    'build',
    'schoolsync/desktop/server-app/SchoolSync.Server.csproj',
    '-c',
    'Release',
    '-o',
    serverOut,
  ]);
  run(dotnetBin, [
    'build',
    'schoolsync/desktop/client-app/SchoolSync.Client.csproj',
    '-c',
    'Release',
    '-o',
    clientOut,
  ]);

  const clientDistDest = path.join(clientOut, 'dist');
  fs.rmSync(clientDistDest, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'schoolsync/dist'), clientDistDest, { recursive: true });

  console.log('\nSchoolSync WebView2 Desktop apps built:');
  console.log('  1) Server Console : schoolsync/desktop/bin/server/SchoolSync Server.exe');
  console.log('  2) Client App     : schoolsync/desktop/bin/client/SchoolSync Client.exe');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
