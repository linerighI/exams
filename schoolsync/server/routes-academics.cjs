/**
 * Academic routes: homework assignment, student submissions, grade recording, and publication.
 */
const { z } = require('zod');
const { id, day, text, fail } = require('./db.cjs');

function registerAcademicRoutes(app, ctx) {
  const { one, all, run, audit, notify, student, staff, teacherCanManageSubject } = ctx;

  app.post('/api/homework/:id/submit', async (req) => {
    const u = req.user;
    if (u.role !== 'student') fail('Only students submit work');
    const v = z.object({ content: text }).parse(req.body);
    const s = student(u, one('SELECT id FROM students WHERE user_id=?', u.id)?.id);
    const hw = one('SELECT * FROM homework WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!hw || hw.section !== s.section) fail('Homework not found', 404);
    ctx.db.transaction(() => {
      run(
        'INSERT INTO submissions(homework_id,student_id,content) VALUES(?,?,?) ON CONFLICT(homework_id,student_id) DO UPDATE SET content=excluded.content,created=CURRENT_TIMESTAMP',
        hw.id,
        s.id,
        v.content,
      );
      audit(u, `Submitted homework ${hw.id}`);
    })();
    return { ok: true };
  });

  app.post('/api/homework', async (req) => {
    const u = req.user;
    staff(u);
    const v = z.object({ section: text, subject: text, title: text, description: text, due: z.iso.date() }).parse(req.body);
    if (!teacherCanManageSubject(u, v.section, v.subject))
      fail('You are not assigned to this subject and section');
    ctx.db.transaction(() => {
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
      for (const s of all('SELECT * FROM students WHERE school_id=? AND section=?', u.school_id, v.section))
        notify(u, s.id, 'واجب جديد', v.title);
      audit(u, `Published homework: ${v.title}`);
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
      .refine((x) => x.score <= x.max, 'Score cannot exceed maximum')
      .parse(req.body);
    const s = student(u, v.studentId);
    if (!teacherCanManageSubject(u, s.section, v.subject)) fail('Subject access denied');
    ctx.db.transaction(() => {
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

  app.post('/api/grades/:id/publish', async (req) => {
    const u = req.user;
    staff(u);
    const g = one('SELECT * FROM grades WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!g || (u.role === 'teacher' && g.teacher_id !== u.id)) fail('Grade access denied');
    student(u, g.student_id);
    ctx.db.transaction(() => {
      if (!g.published) {
        run('UPDATE grades SET published=1 WHERE id=?', g.id);
        notify(u, g.student_id, 'تحديث دراسي جديد', `${g.subject}: ${g.title}`);
        audit(u, 'Published draft grade');
      }
    })();
    return { ok: true };
  });
}

module.exports = { registerAcademicRoutes };
