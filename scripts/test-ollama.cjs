const { spawnSync } = require('node:child_process');
const result = spawnSync(require('electron'), ['--import', 'tsx', 'tests/ollama-live.ts'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
process.exit(result.status ?? 1);
