const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app.cjs');
const {
  parseTunnelUrlFromText,
  loadConsoleConfig,
  saveConsoleConfig,
  maskConsoleConfig,
  publishTunnelUrl,
  fetchRemoteTunnelUrl,
} = require('../server/git-sync.cjs');
const { createConsoleDaemon } = require('../server/console-daemon.cjs');

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolsync-console-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseTunnelUrlFromText ignores comments, blank lines, and trims trailing slashes', () => {
  const raw = [
    '# Active SchoolSync Cloudflare Tunnel URL',
    '',
    '   # another comment',
    'https://alpha-school-demo.trycloudflare.com/  ',
    'https://second-url.trycloudflare.com',
  ].join('\n');
  assert.equal(parseTunnelUrlFromText(raw), 'https://alpha-school-demo.trycloudflare.com');
  assert.equal(parseTunnelUrlFromText('# no url yet\nnot-a-url\nftp://example.com'), '');
});

test('console config masks GitHub PAT and preserves stored token on blank updates', () => {
  const dataDir = makeTempDir();
  const initial = saveConsoleConfig(
    {
      githubOwner: 'linerighI',
      githubRepo: 'exams',
      githubToken: 'github_pat_secret_123456',
    },
    dataDir,
  );
  assert.equal(initial.githubToken, 'github_pat_secret_123456');

  const masked = maskConsoleConfig(initial);
  assert.equal(masked.hasGithubToken, true);
  assert.equal(masked.githubTokenPreview, 'gith••••3456');
  assert.equal('githubToken' in masked, false);

  const kept = saveConsoleConfig({ githubBranch: 'master', githubToken: '' }, dataDir);
  assert.equal(kept.githubToken, 'github_pat_secret_123456');

  const cleared = saveConsoleConfig({ clearGithubToken: true }, dataDir);
  assert.equal(loadConsoleConfig(dataDir).githubToken, '');
});

test('publishTunnelUrl handles initial PUT, idempotent no-op, and SHA update via mocked GitHub API', async () => {
  const tmp = makeTempDir();
  const dataDir = path.join(tmp, 'data');
  const repoRoot = path.join(tmp, 'repo');
  const cfg = {
    githubOwner: 'linerighI',
    githubRepo: 'exams',
    githubBranch: 'master',
    githubFilePath: 'schoolsync/tunnel-url.txt',
    githubToken: 'ghp_test_token_123456',
    autoSyncToGitHub: true,
    useLocalGitFallback: false,
  };

  let remoteContent = null;
  let remoteSha = null;
  let putCount = 0;

  const mockFetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    assert.ok(String(url).includes('/repos/linerighI/exams/contents/schoolsync/tunnel-url.txt'));
    if (method === 'GET') {
      if (remoteContent === null) {
        return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
      }
      return new Response(
        JSON.stringify({
          sha: remoteSha,
          content: Buffer.from(remoteContent, 'utf8').toString('base64'),
        }),
        { status: 200 },
      );
    }
    if (method === 'PUT') {
      putCount += 1;
      const body = JSON.parse(init.body);
      remoteContent = Buffer.from(body.content, 'base64').toString('utf8');
      remoteSha = `sha-${putCount}`;
      return new Response(JSON.stringify({ content: { sha: remoteSha } }), { status: 200 });
    }
    throw new Error(`Unexpected method ${method}`);
  };

  // 1) Initial PUT when file is 404 on GitHub
  const first = await publishTunnelUrl('https://one.trycloudflare.com/', cfg, {
    repoRoot,
    dataDir,
    fetchImpl: mockFetch,
  });
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.url, 'https://one.trycloudflare.com');
  assert.equal(putCount, 1);
  assert.equal(fs.readFileSync(path.join(repoRoot, 'schoolsync/tunnel-url.txt'), 'utf8'), 'https://one.trycloudflare.com\n');

  // 2) Idempotent no-op when same URL is already published
  const second = await publishTunnelUrl('https://one.trycloudflare.com', cfg, {
    repoRoot,
    dataDir,
    fetchImpl: mockFetch,
  });
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.equal(putCount, 1);

  // 3) Update PUT with SHA when tunnel URL rotates
  const third = await publishTunnelUrl('https://two.trycloudflare.com', cfg, {
    repoRoot,
    dataDir,
    fetchImpl: mockFetch,
  });
  assert.equal(third.ok, true);
  assert.equal(third.changed, true);
  assert.equal(putCount, 2);

  const fetched = await fetchRemoteTunnelUrl(cfg, { bypassCdn: true, fetchImpl: mockFetch });
  assert.equal(fetched.ok, true);
  assert.equal(fetched.url, 'https://two.trycloudflare.com');
});

