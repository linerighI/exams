/**
 * Portable School Database Schema Validator, Starter Template, and Exporter.
 * Isolates validation & snapshot serialization from transactional import mutations.
 */
const { z } = require('zod');
const { normalizeNationalId, text, time, fail } = require('./db.cjs');

const colorEnum = z.enum(['blue', 'peach', 'mint', 'lilac', 'pink', 'yellow']);

const optionalNationalId = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? normalizeNationalId(v) : undefined),
  z.string().regex(/^\d{5,20}$/, 'الرقم الوطني يجب أن يتكون من ٥ أرقام على الأقل').optional(),
);

const ImportSchema = z.object({
  version: z.number().int().optional(),
  mode: z.enum(['merge', 'replace']).default('merge'),
  defaultPassword: z.string().min(12).max(200).optional(),
  school: z
    .object({
      name: text.optional(),
      principalName: text.optional(),
      timezone: text.optional(),
      start_time: time.optional(),
      end_time: time.optional(),
      period_minutes: z.number().int().min(20).max(90).optional(),
      break_minutes: z.number().int().min(0).max(30).optional(),
      period_count: z.number().int().min(1).max(10).optional(),
      workdays: z.string().regex(/^[0-6](,[0-6])*$/).optional(),
      duty_notes: z.string().max(1000).optional(),
    })
    .optional(),
  classes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        gradeLevel: z.string().trim().max(60).optional(),
        location: z.string().trim().max(120).optional(),
        room: z.string().trim().max(60).optional(),
        sortOrder: z.number().int().min(0).max(500).optional(),
      }),
    )
    .max(200)
    .default([]),
  subjects: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(200).optional(),
        color: colorEnum.optional(),
      }),
    )
    .max(200)
    .default([]),
  teachers: z
    .array(
      z.object({
        name: text,
        email: z.email(),
        password: z.string().min(12).max(200).optional(),
        classes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
        subjects: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
      }),
    )
    .max(300)
    .default([]),
  parents: z
    .array(
      z.object({
        name: text,
        email: z.email(),
        password: z.string().min(12).max(200).optional(),
      }),
    )
    .max(1000)
    .default([]),
  students: z
    .array(
      z.object({
        name: text,
        section: text,
        guardianPhone: z.string().trim().max(40).optional(),
        initials: z.string().trim().max(8).optional(),
        color: colorEnum.optional(),
        guardianEmail: z.email().optional(),
        guardianEmails: z.array(z.email()).max(5).optional(),
        nationalId: optionalNationalId,
        familyCode: z.string().min(8).max(200).optional(),
        studentEmail: z.email().optional(),
        studentPassword: z.string().min(12).max(200).optional(),
      }),
    )
    .max(2000)
    .default([]),
  lessons: z
    .array(
      z.object({
        section: text,
        teacherEmail: z.email().optional(),
        teacherName: text.optional(),
        subject: text,
        room: text,
        weekday: z.number().int().min(0).max(6),
        start: time.optional(),
        end: time.optional(),
        periodNumber: z.number().int().min(1).max(10).optional(),
        color: colorEnum.optional(),
      }),
    )
    .max(2000)
    .default([]),
  homework: z
    .array(
      z.object({
        section: text,
        teacherEmail: z.email().optional(),
        subject: text,
        title: text,
        description: text,
        due: z.iso.date(),
        color: colorEnum.optional(),
      }),
    )
    .max(1000)
    .default([]),
  announcements: z.array(z.object({ title: text, content: text })).max(200).default([]),
});

function makeInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
}

