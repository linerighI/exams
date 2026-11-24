/**
 * GitHub & local Git tunnel-URL publisher + persistent Server Console configuration.
 * Publishes active `cloudflared`/`ngrok` URLs to `schoolsync/tunnel-url.txt` so remote
 * WebView2, Capacitor Android, and web clients auto-discover server restarts seamlessly.
 */
const { execFile } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const DEFAULT_DATA_DIR = path.join(__dirname, '../.data');
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '../..');

/** Resolve the writable SchoolSync data directory (`SCHOOLSYNC_DATA_DIR` override or `.data`). */
function resolveDataDir(dataDir) {
  return dataDir || process.env.SCHOOLSYNC_DATA_DIR || DEFAULT_DATA_DIR;
}

const DEFAULT_CONSOLE_CONFIG = {
  githubOwner: 'linerighI',
  githubRepo: 'exams',
  githubBranch: 'master',
  githubFilePath: 'schoolsync/tunnel-url.txt',
  githubToken: '',
  autoSyncToGitHub: true,
  useLocalGitFallback: true,
  driftCheckSeconds: 60,
  autoStartServer: true,
  autoStartTunnel: true,
  tunnelProvider: 'cloudflared',
  serverPort: 4320,
};

/** Extract the first valid `http(s)://...` URL from plain text, ignoring `#` comments. */
function parseTunnelUrlFromText(text) {
  if (!text || typeof text !== 'string') return '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(https?:\/\/[^\s#]+)/i);
    if (match) {
      try {
        const parsed = new URL(match[1]);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.origin + parsed.pathname.replace(/\/+$/, '');
        }
      } catch {
        // Ignore malformed lines and continue scanning.
      }
    }
  }
  return '';
}

function configFilePath(dataDir) {
  return path.join(resolveDataDir(dataDir), 'console-config.json');
}

/** Load persisted Server Console & GitHub sync config merged with defaults. */
function loadConsoleConfig(dataDir) {
  const file = configFilePath(dataDir);
  let stored = {};
  if (existsSync(file)) {
    try {
      stored = JSON.parse(readFileSync(file, 'utf8')) || {};
    } catch {
      stored = {};
    }
  }
  return {
    ...DEFAULT_CONSOLE_CONFIG,
    ...stored,
    githubOwner: String(stored.githubOwner || DEFAULT_CONSOLE_CONFIG.githubOwner).trim(),
    githubRepo: String(stored.githubRepo || DEFAULT_CONSOLE_CONFIG.githubRepo).trim(),
    githubBranch: String(stored.githubBranch || DEFAULT_CONSOLE_CONFIG.githubBranch).trim(),
    githubFilePath: String(stored.githubFilePath || DEFAULT_CONSOLE_CONFIG.githubFilePath)
      .trim()
      .replace(/^\/+/, ''),
    githubToken: typeof stored.githubToken === 'string' ? stored.githubToken.trim() : '',
    autoSyncToGitHub:
      typeof stored.autoSyncToGitHub === 'boolean'
        ? stored.autoSyncToGitHub
        : DEFAULT_CONSOLE_CONFIG.autoSyncToGitHub,
    useLocalGitFallback:
      typeof stored.useLocalGitFallback === 'boolean'
        ? stored.useLocalGitFallback
        : DEFAULT_CONSOLE_CONFIG.useLocalGitFallback,
    driftCheckSeconds: Math.min(
      3600,
      Math.max(10, Number(stored.driftCheckSeconds || DEFAULT_CONSOLE_CONFIG.driftCheckSeconds) || 60),
    ),
    autoStartServer:
      typeof stored.autoStartServer === 'boolean'
        ? stored.autoStartServer
        : DEFAULT_CONSOLE_CONFIG.autoStartServer,
    autoStartTunnel:
      typeof stored.autoStartTunnel === 'boolean'
        ? stored.autoStartTunnel
        : DEFAULT_CONSOLE_CONFIG.autoStartTunnel,
    tunnelProvider: stored.tunnelProvider === 'ngrok' ? 'ngrok' : 'cloudflared',
    serverPort: Math.min(
      65535,
      Math.max(1024, Number(stored.serverPort || DEFAULT_CONSOLE_CONFIG.serverPort) || 4320),
    ),
  };
}

