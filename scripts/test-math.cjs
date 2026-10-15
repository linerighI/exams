const { spawnSync } = require('node:child_process');
const result = spawnSync(
  require('electron'),
  ['--import', 'tsx', 'tests/math-live.ts', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  },
);
process.exit(result.status ?? 1);
