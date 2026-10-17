const { spawnSync } = require('node:child_process');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'tests/math-live.ts', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  },
);
process.exit(result.status ?? 1);
