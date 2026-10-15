const { spawn } = require('node:child_process');
const child = spawn(require('electron'), ['--import', 'tsx', 'server/dev.ts'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
process.on('SIGINT',()=>child.kill());
process.on('SIGTERM',()=>child.kill());
