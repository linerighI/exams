/**
 * School setup, bell schedule, classes, subjects, and teacher multi-assignment routes.
 */
const { z } = require('zod');
const { id, text, time, fail } = require('./db.cjs');
const { syncClassSortOrders } = require('./school-helpers.cjs');

function registerSchoolRoutes(app, ctx) {
  const { one, run, audit, schoolManager } = ctx;

  app.post('/api/school', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        name: text,
        timezone: text,
        start: time,
        end: time,
        periodMinutes: z.number().int().min(20).max(90).optional(),
        breakMinutes: z.number().int().min(0).max(30).optional(),
        periodCount: z.number().int().min(1).max(10).optional(),
        workdays: z.string().regex(/^[0-6](,[0-6])*$/).optional(),
        dutyNotes: z.string().max(1000).optional(),
      })
      .refine((x) => x.start < x.end, 'End must be after start')
      .parse(req.body);
    try {
      new Intl.DateTimeFormat('en', { timeZone: v.timezone }).format();
    } catch {
      fail('Invalid school timezone', 400);
    }
    if (one('SELECT 1 FROM lessons WHERE school_id=? AND (start<? OR end>?)', u.school_id, v.start, v.end))
      fail('School hours must include existing lessons', 409);
    const current = one('SELECT * FROM schools WHERE id=?', u.school_id);
    ctx.db.transaction(() => {
      run(
        'UPDATE schools SET name=?,timezone=?,start_time=?,end_time=?,period_minutes=?,break_minutes=?,period_count=?,workdays=?,duty_notes=? WHERE id=?',
        v.name,
        v.timezone,
        v.start,
        v.end,
        v.periodMinutes ?? current.period_minutes ?? 45,
        v.breakMinutes ?? current.break_minutes ?? 5,
        v.periodCount ?? current.period_count ?? 8,
        v.workdays ?? current.workdays ?? '0,1,2,3,4',
        v.dutyNotes ?? current.duty_notes ?? '',
        u.school_id,
      );
      audit(u, 'Updated school settings');
    })();
    return { ok: true };
  });

  app.post('/api/classes', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        gradeLevel: z.string().trim().max(60).optional(),
        location: z.string().trim().max(120).optional(),
        room: z.string().trim().max(60).optional(),
        leadTeacherId: z.string().nullable().optional(),
      })
      .parse(req.body);
    if (v.leadTeacherId) {
      const lt = one("SELECT id FROM users WHERE id=? AND school_id=? AND role='teacher'", v.leadTeacherId, u.school_id);
      if (!lt) fail('Teacher not found', 404);
    }
    ctx.db.transaction(() => {
      if (v.id) {
        const existing = one('SELECT * FROM classes WHERE id=? AND school_id=?', v.id, u.school_id);
        if (!existing) fail('Class not found', 404);
        const nextLead = v.leadTeacherId !== undefined ? v.leadTeacherId : existing.lead_teacher_id;
        run(
          'UPDATE classes SET name=?,grade_level=?,location=?,room=?,lead_teacher_id=? WHERE id=?',
          v.name,
          v.gradeLevel || '',
          v.location || '',
          v.room || '',
          nextLead || null,
          v.id,
        );
        if (existing.name !== v.name) {
          run('UPDATE students SET section=? WHERE school_id=? AND section=?', v.name, u.school_id, existing.name);
          run('UPDATE lessons SET section=? WHERE school_id=? AND section=?', v.name, u.school_id, existing.name);
          run('UPDATE teacher_classes SET class_name=? WHERE school_id=? AND class_name=?', v.name, u.school_id, existing.name);
        }
        if (v.leadTeacherId) {
          run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, v.leadTeacherId, v.name);
        }
      } else {
        if (one('SELECT 1 FROM classes WHERE school_id=? AND name=?', u.school_id, v.name))
          fail('توجد شعبة بهذا الاسم بالفعل', 409);
        const maxOrder = one('SELECT COALESCE(MAX(sort_order),0) m FROM classes WHERE school_id=?', u.school_id)?.m || 0;
        run(
          'INSERT INTO classes(id,school_id,name,grade_level,location,room,sort_order,lead_teacher_id) VALUES(?,?,?,?,?,?,?,?)',
          id(),
          u.school_id,
          v.name,
          v.gradeLevel || '',
          v.location || '',
          v.room || '',
          maxOrder + 1,
          v.leadTeacherId || null,
        );
        if (v.leadTeacherId) {
          run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, v.leadTeacherId, v.name);
        }
      }
      audit(u, `Saved class ${v.name}`);
    })();
    return { ok: true };
  });

  app.post('/api/classes/:id/lead-teacher', async (req) => {
    const u = req.user;
    schoolManager(u);
    const cls = one('SELECT * FROM classes WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!cls) fail('Class not found', 404);
    const v = z.object({ teacherId: z.string().nullable() }).parse(req.body);
    if (v.teacherId) {
      const teacher = one("SELECT id FROM users WHERE id=? AND school_id=? AND role='teacher'", v.teacherId, u.school_id);
      if (!teacher) fail('Teacher not found', 404);
    }
    ctx.db.transaction(() => {
      run('UPDATE classes SET lead_teacher_id=? WHERE id=?', v.teacherId || null, cls.id);
      if (v.teacherId) {
        run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, v.teacherId, cls.name);
        run("UPDATE users SET section=? WHERE id=? AND (section IS NULL OR section='')", cls.name, v.teacherId);
      }
      audit(u, `Set lead teacher for ${cls.name}`);
    })();
    return { ok: true };
  });

  app.post('/api/classes/reorder', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        mode: z.enum(['auto', 'manual']).optional(),
        classIds: z.array(text).min(1).max(300).optional(),
      })
      .parse(req.body);
    if (v.mode === 'auto' || !v.classIds?.length) {
      syncClassSortOrders(ctx.db, u.school_id, true);
      audit(u, 'Auto-sorted classes by grade level');
      return { ok: true };
    }
    ctx.db.transaction(() => {
      v.classIds.forEach((cid, idx) => {
        run('UPDATE classes SET sort_order=? WHERE id=? AND school_id=?', idx + 1, cid, u.school_id);
      });
      audit(u, 'Reordered classes manually');
    })();
    return { ok: true };
  });

  app.post('/api/classes/:id/delete', async (req) => {
    const u = req.user;
    schoolManager(u);
    const c = one('SELECT * FROM classes WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!c) fail('Class not found', 404);
    if (one('SELECT 1 FROM students WHERE school_id=? AND section=?', u.school_id, c.name))
      fail('انقل الطلاب من هذه الشعبة أولاً قبل حذفها', 409);
    run('DELETE FROM teacher_classes WHERE school_id=? AND class_name=?', u.school_id, c.name);
    run('DELETE FROM classes WHERE id=?', c.id);
    return { ok: true };
  });

  app.post('/api/subjects', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(200).optional(),
        color: z.enum(['blue', 'peach', 'mint', 'lilac', 'pink', 'yellow']).optional(),
      })
      .parse(req.body);
    ctx.db.transaction(() => {
      if (v.id) {
        const cur = one('SELECT * FROM subjects WHERE id=? AND school_id=?', v.id, u.school_id);
        if (!cur) fail('Subject not found', 404);
        run('UPDATE subjects SET name=?,description=?,color=? WHERE id=?', v.name, v.description || '', v.color || 'blue', v.id);
        if (cur.name !== v.name) {
          run('UPDATE lessons SET subject=? WHERE school_id=? AND subject=?', v.name, u.school_id, cur.name);
          run('UPDATE teacher_subjects SET subject=? WHERE school_id=? AND subject=?', v.name, u.school_id, cur.name);
          run('UPDATE homework SET subject=? WHERE school_id=? AND subject=?', v.name, u.school_id, cur.name);
          run('UPDATE grades SET subject=? WHERE school_id=? AND subject=?', v.name, u.school_id, cur.name);
        }
      } else {
        if (one('SELECT 1 FROM subjects WHERE school_id=? AND name=?', u.school_id, v.name))
          fail('المادة الدراسية مسجلة بالفعل', 409);
        run(
          'INSERT INTO subjects(id,school_id,name,description,color) VALUES(?,?,?,?,?)',
          id(),
          u.school_id,
          v.name,
          v.description || '',
          v.color || 'blue',
        );
      }
      audit(u, `Saved subject ${v.name}`);
    })();
    return { ok: true };
  });

  app.post('/api/teachers/:id/assignments', async (req) => {
    const u = req.user;
    schoolManager(u);
    const t = one("SELECT * FROM users WHERE id=? AND school_id=? AND role='teacher'", req.params.id, u.school_id);
    if (!t) fail('Teacher not found', 404);
    const v = z
      .object({
        classes: z.array(z.string().trim().min(1).max(80)).max(30),
        subjects: z.array(z.string().trim().min(1).max(80)).max(30),
        wings: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      })
      .parse(req.body);
    ctx.db.transaction(() => {
      run('DELETE FROM teacher_classes WHERE teacher_id=?', t.id);
      run('DELETE FROM teacher_subjects WHERE teacher_id=?', t.id);
      for (const cls of new Set(v.classes)) {
        run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, t.id, cls);
        run('INSERT OR IGNORE INTO classes(id,school_id,name) VALUES(?,?,?)', id(), u.school_id, cls);
      }
      for (const sub of new Set(v.subjects)) {
        run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', u.school_id, t.id, sub);
        run('INSERT OR IGNORE INTO subjects(id,school_id,name) VALUES(?,?,?)', id(), u.school_id, sub);
      }
      if (v.wings !== undefined) {
        run('DELETE FROM teacher_wings WHERE teacher_id=?', t.id);
        for (const w of new Set(v.wings)) {
          run('INSERT OR IGNORE INTO teacher_wings(school_id,teacher_id,wing) VALUES(?,?,?)', u.school_id, t.id, w);
        }
      }
      run('UPDATE users SET section=? WHERE id=?', v.classes[0] || null, t.id);
      audit(u, `Updated teacher assignments for ${t.name}`);
    })();
    return { ok: true };
  });
}

module.exports = { registerSchoolRoutes };