/** Update and persist Server Console configuration safely without leaking or clobbering tokens. */
function saveConsoleConfig(patch = {}, dataDir) {
  const effectiveDataDir = resolveDataDir(dataDir);
  const current = loadConsoleConfig(effectiveDataDir);
  const next = { ...current };

  if (typeof patch.githubOwner === 'string' && patch.githubOwner.trim())
    next.githubOwner = patch.githubOwner.trim();
  if (typeof patch.githubRepo === 'string' && patch.githubRepo.trim())
    next.githubRepo = patch.githubRepo.trim();
  if (typeof patch.githubBranch === 'string' && patch.githubBranch.trim())
    next.githubBranch = patch.githubBranch.trim();
  if (typeof patch.githubFilePath === 'string' && patch.githubFilePath.trim())
    next.githubFilePath = patch.githubFilePath.trim().replace(/^\/+/, '');
  if (patch.clearGithubToken === true) next.githubToken = '';
  else if (typeof patch.githubToken === 'string' && patch.githubToken.trim())
    next.githubToken = patch.githubToken.trim();

  if (typeof patch.autoSyncToGitHub === 'boolean') next.autoSyncToGitHub = patch.autoSyncToGitHub;
  if (typeof patch.useLocalGitFallback === 'boolean')
    next.useLocalGitFallback = patch.useLocalGitFallback;
  if (patch.driftCheckSeconds !== undefined) {
    const val = Number(patch.driftCheckSeconds);
    if (Number.isFinite(val)) next.driftCheckSeconds = Math.min(3600, Math.max(10, Math.round(val)));
  }
  if (typeof patch.autoStartServer === 'boolean') next.autoStartServer = patch.autoStartServer;
  if (typeof patch.autoStartTunnel === 'boolean') next.autoStartTunnel = patch.autoStartTunnel;
  if (patch.tunnelProvider === 'cloudflared' || patch.tunnelProvider === 'ngrok')
    next.tunnelProvider = patch.tunnelProvider;
  if (patch.serverPort !== undefined) {
    const port = Number(patch.serverPort);
    if (Number.isInteger(port) && port >= 1024 && port <= 65535) next.serverPort = port;
  }

  mkdirSync(effectiveDataDir, { recursive: true });
  writeFileSync(configFilePath(effectiveDataDir), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** Resolve effective GitHub PAT from config or environment without exposing it to the UI. */
function resolveGithubToken(cfg) {
  return (
    (cfg?.githubToken || '').trim() ||
    (process.env.SCHOOLSYNC_GITHUB_TOKEN || '').trim() ||
    (process.env.GITHUB_TOKEN || '').trim()
  );
}

/** Return a UI-safe config summary with `githubToken` masked. */
function maskConsoleConfig(cfg) {
  const token = resolveGithubToken(cfg);
  const tokenSource = (cfg?.githubToken || '').trim()
    ? 'config'
    : (process.env.SCHOOLSYNC_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim()
      ? 'env'
      : 'none';
  const preview =
    token.length >= 8 ? `${token.slice(0, 4)}••••${token.slice(-4)}` : token ? '••••••••' : '';
  return {
    githubOwner: cfg.githubOwner,
    githubRepo: cfg.githubRepo,
    githubBranch: cfg.githubBranch,
    githubFilePath: cfg.githubFilePath,
    hasGithubToken: Boolean(token),
    githubTokenPreview: preview,
    tokenSource,
    autoSyncToGitHub: cfg.autoSyncToGitHub,
    useLocalGitFallback: cfg.useLocalGitFallback,
    driftCheckSeconds: cfg.driftCheckSeconds,
    autoStartServer: cfg.autoStartServer,
    autoStartTunnel: cfg.autoStartTunnel,
    tunnelProvider: cfg.tunnelProvider,
    serverPort: cfg.serverPort,
  };
}

function encodeContentsPath(filePath) {
  return String(filePath || '')
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function githubApiHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SchoolSync-Server-Console/1.0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Fetch the currently published tunnel URL from GitHub (`Contents API` with raw CDN fallback). */
async function fetchRemoteTunnelUrl(
  cfg = DEFAULT_CONSOLE_CONFIG,
  { bypassCdn = true, fetchImpl = globalThis.fetch } = {},
) {
  const effective = { ...DEFAULT_CONSOLE_CONFIG, ...cfg };
  const token = resolveGithubToken(effective);
  const encodedPath = encodeContentsPath(effective.githubFilePath);
  const branch = encodeURIComponent(effective.githubBranch);

  if (bypassCdn) {
    try {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(effective.githubOwner)}/${encodeURIComponent(effective.githubRepo)}/contents/${encodedPath}?ref=${branch}`;
      const res = await fetchImpl(apiUrl, { headers: githubApiHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        const rawText =
          typeof data?.content === 'string'
            ? Buffer.from(data.content.replace(/\s+/g, ''), 'base64').toString('utf8')
            : '';
        return {
          ok: true,
          url: parseTunnelUrlFromText(rawText) || null,
          sha: data?.sha || null,
          source: 'github-api',
          rawText,
        };
      }
      if (res.status === 404) {
        return { ok: true, url: null, sha: null, source: 'github-api', rawText: '' };
      }
    } catch {
      // Fall through to raw CDN read.
    }
  }

  try {
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(effective.githubOwner)}/${encodeURIComponent(effective.githubRepo)}/${branch}/${encodedPath}?t=${Date.now()}`;
    const res = await fetchImpl(rawUrl, { cache: 'no-store' });
    if (!res.ok) {
      return {
        ok: false,
        url: null,
        sha: null,
        source: 'github-raw',
        error: `HTTP ${res.status}`,
      };
    }
    const rawText = await res.text();
    return {
      ok: true,
      url: parseTunnelUrlFromText(rawText) || null,
      sha: null,
      source: 'github-raw',
      rawText,
    };
  } catch (err) {
    return {
      ok: false,
      url: null,
      sha: null,
      source: 'error',
      error: err?.message || 'Failed to read remote GitHub file',
    };
  }
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd,
        windowsHide: true,
        timeout: 25000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || err.message || 'git failed').trim();
          reject(Object.assign(new Error(msg), { code: err.code, stdout, stderr }));
          return;
        }
        resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
      },
    );
  });
}

