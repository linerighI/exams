const Fastify = require('fastify');
const Database = require('better-sqlite3');
const {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const id = () => randomUUID();
const hash = (password, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const verify = (password, stored) => {
  const [salt, key] = stored.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
};
const digest = (token) => createHash('sha256').update(token).digest('hex');
const normalizeNationalId = (value) =>
  String(value)
    .normalize('NFKC')
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
const day = (zone = 'Asia/Amman', date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const text = z.string().trim().min(1).max(4000);
const fail = (message, statusCode = 403) => {
  throw Object.assign(new Error(message), { statusCode });
};
function createApp({
  database = ':memory:',
  demo = false,
  logger = false,
  allowSetup = false,
  clock = () => new Date(),
} = {}) {
  const app = Fastify({ logger, bodyLimit: 65536 });
  app.register(require('@fastify/websocket'));
  const db = new Database(database);
  db.pragma('journal_mode = WAL');
  db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  if (demo) {
    seed(db);
    require('./demo-arabic.cjs')(db);
  }
  let idPepper =
    process.env.SCHOOLSYNC_ID_PEPPER || (demo ? 'schoolsync-fictional-demo-identities' : null);
  if (!idPepper && database !== ':memory:') {
    const keyPath = path.resolve(database) + '.identity-key';
    if (!existsSync(keyPath)) {
      try {
        writeFileSync(keyPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
    idPepper = readFileSync(keyPath, 'utf8').trim();
  }
  const nationalHash = (value) => {
    if (!idPepper) fail('يرجى إعداد مفتاح هويات العائلة على الخادم أولاً', 503);
    return createHmac('sha256', idPepper).update(normalizeNationalId(value)).digest('hex');
  };
  if (demo) {
    for (const [studentId, nationalId, code] of [
      ['alex', '0000000001', 'YousefDemo2026'],
      ['jamie', '0000000002', 'OmarDemo2026'],
    ])
      if (!db.prepare('SELECT 1 FROM family_credentials WHERE student_id=?').get(studentId))
        db.prepare(
          'INSERT INTO family_credentials(student_id,school_id,guardian_id,national_id_hash,code_hash) VALUES(?,?,?,?,?)',
        ).run(studentId, 'school-demo', 'parent-demo', nationalHash(nationalId), hash(code));
  }
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const audit = (u, action) =>
    run(
      'INSERT INTO audit_log(id,school_id,actor_id,action) VALUES(?,?,?,?)',
      id(),
      u.school_id,
      u.id,
      action,
    );
  const notify = (u, student, title, content) => {
    const recipients = all(
      "SELECT guardian_id id FROM guardian_links WHERE student_id=? UNION SELECT user_id id FROM students WHERE id=? UNION SELECT id FROM users WHERE school_id=? AND role='admin'",
      student,
      student,
      u.school_id,
    );
    for (const r of recipients)
      if (r.id)
        run(
          'INSERT INTO notifications(id,school_id,user_id,title,content) VALUES(?,?,?,?,?)',
          id(),
          u.school_id,
          r.id,
          title,
          content,
        );
  };
  function students(u) {
    if (u.role === 'parent')
      return all(
        'SELECT s.* FROM students s JOIN guardian_links g ON g.student_id=s.id WHERE g.guardian_id=? AND s.school_id=?',
        u.id,
        u.school_id,
      );
    if (u.role === 'student')
      return all('SELECT * FROM students WHERE user_id=? AND school_id=?', u.id, u.school_id);
    if (u.role === 'teacher')
      return all('SELECT * FROM students WHERE school_id=? AND section=?', u.school_id, u.section);
    return all('SELECT * FROM students WHERE school_id=?', u.school_id);
  }
  const student = (u, sid) =>
    students(u).find((s) => s.id === sid) || fail('Student access denied');
  const staff = (u) => {
    if (!['teacher', 'admin'].includes(u.role)) fail('Staff access required');
  };
  const admin = (u) => {
    if (u.role !== 'admin') fail('Administrator access required');
  };
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
  const lesson = (u, lid) => {
    const l = one('SELECT * FROM lessons WHERE id=? AND school_id=?', lid, u.school_id);
    if (!l || (u.role === 'teacher' && l.teacher_id !== u.id)) fail('Lesson access denied');
    return l;
  };
  app.decorateRequest('user', null);
  const attempts = new Map();
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin');
    if (!req.url.startsWith('/api/')) return;
    const origin = req.headers.origin;
    if ((!['GET', 'HEAD'].includes(req.method) || req.url === '/api/live') && origin) {
      let host;
      try {
        host = new URL(origin).host;
      } catch {
        fail('Invalid origin');
      }
      if (host !== req.headers.host) fail('Cross-origin request denied');
    }
    if (['/api/login', '/api/family-login', '/api/config', '/api/setup'].includes(req.url)) return;
    const token = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    const u =
      token &&
      one(
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
    reply
      .code(code)
      .send({ error: code >= 500 ? 'Unable to save. Please try again.' : err.message });
  });
  app.get('/api/config', async () => ({
    demo,
    setupRequired: allowSetup && !one('SELECT 1 FROM users LIMIT 1'),
  }));
  const throttle = (req) => {
    const key = req.ip;
    const old = attempts.get(key);
    const attempt = old && old.until > Date.now() ? old : { count: 0, until: Date.now() + 60000 };
    attempts.set(key, attempt);
    if (++attempt.count > 20) fail('Too many attempts. Try again in a minute.', 429);
  };
  const session = (reply, u) => {
    const token = randomBytes(32).toString('hex');
    run('INSERT INTO sessions VALUES(?,?,?)', digest(token), u.id, Date.now() + 7 * 86400000);
    reply.header(
      'Set-Cookie',
      `schoolsync=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.SCHOOLSYNC_SECURE_COOKIE === '1' ? '; Secure' : ''}`,
    );
    return { id: u.id, name: u.name, role: u.role };
  };
  app.post('/api/setup', async (req, reply) => {
    if (!allowSetup || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip))
      fail('إعداد المدرسة متاح محلياً فقط', 403);
    throttle(req);
    if (one('SELECT 1 FROM users LIMIT 1')) fail('تم إعداد المدرسة بالفعل', 409);
    const input = z
      .object({
        schoolName: text,
        adminName: text,
        email: z.email(),
        password: z.string().min(12, 'استخدم كلمة مرور من ١٢ حرفاً على الأقل').max(200),
        timezone: text,
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      })
      .refine((v) => v.start < v.end, 'نهاية الدوام يجب أن تكون بعد بدايته')
      .parse(req.body);
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
    } catch {
      fail('المنطقة الزمنية غير صحيحة', 400);
    }
    const user = { id: id(), school_id: id(), name: input.adminName, role: 'admin' };
    db.transaction(() => {
      if (one('SELECT 1 FROM users LIMIT 1')) fail('تم إعداد المدرسة بالفعل', 409);
      run(
        'INSERT INTO schools VALUES(?,?,?,?,?)',
        user.school_id,
        input.schoolName,
        input.timezone,
        input.start,
        input.end,
      );
      run(
        'INSERT INTO users VALUES(?,?,?,?,?,?,?)',
        user.id,
        user.school_id,
        input.adminName,
        input.email.toLowerCase(),
        hash(input.password),
        'admin',
        null,
      );
      audit(user, 'Created school through first-run setup');
    })();
    return session(reply, user);
  });
  app.post('/api/family-login', async (req, reply) => {
    throttle(req);
    const v = z
      .object({
        nationalId: z
          .string()
          .transform(normalizeNationalId)
          .pipe(z.string().regex(/^\d{10}$/, 'أدخل الرقم الوطني المكوّن من ١٠ أرقام')),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    const credential = one(
      "SELECT c.*,u.id,u.name,u.role FROM family_credentials c JOIN users u ON u.id=c.guardian_id JOIN guardian_links g ON g.guardian_id=c.guardian_id AND g.student_id=c.student_id WHERE c.national_id_hash=? AND u.school_id=c.school_id AND u.role='parent'",
      nationalHash(v.nationalId),
    );
    if (!credential || !verify(v.password, credential.code_hash))
      fail('الرقم الوطني أو رمز الدخول غير صحيح', 401);
    return { ...session(reply, credential), entryStudentId: credential.student_id };
  });
  app.post('/api/login', async (req, reply) => {
    const { email, password, portal } = z
      .object({
        email: z.email(),
        password: z.string().min(1).max(200),
        portal: z.enum(['staff']).optional(),
      })
      .parse(req.body);
    throttle(req);
    const u = one('SELECT * FROM users WHERE email=?', email.toLowerCase());
    if (!u || !verify(password, u.password)) fail('Email or password is incorrect', 401);
    if (portal === 'staff' && !['teacher', 'admin'].includes(u.role))
      fail('هذا الحساب مخصص لمساحة العائلة', 403);
    return session(reply, u);
  });
  app.post('/api/logout', async (req, reply) => {
    const token = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    if (token) run('DELETE FROM sessions WHERE token=?', digest(token));
    reply.header('Set-Cookie', 'schoolsync=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return { ok: true };
  });
  app.post('/api/password', async (req) => {
    const u = req.user;
    const v = z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(12).max(200),
      })
      .parse(req.body);
    const record = one('SELECT password FROM users WHERE id=?', u.id);
    if (!verify(v.currentPassword, record.password)) fail('Current password is incorrect', 400);
    const token = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    db.transaction(() => {
      run('UPDATE users SET password=? WHERE id=?', hash(v.newPassword), u.id);
      run('DELETE FROM sessions WHERE user_id=? AND token<>?', u.id, digest(token));
      audit(u, 'Changed account password');
    })();
    return { ok: true };
  });
  app.get('/api/state', async (req) => {
    const u = req.user;
    const ss = students(u);
    const sid = req.query.student || ss[0]?.id;
    const s = sid ? student(u, sid) : null;
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    const date = day(school.timezone, clock());
    const hw = s
      ? all(
          'SELECT h.*,u.name teacher,sub.content submission FROM homework h JOIN users u ON u.id=h.teacher_id LEFT JOIN submissions sub ON sub.homework_id=h.id AND sub.student_id=? WHERE h.school_id=? AND h.section=? ORDER BY h.due',
          s.id,
          u.school_id,
          s.section,
        )
      : [];
    const contacts = all(
      "SELECT id,name,role FROM users WHERE school_id=? AND id<>? AND (role IN ('teacher','admin') OR ? IN ('teacher','admin'))",
      u.school_id,
      u.id,
      u.role,
    ).filter((c) => {
      if (u.role === 'admin' || c.role === 'admin') return true;
      if (u.role === 'teacher')
        return (
          all('SELECT * FROM guardian_links WHERE guardian_id=?', c.id).some((g) =>
            ss.some((s) => s.id === g.student_id),
          ) || ss.some((s) => s.user_id === c.id)
        );
      return one(
        'SELECT 1 FROM lessons WHERE teacher_id=? AND school_id=? AND section IN (SELECT section FROM students WHERE id IN (SELECT student_id FROM guardian_links WHERE guardian_id=?) OR user_id=?)',
        c.id,
        u.school_id,
        u.id,
        u.id,
      );
    });
    return {
      user: u,
      school,
      date,
      students: ss,
      student: s,
      lessons: s
        ? all(
            'SELECT l.*,u.name teacher FROM lessons l JOIN users u ON u.id=l.teacher_id WHERE l.school_id=? AND l.section=? ORDER BY l.weekday,l.start',
            u.school_id,
            s.section,
          )
        : [],
      homework: hw,
      grades: s
        ? all(
            "SELECT * FROM grades WHERE student_id=? AND school_id=? AND (published=1 OR ? IN ('teacher','admin')) ORDER BY date",
            s.id,
            u.school_id,
            u.role,
          )
        : [],
      attendance: s
        ? all(
            'SELECT a.*,l.subject,l.start FROM attendance a JOIN lessons l ON l.id=a.lesson_id WHERE a.student_id=? AND a.school_id=? ORDER BY a.date DESC,l.start',
            s.id,
            u.school_id,
          )
        : [],
      incidents: all(
        'SELECT i.*,s.name student_name FROM incidents i JOIN students s ON s.id=i.student_id WHERE i.school_id=?',
        u.school_id,
      ).filter((i) => ss.some((s) => s.id === i.student_id)),
      notes: s
        ? all(
            'SELECT n.*,u.name author FROM notes n JOIN users u ON u.id=n.author_id WHERE student_id=? AND n.school_id=? ORDER BY created DESC',
            s.id,
            u.school_id,
          )
        : [],
      announcements: all(
        'SELECT * FROM announcements WHERE school_id=? ORDER BY created DESC',
        u.school_id,
      ),
      notifications: all(
        'SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 100',
        u.id,
      ),
      messages: all(
        'SELECT m.*,u.name sender FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.school_id=? AND (sender_id=? OR recipient_id=?) ORDER BY m.rowid',
        u.school_id,
        u.id,
        u.id,
      ),
      contacts,
      accounts:
        u.role === 'admin'
          ? all(
              'SELECT id,name,email,role,section FROM users WHERE school_id=? ORDER BY name',
              u.school_id,
            )
          : [],
      rosterAttendance: ['teacher', 'admin'].includes(u.role)
        ? all('SELECT * FROM attendance WHERE school_id=? AND date=?', u.school_id, date).filter(
            (a) => ss.some((s) => s.id === a.student_id),
          )
        : [],
      familyAccess:
        u.role === 'admin'
          ? all(
              'SELECT c.student_id,c.guardian_id,u.name guardian_name FROM family_credentials c JOIN users u ON u.id=c.guardian_id WHERE c.school_id=?',
              u.school_id,
            )
          : [],
      schoolWorkspace: ['teacher', 'admin'].includes(u.role)
        ? {
            lessons: all(
              "SELECT l.*,u.name teacher FROM lessons l JOIN users u ON u.id=l.teacher_id WHERE l.school_id=? AND (?='admin' OR l.teacher_id=?) ORDER BY l.weekday,l.start",
              u.school_id,
              u.role,
              u.id,
            ),
            homework: all(
              "SELECT id,section,subject,title,due FROM homework WHERE school_id=? AND (?='admin' OR teacher_id=?) ORDER BY due",
              u.school_id,
              u.role,
              u.id,
            ),
          }
        : null,
      demo,
    };
  });
  app.post('/api/homework/:id/submit', async (req) => {
    const u = req.user;
    if (u.role !== 'student') fail('Only students can submit their work');
    const { content } = z.object({ content: text }).parse(req.body);
    const s = students(u)[0];
    const h = one(
      'SELECT * FROM homework WHERE id=? AND school_id=? AND section=?',
      req.params.id,
      u.school_id,
      s.section,
    );
    if (!h) fail('Assignment unavailable', 404);
    run(
      'INSERT INTO submissions(homework_id,student_id,content) VALUES(?,?,?) ON CONFLICT(homework_id,student_id) DO UPDATE SET content=excluded.content,created=CURRENT_TIMESTAMP',
      h.id,
      s.id,
      content,
    );
    audit(u, `Submitted homework ${h.id}`);
    return { ok: true };
  });
  app.post('/api/homework', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({ section: text, subject: text, title: text, description: text, due: z.iso.date() })
      .parse(req.body);
    if (
      u.role === 'teacher' &&
      !one(
        'SELECT 1 FROM lessons WHERE teacher_id=? AND section=? AND subject=?',
        u.id,
        v.section,
        v.subject,
      )
    )
      fail('You are not assigned to this subject and section');
    db.transaction(() => {
      run(
        'INSERT INTO homework(id,school_id,section,teacher_id,subject,title,description,due,color) VALUES(?,?,?,?,?,?,?,?,?)',
        id(),
        u.school_id,
        v.section,
        u.id,
        v.subject,
        v.title,
        v.description,
        v.due,
        'peach',
      );
      for (const s of all(
        'SELECT * FROM students WHERE school_id=? AND section=?',
        u.school_id,
        v.section,
      ))
        notify(u, s.id, 'واجب جديد', v.title);
      audit(u, `Published homework: ${v.title}`);
    })();
    return { ok: true };
  });
  app.post('/api/attendance', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        lessonId: text,
        date: z.iso.date(),
        records: z
          .array(
            z.object({ studentId: text, status: z.enum(['present', 'absent', 'late', 'excused']) }),
          )
          .min(1)
          .max(100),
      })
      .parse(req.body);
    const l = lesson(u, v.lessonId);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    if (v.date !== day(school.timezone, clock()))
      fail('Attendance can only be recorded for today', 400);
    const weekday = new Date(`${v.date}T12:00:00Z`).getUTCDay();
    if (l.weekday !== weekday) fail('This lesson is not scheduled for today', 400);
    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: school.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(clock());
    if (now < l.start || now > school.end_time)
      fail('Attendance is available from the lesson start until dismissal', 400);
    db.transaction(() => {
      for (const r of v.records) {
        const s = student(u, r.studentId);
        if (s.section !== l.section) fail('Student is not enrolled in this class');
        run(
          'INSERT INTO attendance VALUES(?,?,?,?,?,?,?) ON CONFLICT(student_id,lesson_id,date) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by',
          id(),
          u.school_id,
          s.id,
          l.id,
          v.date,
          r.status,
          u.id,
        );
        if (
          r.status === 'absent' &&
          one(
            "SELECT 1 FROM attendance a JOIN lessons l ON l.id=a.lesson_id WHERE a.student_id=? AND a.date=? AND a.status IN ('present','late') AND l.start<?",
            s.id,
            v.date,
            l.start,
          )
        ) {
          const result = run(
            'INSERT OR IGNORE INTO incidents(id,school_id,student_id,date,detail) VALUES(?,?,?,?,?)',
            id(),
            u.school_id,
            s.id,
            v.date,
            `غياب غير متوقع في حصة ${l.subject}. لم يتم التحقق من مكان الطالب بعد، وتتابع المدرسة الحالة.`,
          );
          if (result.changes) {
            const incident = one(
              'SELECT id FROM incidents WHERE student_id=? AND date=?',
              s.id,
              v.date,
            );
            run(
              'INSERT INTO incident_events(id,incident_id,actor_id,detail) VALUES(?,?,?,?)',
              id(),
              incident.id,
              u.id,
              'Unexpected absence reported',
            );
            notify(
              u,
              s.id,
              'الحضور يحتاج إلى تحقق',
              `تم تسجيل غياب غير متوقع في حصة ${l.subject}. تتابع المدرسة الحالة. هذا لا يؤكد مغادرة الطالب للمدرسة.`,
            );
          }
        }
      }
      audit(u, `Attendance recorded for ${l.id}`);
    })();
    return { ok: true };
  });
  app.post('/api/incidents/:id', async (req) => {
    const u = req.user;
    admin(u);
    const v = z
      .object({ status: z.enum(['investigating', 'resolved']), resolution: text })
      .parse(req.body);
    const i = one('SELECT * FROM incidents WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!i) fail('Incident not found', 404);
    db.transaction(() => {
      run('UPDATE incidents SET status=?,resolution=? WHERE id=?', v.status, v.resolution, i.id);
      run(
        'INSERT INTO incident_events(id,incident_id,actor_id,detail) VALUES(?,?,?,?)',
        id(),
        i.id,
        u.id,
        v.resolution,
      );
      notify(
        u,
        i.student_id,
        `تحديث متابعة الحضور: ${v.status === 'resolved' ? 'تمت المعالجة' : 'قيد المتابعة'}`,
        v.resolution,
      );
      audit(u, `Incident ${i.id}: ${v.status}`);
    })();
    return { ok: true };
  });
  app.post('/api/notes', async (req) => {
    const u = req.user;
    staff(u);
    const v = z.object({ studentId: text, content: text }).parse(req.body);
    student(u, v.studentId);
    db.transaction(() => {
      run(
        'INSERT INTO notes(id,school_id,student_id,author_id,content) VALUES(?,?,?,?,?)',
        id(),
        u.school_id,
        v.studentId,
        u.id,
        v.content,
      );
      notify(u, v.studentId, 'ملاحظة من معلمك', v.content);
      audit(u, 'Published student note');
    })();
    return { ok: true };
  });
  app.post('/api/grades', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        studentId: text,
        subject: text,
        title: text,
        score: z.number().min(0),
        max: z.number().positive(),
        published: z.boolean(),
      })
      .refine((v) => v.score <= v.max, 'Score cannot exceed maximum')
      .parse(req.body);
    const s = student(u, v.studentId);
    if (
      u.role === 'teacher' &&
      !one(
        'SELECT 1 FROM lessons WHERE teacher_id=? AND section=? AND subject=?',
        u.id,
        s.section,
        v.subject,
      )
    )
      fail('Subject access denied');
    db.transaction(() => {
      run(
        'INSERT INTO grades VALUES(?,?,?,?,?,?,?,?,?,?)',
        id(),
        u.school_id,
        s.id,
        u.id,
        v.subject,
        v.title,
        v.score,
        v.max,
        Number(v.published),
        day(),
      );
      if (v.published) notify(u, s.id, 'تحديث دراسي جديد', `${v.subject}: ${v.title}`);
      audit(u, 'Recorded grade');
    })();
    return { ok: true };
  });
  app.post('/api/messages', async (req) => {
    const u = req.user;
    const v = z.object({ recipientId: text, content: text }).parse(req.body);
    const recipient = one(
      'SELECT * FROM users WHERE id=? AND school_id=?',
      v.recipientId,
      u.school_id,
    );
    if (!recipient || recipient.id === u.id) fail('Recipient unavailable');
    if (u.role !== 'admin' && recipient.role !== 'admin') {
      const teacher = u.role === 'teacher' ? u : recipient;
      const family = u.role === 'teacher' ? recipient : u;
      if (
        teacher.role !== 'teacher' ||
        !['parent', 'student'].includes(family.role) ||
        !students(family).some((s) =>
          one(
            'SELECT 1 FROM lessons WHERE teacher_id=? AND section=? AND school_id=?',
            teacher.id,
            s.section,
            u.school_id,
          ),
        )
      )
        fail('Conversation access denied');
    }
    db.transaction(() => {
      run(
        'INSERT INTO messages(id,school_id,sender_id,recipient_id,content) VALUES(?,?,?,?,?)',
        id(),
        u.school_id,
        u.id,
        recipient.id,
        v.content,
      );
      run(
        'INSERT INTO notifications(id,school_id,user_id,title,content) VALUES(?,?,?,?,?)',
        id(),
        u.school_id,
        recipient.id,
        'رسالة جديدة',
        `رسالة من ${u.name}`,
      );
    })();
    return { ok: true };
  });
  app.post('/api/notifications/read', async (req) => {
    run('UPDATE notifications SET read=1 WHERE user_id=?', req.user.id);
    return { ok: true };
  });
  app.post('/api/announcements', async (req) => {
    const u = req.user;
    admin(u);
    const v = z.object({ title: text, content: text }).parse(req.body);
    db.transaction(() => {
      run(
        'INSERT INTO announcements(id,school_id,author_id,title,content) VALUES(?,?,?,?,?)',
        id(),
        u.school_id,
        u.id,
        v.title,
        v.content,
      );
      for (const r of all('SELECT id FROM users WHERE school_id=?', u.school_id))
        run(
          'INSERT INTO notifications(id,school_id,user_id,title,content) VALUES(?,?,?,?,?)',
          id(),
          u.school_id,
          r.id,
          v.title,
          v.content,
        );
      audit(u, 'Published announcement');
    })();
    return { ok: true };
  });
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  app.post('/api/lessons', async (req) => {
    const u = req.user;
    admin(u);
    const v = z
      .object({
        section: text,
        teacherId: text,
        subject: text,
        room: text,
        weekday: z.number().int().min(0).max(6),
        start: time,
        end: time,
      })
      .refine((v) => v.start < v.end, 'End must be after start')
      .parse(req.body);
    const teacher = one(
      "SELECT * FROM users WHERE id=? AND school_id=? AND role='teacher' AND section=?",
      v.teacherId,
      u.school_id,
      v.section,
    );
    if (!teacher) fail('Choose a teacher assigned to this class', 400);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    if (v.start < school.start_time || v.end > school.end_time)
      fail('Lesson must be within school hours', 400);
    if (
      one(
        'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND start<? AND end>? AND (section=? OR teacher_id=? OR room=?)',
        u.school_id,
        v.weekday,
        v.end,
        v.start,
        v.section,
        v.teacherId,
        v.room,
      )
    )
      fail('Schedule conflict: class, teacher, or room already booked', 409);
    db.transaction(() => {
      run(
        'INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?)',
        id(),
        u.school_id,
        v.section,
        v.teacherId,
        v.subject,
        v.room,
        v.weekday,
        v.start,
        v.end,
        'blue',
      );
      audit(u, 'Created timetable lesson');
    })();
    return { ok: true };
  });
  app.post('/api/school', async (req) => {
    const u = req.user;
    admin(u);
    const v = z
      .object({ name: text, timezone: text, start: time, end: time })
      .refine((v) => v.start < v.end, 'End must be after start')
      .parse(req.body);
    try {
      new Intl.DateTimeFormat('en', { timeZone: v.timezone }).format();
    } catch {
      fail('Invalid school timezone', 400);
    }
    if (
      one(
        'SELECT 1 FROM lessons WHERE school_id=? AND (start<? OR end>?)',
        u.school_id,
        v.start,
        v.end,
      )
    )
      fail('School hours must include existing lessons', 409);
    db.transaction(() => {
      run(
        'UPDATE schools SET name=?,timezone=?,start_time=?,end_time=? WHERE id=?',
        v.name,
        v.timezone,
        v.start,
        v.end,
        u.school_id,
      );
      audit(u, 'Updated school settings');
    })();
    return { ok: true };
  });
  app.post('/api/grades/:id/publish', async (req) => {
    const u = req.user;
    staff(u);
    const g = one('SELECT * FROM grades WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!g || (u.role === 'teacher' && g.teacher_id !== u.id)) fail('Grade access denied');
    student(u, g.student_id);
    db.transaction(() => {
      if (!g.published) {
        run('UPDATE grades SET published=1 WHERE id=?', g.id);
        notify(u, g.student_id, 'تحديث دراسي جديد', `${g.subject}: ${g.title}`);
        audit(u, 'Published draft grade');
      }
    })();
    return { ok: true };
  });
  app.post('/api/lessons/:id', async (req) => {
    const u = req.user;
    admin(u);
    const l = lesson(u, req.params.id);
    const v = z
      .object({
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        room: text,
        teacherId: z.string().optional(),
      })
      .refine((v) => v.start < v.end, 'End must be after start')
      .parse(req.body);
    const teacherId = v.teacherId || l.teacher_id;
    if (
      !one(
        "SELECT 1 FROM users WHERE id=? AND school_id=? AND role='teacher' AND section=?",
        teacherId,
        u.school_id,
        l.section,
      )
    )
      fail('Choose a teacher assigned to this class', 400);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    if (v.start < school.start_time || v.end > school.end_time)
      fail('Lesson must be within school hours', 400);
    if (
      one(
        'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND id<>? AND start<? AND end>? AND (section=? OR teacher_id=? OR room=?)',
        u.school_id,
        l.weekday,
        l.id,
        v.end,
        v.start,
        l.section,
        teacherId,
        v.room,
      )
    )
      fail('Schedule conflict: class, teacher, or room already booked', 409);
    db.transaction(() => {
      run(
        'UPDATE lessons SET start=?,end=?,room=?,teacher_id=? WHERE id=?',
        v.start,
        v.end,
        v.room,
        teacherId,
        l.id,
      );
      audit(u, `Updated timetable ${l.id}`);
    })();
    return { ok: true };
  });
  app.post('/api/students', async (req) => {
    const u = req.user;
    admin(u);
    const v = z.object({ name: text, section: text }).parse(req.body);
    run(
      'INSERT INTO students(id,school_id,name,section,initials,color) VALUES(?,?,?,?,?,?)',
      id(),
      u.school_id,
      v.name,
      v.section,
      v.name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join(''),
      'mint',
    );
    audit(u, 'Enrolled student');
    return { ok: true };
  });
  app.post('/api/guardians', async (req) => {
    const u = req.user;
    admin(u);
    const v = z.object({ studentId: text, guardianEmail: z.email() }).parse(req.body);
    student(u, v.studentId);
    const g = one(
      "SELECT id FROM users WHERE school_id=? AND email=? AND role='parent'",
      u.school_id,
      v.guardianEmail,
    );
    if (!g) fail('Existing guardian account not found in this school', 404);
    run('INSERT OR IGNORE INTO guardian_links VALUES(?,?)', g.id, v.studentId);
    audit(u, 'Linked verified guardian');
    return { ok: true };
  });
  app.post('/api/family-access', async (req) => {
    const u = req.user;
    admin(u);
    const v = z
      .object({
        studentId: text,
        guardianEmail: z.email(),
        nationalId: z
          .string()
          .transform(normalizeNationalId)
          .pipe(z.string().regex(/^\d{10}$/, 'أدخل الرقم الوطني المكوّن من ١٠ أرقام')),
        code: z.string().min(8, 'رمز الدخول يجب أن يتكون من ٨ أحرف أو أرقام على الأقل').max(200),
      })
      .parse(req.body);
    student(u, v.studentId);
    const guardian = one(
      "SELECT u.id FROM users u JOIN guardian_links g ON g.guardian_id=u.id WHERE u.school_id=? AND u.role='parent' AND u.email=? AND g.student_id=?",
      u.school_id,
      v.guardianEmail.toLowerCase(),
      v.studentId,
    );
    if (!guardian) fail('اربط ولي الأمر الموثّق بالطالب قبل تفعيل دخول العائلة', 400);
    const nh = nationalHash(v.nationalId);
    if (
      one(
        'SELECT 1 FROM family_credentials WHERE national_id_hash=? AND student_id<>?',
        nh,
        v.studentId,
      )
    )
      fail('الرقم الوطني مرتبط بطالب آخر', 409);
    db.transaction(() => {
      run(
        'INSERT INTO family_credentials(student_id,school_id,guardian_id,national_id_hash,code_hash) VALUES(?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET guardian_id=excluded.guardian_id,national_id_hash=excluded.national_id_hash,code_hash=excluded.code_hash,updated=CURRENT_TIMESTAMP',
        v.studentId,
        u.school_id,
        guardian.id,
        nh,
        hash(v.code),
      );
      run('DELETE FROM sessions WHERE user_id=?', guardian.id);
      audit(u, 'Configured family access for student');
    })();
    return { ok: true };
  });
  app.post('/api/family-code', async (req) => {
    const u = req.user;
    if (u.role !== 'parent') fail('هذه الميزة مخصصة لحساب العائلة');
    const v = z
      .object({
        studentId: text,
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(8).max(200),
      })
      .parse(req.body);
    student(u, v.studentId);
    const credential = one(
      'SELECT * FROM family_credentials WHERE student_id=? AND guardian_id=? AND school_id=?',
      v.studentId,
      u.id,
      u.school_id,
    );
    if (!credential || !verify(v.currentPassword, credential.code_hash))
      fail('رمز الدخول الحالي غير صحيح', 400);
    const token = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    db.transaction(() => {
      run(
        'UPDATE family_credentials SET code_hash=?,updated=CURRENT_TIMESTAMP WHERE student_id=?',
        hash(v.newPassword),
        v.studentId,
      );
      run('DELETE FROM sessions WHERE user_id=? AND token<>?', u.id, digest(token));
      audit(u, 'Changed child family access code');
    })();
    return { ok: true };
  });
  app.post('/api/accounts', async (req) => {
    const u = req.user;
    admin(u);
    const v = z
      .object({
        name: text,
        email: z.email(),
        password: z.string().min(12).max(200),
        role: z.enum(['student', 'parent', 'teacher', 'admin']),
        section: z.string().trim().max(50).optional(),
        studentId: z.string().optional(),
      })
      .parse(req.body);
    if (one('SELECT 1 FROM users WHERE email=?', v.email.toLowerCase()))
      fail('This email already has an account', 409);
    if (v.role === 'teacher' && !v.section) fail('Teachers need an assigned class', 400);
    if (v.role === 'student' && !v.studentId)
      fail('Select an enrolled student to link this account', 400);
    const uid = id();
    db.transaction(() => {
      if (v.role === 'student') {
        const s = student(u, v.studentId);
        if (s.user_id) fail('This student already has an account', 409);
        run('UPDATE students SET user_id=? WHERE id=?', null, s.id);
      }
      run(
        'INSERT INTO users VALUES(?,?,?,?,?,?,?)',
        uid,
        u.school_id,
        v.name,
        v.email.toLowerCase(),
        hash(v.password),
        v.role,
        v.section || null,
      );
      if (v.role === 'student') run('UPDATE students SET user_id=? WHERE id=?', uid, v.studentId);
      audit(u, `Created ${v.role} account`);
    })();
    return { ok: true };
  });
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
    return reply
      .type(mime[path.extname(file)] || 'application/octet-stream')
      .send(readFileSync(file));
  });
  app.addHook('onClose', async () => db.close());
  return { app, db };
}
function seed(db) {
  if (db.prepare('SELECT 1 FROM schools LIMIT 1').get()) return;
  db.transaction(() => {
    db.prepare('INSERT INTO schools VALUES(?,?,?,?,?)').run(
      'school-demo',
      'Olive Grove School',
      'Asia/Amman',
      '08:00',
      '14:00',
    );
    const users = [
      ['student-demo', 'Alex Morgan', 'alex@schoolsync.demo', 'student', '8A'],
      ['parent-demo', 'Sarah Morgan', 'sarah@schoolsync.demo', 'parent', null],
      ['teacher-demo', 'Emma Wilson', 'emma@schoolsync.demo', 'teacher', '8A'],
      ['teacher-sibling', 'Nora Ahmad', 'nora@schoolsync.demo', 'teacher', '6B'],
      ['admin-demo', 'Rami Haddad', 'rami@schoolsync.demo', 'admin', null],
      ['student-sibling', 'Jamie Morgan', 'jamie@schoolsync.demo', 'student', '6B'],
    ];
    for (const [uid, name, email, role, section] of users)
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
        uid,
        'school-demo',
        name,
        email,
        hash('SchoolSync!2026'),
        role,
        section,
      );
    db.prepare('INSERT INTO students VALUES(?,?,?,?,?,?,?)').run(
      'alex',
      'school-demo',
      'student-demo',
      'Alex Morgan',
      '8A',
      'AM',
      'lilac',
    );
    db.prepare('INSERT INTO students VALUES(?,?,?,?,?,?,?)').run(
      'jamie',
      'school-demo',
      'student-sibling',
      'Jamie Morgan',
      '6B',
      'JM',
      'peach',
    );
    for (const sid of ['alex', 'jamie'])
      db.prepare('INSERT INTO guardian_links VALUES(?,?)').run('parent-demo', sid);
    const subjects = [
      ['Mathematics', '08:00', '08:50', 'Room 204', 'blue'],
      ['English', '09:00', '09:50', 'Room 108', 'peach'],
      ['Science', '10:10', '11:00', 'Science lab', 'mint'],
      ['Arabic', '11:10', '12:00', 'Room 202', 'lilac'],
      ['Art & design', '12:10', '13:00', 'Art studio', 'pink'],
      ['History', '13:10', '14:00', 'Room 105', 'yellow'],
    ];
    for (const section of ['8A', '6B'])
      for (const weekday of [0, 1, 2, 3, 4])
        for (const [n, start, end, room, color] of subjects)
          db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?)').run(
            `${section}-${weekday}-${n}`,
            'school-demo',
            section,
            section === '8A' ? 'teacher-demo' : 'teacher-sibling',
            n,
            section === '8A' ? room : `Junior ${room}`,
            weekday,
            start,
            end,
            color,
          );
    const today = day();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const due = tomorrow.toISOString().slice(0, 10);
    for (const section of ['8A', '6B'])
      for (const [n, title, desc, color] of [
        [
          'Mathematics',
          'A little everyday algebra',
          'Complete exercises 1–8 on page 42. Show your working and explain how you found each answer.',
          'blue',
        ],
        [
          'English',
          'Stories worth telling',
          'Write 150 words about a place that feels like home. Include three descriptive details.',
          'peach',
        ],
        [
          'Science',
          'The world under a leaf',
          'Find a leaf, sketch it, and label the parts involved in photosynthesis.',
          'mint',
        ],
      ])
        db.prepare(
          'INSERT INTO homework(id,school_id,section,teacher_id,subject,title,description,due,color) VALUES(?,?,?,?,?,?,?,?,?)',
        ).run(id(), 'school-demo', section, 'teacher-demo', n, title, desc, due, color);
    for (const sid of ['alex', 'jamie'])
      for (let i = 0; i < 6; i++) {
        const d = new Date(`${today}T12:00:00Z`);
        d.setDate(d.getDate() - (6 - i) * 7);
        db.prepare('INSERT INTO grades VALUES(?,?,?,?,?,?,?,?,?,?)').run(
          id(),
          'school-demo',
          sid,
          'teacher-demo',
          subjects[i][0],
          ['Creative project', 'Class participation', 'Learning journal'][i % 3],
          [78, 84, 81, 89, 92, 94][i],
          100,
          1,
          d.toISOString().slice(0, 10),
        );
      }
    db.prepare(
      'INSERT INTO announcements(id,school_id,author_id,title,content) VALUES(?,?,?,?,?)',
    ).run(
      id(),
      'school-demo',
      'admin-demo',
      'A day for curious minds',
      'Our school discovery day is coming up. Bring your questions, your ideas, and a little curiosity. Families are welcome — contact the school office for details.',
    );
    db.prepare(
      'INSERT INTO notes(id,school_id,student_id,author_id,content) VALUES(?,?,?,?,?)',
    ).run(
      id(),
      'school-demo',
      'alex',
      'teacher-demo',
      'Alex brought a thoughtful perspective to our class discussion today. Lovely to see that confidence growing.',
    );
    db.prepare(
      'INSERT INTO messages(id,school_id,sender_id,recipient_id,content) VALUES(?,?,?,?,?)',
    ).run(
      id(),
      'school-demo',
      'teacher-demo',
      'parent-demo',
      'Hi Sarah! A lovely day of learning today. Please let me know if you have any questions about the new homework.',
    );
    for (const uid of ['student-demo', 'parent-demo'])
      db.prepare(
        'INSERT INTO notifications(id,school_id,user_id,title,content) VALUES(?,?,?,?,?)',
      ).run(
        id(),
        'school-demo',
        uid,
        'Welcome to your school day',
        'Your timetable, homework, and school updates, together in one calm place.',
      );
  })();
}
module.exports = { createApp, seed, day, hash };
if (require.main === module) {
  mkdirSync(path.join(__dirname, '../.data'), { recursive: true });
  const { app } = createApp({
    database:
      process.env.SCHOOLSYNC_DB ||
      path.join(
        __dirname,
        process.argv.includes('--demo')
          ? '../.data/schoolsync.sqlite'
          : '../.data/schoolsync-live.sqlite',
      ),
    demo: process.argv.includes('--demo'),
    logger: true,
    allowSetup: process.argv.includes('--setup') || process.env.SCHOOLSYNC_ALLOW_SETUP === '1',
  });
  app
    .listen({
      port: Number(process.env.SCHOOLSYNC_PORT || 4320),
      host: process.env.SCHOOLSYNC_HOST || '127.0.0.1',
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
