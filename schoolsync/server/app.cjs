/**
 * SchoolSync HTTP & WebSocket server entrypoint: mounts authentication, school
 * administration, timetable lessons, people management, academics, and classroom routes.
 */
const Fastify = require('fastify');
const Database = require('better-sqlite3');
const { readFileSync, mkdirSync, existsSync, statSync } = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const {
  hash,
  digest,
  day,
  fail,
  migrate,
  syncAssignmentsFromExistingRows,
  resolveIdPepper,
  createHmac,
  normalizeNationalId,
} = require('./db.cjs');
const { seed } = require('./seed-demo.cjs');
const { createContext, buildState } = require('./state.cjs');
const { registerAuthRoutes } = require('./routes-auth.cjs');
const { registerSchoolRoutes } = require('./routes-school.cjs');
const { registerLessonRoutes } = require('./routes-lessons.cjs');
const { registerPeopleRoutes } = require('./routes-people.cjs');
const { registerAcademicRoutes } = require('./routes-academics.cjs');
const { registerClassroomRoutes } = require('./routes-classroom.cjs');
const { registerDatabaseRoutes } = require('./routes-database.cjs');

function createApp({
  database = ':memory:',
  demo = false,
  logger = false,
  allowSetup = false,
  clock = () => new Date(),
} = {}) {
  const app = Fastify({ logger, bodyLimit: 65536, trustProxy: ['127.0.0.1', '::1'] });
  const CAPACITOR_ORIGINS = new Set([
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'http://127.0.0.1:5180',
    'http://localhost:5180',
  ]);
  app.register(require('@fastify/websocket'));
  const db = new Database(database);
  db.pragma('journal_mode = WAL');
  db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrate(db);

  if (demo) {
    seed(db);
    require('./demo-arabic.cjs')(db);
    syncAssignmentsFromExistingRows(db);
  }

  const idPepper = resolveIdPepper(database, demo);
  const nationalHash = (value) => {
    if (!idPepper) fail('يرجى إعداد مفتاح هويات العائلة على الخادم أولاً', 503);
    return createHmac('sha256', idPepper).update(normalizeNationalId(value)).digest('hex');
  };

  if (demo) {
    const { provisionStudentAccount } = require('./school-helpers.cjs');
    for (const [studentId, nationalId, code] of [
      ['alex', '0000000001', 'YousefDemo2026'],
      ['jamie', '0000000002', 'OmarDemo2026'],
    ])
      if (!db.prepare('SELECT 1 FROM family_credentials WHERE student_id=?').get(studentId))
        db.prepare(
          'INSERT INTO family_credentials(student_id,school_id,guardian_id,national_id_hash,code_hash) VALUES(?,?,?,?,?)',
        ).run(studentId, 'school-demo', 'parent-demo', nationalHash(nationalId), hash(code));
    const unifiedDemoStudent = db.prepare("SELECT * FROM students WHERE id='demo-student-1'").get();
    if (unifiedDemoStudent && !unifiedDemoStudent.national_id_hash) {
      provisionStudentAccount({
        db,
        schoolId: 'school-demo',
        studentRow: unifiedDemoStudent,
        nationalId: '0000000003',
        nationalHash,
      });
    }
  }

  const ctx = { ...createContext(db, clock), db };
  const liveClients = new Map();

  app.addHook('onResponse', async (req, reply) => {
    if (req.method === 'POST' && reply.statusCode < 300 && req.user) {
      for (const [socket, info] of liveClients) {
        if (info.expires < Date.now()) {
          socket.close();
          continue;
        }
        if (info.school === req.user.school_id && socket.readyState === 1)
          socket.send('{"changed":true}');
      }
    }
  });

  app.register(async function (routes) {
    routes.get('/api/live', { websocket: true }, (socket, req) => {
      liveClients.set(socket, { school: req.user.school_id, expires: Date.now() + 3600000 });
      socket.on('close', () => liveClients.delete(socket));
      socket.on('error', () => liveClients.delete(socket));
    });
  });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin');
    if (!req.url.startsWith('/api/')) return;
    const origin = req.headers.origin;
    const isBearerClient = req.headers['x-schoolsync-client'] === 'capacitor' && !req.headers.cookie;
    const isNativeOrigin = origin ? CAPACITOR_ORIGINS.has(origin) || (isBearerClient && /^https?:\/\//i.test(origin)) : false;
    if (isNativeOrigin) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SchoolSync-Client, ngrok-skip-browser-warning')
        .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') return reply.code(204).send();
    }
    const routePath = req.url.split('?')[0];
    if ((!['GET', 'HEAD'].includes(req.method) || routePath === '/api/live') && origin && !isNativeOrigin) {
      let host;
      try {
        host = new URL(origin).host;
      } catch {
        fail('Invalid origin');
      }
      if (host !== req.headers.host) fail('Cross-origin request denied');
    }
    if (['/api/login', '/api/family-login', '/api/config', '/api/setup'].includes(routePath)) return;
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
    const queryToken = ['/api/live', '/api/notifications/stream'].includes(routePath) ? String(req.query?.token || '') : '';
    const cookieToken = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    const token = bearer || queryToken || cookieToken;
    const u =
      token &&
      ctx.one(
        'SELECT u.id,u.school_id,u.name,u.email,u.role,u.section FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',
        digest(token),
        Date.now(),
      );
    if (!u) fail('Please sign in to continue', 401);
    req.user = u;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof z.ZodError)
      return reply.code(400).send({ error: err.issues.map((i) => i.message).join('. ') });
    const code = err.statusCode || 500;
    if (code >= 500) req.log.error(err);
    reply.code(code).send({ error: code >= 500 ? 'Unable to save. Please try again.' : err.message });
  });

  registerAuthRoutes(app, ctx, { allowSetup, demo, nationalHash });
  app.get('/api/state', async (req) => buildState(ctx, req.user, req.query.student, demo));
  registerSchoolRoutes(app, ctx);
  registerLessonRoutes(app, ctx);
  registerPeopleRoutes(app, ctx, { nationalHash });
  registerAcademicRoutes(app, ctx);
  registerClassroomRoutes(app, ctx);
  registerDatabaseRoutes(app, ctx, { nationalHash });

  const dist = path.resolve(__dirname, '../dist');
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
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
    let file = path.resolve(dist, '.' + pathname);
    if (file !== dist && !file.startsWith(dist + path.sep))
      return reply.code(403).send({ error: 'Access denied' });
    if (!existsSync(file) || !statSync(file).isFile()) file = path.join(dist, 'index.html');
    if (!existsSync(file))
      return reply.code(503).send({ error: 'Run npm run schoolsync:build first' });
    return reply.type(mime[path.extname(file)] || 'application/octet-stream').send(readFileSync(file));
  });

  app.addHook('onClose', async () => db.close());
  return { app, db };
}

