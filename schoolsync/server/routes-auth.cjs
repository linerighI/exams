/**
 * Authentication, first-run school setup, password management, and family credential routes.
 */
const { z } = require('zod');
const { id, hash, verify, digest, normalizeNationalId, text, time, fail } = require('./db.cjs');
const { STAFF_ROLES } = require('./state.cjs');
const { getActiveTunnelUrl } = require('./tunnel.cjs');
const { loadConsoleConfig } = require('./git-sync.cjs');

function registerAuthRoutes(app, ctx, { allowSetup, demo, nationalHash }) {
  const { one, run, audit, student } = ctx;
  const attempts = new Map();

  const throttle = (req) => {
    const key = req.ip;
    const old = attempts.get(key);
    const attempt = old && old.until > Date.now() ? old : { count: 0, until: Date.now() + 60000 };
    attempts.set(key, attempt);
    if (++attempt.count > 20) fail('Too many attempts. Try again in a minute.', 429);
  };

  const readSessionToken = (req) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('schoolsync='))
      ?.slice(11);
    return bearer || cookie || '';
  };

  const session = (reply, u, req) => {
    const token = require('node:crypto').randomBytes(32).toString('hex');
    run('INSERT INTO sessions VALUES(?,?,?)', digest(token), u.id, Date.now() + 7 * 86400000);
    reply.header(
      'Set-Cookie',
      `schoolsync=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.SCHOOLSYNC_SECURE_COOKIE === '1' ? '; Secure' : ''}`,
    );
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      ...(req?.headers['x-schoolsync-client'] === 'capacitor' ? { token } : {}),
    };
  };

  app.get('/api/config', async () => {
    const school = one('SELECT name FROM schools LIMIT 1');
    const cfg = loadConsoleConfig();
    return {
      demo,
      setupRequired: allowSetup && !one('SELECT 1 FROM users LIMIT 1'),
      schoolName: school?.name || 'مدرسة محمد الشريقي الثانوية للبنين',
      tunnelUrl: getActiveTunnelUrl() || null,
      registry: {
        owner: cfg.githubOwner,
        repo: cfg.githubRepo,
        branch: cfg.githubBranch,
        filePath: cfg.githubFilePath,
      },
    };
  });

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
        start: time,
        end: time,
      })
      .refine((v) => v.start < v.end, 'نهاية الدوام يجب أن تكون بعد بدايته')
      .parse(req.body);
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
    } catch {
      fail('المنطقة الزمنية غير صحيحة', 400);
    }
    const user = { id: id(), school_id: id(), name: input.adminName, role: 'admin' };
    ctx.db.transaction(() => {
      if (one('SELECT 1 FROM users LIMIT 1')) fail('تم إعداد المدرسة بالفعل', 409);
      run(
        'INSERT INTO schools(id,name,timezone,start_time,end_time) VALUES(?,?,?,?,?)',
        user.school_id,
        input.schoolName,
        input.timezone,
        input.start,
        input.end,
      );
      run(
        'INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)',
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
    return session(reply, user, req);
  });

  app.post('/api/family-login', async (req, reply) => {
    throttle(req);
    const v = z
      .object({
        nationalId: z
          .string()
          .transform(normalizeNationalId)
          .pipe(z.string().regex(/^\d{5,20}$/, 'أدخل الرقم الوطني بالأرقام (٥ أرقام على الأقل)')),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    const nh = nationalHash(v.nationalId);
    const unified = one(
      "SELECT s.id AS student_id, u.* FROM students s JOIN users u ON u.id=s.user_id WHERE s.national_id_hash=? AND u.role='student'",
      nh,
    );
    if (unified && verify(v.password, unified.password)) {
      return { ...session(reply, unified, req), entryStudentId: unified.student_id };
    }
    const credential = one(
      "SELECT c.*,u.id,u.name,u.role FROM family_credentials c JOIN users u ON u.id=c.guardian_id JOIN guardian_links g ON g.guardian_id=c.guardian_id AND g.student_id=c.student_id WHERE c.national_id_hash=? AND u.school_id=c.school_id AND u.role='parent'",
      nh,
    );
    if (!credential || !verify(v.password, credential.code_hash))
      fail('الرقم الوطني أو كلمة المرور غير صحيحة', 401);
    return { ...session(reply, credential, req), entryStudentId: credential.student_id };
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
    if (portal === 'staff' && !STAFF_ROLES.includes(u.role))
      fail('هذا الحساب مخصص لمساحة العائلة', 403);
    return session(reply, u, req);
  });

  app.post('/api/logout', async (req, reply) => {
    const token = readSessionToken(req);
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
    const token = readSessionToken(req);
    ctx.db.transaction(() => {
      run('UPDATE users SET password=? WHERE id=?', hash(v.newPassword), u.id);
      run('DELETE FROM sessions WHERE user_id=? AND token<>?', u.id, digest(token));
      audit(u, 'Changed account password');
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
    const token = readSessionToken(req);
    ctx.db.transaction(() => {
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
}

module.exports = { registerAuthRoutes };