/**
 * Write the active tunnel URL locally and publish it to GitHub (`Contents API` first,
 * falling back to `git commit` + `git push` when inside a configured Git clone).
 */
async function publishTunnelUrl(
  url,
  cfg = DEFAULT_CONSOLE_CONFIG,
  { repoRoot = DEFAULT_REPO_ROOT, dataDir, fetchImpl = globalThis.fetch } = {},
) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(cleanUrl)) {
    return {
      ok: false,
      method: 'validation',
      changed: false,
      url: cleanUrl,
      error: 'رابط النفق غير صالح للنشر',
    };
  }

  const effective = { ...DEFAULT_CONSOLE_CONFIG, ...cfg };
  const effectiveDataDir = resolveDataDir(dataDir);
  const payload = `${cleanUrl}\n`;

  try {
    mkdirSync(effectiveDataDir, { recursive: true });
    writeFileSync(path.join(effectiveDataDir, 'tunnel-url.txt'), payload, 'utf8');
  } catch {}

  const absRoot = path.resolve(repoRoot);
  const absRepoFile = path.resolve(absRoot, effective.githubFilePath);
  const hasGitCheckout = existsSync(path.join(absRoot, '.git'));
  if ((hasGitCheckout || !resolveGithubToken(effective)) && absRepoFile.startsWith(absRoot + path.sep)) {
    try {
      mkdirSync(path.dirname(absRepoFile), { recursive: true });
      writeFileSync(absRepoFile, payload, 'utf8');
    } catch {}
  }

  const token = resolveGithubToken(effective);
  const syncedAt = new Date().toISOString();

  if (token) {
    const encodedPath = encodeContentsPath(effective.githubFilePath);
    const baseApi = `https://api.github.com/repos/${encodeURIComponent(effective.githubOwner)}/${encodeURIComponent(effective.githubRepo)}/contents/${encodedPath}`;
    try {
      let sha;
      const getRes = await fetchImpl(`${baseApi}?ref=${encodeURIComponent(effective.githubBranch)}`, {
        headers: githubApiHeaders(token),
      });
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing?.sha;
        const decoded =
          typeof existing?.content === 'string'
            ? Buffer.from(existing.content.replace(/\s+/g, ''), 'base64').toString('utf8')
            : '';
        if (parseTunnelUrlFromText(decoded) === cleanUrl) {
          return { ok: true, method: 'github-api', changed: false, url: cleanUrl, sha, syncedAt };
        }
      } else if (getRes.status !== 404) {
        const errBody = await getRes.text();
        return {
          ok: false,
          method: 'github-api',
          changed: false,
          url: cleanUrl,
          error: `GitHub GET ${getRes.status}: ${errBody.slice(0, 180)}`,
        };
      }

      const putRes = await fetchImpl(baseApi, {
        method: 'PUT',
        headers: {
          ...githubApiHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'chore(schoolsync): update active cloud tunnel URL',
          content: Buffer.from(payload, 'utf8').toString('base64'),
          branch: effective.githubBranch,
          ...(sha ? { sha } : {}),
        }),
      });
      const putText = await putRes.text();
      if (!putRes.ok) {
        return {
          ok: false,
          method: 'github-api',
          changed: false,
          url: cleanUrl,
          error: `GitHub PUT ${putRes.status}: ${putText.slice(0, 180)}`,
        };
      }
      let putJson = {};
      try {
        putJson = JSON.parse(putText);
      } catch {}
      return {
        ok: true,
        method: 'github-api',
        changed: true,
        url: cleanUrl,
        sha: putJson?.content?.sha || sha || null,
        syncedAt,
      };
    } catch (err) {
      return {
        ok: false,
        method: 'github-api',
        changed: false,
        url: cleanUrl,
        error: err?.message || 'GitHub API sync failed',
      };
    }
  }

  if (effective.useLocalGitFallback && existsSync(path.join(absRoot, '.git'))) {
    const relPath = effective.githubFilePath.replace(/\\/g, '/');
    try {
      await runGit(['add', '--', relPath], absRoot);
      let hasDiff = false;
      try {
        await runGit(['diff', '--cached', '--quiet', '--', relPath], absRoot);
      } catch {
        hasDiff = true;
      }
      if (hasDiff) {
        await runGit(
          ['commit', '--only', '-m', 'chore(schoolsync): update active cloud tunnel URL', '--', relPath],
          absRoot,
        );
      }
      await runGit(['push', 'origin', `HEAD:${effective.githubBranch}`], absRoot);
      return { ok: true, method: 'local-git', changed: hasDiff, url: cleanUrl, syncedAt };
    } catch (err) {
      return {
        ok: false,
        method: 'local-git',
        changed: false,
        url: cleanUrl,
        error: err?.message || 'Git push failed',
      };
    }
  }

  return {
    ok: false,
    method: 'none',
    changed: false,
    url: cleanUrl,
    error: 'أضف رمز GitHub (PAT) في الإعدادات أو فعّل المزامنة عبر Git المحلي لنشر الرابط تلقائياً.',
  };
}

module.exports = {
  DEFAULT_CONSOLE_CONFIG,
  DEFAULT_DATA_DIR,
  DEFAULT_REPO_ROOT,
  resolveDataDir,
  parseTunnelUrlFromText,
  loadConsoleConfig,
  saveConsoleConfig,
  maskConsoleConfig,
  resolveGithubToken,
  fetchRemoteTunnelUrl,
  publishTunnelUrl,
};
