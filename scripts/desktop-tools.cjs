const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function dotnet() {
  const local = path.join(root, '.tools', 'dotnet', 'dotnet.exe');
  if (fs.existsSync(local)) return local;
  const found = spawnSync('dotnet', ['--list-sdks'], { encoding: 'utf8' });
  if (found.status !== 0 || !/^10\./m.test(found.stdout || ''))
    throw Error('Install the .NET 10 SDK, or run npm run desktop:setup first.');
  return 'dotnet';
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', ...options.env }, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${path.basename(command)} failed (${result.status})`);
}
function nodeScript(script, args = []) { run(process.execPath, [script, ...args]); }
module.exports = { root, dotnet, run, nodeScript };
