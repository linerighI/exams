/**
 * Stages both self-contained Windows WebView2 SchoolSync apps (`Server` & `Client`)
 * and compiles standalone NSIS executable installers under `release/`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { root, dotnet, run, nodeScript } = require('../../scripts/desktop-tools.cjs');
const { findTunnelExecutable } = require('../server/tunnel.cjs');

function readInstalledVersion(pkgName) {
  const pkgPath = path.join(root, 'node_modules', pkgName, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

try {
  const makensis = path.join(root, '.tools/nsis/Bin/makensis.exe');
  const webview2Installer = path.join(root, '.tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe');
  if (!fs.existsSync(makensis) || !fs.existsSync(webview2Installer)) {
    console.log('Preparing NSIS compiler and offline WebView2 Runtime...');
    run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'scripts/prepare-distribution.ps1',
    ]);
  }

  // Ensure both web bundles are fresh.
  nodeScript('node_modules/typescript/bin/tsc', ['-p', 'schoolsync/tsconfig.json']);
  nodeScript('node_modules/vite/bin/vite.js', ['build', '--config', 'schoolsync/vite.config.ts']);
  nodeScript('node_modules/vite/bin/vite.js', ['build', '--config', 'schoolsync/vite.console.config.ts']);

  const dotnetBin = dotnet();
  const releaseDir = path.join(root, 'release');
  const serverStage = path.join(releaseDir, 'schoolsync-server-unpacked');
  const clientStage = path.join(releaseDir, 'schoolsync-client-unpacked');

  fs.rmSync(serverStage, { recursive: true, force: true });
  fs.rmSync(clientStage, { recursive: true, force: true });
  fs.mkdirSync(serverStage, { recursive: true });
  fs.mkdirSync(clientStage, { recursive: true });

  // 1) Publish App #1: SchoolSync Server Console WebView2 Host
  run(dotnetBin, [
    'publish',
    'schoolsync/desktop/server-app/SchoolSync.Server.csproj',
    '-c',
    'Release',
    '-r',
    'win-x64',
    '--self-contained',
    'true',
    '-o',
    serverStage,
  ]);

  const stagedSchoolSync = path.join(serverStage, 'schoolsync');
  fs.mkdirSync(stagedSchoolSync, { recursive: true });
  for (const dirName of ['server', 'dist', 'dist-console']) {
    fs.cpSync(path.join(root, 'schoolsync', dirName), path.join(stagedSchoolSync, dirName), {
      recursive: true,
    });
  }
  for (const fileName of ['database.js', 'alshereqi-school-database.json', 'tunnel-url.txt']) {
    fs.copyFileSync(
      path.join(root, 'schoolsync', fileName),
      path.join(stagedSchoolSync, fileName),
    );
  }

  const serverRuntime = path.join(serverStage, 'runtime');
  fs.mkdirSync(serverRuntime, { recursive: true });
  fs.copyFileSync(process.execPath, path.join(serverRuntime, 'node.exe'));
  fs.copyFileSync(webview2Installer, path.join(serverRuntime, 'WebView2Installer.exe'));

  const cloudflaredPath = findTunnelExecutable('cloudflared');
  if (!cloudflaredPath || !fs.existsSync(cloudflaredPath)) {
    throw Error(`cloudflared.exe not found (${cloudflaredPath}). Install Cloudflare.cloudflared first.`);
  }
  fs.copyFileSync(cloudflaredPath, path.join(serverRuntime, 'cloudflared.exe'));

  const runtimeDeps = {
    fastify: readInstalledVersion('fastify'),
    '@fastify/websocket': readInstalledVersion('@fastify/websocket'),
    'better-sqlite3': readInstalledVersion('better-sqlite3'),
    zod: readInstalledVersion('zod'),
  };
  fs.writeFileSync(
    path.join(serverStage, 'package.json'),
    JSON.stringify(
      {
        name: 'schoolsync-server-runtime',
        private: true,
        type: 'module',
        dependencies: runtimeDeps,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  const npmCli =
    process.env.npm_execpath ||
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  run(
    process.execPath,
    [npmCli, 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: serverStage },
  );

  const rootSqliteAddon = path.join(
    root,
    'node_modules/better-sqlite3/build/Release/better_sqlite3.node',
  );
  const stageSqliteRelease = path.join(
    serverStage,
    'node_modules/better-sqlite3/build/Release',
  );
  if (fs.existsSync(rootSqliteAddon)) {
    fs.mkdirSync(stageSqliteRelease, { recursive: true });
    fs.copyFileSync(rootSqliteAddon, path.join(stageSqliteRelease, 'better_sqlite3.node'));
  } else {
    run(process.execPath, [npmCli, 'rebuild', 'better-sqlite3'], { cwd: serverStage });
  }

  run(
    path.join(serverRuntime, 'node.exe'),
    [
      '-e',
      "const req = require('node:module').createRequire(process.cwd() + '/package.json'); req('better-sqlite3'); req('fastify'); req('@fastify/websocket'); req('zod'); console.log('Staged server runtime verified.');",
    ],
    { cwd: serverStage },
  );

  // 2) Publish App #2: SchoolSync Client WebView2 Host
  run(dotnetBin, [
    'publish',
    'schoolsync/desktop/client-app/SchoolSync.Client.csproj',
    '-c',
    'Release',
    '-r',
    'win-x64',
    '--self-contained',
    'true',
    '-o',
    clientStage,
  ]);
  fs.cpSync(path.join(root, 'schoolsync/dist'), path.join(clientStage, 'dist'), {
    recursive: true,
  });
  const clientRuntime = path.join(clientStage, 'runtime');
  fs.mkdirSync(clientRuntime, { recursive: true });
  fs.copyFileSync(webview2Installer, path.join(clientRuntime, 'WebView2Installer.exe'));

  // 3) Compile both NSIS Setup executables
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  run(makensis, [`/DAPP_VERSION=${version}`, 'schoolsync/installer/schoolsync-server.nsi']);
  run(makensis, [`/DAPP_VERSION=${version}`, 'schoolsync/installer/schoolsync-client.nsi']);

  const serverSetup = path.join(releaseDir, `SchoolSync-Server-${version}-Setup.exe`);
  const clientSetup = path.join(releaseDir, `SchoolSync-Client-${version}-Setup.exe`);
  console.log('\nExecutable installers created:');
  console.log(`  1) ${serverSetup} (${formatMb(fs.statSync(serverSetup).size)})`);
  console.log(`  2) ${clientSetup} (${formatMb(fs.statSync(clientSetup).size)})`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
