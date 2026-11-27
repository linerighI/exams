/**
 * Jordanian timetable period/lesson creation, update, and deletion routes
 * shared by Principal (`admin`) and Assistant Principal (`assistant`).
 */
const { z } = require('zod');
const { id, text, time, fail } = require('./db.cjs');
const { periodWindow } = require('./state.cjs');

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

  /** Apply a universal weekly schedule template across all classes in the school. */
  app.post('/api/lessons/universal', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        replaceExisting: z.boolean().default(true),
        entries: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              periodNumber: z.number().int().min(1).max(10),
              subject: text,
              teacherId: z.string().optional(),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(req.body);

    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    const classes = ctx.all('SELECT name, room FROM classes WHERE school_id=?', u.school_id);
    if (!classes.length) fail('لا توجد صفوف دراسية بعد', 400);
    const fallbackTeacher = one("SELECT id FROM users WHERE school_id=? AND role='teacher' LIMIT 1", u.school_id);
    if (!fallbackTeacher) fail('أضف معلماً واحداً على الأقل أولاً', 400);

    let createdCount = 0;
    let maxEnd = school.end_time;
    ctx.db.transaction(() => {
      for (const cls of classes) {
        const lead = one(
          "SELECT u.id FROM users u WHERE u.school_id=? AND u.role='teacher' AND (u.section=? OR EXISTS(SELECT 1 FROM teacher_classes tc WHERE tc.teacher_id=u.id AND tc.class_name=?)) LIMIT 1",
          u.school_id,
          cls.name,
          cls.name,
        );
        for (const entry of v.entries) {
          const derived = periodWindow(school, entry.periodNumber);
          if (!derived) continue;
          const tid = entry.teacherId || lead?.id || fallbackTeacher.id;
          if (v.replaceExisting) {
            run(
              'DELETE FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=? AND id NOT IN (SELECT COALESCE(lesson_id,"") FROM attendance)',
              u.school_id, cls.name, entry.weekday, entry.periodNumber,
            );
          }
          const exists = one(
            'SELECT 1 FROM lessons WHERE school_id=? AND section=? AND weekday=? AND start<? AND end>?',
            u.school_id, cls.name, entry.weekday, derived.end, derived.start,
          );
          if (exists) continue;
          run(
            'INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            id(), u.school_id, cls.name, tid, entry.subject, cls.room || cls.name,
            entry.weekday, derived.start, derived.end, 'blue', entry.periodNumber,
          );
          run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', u.school_id, tid, cls.name);
          run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', u.school_id, tid, entry.subject);
          if (derived.end > maxEnd) maxEnd = derived.end;
          createdCount++;
        }
      }
      if (maxEnd > school.end_time) run('UPDATE schools SET end_time=? WHERE id=?', maxEnd, u.school_id);
      audit(u, `Applied universal schedule (${createdCount} lessons) across ${classes.length} classes`);
    })();
    return { ok: true, createdCount, classCount: classes.length };
  });
}

module.exports = { registerLessonRoutes };
