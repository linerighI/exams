const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { createApp, hash } = require('./app.cjs');
const { resolveIdPepper, createHmac, normalizeNationalId } = require('./db.cjs');
const { createContext } = require('./state.cjs');
const { exportSchoolSnapshot } = require('./db-snapshot.cjs');
const { importSchoolSnapshot } = require('./db-injector.cjs');
const directory = path.join(__dirname, '../.data');
mkdirSync(directory, { recursive: true });
const dbPath = process.env.SCHOOLSYNC_DB || path.join(directory, 'schoolsync-live.sqlite');
const { app, db } = createApp({ database: dbPath });
(async () => {
  const command = process.argv[2];
  if (command === 'init') {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get())
      throw new Error(
        'An account already exists. Initialization is only allowed on an empty database.',
      );
    const input = z
      .object({
        email: z.email(),
        password: z.string().min(12).max(200),
        school: z.string().trim().min(1),
        name: z.string().trim().min(1),
        timezone: z.string(),
      })
      .parse({
        email: process.env.SCHOOLSYNC_ADMIN_EMAIL,
        password: process.env.SCHOOLSYNC_ADMIN_PASSWORD,
        school: process.env.SCHOOLSYNC_SCHOOL_NAME,
        name: process.env.SCHOOLSYNC_ADMIN_NAME || 'School administrator',
        timezone: process.env.SCHOOLSYNC_TIMEZONE || 'Asia/Amman',
      });
    new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
    db.transaction(() => {
      const school = randomUUID();
      db.prepare('INSERT INTO schools(id,name,timezone) VALUES(?,?,?)').run(
        school,
        input.school,
        input.timezone,
      );
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
        randomUUID(),
        school,
        input.name,
        input.email.toLowerCase(),
        hash(input.password),
        'admin',
        null,
      );
    })();
    console.log(
      'School and administrator created. Sign in with the email and password you supplied.',
    );
  } else if (command === 'backup') {
    const folder = path.join(directory, 'backups');
    mkdirSync(folder, { recursive: true });
    const target = path.join(
      folder,
      `schoolsync-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
    );
    await db.backup(target);
    console.log(`Verified SQLite backup written: ${target}`);
  } else if (command === 'export') {
    const arg3 = process.argv[3];
    const isOutPath = arg3 && (/\.json$/i.test(arg3) || arg3.includes('/') || arg3.includes('\\'));
    const schoolRow =
      arg3 && !isOutPath
        ? db.prepare('SELECT id FROM schools WHERE id=?').get(arg3)
        : db.prepare('SELECT id FROM schools LIMIT 1').get();
    if (!schoolRow) throw new Error('No school found in database.');
    const ctx = { ...createContext(db, () => new Date()), db };
    const snap = exportSchoolSnapshot(ctx, schoolRow.id);
    const target =
      (isOutPath ? arg3 : process.argv[4]) ||
      path.join(directory, `schoolsync-export-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(target, JSON.stringify(snap, null, 2));
    console.log(`Exported school snapshot: ${target}`);
  } else if (command === 'inject') {
    const file = process.argv[3];
    if (!file) throw new Error('Usage: node schoolsync/server/manage.cjs inject <jsonFile> [merge|replace]');
    const mode = process.argv[4] === 'replace' ? 'replace' : 'merge';
    const adminUser = db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get();
    if (!adminUser) throw new Error('Initialize a school admin account first (manage.cjs init).');
    const pepper = resolveIdPepper(dbPath, false);
    const nationalHash = (val) => createHmac('sha256', pepper).update(normalizeNationalId(val)).digest('hex');
    const ctx = { ...createContext(db, () => new Date()), db };
    const rawJson = readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, '');
    const payload = { ...JSON.parse(rawJson), mode };
    const result = importSchoolSnapshot(ctx, adminUser.school_id, adminUser, payload, { nationalHash });
    console.log(`Injected (${result.mode}):`, JSON.stringify(result.counts));
  } else
    throw new Error(
      'Usage: node schoolsync/server/manage.cjs init | backup | export [schoolId] [outFile] | inject <jsonFile> [merge|replace]',
    );
  await app.close();
})().catch(async (err) => {
  console.error(
    err instanceof z.ZodError
      ? 'Missing or invalid setup environment variables. See schoolsync/README.md.'
      : err.message,
  );
  await app.close();
  process.exitCode = 1;
});
