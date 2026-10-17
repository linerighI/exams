const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['--import', 'tsx', 'tests/ollama-live.ts'], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
