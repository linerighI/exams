const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['--import', 'tsx', 'server/dev.ts'], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
process.on('SIGINT',()=>child.kill());
process.on('SIGTERM',()=>child.kill());
