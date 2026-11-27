/**
 * Jordanian timetable period/lesson creation, update, and deletion routes
 * shared by Principal (`admin`) and Assistant Principal (`assistant`).
 */
const { z } = require('zod');
const { id, text, time, fail } = require('./db.cjs');
const { periodWindow } = require('./state.cjs');
const {
  buildScheduleOverview,
  updateScheduleConfig,
  upsertScheduleCell,
  optimizeSectionForAbsences,
  rewriteScheduleForAbsences,
  applyUniversalSchedule,
  swapLessons,
} = require('./schedule-service.cjs');

function registerLessonRoutes(app, ctx) {
  const { one, run, audit, schoolManager, lesson } = ctx;

  const teacherAssigned = (schoolId, teacherId, section) =>
    one(
      "SELECT 1 FROM users u WHERE u.id=? AND u.school_id=? AND u.role='teacher' AND (u.section=? OR EXISTS(SELECT 1 FROM teacher_classes tc WHERE tc.teacher_id=u.id AND tc.class_name=?))",
      teacherId,
      schoolId,
      section,
      section,
    );

  app.post('/api/lessons', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        section: text,
        teacherId: text,
        subject: text,
        room: text,
        weekday: z.number().int().min(0).max(6),
        start: time.optional(),
        end: time.optional(),
        periodNumber: z.number().int().min(1).max(10).optional(),
        color: z.enum(['blue', 'peach', 'mint', 'lilac', 'pink', 'yellow']).optional(),
      })
      .parse(req.body);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    const derived = v.periodNumber ? periodWindow(school, v.periodNumber) : null;
    const start = v.start || derived?.start || fail('حدد وقت الحصة أو رقمها', 400);
    const end = v.end || derived?.end || fail('حدد نهاية الحصة', 400);
    if (start >= end) fail('End must be after start', 400);
    if (v.periodNumber) {
      const validTeacher = one(
        "SELECT 1 FROM users WHERE id=? AND school_id=? AND role='teacher'",
        v.teacherId,
        u.school_id,
      );
      if (!validTeacher) fail('Choose a teacher in this school', 400);
    } else {
      if (!teacherAssigned(u.school_id, v.teacherId, v.section))
        fail('Choose a teacher assigned to this class', 400);
      if (start < school.start_time || end > school.end_time)
        fail('Lesson must be within school hours', 400);
    }
    if (
      one(
        'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND start<? AND end>? AND (section=? OR teacher_id=? OR room=?)',
        u.school_id,
        v.weekday,
        end,
        start,
        v.section,
        v.teacherId,
        v.room,
      )
    )
      fail('Schedule conflict: class, teacher, or room already booked', 409);
    ctx.db.transaction(() => {
      if (v.periodNumber) {
        run(
          'INSERT OR IGNORE INTO classes(id,school_id,name,room) VALUES(?,?,?,?)',
          id(),
          u.school_id,
          v.section,
          v.room,
        );
        run(
          'INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)',
          u.school_id,
          v.teacherId,
          v.section,
        );
        if (end > school.end_time) {
          run('UPDATE schools SET end_time=? WHERE id=?', end, u.school_id);
        }
      }
      run(
        'INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        id(),
        u.school_id,
        v.section,
        v.teacherId,
        v.subject,
        v.room,
        v.weekday,
        start,
        end,
        v.color || 'blue',
        v.periodNumber || 1,
      );
      run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', u.school_id, v.teacherId, v.subject);
      audit(u, 'Created timetable lesson');
    })();
    return { ok: true };
  });

  app.post('/api/lessons/:id', async (req) => {
    const u = req.user;
    schoolManager(u);
    const l = lesson(u, req.params.id);
    const v = z
      .object({
        start: time,
        end: time,
        room: text,
        teacherId: z.string().optional(),
        periodNumber: z.number().int().min(1).max(10).optional(),
      })
      .refine((x) => x.start < x.end, 'End must be after start')
      .parse(req.body);
    const teacherId = v.teacherId || l.teacher_id;
    if (!teacherAssigned(u.school_id, teacherId, l.section))
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
    ctx.db.transaction(() => {
      run(
        'UPDATE lessons SET start=?,end=?,room=?,teacher_id=?,period_number=? WHERE id=?',
        v.start,
        v.end,
        v.room,
        teacherId,
        v.periodNumber || l.period_number || 1,
        l.id,
      );
      audit(u, `Updated timetable ${l.id}`);
    })();
    return { ok: true };
  });

  app.post('/api/lessons/:id/delete', async (req) => {
    const u = req.user;
    schoolManager(u);
    const l = lesson(u, req.params.id);
    if (one('SELECT 1 FROM attendance WHERE lesson_id=?', l.id))
      fail('لا يمكن حذف حصة مسجّل بها حضور', 409);
    run('DELETE FROM lessons WHERE id=?', l.id);
    audit(u, `Deleted lesson ${l.id}`);
    return { ok: true };
  });

  /** Return full school-wide daily schedule overview + lead teachers + period slots. */
  app.get('/api/schedule/overview', async (req) => {
    ctx.staff(req.user);
    const wd = Math.max(0, Math.min(6, Number(req.query?.weekday ?? 0) || 0));
    return buildScheduleOverview(ctx, req.user.school_id, wd);
  });

  /** Apply a universal weekly schedule template across all (or targeted) classes. */
  app.post('/api/lessons/universal', async (req) => {
    schoolManager(req.user);
    const v = z
      .object({
        replaceExisting: z.boolean().default(true),
        targetSections: z.array(text).max(40).optional(),
        entries: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              periodNumber: z.number().int().min(1).max(10),
              subject: text,
              teacherId: z.string().optional(),
              color: z.enum(['blue', 'peach', 'mint', 'lilac', 'pink', 'yellow']).optional(),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(req.body);
    return applyUniversalSchedule(ctx, req.user, v);
  });

  /** Swap two existing lessons' time slots atomically with conflict checks. */
  app.post('/api/lessons/swap', async (req) => {
    schoolManager(req.user);
    const v = z.object({ lessonIdA: text, lessonIdB: text }).parse(req.body);
    return swapLessons(ctx, req.user, v.lessonIdA, v.lessonIdB);
  });

  app.post('/api/schedule/config', async (req) => {
    schoolManager(req.user);
    const v = z.object({
      start_time: time.optional(),
      period_minutes: z.number().int().min(15).max(120).optional(),
      break_minutes: z.number().int().min(0).max(45).optional(),
      period_count: z.number().int().min(1).max(12).optional(),
      schedule_mode: z.enum(['manual', 'auto']).optional(),
      active_period: z.number().int().min(1).max(12).nullable().optional(),
      duty_notes: z.string().max(1500).optional(),
    }).parse(req.body);
    return updateScheduleConfig(ctx, req.user, v);
  });

  app.post('/api/schedule/cell', async (req) => {
    schoolManager(req.user);
    const v = z.object({
      section: text,
      weekday: z.number().int().min(0).max(6),
      periodNumber: z.number().int().min(1).max(12),
      action: z.enum(['upsert', 'cancel', 'restore', 'clear']).default('upsert'),
      subject: z.string().trim().max(100).optional(),
      teacherId: z.string().optional(),
      color: z.enum(['blue', 'peach', 'mint', 'lilac', 'pink', 'yellow']).optional(),
    }).parse(req.body);
    return upsertScheduleCell(ctx, req.user, v);
  });

  app.post('/api/schedule/teacher-absence', async (req) => {
    schoolManager(req.user);
    const v = z.object({ teacherId: text, isAbsent: z.boolean() }).parse(req.body);
    ctx.run("UPDATE users SET is_absent=? WHERE id=? AND school_id=? AND role='teacher'", v.isAbsent ? 1 : 0, v.teacherId, req.user.school_id);
    return { ok: true };
  });

  app.post('/api/schedule/optimize-section', async (req) => {
    schoolManager(req.user);
    const v = z.object({ section: text, weekday: z.number().int().min(0).max(6) }).parse(req.body);
    return optimizeSectionForAbsences(ctx, req.user, v.section, v.weekday);
  });

  app.post('/api/schedule/rewrite-absences', async (req) => {
    schoolManager(req.user);
    const v = z.object({ weekday: z.number().int().min(0).max(6) }).parse(req.body);
    return rewriteScheduleForAbsences(ctx, req.user, v.weekday);
  });

  app.post('/api/schedule/profiles', async (req) => {
    schoolManager(req.user);
    const v = z.object({ name: text }).parse(req.body);
    const ov = buildScheduleOverview(ctx, req.user.school_id, 0);
    const allLessons = ctx.all('SELECT section,teacher_id,subject,room,weekday,start,end,color,period_number,status FROM lessons WHERE school_id=?', req.user.school_id);
    const pid = id();
    ctx.run('INSERT INTO schedule_profiles(id,school_id,name,config_json,cells_json) VALUES(?,?,?,?,?)', pid, req.user.school_id, v.name, JSON.stringify(ov.school), JSON.stringify(allLessons));
    return { ok: true, id: pid };
  });

  app.post('/api/schedule/profiles/:id/load', async (req) => {
    schoolManager(req.user);
    const p = one('SELECT * FROM schedule_profiles WHERE id=? AND school_id=?', req.params.id, req.user.school_id);
    if (!p) fail('Profile not found', 404);
    const cfg = JSON.parse(p.config_json);
    const saved = JSON.parse(p.cells_json);
    ctx.db.transaction(() => {
      updateScheduleConfig(ctx, req.user, cfg);
      ctx.run("DELETE FROM lessons WHERE school_id=? AND id NOT IN (SELECT COALESCE(lesson_id,'') FROM attendance)", req.user.school_id);
      for (const l of saved) {
        ctx.run("INSERT OR IGNORE INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", id(), req.user.school_id, l.section, l.teacher_id, l.subject, l.room, l.weekday, l.start, l.end, l.color || 'blue', l.period_number || 1, l.status || 'active');
      }
    })();
    return { ok: true };
  });

  app.post('/api/schedule/profiles/:id/delete', async (req) => {
    schoolManager(req.user);
    ctx.run('DELETE FROM schedule_profiles WHERE id=? AND school_id=?', req.params.id, req.user.school_id);
    return { ok: true };
  });
}

module.exports = { registerLessonRoutes };
