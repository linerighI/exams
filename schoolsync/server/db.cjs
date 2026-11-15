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