test('console daemon enforces loopback/origin checks and updates masked config', async () => {
  const tmp = makeTempDir();
  const dataDir = path.join(tmp, 'data');
  const dbPath = path.join(tmp, 'test.sqlite');
  const distConsoleDir = path.join(tmp, 'dist-console');

  const fakeTunnel = {
    getActiveTunnelUrl: () => 'https://live-console.trycloudflare.com',
    getTunnelStatus: () => ({
      running: true,
      pid: 9999,
      provider: 'cloudflared',
      port: 4320,
      url: 'https://live-console.trycloudflare.com',
      startedAt: '2026-11-24T06:00:00Z',
      binaryFound: true,
      binaryPath: 'cloudflared',
      lastError: null,
    }),
    subscribeTunnel: () => () => {},
    startTunnel: () => null,
    stopTunnel: async () => true,
    restartTunnel: async () => null,
    clearTunnelLogs: () => {},
  };

  const { app } = createConsoleDaemon({
    consolePort: 4325,
    dataDir,
    repoRoot: tmp,
    dbPath,
    distConsoleDir,
    tunnelCtrl: fakeTunnel,
  });

  try {
    const health = await app.inject({ method: 'GET', url: '/api/console/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);

    const status = await app.inject({ method: 'GET', url: '/api/console/status' });
    assert.equal(status.statusCode, 200);
    const body = status.json();
    assert.equal(body.tunnel.url, 'https://live-console.trycloudflare.com');
    assert.equal(body.config.githubOwner, 'linerighI');

    const badOrigin = await app.inject({
      method: 'POST',
      url: '/api/console/config',
      headers: { origin: 'https://evil.example' },
      payload: { githubOwner: 'attacker' },
    });
    assert.equal(badOrigin.statusCode, 403);

    const saved = await app.inject({
      method: 'POST',
      url: '/api/console/config',
      headers: { origin: 'http://127.0.0.1:4325' },
      payload: { githubToken: 'github_pat_console_9999', driftCheckSeconds: 45 },
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().config.hasGithubToken, true);
    assert.equal(saved.json().config.driftCheckSeconds, 45);
    assert.equal('githubToken' in saved.json().config, false);
  } finally {
    await app.close();
  }
});

test('app exposes registry metadata on /api/config and supports standalone WebView2/Pages CORS preflight', async () => {
  const { app } = createApp({ demo: true });
  try {
    const cfg = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { origin: 'https://linerighi.github.io' },
    });
    assert.equal(cfg.statusCode, 200);
    assert.equal(cfg.headers['access-control-allow-origin'], 'https://linerighi.github.io');
    const json = cfg.json();
    assert.equal(json.registry.owner, 'linerighI');
    assert.equal(json.registry.repo, 'exams');
    assert.equal(json.registry.filePath, 'schoolsync/tunnel-url.txt');

    for (const origin of ['https://app.schoolsync.invalid', 'https://linerighi.github.io']) {
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/api/login',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type, x-schoolsync-client',
        },
      });
      assert.equal(preflight.statusCode, 204);
      assert.equal(preflight.headers['access-control-allow-origin'], origin);
    }
  } finally {
    await app.close();
  }
});
