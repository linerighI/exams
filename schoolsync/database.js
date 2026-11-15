/**
 * Portable SchoolSync Database Snapshot & Injector (`schoolsync/database.js`).
 * Run `node schoolsync/database.js` on any school PC to create/update the local SQLite
 * database with all classes, subjects, staff, and students, or pass `--url <https://...>`
 * to push the snapshot into a running remote/cloud-tunneled SchoolSync server.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { id, hash, migrate, resolveIdPepper, createHmac, normalizeNationalId } = require('./server/db.cjs');
const { createContext } = require('./server/state.cjs');
const { importSchoolSnapshot } = require('./server/db-injector.cjs');
const { syncClassSortOrders } = require('./server/school-helpers.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_FILE = path.join(__dirname, 'alshereqi-school-database.json');

/** Full exported school database snapshot (`مدرسة محمد الشريقي`). */
export const DATABASE_SNAPSHOT = existsSync(SNAPSHOT_FILE)
  ? JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'))
  : { version: 1, school: { name: 'مدرسة محمد الشريقي الثانوية للبنين' }, classes: [], subjects: [], teachers: [], parents: [], students: [], lessons: [], homework: [], announcements: [] };

/** Read a `--flag value` CLI argument safely. */
function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : '';
}

/** Ensure a school row and default administrator account exist on a fresh PC database. */
function ensureSchoolAndAdmin(db, schoolData = {}) {
  let school = db.prepare('SELECT * FROM schools LIMIT 1').get();
  if (!school) {
    const sid = id();
    db.prepare(
      'INSERT INTO schools(id,name,timezone,start_time,end_time,period_minutes,break_minutes,period_count,workdays,duty_notes) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ).run(
      sid,
      schoolData.name || 'مدرسة محمد الشريقي الثانوية للبنين',
      schoolData.timezone || 'Asia/Amman',
      schoolData.start_time || '08:00',
      schoolData.end_time || '14:35',
      schoolData.period_minutes || 45,
      schoolData.break_minutes ?? 5,
      schoolData.period_count || 8,
      schoolData.workdays || '0,1,2,3,4',
      schoolData.duty_notes || '',
    );
    school = db.prepare('SELECT * FROM schools WHERE id=?').get(sid);
  }
  let admin = db.prepare("SELECT * FROM users WHERE school_id=? AND role='admin' LIMIT 1").get(school.id);
  if (!admin) {
    const aid = id();
    const adminPw = process.env.SCHOOLSYNC_ADMIN_PASSWORD || 'Alshereqi!2026';
    db.prepare('INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)').run(
      aid,
      school.id,
      schoolData.principalName || 'مدير المدرسة',
      'admin@alshereqi.edu.jo',
      hash(adminPw),
      'admin',
      null,
    );
    admin = db.prepare('SELECT * FROM users WHERE id=?').get(aid);
  }
  return { school, admin };
}

/** Inject `DATABASE_SNAPSHOT` directly into a local SchoolSync SQLite database file. */
export function injectLocalDatabase({
  dbPath = path.join(__dirname, '.data/schoolsync-live.sqlite'),
  mode = 'merge',
  defaultPassword = process.env.SCHOOLSYNC_DEFAULT_PW || 'SchoolSync!2026',
} = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(readFileSync(path.join(__dirname, 'server/schema.sql'), 'utf8'));
  migrate(db);

  const idPepper = resolveIdPepper(dbPath, false);
  const nationalHash = (value) =>
    createHmac('sha256', idPepper).update(normalizeNationalId(value)).digest('hex');

  const ctx = { ...createContext(db, () => new Date()), db };
  const { school, admin } = ensureSchoolAndAdmin(db, DATABASE_SNAPSHOT.school);
  const payload = { ...DATABASE_SNAPSHOT, mode, defaultPassword };
  const result = importSchoolSnapshot(ctx, school.id, admin, payload, { nationalHash });
  syncClassSortOrders(db, school.id, false);
  db.close();
  return { target: dbPath, school: school.name, ...result };
}

/** Push `DATABASE_SNAPSHOT` into a running local or cloud-tunneled SchoolSync server. */
export async function injectRemoteDatabase({
  url,
  email = process.env.SCHOOLSYNC_ADMIN_EMAIL || 'admin@alshereqi.edu.jo',
  password = process.env.SCHOOLSYNC_ADMIN_PASSWORD || 'Alshereqi!2026',
  mode = 'merge',
  defaultPassword = process.env.SCHOOLSYNC_DEFAULT_PW || 'SchoolSync!2026',
}) {
  const base = url.trim().replace(/\/+$/, '');
  const common = { 'Content-Type': 'application/json', 'X-SchoolSync-Client': 'capacitor', 'ngrok-skip-browser-warning': 'true' };
  const loginRes = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: common,
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok || !loginJson.token) {
    throw new Error(loginJson.error || `Login failed (${loginRes.status})`);
  }
  const res = await fetch(`${base}/api/database/inject`, {
    method: 'POST',
    headers: { ...common, Authorization: `Bearer ${loginJson.token}` },
    body: JSON.stringify({ ...DATABASE_SNAPSHOT, mode, defaultPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Inject failed (${res.status})`);
  return { target: base, ...data };
}

const isEntrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntrypoint) {
  const mode = process.argv.includes('--replace') ? 'replace' : 'merge';
  const remoteUrl = readArg('--url');
  const dbPath = readArg('--db') || process.env.SCHOOLSYNC_DB || path.join(__dirname, '.data/schoolsync-live.sqlite');

  Promise.resolve(
    remoteUrl
      ? injectRemoteDatabase({
          url: remoteUrl,
          email: readArg('--email') || undefined,
          password: readArg('--password') || undefined,
          mode,
        })
      : injectLocalDatabase({ dbPath, mode }),
  )
    .then((summary) => {
      console.log('SchoolSync database injected successfully:');
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((err) => {
      console.error('Database injection failed:', err.message);
      process.exit(1);
    });
}
