/**
 * Database primitives, schema migrations, and assignment synchronization.
 */
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const cryptoHelpers = require('./db-crypto.cjs');
const { syncClassSortOrders } = require('./school-helpers.cjs');

const { id, hash, verify, digest, normalizeNationalId, day, text, time, fail, createHmac, randomBytes } = cryptoHelpers;

const hasColumn = (db, table, column) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

/** Upgrade older SQLite files idempotently without discarding live records. */
function migrate(db) {
  const userSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql;
  if (userSql && !userSql.includes("'assistant'")) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new(
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL REFERENCES schools(id),
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('student','parent','teacher','assistant','admin')),
          section TEXT
        );
        INSERT INTO users_new(id,school_id,name,email,password,role,section)
          SELECT id,school_id,name,email,password,role,section FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }
  const alters = [
    ['schools', 'period_minutes', 'INTEGER NOT NULL DEFAULT 45'],
    ['schools', 'break_minutes', 'INTEGER NOT NULL DEFAULT 5'],
    ['schools', 'period_count', 'INTEGER NOT NULL DEFAULT 8'],
    ['schools', 'workdays', "TEXT NOT NULL DEFAULT '0,1,2,3,4'"],
    ['schools', 'duty_notes', "TEXT NOT NULL DEFAULT ''"],
    ['students', 'guardian_phone', "TEXT NOT NULL DEFAULT ''"],
    ['students', 'national_id', "TEXT NOT NULL DEFAULT ''"],
    ['students', 'national_id_hash', 'TEXT'],
    ['classes', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['lessons', 'period_number', 'INTEGER NOT NULL DEFAULT 1'],
    ['notes', 'category', "TEXT NOT NULL DEFAULT 'general'"],
  ];
  for (const [table, col, def] of alters) {
    if (!hasColumn(db, table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS spatial_rooms(
      school_id TEXT NOT NULL REFERENCES schools(id),
      slot_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'classroom',
      class_name TEXT NOT NULL DEFAULT '',
      wing TEXT NOT NULL DEFAULT 'west-main',
      PRIMARY KEY(school_id, slot_id)
    );
    CREATE TABLE IF NOT EXISTS teacher_wings(
      school_id TEXT NOT NULL REFERENCES schools(id),
      teacher_id TEXT NOT NULL REFERENCES users(id),
      wing TEXT NOT NULL,
      PRIMARY KEY(teacher_id, wing)
    );
    CREATE TABLE IF NOT EXISTS campus_layouts(
      school_id TEXT NOT NULL REFERENCES schools(id),
      status TEXT NOT NULL CHECK(status IN ('draft','published')),
      version INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL,
      sar_source TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(school_id, status)
    );
    CREATE TABLE IF NOT EXISTS campus_geo_anchors(
      school_id TEXT PRIMARY KEY REFERENCES schools(id),
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      bearing_deg REAL NOT NULL DEFAULT 0,
      scale REAL NOT NULL DEFAULT 1,
      geofence_radius_m REAL NOT NULL DEFAULT 250,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS campus_beacons(
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id),
      room_id TEXT NOT NULL,
      floor_id TEXT NOT NULL,
      beacon_type TEXT NOT NULL CHECK(beacon_type IN ('qr','nfc','wifi','ble')),
      identifier TEXT NOT NULL,
      rssi_ref REAL NOT NULL DEFAULT -60,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      z REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS teacher_presence(
      teacher_id TEXT PRIMARY KEY REFERENCES users(id),
      school_id TEXT NOT NULL REFERENCES schools(id),
      room_id TEXT,
      floor_id TEXT,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      z REAL NOT NULL DEFAULT 0,
      lat REAL,
      lng REAL,
      accuracy_m REAL,
      source TEXT NOT NULL DEFAULT 'schedule',
      confidence REAL NOT NULL DEFAULT 0.35,
      status TEXT NOT NULL DEFAULT 'offline',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS teacher_location_history(
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id),
      teacher_id TEXT NOT NULL REFERENCES users(id),
      room_id TEXT,
      floor_id TEXT,
      x REAL NOT NULL DEFAULT 0,
      z REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_teacher_history ON teacher_location_history(school_id, teacher_id, recorded_at);
    CREATE TABLE IF NOT EXISTS schedule_profiles(
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id),
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      cells_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (!hasColumn(db, 'campus_layouts', 'sar_source')) db.exec('ALTER TABLE campus_layouts ADD COLUMN sar_source TEXT');
  if (!hasColumn(db, 'lessons', 'status')) db.exec("ALTER TABLE lessons ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  if (!hasColumn(db, 'schools', 'schedule_mode')) db.exec("ALTER TABLE schools ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'manual'");
  if (!hasColumn(db, 'schools', 'active_period')) db.exec('ALTER TABLE schools ADD COLUMN active_period INTEGER');
  if (!hasColumn(db, 'schools', 'duty_notes')) db.exec("ALTER TABLE schools ADD COLUMN duty_notes TEXT NOT NULL DEFAULT ''");
  if (!hasColumn(db, 'users', 'is_absent')) db.exec('ALTER TABLE users ADD COLUMN is_absent INTEGER NOT NULL DEFAULT 0');
  syncAssignmentsFromExistingRows(db);
  syncClassSortOrders(db);
}

function syncAssignmentsFromExistingRows(db) {
  db.transaction(() => {
    for (const t of db
      .prepare("SELECT id,school_id,section FROM users WHERE role='teacher' AND section IS NOT NULL AND section<>''")
      .all()) {
      db.prepare('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)').run(
        t.school_id,
        t.id,
        t.section,
      );
    }
    for (const l of db.prepare('SELECT DISTINCT school_id,teacher_id,section,subject FROM lessons').all()) {
      db.prepare('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)').run(
        l.school_id,
        l.teacher_id,
        l.section,
      );
      db.prepare('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)').run(
        l.school_id,
        l.teacher_id,
        l.subject,
      );
    }
    for (const sec of db
      .prepare('SELECT DISTINCT school_id,section FROM students UNION SELECT DISTINCT school_id,section FROM lessons')
      .all()) {
      db.prepare('INSERT OR IGNORE INTO classes(id,school_id,name) VALUES(?,?,?)').run(
        `${sec.school_id}:${sec.section}`,
        sec.school_id,
        sec.section,
      );
    }
    for (const sub of db.prepare('SELECT DISTINCT school_id,subject,color FROM lessons').all()) {
      db.prepare('INSERT OR IGNORE INTO subjects(id,school_id,name,color) VALUES(?,?,?,?)').run(
        `${sub.school_id}:${sub.subject}`,
        sub.school_id,
        sub.subject,
        sub.color || 'blue',
      );
    }
  })();
}

function resolveIdPepper(database, demo) {
  let pepper = process.env.SCHOOLSYNC_ID_PEPPER || (demo ? 'schoolsync-fictional-demo-identities' : null);
  if (!pepper && database !== ':memory:') {
    const keyPath = path.resolve(database) + '.identity-key';
    if (!existsSync(keyPath)) {
      try {
        writeFileSync(keyPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
    pepper = readFileSync(keyPath, 'utf8').trim();
  }
  return pepper;
}

module.exports = {
  id,
  hash,
  verify,
  digest,
  normalizeNationalId,
  day,
  text,
  time,
  fail,
  migrate,
  syncAssignmentsFromExistingRows,
  resolveIdPepper,
  createHmac,
};
