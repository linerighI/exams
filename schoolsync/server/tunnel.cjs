/**
 * Automatic HTTPS Cloud Tunnel manager for SchoolSync (`cloudflared` or `ngrok`).
 * Exposes a local PC SchoolSync server securely to phones, WebView2 clients, and browsers.
 */
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const MAX_LOG_LINES = 250;
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.(?:trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|ngrok\.io)/i;

let activeTunnelUrl = '';
let activeTunnelChild = null;
let activeProvider = 'cloudflared';
let activePort = 4320;
let activeStartedAt = null;
let lastTunnelError = '';
let manualStop = false;
let restartTimer = null;
let lastStartOptions = null;
let signalHooksInstalled = false;
const tunnelLogs = [];
const listeners = new Set();

function emitEvent(type, payload) {
  for (const listener of listeners) {
    try {
      listener({ type, payload });
    } catch {}
  }
}

function appendLog(level, message, source = 'tunnel') {
  const text = String(message || '').trim();
  if (!text) return;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const entry = {
      ts: new Date().toISOString(),
      source,
      level,
      message: clean,
    };
    tunnelLogs.push(entry);
    if (tunnelLogs.length > MAX_LOG_LINES) tunnelLogs.shift();
    emitEvent('log', entry);
  }
}

/** Subscribe to live tunnel status and log events. Returns an unsubscribe function. */
function subscribeTunnel(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Return the active HTTPS public tunnel URL if a cloud tunnel is running. */
function getActiveTunnelUrl() {
  return activeTunnelUrl;
}

/** Return rolling tunnel log entries (oldest to newest). */
function getTunnelLogs(limit = MAX_LOG_LINES) {
  if (!limit || limit >= tunnelLogs.length) return tunnelLogs.slice();
  return tunnelLogs.slice(-limit);
}

/** Clear buffered tunnel log entries. */
function clearTunnelLogs() {
  tunnelLogs.length = 0;
}

/** Search PATH and known Windows install paths for a tunnel binary. */
function findTunnelExecutable(provider = 'cloudflared') {
  if (provider === 'ngrok') {
    const custom = process.env.NGROK_PATH;
    if (custom && existsSync(custom)) return custom;
    return findInPath('ngrok') || 'ngrok';
  }
  const candidates = [
    process.env.CLOUDFLARED_PATH,
    path.resolve(__dirname, '../../runtime/cloudflared.exe'),
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe')
      : '',
    findInPath('cloudflared'),
    'cloudflared',
  ].filter(Boolean);
  for (const item of candidates) {
    if (item === 'cloudflared' || existsSync(item)) return item;
  }
  return 'cloudflared';
}

function findInPath(exeName) {
  const pathEnv = process.env.PATH || '';
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${exeName}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return '';
}

/** Check whether the configured tunnel executable exists on disk or in PATH. */
function isTunnelBinaryAvailable(provider = 'cloudflared') {
  const bin = findTunnelExecutable(provider);
  if (bin === provider) return Boolean(findInPath(provider));
  return existsSync(bin);
}

/** Return full live status snapshot for the Server Console. */
function getTunnelStatus() {
  const binaryPath = findTunnelExecutable(activeProvider);
  return {
    running: Boolean(activeTunnelChild && !activeTunnelChild.killed && activeTunnelChild.exitCode === null),
    pid: activeTunnelChild?.pid || null,
    provider: activeProvider,
    port: activePort,
    url: activeTunnelUrl || null,
    startedAt: activeStartedAt,
    binaryFound: isTunnelBinaryAvailable(activeProvider),
    binaryPath,
    lastError: lastTunnelError || null,
  };
}

/** Print a clear box in the server terminal displaying local and public cloud URLs. */
function printTunnelBanner(port, url, provider) {
  console.log('\n============================================================');
  console.log(`SchoolSync Cloud Server Ready (${provider})`);
  console.log(`Local PC URL : http://127.0.0.1:${port}`);
  console.log(`Cloud URL    : ${url}`);
  console.log('Open SchoolSync on any phone or client app to connect.');
  console.log('============================================================\n');
}

function installSignalHooks() {
  if (signalHooksInstalled) return;
  signalHooksInstalled = true;
  const stop = () => {
    manualStop = true;
    clearTimeout(restartTimer);
    try {
      if (activeTunnelChild && !activeTunnelChild.killed) activeTunnelChild.kill();
    } catch {}
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

/** Stop any running tunnel process cleanly and cancel pending auto-restarts. */
function stopTunnel() {
  manualStop = true;
  clearTimeout(restartTimer);
  restartTimer = null;
  const child = activeTunnelChild;
  activeTunnelUrl = '';
  activeStartedAt = null;
  if (!child || child.killed || child.exitCode !== null) {
    activeTunnelChild = null;
    emitEvent('status', getTunnelStatus());
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (activeTunnelChild === child) activeTunnelChild = null;
      appendLog('info', 'تم إيقاف النفق السحابي');
      emitEvent('status', getTunnelStatus());
      resolve(true);
    };
    child.once('exit', done);
    try {
      child.kill();
    } catch {
      done();
    }
    setTimeout(() => {
      try {
        if (child.exitCode === null) child.kill('SIGKILL');
      } catch {}
      done();
    }, 2500);
  });
}

/** Start a background `cloudflared` or `ngrok` HTTP tunnel pointing at `127.0.0.1:port`. */
function startTunnel(options = {}) {
  const {
    port = 4320,
    provider = 'cloudflared',
    dataDir = process.env.SCHOOLSYNC_DATA_DIR || path.join(__dirname, '../.data'),
    onUrl,
    autoRestart = false,
    silentBanner = false,
  } = options;

  clearTimeout(restartTimer);
  restartTimer = null;
  manualStop = false;
  lastStartOptions = options;
  activeProvider = provider === 'ngrok' ? 'ngrok' : 'cloudflared';
  activePort = port;
  activeTunnelUrl = '';
  lastTunnelError = '';

  if (activeTunnelChild && !activeTunnelChild.killed && activeTunnelChild.exitCode === null) {
    try {
      activeTunnelChild.kill();
    } catch {}
    activeTunnelChild = null;
  }

  const bin = findTunnelExecutable(activeProvider);
  if (!isTunnelBinaryAvailable(activeProvider)) {
    const msg = `${activeProvider} غير مثبت على الجهاز (${bin})`;
    lastTunnelError = msg;
    appendLog('warn', msg);
    emitEvent('status', getTunnelStatus());
    return null;
  }

  const args =
    activeProvider === 'ngrok'
      ? ['http', String(port), '--log=stdout']
      : ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'];

  let child;
  try {
    child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (err) {
    lastTunnelError = err.message;
    console.warn(`[tunnel] Failed to start ${activeProvider}: ${err.message}`);
    appendLog('error', `تعذر تشغيل ${activeProvider}: ${err.message}`);
    emitEvent('status', getTunnelStatus());
    return null;
  }

  activeTunnelChild = child;
  activeStartedAt = new Date().toISOString();
  installSignalHooks();
  appendLog('info', `بدء تشغيل نفق ${activeProvider} للمنفذ ${port}`);
  emitEvent('status', getTunnelStatus());

  const inspectChunk = (chunk, streamLevel = 'info') => {
    const text = chunk.toString('utf8');
    const match = text.match(TUNNEL_URL_PATTERN);
    if (match && match[0] && match[0] !== activeTunnelUrl) {
      activeTunnelUrl = match[0];
      lastTunnelError = '';
      try {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(path.join(dataDir, 'tunnel-url.txt'), `${activeTunnelUrl}\n`, 'utf8');
      } catch {}
      if (!silentBanner) printTunnelBanner(port, activeTunnelUrl, activeProvider);
      appendLog('info', `تم إنشاء رابط النفق: ${activeTunnelUrl}`);
      emitEvent('status', getTunnelStatus());
      if (typeof onUrl === 'function') {
        Promise.resolve(onUrl(activeTunnelUrl)).catch((err) => {
          appendLog('warn', `فشل رد نداء النفق: ${err?.message || err}`);
        });
      }
    }
    if (/ERR_NGROK|failed to start|authentication failed|ERR\s+/i.test(text)) {
      appendLog('warn', text);
    } else if (streamLevel === 'stderr' && /Registered tunnel connection|Your quick Tunnel/i.test(text)) {
      appendLog('info', text);
    }
  };

  child.stdout?.on('data', (chunk) => inspectChunk(chunk, 'info'));
  child.stderr?.on('data', (chunk) => inspectChunk(chunk, 'stderr'));
  child.on('error', (err) => {
    lastTunnelError = err.message;
    console.warn(`[tunnel] ${activeProvider} error: ${err.message}`);
    appendLog('error', `${activeProvider} error: ${err.message}`);
    emitEvent('status', getTunnelStatus());
  });
  child.on('exit', (code) => {
    const wasCurrent = activeTunnelChild === child;
    if (wasCurrent) {
      activeTunnelChild = null;
      activeTunnelUrl = '';
      activeStartedAt = null;
    }
    if (code && code !== 0 && !manualStop) {
      lastTunnelError = `${activeProvider} exited with code ${code}`;
      console.warn(`[tunnel] ${activeProvider} exited with code ${code}`);
      appendLog('warn', `${activeProvider} توقف برمز خروج ${code}`);
    }
    emitEvent('status', getTunnelStatus());
    if (wasCurrent && autoRestart && !manualStop && lastStartOptions) {
      appendLog('info', 'سيتم إعادة تشغيل النفق السحابي تلقائياً خلال 5 ثوانٍ...');
      restartTimer = setTimeout(() => {
        if (!manualStop) startTunnel(lastStartOptions);
      }, 5000);
    }
  });

  return child;
}

/** Stop any active tunnel and start a fresh tunnel (generating a new quick-tunnel URL). */
async function restartTunnel(options) {
  const nextOptions = options || lastStartOptions || {};
  await stopTunnel();
  return startTunnel(nextOptions);
}

module.exports = {
  getActiveTunnelUrl,
  findTunnelExecutable,
  isTunnelBinaryAvailable,
  getTunnelStatus,
  getTunnelLogs,
  clearTunnelLogs,
  subscribeTunnel,
  startTunnel,
  stopTunnel,
  restartTunnel,
};
