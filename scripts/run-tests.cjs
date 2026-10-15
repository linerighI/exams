const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const files = readdirSync('tests')
  .filter((n) => n.endsWith('.test.ts'))
  .map((n) => 'tests/' + n);
const result = spawnSync(require('electron'), ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
process.exit(result.status ?? 1);
