/**
 * Student enrollment, verified guardian linking, family credentials,
 * and staff/family account creation routes (Principal & Assistant Principal).
 */
const { z } = require('zod');
const { id, hash, normalizeNationalId, text, fail } = require('./db.cjs');
const { provisionStudentAccount, studentPasswordFromNationalId } = require('./school-helpers.cjs');

function registerPeopleRoutes(app, ctx, { nationalHash }) {
  const { one, run, audit, student, schoolManager } = ctx;

  app.post('/api/students', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        name: text,
        section: text,
        guardianPhone: z.string().trim().max(40).optional(),
        nationalId: z.string().trim().max(30).optional(),
      })
      .parse(req.body);
    const initials = v.name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join('');
    const sid = id();
    let provisioned = null;
    ctx.db.transaction(() => {
      const maxOrder = one('SELECT COALESCE(MAX(sort_order),0) m FROM classes WHERE school_id=?', u.school_id)?.m || 0;
      run(
        'INSERT OR IGNORE INTO classes(id,school_id,name,sort_order) VALUES(?,?,?,?)',
        id(),
        u.school_id,
        v.section,
        maxOrder + 1,
      );
      run(
        'INSERT INTO students(id,school_id,name,section,initials,color,guardian_phone) VALUES(?,?,?,?,?,?,?)',
        sid,
        u.school_id,
        v.name,
        v.section,
        initials,
        'mint',
        v.guardianPhone || '',
      );
      if (v.nationalId && v.nationalId.trim()) {
        const row = one('SELECT * FROM students WHERE id=?', sid);
        provisioned = provisionStudentAccount({
          db: ctx.db,
          schoolId: u.school_id,
          studentRow: row,
          nationalId: v.nationalId,
          nationalHash,
        });
      }
      audit(u, 'Enrolled student');
    })();
    return {
      ok: true,
      studentId: sid,
      accountCreated: Boolean(provisioned),
      ...(provisioned ? { username: provisioned.nationalId, defaultPassword: provisioned.defaultPassword } : {}),
    };
  });

  app.post('/api/students/:id/national-id', async (req) => {
    const u = req.user;
    schoolManager(u);
    const s = student(u, req.params.id);
    const v = z
      .object({
        nationalId: z.string().transform(normalizeNationalId),
      })
      .parse(req.body);
    let provisioned;
    ctx.db.transaction(() => {
      provisioned = provisionStudentAccount({
        db: ctx.db,
        schoolId: u.school_id,
        studentRow: s,
        nationalId: v.nationalId,
        nationalHash,
      });
      audit(u, 'Assigned student National ID and auto-created account');
    })();
    return {
      ok: true,
      nationalId: provisioned.nationalId,
      defaultPassword: studentPasswordFromNationalId(provisioned.nationalId),
    };
  });

  app.post('/api/guardians', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z.object({ studentId: text, guardianEmail: z.email() }).parse(req.body);
    student(u, v.studentId);
    const g = one(
      "SELECT id FROM users WHERE school_id=? AND email=? AND role='parent'",
      u.school_id,
      v.guardianEmail.toLowerCase(),
    );
    if (!g) fail('Existing guardian account not found in this school', 404);
    run('INSERT OR IGNORE INTO guardian_links VALUES(?,?)', g.id, v.studentId);
    audit(u, 'Linked verified guardian');
    return { ok: true };
  });

  app.post('/api/family-access', async (req) => {
    const u = req.user;
    schoolManager(u);
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
    if (one('SELECT 1 FROM family_credentials WHERE national_id_hash=? AND student_id<>?', nh, v.studentId))
      fail('الرقم الوطني مرتبط بطالب آخر', 409);
    ctx.db.transaction(() => {
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

  app.post('/api/accounts', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        name: text,
        email: z.email(),
        password: z.string().min(12).max(200),
        role: z.enum(['student', 'parent', 'teacher', 'assistant', 'admin']),
        section: z.string().trim().max(80).optional(),
        sections: z.array(z.string().trim().min(1).max(80)).optional(),
        subjects: z.array(z.string().trim().min(1).max(80)).optional(),
        studentId: z.string().optional(),
      })
      .parse(req.body);
    if (one('SELECT 1 FROM users WHERE email=?', v.email.toLowerCase()))
      fail('This email already has an account', 409);
    const classList = [
      ...new Set([...(v.sections || []), ...(v.section ? [v.section] : [])]),
    ].filter(Boolean);
    if (v.role === 'teacher' && !classList.length) fail('Teachers need an assigned class', 400);
    if (v.role === 'student' && !v.studentId)
      fail('Select an enrolled student to link this account', 400);
    const uid = id();
    ctx.db.transaction(() => {
      if (v.role === 'student') {
        const s = student(u, v.studentId);
        if (s.user_id) fail('This student already has an account', 409);
      }
      run(
        'INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)',
        uid,
        u.school_id,
        v.name,
        v.email.toLowerCase(),
        hash(v.password),
        v.role,
        classList[0] || null,
      );
      if (v.role === 'teacher') {
        for (const cls of classList) {
          run('INSERT OR IGNORE INTO classes(id,school_id,name) VALUES(?,?,?)', id(), u.school_id, cls);
          run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, uid, cls);
        }
        for (const sub of v.subjects || []) {
          run('INSERT OR IGNORE INTO subjects(id,school_id,name) VALUES(?,?,?)', id(), u.school_id, sub);
          run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', u.school_id, uid, sub);
        }
      }
      if (v.role === 'student') run('UPDATE students SET user_id=? WHERE id=?', uid, v.studentId);
      audit(u, `Created ${v.role} account`);
    })();
    return { ok: true };
  });
}

module.exports = { registerPeopleRoutes };
