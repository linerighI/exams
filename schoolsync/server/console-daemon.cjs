/**
 * Dedicated loopback-only Server Console Daemon (`127.0.0.1:4325`) for SchoolSync App #1.
 * Manages the SchoolSync HTTP/WS server process, Cloudflare/ngrok tunnel, automatic
 * GitHub tunnel-URL publishing, drift self-healing, database injection, and backups.
 */
const Fastify = require('fastify');
const Database = require('better-sqlite3');
const { spawn } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { networkInterfaces } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { z } = require('zod');
const defaultTunnelCtrl = require('./tunnel.cjs');
const defaultGitSync = require('./git-sync.cjs');
const { exportSchoolSnapshot } = require('./db-snapshot.cjs');
const { fail } = require('./db.cjs');

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MAX_CONSOLE_LOGS = 300;

/** List non-internal IPv4 LAN URLs for the managed SchoolSync server port. */
function collectLanUrls(port) {
  const urls = [`http://127.0.0.1:${port}`];
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry && entry.family === 'IPv4' && !entry.internal && entry.address) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return [...new Set(urls)];
}

/** Read database metadata, school name, record counts, and backup list without locking writes. */
function inspectDatabase(dbPath, backupsDir) {
  const backups = existsSync(backupsDir)
    ? readdirSync(backupsDir)
        .filter((name) => name.endsWith('.sqlite') || name.endsWith('.json'))
        .map((name) => {
          const full = path.join(backupsDir, name);
          const st = statSync(full);
          return { name, sizeBytes: st.size, createdAt: st.mtime.toISOString() };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12)
    : [];

  const empty = {
    path: dbPath,
    exists: false,
    sizeBytes: 0,
    updatedAt: null,
    schoolName: null,
    counts: {
      students: 0,
      teachers: 0,
      classes: 0,
      subjects: 0,
      lessons: 0,
      announcements: 0,
      sessions: 0,
    },
    backups,
  };

  if (!existsSync(dbPath)) return empty;
  const st = statSync(dbPath);
  empty.exists = true;
  empty.sizeBytes = st.size;
  empty.updatedAt = st.mtime.toISOString();

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const count = (sql, ...args) => {
      try {
        return Number(db.prepare(sql).get(...args)?.n || 0);
      } catch {
        return 0;
      }
    };
    let schoolName = null;
    try {
      schoolName = db.prepare('SELECT name FROM schools LIMIT 1').get()?.name || null;
    } catch {}
    empty.schoolName = schoolName;
    empty.counts = {
      students: count('SELECT COUNT(*) n FROM students'),
      teachers: count("SELECT COUNT(*) n FROM users WHERE role='teacher'"),
      classes: count('SELECT COUNT(*) n FROM classes'),
      subjects: count('SELECT COUNT(*) n FROM subjects'),
      lessons: count('SELECT COUNT(*) n FROM lessons'),
      announcements: count('SELECT COUNT(*) n FROM announcements'),
      sessions: count('SELECT COUNT(*) n FROM sessions WHERE expires>?', Date.now()),
    };
  } catch {
    // Database may still be initializing on first boot; return file stats cleanly.
  } finally {
    try {
      db?.close();
    } catch {}
  }
  return empty;
}