module.exports = { createApp, seed, day, hash };

if (require.main === module) {
  mkdirSync(path.join(__dirname, '../.data'), { recursive: true });
  const { app } = createApp({
    database:
      process.env.SCHOOLSYNC_DB ||
      path.join(
        __dirname,
        process.argv.includes('--demo') ? '../.data/schoolsync.sqlite' : '../.data/schoolsync-live.sqlite',
      ),
    demo: process.argv.includes('--demo'),
    logger: true,
    allowSetup: process.argv.includes('--setup') || process.env.SCHOOLSYNC_ALLOW_SETUP === '1',
  });
  const cloudMode = process.argv.includes('--cloud') || process.argv.includes('--tunnel') || process.argv.includes('--ngrok');
  const listenPort = Number(process.env.SCHOOLSYNC_PORT || 4320);
  const listenHost = process.env.SCHOOLSYNC_HOST || (process.argv.includes('--lan') || cloudMode ? '0.0.0.0' : '127.0.0.1');
  app
    .listen({
      port: listenPort,
      host: listenHost,
    })
    .then(() => {
      if (cloudMode) {
        const { startTunnel } = require('./tunnel.cjs');
        startTunnel({
          port: listenPort,
          provider: process.argv.includes('--ngrok') ? 'ngrok' : 'cloudflared',
        });
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