function exportSchoolSnapshot(ctx, schoolId) {
  const { one, all } = ctx;
  const school = one('SELECT * FROM schools WHERE id=?', schoolId);
  if (!school) fail('School not found', 404);
  const teacherEmailById = new Map(
    all("SELECT id, email FROM users WHERE school_id=? AND role='teacher'", schoolId).map((u) => [u.id, u.email]),
  );
  const teachers = all("SELECT id, name, email, section FROM users WHERE school_id=? AND role='teacher' ORDER BY name", schoolId).map(
    (t) => {
      const cls = all('SELECT class_name FROM teacher_classes WHERE school_id=? AND teacher_id=? ORDER BY class_name', schoolId, t.id).map(
        (r) => r.class_name,
      );
      if (t.section && !cls.includes(t.section)) cls.unshift(t.section);
      const subs = all('SELECT subject FROM teacher_subjects WHERE school_id=? AND teacher_id=? ORDER BY subject', schoolId, t.id).map(
        (r) => r.subject,
      );
      return { name: t.name, email: t.email, classes: [...new Set(cls)], subjects: [...new Set(subs)] };
    },
  );
  const parents = all("SELECT name, email FROM users WHERE school_id=? AND role='parent' ORDER BY name", schoolId);
  const students = all('SELECT * FROM students WHERE school_id=? ORDER BY section, name', schoolId).map((s) => {
    const guardianEmails = all(
      'SELECT u.email FROM guardian_links g JOIN users u ON u.id=g.guardian_id WHERE g.student_id=? ORDER BY u.email',
      s.id,
    ).map((r) => r.email);
    const studentUser = s.user_id ? one('SELECT email FROM users WHERE id=?', s.user_id)?.email : undefined;
    return {
      name: s.name,
      section: s.section,
      guardianPhone: s.guardian_phone || '',
      initials: s.initials,
      color: s.color,
      guardianEmails,
      ...(studentUser ? { studentEmail: studentUser } : {}),
    };
  });
  const adminUser = one("SELECT name FROM users WHERE school_id=? AND role='admin' ORDER BY name LIMIT 1", schoolId);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    school: {
      name: school.name,
      ...(adminUser?.name ? { principalName: adminUser.name } : {}),
      timezone: school.timezone,
      start_time: school.start_time,
      end_time: school.end_time,
      period_minutes: school.period_minutes,
      break_minutes: school.break_minutes,
      period_count: school.period_count,
      workdays: school.workdays,
      duty_notes: school.duty_notes || '',
    },
    classes: all(
      'SELECT name, grade_level gradeLevel, location, room, sort_order sortOrder FROM classes WHERE school_id=? ORDER BY sort_order ASC, name ASC',
      schoolId,
    ),
    subjects: all('SELECT name, description, color FROM subjects WHERE school_id=? ORDER BY name', schoolId),
    teachers,
    parents,
    students,
    lessons: all('SELECT * FROM lessons WHERE school_id=? ORDER BY weekday, start, section', schoolId).map((l) => ({
      section: l.section,
      teacherEmail: teacherEmailById.get(l.teacher_id) || undefined,
      subject: l.subject,
      room: l.room,
      weekday: l.weekday,
      start: l.start,
      end: l.end,
      periodNumber: l.period_number,
      color: l.color,
    })),
    homework: all('SELECT * FROM homework WHERE school_id=? ORDER BY due', schoolId).map((h) => ({
      section: h.section,
      teacherEmail: teacherEmailById.get(h.teacher_id) || undefined,
      subject: h.subject,
      title: h.title,
      description: h.description,
      due: h.due,
      color: h.color,
    })),
    announcements: all('SELECT title, content FROM announcements WHERE school_id=? ORDER BY created DESC', schoolId),
  };
}

function sampleSchoolTemplate() {
  return {
    version: 1,
    mode: 'merge',
    defaultPassword: 'SchoolSync!2026',
    school: {
      name: 'اسم المدرسة',
      timezone: 'Asia/Amman',
      start_time: '08:00',
      end_time: '14:30',
      period_minutes: 45,
      break_minutes: 5,
      period_count: 8,
      workdays: '0,1,2,3,4',
      duty_notes: 'المناوبة الصباحية: الساحة الرئيسية',
    },
    classes: [{ name: 'الصف الثامن - أ', gradeLevel: 'الثامن', location: 'الطابق الثاني', room: '201' }],
    subjects: [{ name: 'الرياضيات', description: 'المنهاج الأساسي', color: 'blue' }],
    teachers: [{ name: 'أ. خالد محمود', email: 'khaled@school.edu.jo', classes: ['الصف الثامن - أ'], subjects: ['الرياضيات'] }],
    parents: [{ name: 'أحمد العلي', email: 'parent1@school.edu.jo' }],
    students: [
      {
        name: 'سيف أحمد العلي',
        section: 'الصف الثامن - أ',
        guardianPhone: '0790000001',
        guardianEmails: ['parent1@school.edu.jo'],
        nationalId: '2000123456',
        familyCode: 'FamilyPass2026',
      },
    ],
    lessons: [{ section: 'الصف الثامن - أ', teacherEmail: 'khaled@school.edu.jo', subject: 'الرياضيات', room: '201', weekday: 0, periodNumber: 1, color: 'blue' }],
    announcements: [{ title: 'أهلاً بكم', content: 'تم تحديث بيانات العام الدراسي.' }],
  };
}

module.exports = { ImportSchema, makeInitials, exportSchoolSnapshot, sampleSchoolTemplate };