/** Build the Fastify Server Console Daemon (`127.0.0.1` only). */
function createConsoleDaemon({
  consolePort = Number(process.env.SCHOOLSYNC_CONSOLE_PORT || 4325),
  dataDir = path.join(__dirname, '../.data'),
  repoRoot = path.resolve(__dirname, '../..'),
  dbPath = process.env.SCHOOLSYNC_DB || path.join(__dirname, '../.data/schoolsync-live.sqlite'),
  distConsoleDir = path.resolve(__dirname, '../dist-console'),
  tunnelCtrl = defaultTunnelCtrl,
  gitSync = defaultGitSync,
  spawnImpl = spawn,
  fetchImpl = globalThis.fetch,
  logger = false,
} = {}) {
  const app = Fastify({ logger, bodyLimit: 1024 * 1024 });
  const backupsDir = path.join(dataDir, 'backups');
  const logs = [];
  const sseClients = new Set();

  let serverChild = null;
  let serverStartedAt = null;
  let serverPort = gitSync.loadConsoleConfig(dataDir).serverPort || 4320;
  let lastServerExitCode = null;
  let driftTimer = null;

  const gitState = {
    syncing: false,
    lastSyncAt: null,
    lastResult: null,
    remoteUrl: null,
    remoteCheckedAt: null,
    error: null,
  };

  function allowedConsoleOrigins() {
    return new Set([
      `http://127.0.0.1:${consolePort}`,
      `http://localhost:${consolePort}`,
      'http://127.0.0.1:5181',
      'http://localhost:5181',
    ]);
  }

  function pushLog(source, level, message) {
    const clean = String(message || '').trim();
    if (!clean) return;
    for (const line of clean.split(/\r?\n/)) {
      const text = line.trim();
      if (!text) continue;
      const entry = {
        ts: new Date().toISOString(),
        source,
        level,
        message: text,
      };
      logs.push(entry);
      if (logs.length > MAX_CONSOLE_LOGS) logs.shift();
      broadcastSse('log', entry);
    }
  }

  function broadcastSse(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function buildStatus() {
    const cfg = gitSync.loadConsoleConfig(dataDir);
    const tunnel = tunnelCtrl.getTunnelStatus();
    const serverRunning = Boolean(serverChild && !serverChild.killed && serverChild.exitCode === null);
    const activeUrl = tunnel.url || null;
    const remoteUrl = gitState.remoteUrl || null;
    return {
      server: {
        running: serverRunning,
        pid: serverChild?.pid || null,
        port: serverPort,
        startedAt: serverStartedAt,
        lastExitCode: lastServerExitCode,
        localUrl: `http://127.0.0.1:${serverPort}`,
        lanUrls: collectLanUrls(serverPort),
      },
      tunnel,
      gitSync: {
        syncing: gitState.syncing,
        lastSyncAt: gitState.lastSyncAt,
        lastResult: gitState.lastResult,
        remoteUrl,
        remoteCheckedAt: gitState.remoteCheckedAt,
        inSync: Boolean(activeUrl && remoteUrl && activeUrl === remoteUrl),
        error: gitState.error,
      },
      config: gitSync.maskConsoleConfig(cfg),
      db: inspectDatabase(dbPath, backupsDir),
      logs: logs.slice(-150),
    };
  }

  function emitStatus() {
    broadcastSse('status', buildStatus());
  }

  const unsubTunnel = tunnelCtrl.subscribeTunnel(({ type, payload }) => {
    if (type === 'log') {
      pushLog('tunnel', payload.level || 'info', payload.message);
    } else if (type === 'status') {
      emitStatus();
    }
  });

  async function syncTunnelUrlToGit(url, { force = false } = {}) {
    const targetUrl = url || tunnelCtrl.getActiveTunnelUrl();
    if (!targetUrl) {
      return { ok: false, method: 'none', error: 'لا يوجد رابط نفق نشط للمزامنة بعد.' };
    }
    const cfg = gitSync.loadConsoleConfig(dataDir);
    if (!force && !cfg.autoSyncToGitHub) {
      return { ok: false, method: 'disabled', error: 'المزامنة التلقائية مع GitHub متوقفة.' };
    }
    if (gitState.syncing) {
      return { ok: false, method: 'busy', error: 'جارٍ تنفيذ مزامنة حالياً.' };
    }
    gitState.syncing = true;
    emitStatus();
    try {
      const res = await gitSync.publishTunnelUrl(targetUrl, cfg, { repoRoot, dataDir, fetchImpl });
      gitState.lastSyncAt = new Date().toISOString();
      gitState.lastResult = res;
      if (res.ok) {
        gitState.remoteUrl = res.url;
        gitState.remoteCheckedAt = gitState.lastSyncAt;
        gitState.error = null;
        pushLog(
          'git',
          'info',
          res.changed
            ? `تم نشر رابط النفق على GitHub (${res.method}): ${res.url}`
            : `رابط النفق متطابق بالفعل على GitHub (${res.method})`,
        );
      } else {
        gitState.error = res.error || 'تعذر النشر على GitHub';
        pushLog('git', 'warn', gitState.error);
      }
      return res;
    } catch (err) {
      gitState.error = err?.message || 'Git sync failed';
      pushLog('git', 'error', gitState.error);
      return { ok: false, method: 'error', error: gitState.error };
    } finally {
      gitState.syncing = false;
      emitStatus();
    }
  }

  async function checkRemoteDrift({ autoRepair = true } = {}) {
    const cfg = gitSync.loadConsoleConfig(dataDir);
    const remote = await gitSync.fetchRemoteTunnelUrl(cfg, { bypassCdn: true, fetchImpl });
    gitState.remoteCheckedAt = new Date().toISOString();
    if (remote.ok) {
      gitState.remoteUrl = remote.url || null;
      gitState.error = null;
    } else {
      gitState.error = remote.error || 'تعذر قراءة الملف من GitHub';
    }
    emitStatus();

    const liveUrl = tunnelCtrl.getActiveTunnelUrl();
    if (autoRepair && cfg.autoSyncToGitHub && liveUrl && remote.ok && remote.url !== liveUrl) {
      pushLog('git', 'info', 'اكتشاف اختلاف بين رابط النفق النشط والملف في GitHub — جارٍ التحديث...');
      await syncTunnelUrlToGit(liveUrl, { force: true });
    }
    return remote;
  }

  function resetDriftTimer() {
    clearInterval(driftTimer);
    const cfg = gitSync.loadConsoleConfig(dataDir);
    const intervalMs = Math.max(15000, Number(cfg.driftCheckSeconds || 60) * 1000);
    driftTimer = setInterval(() => {
      if (tunnelCtrl.getActiveTunnelUrl()) {
        void checkRemoteDrift({ autoRepair: true });
      }
    }, intervalMs);
    driftTimer.unref();
  }

  function startSchoolServer() {
    if (serverChild && !serverChild.killed && serverChild.exitCode === null) {
      return { ok: true, alreadyRunning: true, pid: serverChild.pid };
    }
    const cfg = gitSync.loadConsoleConfig(dataDir);
    serverPort = cfg.serverPort || 4320;
    const appEntry = path.join(__dirname, 'app.cjs');
    const child = spawnImpl(process.execPath, [appEntry, '--lan', '--setup'], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SCHOOLSYNC_PORT: String(serverPort),
        SCHOOLSYNC_DB: dbPath,
      },
    });
    serverChild = child;
    serverStartedAt = new Date().toISOString();
    lastServerExitCode = null;
    pushLog('server', 'info', `تم تشغيل خادم سكول سينك على المنفذ ${serverPort} (PID ${child.pid})`);
    emitStatus();

    child.stdout?.on('data', (chunk) => pushLog('server', 'info', chunk.toString('utf8')));
    child.stderr?.on('data', (chunk) => pushLog('server', 'warn', chunk.toString('utf8')));
    child.on('error', (err) => {
      pushLog('server', 'error', `خطأ في الخادم: ${err.message}`);
      emitStatus();
    });
    child.on('exit', (code) => {
      if (serverChild === child) {
        serverChild = null;
        serverStartedAt = null;
      }
      lastServerExitCode = code;
      pushLog('server', code ? 'warn' : 'info', `توقف خادم سكول سينك (code=${code})`);
      emitStatus();
    });
    return { ok: true, pid: child.pid, port: serverPort };
  }

  function stopSchoolServer() {
    const child = serverChild;
    if (!child || child.killed || child.exitCode !== null) {
      serverChild = null;
      serverStartedAt = null;
      emitStatus();
      return Promise.resolve({ ok: true, alreadyStopped: true });
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (serverChild === child) {
          serverChild = null;
          serverStartedAt = null;
        }
        emitStatus();
        resolve({ ok: true });
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

  function startManagedTunnel() {
    const cfg = gitSync.loadConsoleConfig(dataDir);
    const port = serverPort || cfg.serverPort || 4320;
    const child = tunnelCtrl.startTunnel({
      port,
      provider: cfg.tunnelProvider || 'cloudflared',
      dataDir,
      autoRestart: true,
      silentBanner: true,
      onUrl: (url) => syncTunnelUrlToGit(url),
    });
    emitStatus();
    return { ok: Boolean(child), provider: cfg.tunnelProvider, port };
  }

  async function restartManagedTunnel() {
    const cfg = gitSync.loadConsoleConfig(dataDir);
    const port = serverPort || cfg.serverPort || 4320;
    await tunnelCtrl.restartTunnel({
      port,
      provider: cfg.tunnelProvider || 'cloudflared',
      dataDir,
      autoRestart: true,
      silentBanner: true,
      onUrl: (url) => syncTunnelUrlToGit(url),
    });
    emitStatus();
    return { ok: true };
  }

  async function shutdownAll() {
    clearInterval(driftTimer);
    await tunnelCtrl.stopTunnel();
    await stopSchoolServer();
  }

  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff');

    if (!req.url.startsWith('/api/console')) return;
    if (!LOOPBACK_IPS.has(req.ip)) {
      fail('Console API is restricted to localhost loopback', 403);
    }
    const origin = req.headers.origin;
    if (origin) {
      if (!allowedConsoleOrigins().has(origin)) {
        fail('Cross-origin console request denied', 403);
      }
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Headers', 'Content-Type')
        .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') return reply.code(204).send();
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: err.issues.map((i) => i.message).join('. ') });
    }
    const code = err.statusCode || 500;
    if (code >= 500) req.log.error(err);
    reply.code(code).send({ error: err.message || 'Console error' });
  });

  app.get('/api/console/health', async () => ({
    ok: true,
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
  }));

  app.get('/api/console/status', async () => buildStatus());

  app.get('/api/console/events', async (req, reply) => {
    const headers = {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    };
    if (req.headers.origin && allowedConsoleOrigins().has(req.headers.origin)) {
      headers['Access-Control-Allow-Origin'] = req.headers.origin;
    }
    reply.hijack();
    reply.raw.writeHead(200, headers);
    reply.raw.write(`event: status\ndata: ${JSON.stringify(buildStatus())}\n\n`);
    sseClients.add(reply.raw);
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {}
    }, 20000);
    req.raw.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(reply.raw);
    });
  });

  app.post('/api/console/server/start', async () => startSchoolServer());
  app.post('/api/console/server/stop', async () => stopSchoolServer());
  app.post('/api/console/server/restart', async () => {
    await stopSchoolServer();
    return startSchoolServer();
  });

  app.post('/api/console/tunnel/start', async () => startManagedTunnel());
  app.post('/api/console/tunnel/stop', async () => {
    await tunnelCtrl.stopTunnel();
    emitStatus();
    return { ok: true };
  });
  app.post('/api/console/tunnel/restart', async () => restartManagedTunnel());

  app.post('/api/console/git/sync', async () => syncTunnelUrlToGit(undefined, { force: true }));
  app.post('/api/console/git/check', async () => checkRemoteDrift({ autoRepair: false }));

  app.post('/api/console/config', async (req) => {
    const patch = z
      .object({
        githubOwner: z.string().trim().min(1).max(100).optional(),
        githubRepo: z.string().trim().min(1).max(120).optional(),
        githubBranch: z.string().trim().min(1).max(100).optional(),
        githubFilePath: z.string().trim().min(1).max(200).optional(),
        githubToken: z.string().max(300).optional(),
        clearGithubToken: z.boolean().optional(),
        autoSyncToGitHub: z.boolean().optional(),
        useLocalGitFallback: z.boolean().optional(),
        driftCheckSeconds: z.number().int().min(10).max(3600).optional(),
        autoStartServer: z.boolean().optional(),
        autoStartTunnel: z.boolean().optional(),
        tunnelProvider: z.enum(['cloudflared', 'ngrok']).optional(),
        serverPort: z.number().int().min(1024).max(65535).optional(),
      })
      .parse(req.body || {});

    const updated = gitSync.saveConsoleConfig(patch, dataDir);
    resetDriftTimer();
    pushLog('git', 'info', 'تم حفظ إعدادات لوحة التحكم والمزامنة مع GitHub');
    emitStatus();
    return { ok: true, config: gitSync.maskConsoleConfig(updated) };
  });

  app.post('/api/console/db/inject', async (req) => {
    const { mode } = z.object({ mode: z.enum(['merge', 'replace']).default('merge') }).parse(req.body || {});
    const dbScriptUrl = pathToFileURL(path.join(__dirname, '../database.js')).href;
    const mod = await import(dbScriptUrl);
    const result = mod.injectLocalDatabase({ dbPath, mode });
    pushLog(
      'db',
      'info',
      `تم حقن قاعدة بيانات المدرسة (${mode}): ${result.counts?.students ?? 0} طالب، ${result.counts?.teachers ?? 0} معلم`,
    );
    emitStatus();
    return { ok: true, ...result };
  });

  app.post('/api/console/db/backup', async () => {
    if (!existsSync(dbPath)) fail('ملف قاعدة البيانات غير موجود بعد.', 404);
    mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sqliteFile = `alshereqi-backup-${stamp}.sqlite`;
    const jsonFile = `alshereqi-backup-${stamp}.json`;
    const sqliteDest = path.join(backupsDir, sqliteFile);
    const jsonDest = path.join(backupsDir, jsonFile);

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    let snapshot = null;
    try {
      await db.backup(sqliteDest);
      const school = db.prepare('SELECT id FROM schools LIMIT 1').get();
      if (school) {
        snapshot = exportSchoolSnapshot(
          {
            one: (sql, ...args) => db.prepare(sql).get(...args),
            all: (sql, ...args) => db.prepare(sql).all(...args),
          },
          school.id,
        );
      }
    } finally {
      db.close();
    }
    if (snapshot) writeFileSync(jsonDest, JSON.stringify(snapshot, null, 2), 'utf8');
    pushLog('db', 'info', `تم إنشاء نسخة احتياطية: ${sqliteFile}`);
    emitStatus();
    return { ok: true, sqliteFile, jsonFile: snapshot ? jsonFile : null };
  });

  app.get('/api/console/db/export', async (_req, reply) => {
    if (!existsSync(dbPath)) fail('ملف قاعدة البيانات غير موجود بعد.', 404);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const school = db.prepare('SELECT id FROM schools LIMIT 1').get();
      if (!school) fail('لا توجد بيانات مدرسة للتصدير بعد.', 404);
      const snapshot = exportSchoolSnapshot(
        {
          one: (sql, ...args) => db.prepare(sql).get(...args),
          all: (sql, ...args) => db.prepare(sql).all(...args),
        },
        school.id,
      );
      reply.header('Content-Disposition', 'attachment; filename="alshereqi-snapshot.json"');
      return snapshot;
    } finally {
      db.close();
    }
  });

  app.post('/api/console/logs/clear', async () => {
    logs.length = 0;
    tunnelCtrl.clearTunnelLogs();
    emitStatus();
    return { ok: true };
  });

  app.post('/api/console/shutdown', async () => {
    await shutdownAll();
    return { ok: true };
  });

  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.png': 'image/png',
  };
  app.get('/*', async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Endpoint not found' });
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      return reply.code(400).send({ error: 'Invalid path' });
    }
    if (pathname === '/') pathname = '/server-console.html';
    let file = path.resolve(distConsoleDir, '.' + pathname);
    if (file !== distConsoleDir && !file.startsWith(distConsoleDir + path.sep))
      return reply.code(403).send({ error: 'Access denied' });
    if (!existsSync(file) || !statSync(file).isFile())
      file = path.join(distConsoleDir, 'server-console.html');
    if (!existsSync(file))
      return reply.code(503).send({ error: 'Run npm run schoolsync:console:build first' });
    return reply.type(mime[path.extname(file)] || 'application/octet-stream').send(readFileSync(file));
  });

  resetDriftTimer();
  app.addHook('onClose', async () => {
    unsubTunnel();
    clearInterval(driftTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {}
    }
    sseClients.clear();
  });

  return {
    app,
    startSchoolServer,
    stopSchoolServer,
    startManagedTunnel,
    restartManagedTunnel,
    syncTunnelUrlToGit,
    checkRemoteDrift,
    shutdownAll,
    buildStatus,
  };
}

module.exports = { createConsoleDaemon, collectLanUrls, inspectDatabase };

if (require.main === module) {
  const consolePort = Number(process.env.SCHOOLSYNC_CONSOLE_PORT || 4325);
  const daemon = createConsoleDaemon({ consolePort, logger: true });

  const cleanExit = async () => {
    await daemon.shutdownAll();
    await daemon.app.close();
    process.exit(0);
  };
  process.once('SIGINT', cleanExit);
  process.once('SIGTERM', cleanExit);

  daemon.app
    .listen({ port: consolePort, host: '127.0.0.1' })
    .then(() => {
      console.log(`SchoolSync Server Console listening on http://127.0.0.1:${consolePort}`);
      const autoStartFlag = process.argv.includes('--auto-start');
      const cfg = defaultGitSync.loadConsoleConfig();
      if (autoStartFlag || cfg.autoStartServer) daemon.startSchoolServer();
      if (autoStartFlag || cfg.autoStartTunnel) daemon.startManagedTunnel();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
