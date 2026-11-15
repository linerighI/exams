/**
 * Classroom and immediate-notification routes: 1-tap attendance, lesson attendance,
 * behavior/class notes, incidents, announcements, and one-way notification read state.
 */
const { z } = require('zod');
const { id, day, text, fail } = require('./db.cjs');

function registerClassroomRoutes(app, ctx) {
  const { one, all, run, audit, notify, student, staff, schoolManager, lesson, clock } = ctx;

  const hhmm = (zone) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(clock());

  function notifyAttendanceChange(u, s, status, prevStatus, subjectLabel) {
    if (status === 'absent' && prevStatus !== 'absent') {
      notify(u, s.id, 'تنبيه غياب فوري', `تم تسجيل غياب ${s.name} اليوم (${subjectLabel}).`);
    } else if (status === 'late' && prevStatus !== 'late') {
      notify(u, s.id, 'تنبيه تأخر', `تم تسجيل تأخر ${s.name} اليوم (${subjectLabel}).`);
    }
  }

  /** Instant 1-tap attendance toggle from Students list or Student Profile. */
  app.post('/api/attendance/quick', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        studentId: text,
        status: z.enum(['present', 'absent', 'late', 'excused']),
        lessonId: z.string().optional(),
      })
      .parse(req.body);
    const s = student(u, v.studentId);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    const todayDate = day(school.timezone, clock());
    const now = hhmm(school.timezone);
    const weekday = new Date(`${todayDate}T12:00:00Z`).getUTCDay();
    const targetLesson = v.lessonId
      ? lesson(u, v.lessonId)
      : one(
          'SELECT * FROM lessons WHERE school_id=? AND section=? AND weekday=? AND start<=? AND end>? ORDER BY start LIMIT 1',
          u.school_id,
          s.section,
          weekday,
          now,
          now,
        ) ||
        one(
          'SELECT * FROM lessons WHERE school_id=? AND section=? AND weekday=? ORDER BY start LIMIT 1',
          u.school_id,
          s.section,
          weekday,
        );
    if (targetLesson && targetLesson.section !== s.section) fail('Student is not enrolled in this class');

    ctx.db.transaction(() => {
      const prev = one(
        'SELECT status FROM daily_attendance WHERE student_id=? AND date=?',
        s.id,
        todayDate,
      )?.status;
      const label = targetLesson ? targetLesson.subject : 'الحضور اليومي';
      run(
        'INSERT INTO daily_attendance(id,school_id,student_id,date,status,label,lesson_id,recorded_by,updated) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status,label=excluded.label,lesson_id=excluded.lesson_id,recorded_by=excluded.recorded_by,updated=CURRENT_TIMESTAMP',
        id(),
        u.school_id,
        s.id,
        todayDate,
        v.status,
        label,
        targetLesson ? targetLesson.id : null,
        u.id,
      );
      if (targetLesson) {
        run(
          'INSERT INTO attendance(id,school_id,student_id,lesson_id,date,status,recorded_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(student_id,lesson_id,date) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by',
          id(),
          u.school_id,
          s.id,
          targetLesson.id,
          todayDate,
          v.status,
          u.id,
        );
      }
      notifyAttendanceChange(u, s, v.status, prev, label);
      audit(u, `Quick attendance ${v.status} for ${s.name}`);
    })();
    return { ok: true, status: v.status, date: todayDate };
  });

  app.post('/api/attendance', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        lessonId: text,
        date: z.iso.date(),
        records: z.array(z.object({ studentId: text, status: z.enum(['present', 'absent', 'late', 'excused']) })).min(1).max(100),
      })
      .parse(req.body);
    const l = lesson(u, v.lessonId);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    if (v.date !== day(school.timezone, clock())) fail('Attendance can only be recorded for today', 400);
    if (l.weekday !== new Date(`${v.date}T12:00:00Z`).getUTCDay()) fail('This lesson is not scheduled for today', 400);
    const now = hhmm(school.timezone);
    if (now < l.start || now > school.end_time)
      fail('Attendance is available from the lesson start until dismissal', 400);
    ctx.db.transaction(() => {
      for (const r of v.records) {
        const s = student(u, r.studentId);
        if (s.section !== l.section) fail('Student is not enrolled in this class');
        const prev = one(
          'SELECT status FROM attendance WHERE student_id=? AND lesson_id=? AND date=?',
          s.id,
          l.id,
          v.date,
        )?.status;
        run(
          'INSERT INTO attendance(id,school_id,student_id,lesson_id,date,status,recorded_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(student_id,lesson_id,date) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by',
          id(),
          u.school_id,
          s.id,
          l.id,
          v.date,
          r.status,
          u.id,
        );
        run(
          'INSERT INTO daily_attendance(id,school_id,student_id,date,status,label,lesson_id,recorded_by,updated) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status,label=excluded.label,lesson_id=excluded.lesson_id,recorded_by=excluded.recorded_by,updated=CURRENT_TIMESTAMP',
          id(),
          u.school_id,
          s.id,
          v.date,
          r.status,
          l.subject,
          l.id,
          u.id,
        );
        notifyAttendanceChange(u, s, r.status, prev, l.subject);
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
            const incident = one('SELECT id FROM incidents WHERE student_id=? AND date=?', s.id, v.date);
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
    schoolManager(u);
    const v = z.object({ status: z.enum(['investigating', 'resolved']), resolution: text }).parse(req.body);
    const i = one('SELECT * FROM incidents WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!i) fail('Incident not found', 404);
    ctx.db.transaction(() => {
      run('UPDATE incidents SET status=?,resolution=? WHERE id=?', v.status, v.resolution, i.id);
      run('INSERT INTO incident_events(id,incident_id,actor_id,detail) VALUES(?,?,?,?)', id(), i.id, u.id, v.resolution);
      notify(u, i.student_id, `تحديث متابعة الحضور: ${v.status === 'resolved' ? 'تمت المعالجة' : 'قيد المتابعة'}`, v.resolution);
      audit(u, `Incident ${i.id}: ${v.status}`);
    })();
    return { ok: true };
  });

  app.post('/api/notes', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        studentId: text,
        content: text,
        category: z.enum(['behavior', 'academic', 'general']).optional(),
      })
      .parse(req.body);
    const s = student(u, v.studentId);
    const cat = v.category || 'behavior';
    const title =
      cat === 'behavior'
        ? `ملاحظة سلوكية · ${s.name}`
        : cat === 'academic'
          ? `ملاحظة تعليمية · ${s.name}`
          : `ملاحظة من المعلم · ${s.name}`;
    ctx.db.transaction(() => {
      run(
        'INSERT INTO notes(id,school_id,student_id,author_id,content,category) VALUES(?,?,?,?,?,?)',
        id(),
        u.school_id,
        v.studentId,
        u.id,
        v.content,
        cat,
      );
      notify(u, v.studentId, title, v.content);
      audit(u, 'Published student note');
    })();
    return { ok: true };
  });

  app.post('/api/messages', async () => {
    fail('تم إيقاف المراسلة المباشرة للحفاظ على خصوصية المعلمين؛ تصلك جميع التنبيهات تلقائياً.', 410);
  });

  app.post('/api/notifications/read', async (req) => {
    ctx.run('UPDATE notifications SET read=1 WHERE user_id=?', req.user.id);
    return { ok: true };
  });

  app.post('/api/notifications/:id/read', async (req) => {
    ctx.run('UPDATE notifications SET read=1 WHERE id=? AND user_id=?', req.params.id, req.user.id);
    return { ok: true };
  });

  app.post('/api/announcements', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z.object({ title: text, content: text }).parse(req.body);
    ctx.db.transaction(() => {
      run('INSERT INTO announcements(id,school_id,author_id,title,content) VALUES(?,?,?,?,?)', id(), u.school_id, u.id, v.title, v.content);
      for (const r of all('SELECT id FROM users WHERE school_id=?', u.school_id))
        ctx.insertNotification(r.id, u.school_id, v.title, v.content);
      audit(u, 'Published announcement');
    })();
    return { ok: true };
  });

  app.get('/api/notifications/pending', async (req) => {
    const rows = all(
      'SELECT id,title,content,read,created FROM notifications WHERE user_id=? AND read=0 ORDER BY created DESC LIMIT 30',
      req.user.id,
    );
    return { notifications: rows, unreadCount: rows.length };
  });

  app.post('/api/notifications/test', async (req) => {
    const title = 'إشعار تجريبي · مدرسة محمد الشريقي';
    const content = 'تم ربط التنبيهات الفورية بهاتفك بنجاح عبر خادم المدرسة.';
    const nid = ctx.insertNotification(req.user.id, req.user.school_id, title, content);
    return { ok: true, id: nid, title, content };
  });

  app.get('/api/notifications/stream', async (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const send = (payload) => {
      res.write(`event: notification\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    res.write(': connected\n\n');
    const keepalive = setInterval(() => res.write(': ping\n\n'), 25000);
    const unsubscribe = ctx.subscribeUserNotifications(req.user.id, send);
    req.raw.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
      res.end();
    });
  });
}

module.exports = { registerClassroomRoutes };
