const { spawnSync } = require('node:child_process');
const { readdirSync, existsSync } = require('node:fs');
const { resolve, delimiter } = require('node:path');
const pythonScripts = resolve('worker/build/venv/Scripts');
const files = readdirSync('tests')
  .filter((n) => n.endsWith('.test.ts'))
  .map((n) => 'tests/' + n);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env, ...(existsSync(resolve(pythonScripts, 'python.exe')) ? { PATH: pythonScripts + delimiter + process.env.PATH } : {}) },
});
process.exit(result.status ?? 1);
