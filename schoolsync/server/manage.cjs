const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { createApp, hash } = require('./app.cjs');
const directory = path.join(__dirname, '../.data');
mkdirSync(directory, { recursive: true });
const { app, db } = createApp({
  database: process.env.SCHOOLSYNC_DB || path.join(directory, 'schoolsync-live.sqlite'),
});
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
  } else
    throw new Error(
      'Usage: node schoolsync/server/manage.cjs init | backup. See schoolsync/README.md for environment variables.',
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
