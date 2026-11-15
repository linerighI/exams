/**
 * Automatic HTTPS Cloud Tunnel manager for SchoolSync (`cloudflared` or `ngrok`).
 * Exposes a local PC SchoolSync server securely to phones on any mobile or Wi-Fi network.
 */
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

let activeTunnelUrl = '';
let activeTunnelChild = null;

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.(?:trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|ngrok\.io)/i;

/** Return the active HTTPS public tunnel URL if a cloud tunnel is running. */
function getActiveTunnelUrl() {
  return activeTunnelUrl;
}

/** Resolve the full binary path for `cloudflared` or `ngrok` on Windows or Unix. */
function findTunnelExecutable(provider = 'cloudflared') {
  if (provider === 'ngrok') return 'ngrok';
  const candidates = [
    process.env.CLOUDFLARED_PATH,
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    'cloudflared',
  ].filter(Boolean);
  for (const item of candidates) {
    if (item === 'cloudflared' || existsSync(item)) return item;
  }
  return 'cloudflared';
}

/** Print a clear box in the server terminal displaying local and public cloud URLs. */
function printTunnelBanner(port, url, provider) {
  console.log('\n============================================================');
  console.log(`SchoolSync Cloud Server Ready (${provider})`);
  console.log(`Local PC URL : http://127.0.0.1:${port}`);
  console.log(`Cloud URL    : ${url}`);
  console.log('Open SchoolSync on any phone, tap the Orb, and paste Cloud URL.');
  console.log('============================================================\n');
}

/** Start a background `cloudflared` or `ngrok` HTTP tunnel pointing at `127.0.0.1:port`. */
function startTunnel({
  port = 4320,
  provider = 'cloudflared',
  dataDir = path.join(__dirname, '../.data'),
} = {}) {
  const bin = findTunnelExecutable(provider);
  const args =
    provider === 'ngrok'
      ? ['http', String(port), '--log=stdout']
      : ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'];

  let child;
  try {
    child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (err) {
    console.warn(`[tunnel] Failed to start ${provider}: ${err.message}`);
    return null;
  }

  activeTunnelChild = child;

  const inspectChunk = (chunk) => {
    const text = chunk.toString('utf8');
    const match = text.match(TUNNEL_URL_PATTERN);
    if (match && match[0] && match[0] !== activeTunnelUrl) {
      activeTunnelUrl = match[0];
      try {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(path.join(dataDir, 'tunnel-url.txt'), `${activeTunnelUrl}\n`, 'utf8');
      } catch {}
      printTunnelBanner(port, activeTunnelUrl, provider);
    }
    if (/ERR_NGROK|failed to start|authentication failed/i.test(text)) {
      console.warn(`[tunnel] ${text.trim()}`);
    }
  };

  child.stdout?.on('data', inspectChunk);
  child.stderr?.on('data', inspectChunk);
  child.on('error', (err) => {
    console.warn(`[tunnel] ${provider} error: ${err.message}`);
  });
  child.on('exit', (code) => {
    if (activeTunnelChild === child) activeTunnelChild = null;
    if (code && code !== 0) {
      console.warn(`[tunnel] ${provider} exited with code ${code}`);
    }
  });

  const stop = () => {
    try {
      if (activeTunnelChild && !activeTunnelChild.killed) activeTunnelChild.kill();
    } catch {}
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return child;
}

module.exports = { getActiveTunnelUrl, findTunnelExecutable, startTunnel };
