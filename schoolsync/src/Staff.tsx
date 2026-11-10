import { tr } from './translations';
import { useState, type FormEvent } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCheck,
  GraduationCap,
  Megaphone,
  Plus,
  ShieldCheck,
  LockKeyhole,
  Users,
} from 'lucide-react';
import type { State, Lesson } from './types';
import { dailyLessons } from './screens';
import { Empty, Section, Sheet } from './ui';
export type Mutate = (url: string, body: unknown, success?: string) => Promise<boolean>;
export function Staff({
  data,
  mutate,
  busy,
  mode = 'classroom',
  initialTool = '',
  initialLessonId = '',
  onSectionChange,
}: {
  data: State;
  mutate: Mutate;
  busy: boolean;
  mode?: 'classroom' | 'management';
  initialTool?: string;
  initialLessonId?: string;
  onSectionChange?: (section: string) => void;
}) {
  const [tool, setTool] = useState(initialTool === 'attendance' ? '' : initialTool);
  const [lessonId, setLessonId] = useState(initialLessonId);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [studentId, setStudentId] = useState(data.student?.id || '');
  const lessonSource = mode === 'management' ? data.schoolWorkspace?.lessons || [] : data.lessons;
  const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay();
  const lessons = lessonSource.filter(
    (l) => l.weekday === weekday && (data.user.role === 'admin' || l.teacher_id === data.user.id),
  );
  const selected = lessons.find((l) => l.id === lessonId) || lessons[0];
  const isAdmin = data.user.role === 'admin';
  const section = data.student?.section || data.user.section || '';
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    let url = '',
      body: unknown = f;
    if (tool === 'homework') {
      url = '/homework';
      body = { ...f, section };
    }
    if (tool === 'note') {
      url = '/notes';
      body = { studentId, content: f.content };
    }
    if (tool === 'grade') {
      url = '/grades';
      body = {
        studentId,
        subject: f.subject,
        title: f.title,
        score: Number(f.score),
        max: Number(f.max),
        published: f.published === 'on',
      };
    }
    if (tool === 'announcement') url = '/announcements';
    if (tool === 'student') url = '/students';
    if (tool === 'account') {
      url = '/accounts';
      body = { ...f, studentId, section: f.section || undefined };
    }
    if (tool === 'family') {
      url = '/family-access';
      body = { ...f, studentId };
    }
    if (tool === 'guardian') {
      url = '/guardians';
      body = { studentId, guardianEmail: f.guardianEmail };
    }
    if (tool === 'schedule') {
      url = `/lessons/${f.lessonId}`;
      body = { start: f.start, end: f.end, room: f.room, teacherId: f.teacherId };
    }
    if (tool === 'lesson') {
      url = '/lessons';
      body = { ...f, weekday: Number(f.weekday) };
    }
    if (tool === 'school') url = '/school';
    if (tool.startsWith('incident:')) {
      url = `/incidents/${tool.split(':')[1]}`;
      body = f;
    }
    if (await mutate(url, body, tr('Saved and shared successfully'))) setTool('');
  };
  const titles: Record<string, string> = {
    homework: tr('A new assignment'),
    note: tr('A note that matters'),
    grade: tr('Record a learning milestone'),
    announcement: tr('Share with your school'),
    student: tr('Welcome a student'),
    guardian: tr('Link a verified guardian'),
    schedule: tr('Adjust the timetable'),
    account: tr('Create a school account'),
    lesson: tr('Schedule a lesson'),
    school: tr('School settings'),
    family: 'بيانات دخول العائلة',
  };
  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{tr('A LITTLE CARE. A BIG DIFFERENCE.')}</div>
        <h1>
          {mode === 'management' ? tr('School office') : 'أعمال الصف'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {isAdmin
            ? tr('Keep your school day running smoothly.')
            : tr('More time for the moments that matter.')}
        </p>
      </div>
      {mode === 'classroom' && (
        <label className="staff-section-select">
          الشعبة التي تعمل عليها
          <select value={section} onChange={(e) => onSectionChange?.(e.target.value)}>
            {[...new Set(data.students.map((s) => s.section))].map((s) => (
              <option key={s} value={s}>
                {tr(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="staff-summary" data-reveal>
        <span>
          <Users />
          <strong>{data.students.length}</strong>
          <small>{tr('Accessible students')}</small>
        </span>
        <span>
          <CalendarDays />
          <strong>{lessons.length}</strong>
          <small>{tr('Lessons today')}</small>
        </span>
        <span>
          <ShieldCheck />
          <strong>{data.incidents.filter((i) => i.status !== 'resolved').length}</strong>
          <small>{tr('Open incidents')}</small>
        </span>
      </div>
      <Section title={tr('Make something happen')} />
      <div className="tool-grid" data-reveal>
        {[
          ...(mode === 'classroom'
            ? [
                { id: 'homework', icon: BookOpen, label: tr('Assign homework'), color: 'blue' },
                {
                  id: 'note',
                  icon: GraduationCap,
                  label: tr('Share a student note'),
                  color: 'peach',
                },
                { id: 'grade', icon: CheckCheck, label: tr('Record a grade'), color: 'mint' },
              ]
            : []),
          ...(isAdmin && mode === 'management'
            ? [
                { id: 'account', icon: Users, label: tr('Create an account'), color: 'mint' },
                { id: 'family', icon: LockKeyhole, label: 'دخول العائلة', color: 'blue' },
                { id: 'lesson', icon: CalendarDays, label: tr('Schedule a lesson'), color: 'blue' },
                { id: 'school', icon: ShieldCheck, label: tr('School settings'), color: 'lilac' },
                {
                  id: 'announcement',
                  icon: Megaphone,
                  label: tr('Post an announcement'),
                  color: 'lilac',
                },
                { id: 'student', icon: Users, label: tr('Enroll a student'), color: 'yellow' },
                { id: 'guardian', icon: ShieldCheck, label: tr('Link a guardian'), color: 'pink' },
                {
                  id: 'schedule',
                  icon: CalendarDays,
                  label: tr('Edit the timetable'),
                  color: 'blue',
                },
              ]
            : []),
        ].map((x) => (
          <button className={x.color} key={x.id} onClick={() => setTool(x.id)}>
            <x.icon size={22} />
            <strong>{x.label}</strong>
            <Plus size={16} />
          </button>
        ))}
      </div>
      {mode === 'classroom' && (
        <>
          <Section title={tr('Class-by-class attendance')} />
          <div className="surface" data-reveal>
            <label>
              {tr('Today’s lesson')}
              <select
                value={selected?.id || ''}
                onChange={(e) => {
                  setLessonId(e.target.value);
                  setMarks({});
                }}
              >
                {lessons.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.start} · {tr(l.subject)} · {l.section}
                  </option>
                ))}
              </select>
            </label>
            <p className="form-help">
              {tr(
                'Records start unmarked. Confirm each student before submitting. Attendance opens at lesson start and closes at dismissal.',
              )}
            </p>
            {selected ? (
              data.students
                .filter((s) => s.section === selected.section)
                .map((s) => {
                  const existing = data.rosterAttendance.find(
                    (a) =>
                      a.student_id === s.id && a.lesson_id === selected.id && a.date === data.date,
                  );
                  return (
                    <div className="attendance-student" key={s.id}>
                      <strong>{s.name}</strong>
                      <select
                        aria-label={`Attendance for ${s.name}`}
                        value={marks[s.id] || existing?.status || ''}
                        onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
                      >
                        <option value="">{tr('Not recorded')}</option>
                        {['present', 'absent', 'late', 'excused'].map((x) => (
                          <option key={x} value={x}>
                            {tr(x)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })
            ) : (
              <Empty
                title={tr('No lessons today')}
                detail={tr('Choose another school day to manage the timetable.')}
              />
            )}
            <button
              className="primary"
              disabled={busy || !selected || !Object.values(marks).some(Boolean)}
              onClick={async () => {
                if (
                  await mutate(
                    '/attendance',
                    {
                      lessonId: selected.id,
                      date: data.date,
                      records: Object.entries(marks)
                        .filter(([, v]) => v)
                        .map(([studentId, status]) => ({ studentId, status })),
                    },
                    tr('Attendance recorded'),
                  )
                )
                  setMarks({});
              }}
            >
              <CheckCheck size={17} />
              {tr('Save attendance')}
            </button>
          </div>
          <Section title={tr('Attention, with care')} />
          {data.incidents.length ? (
            data.incidents.map((i) => (
              <article className="incident" key={i.id}>
                <span className="status-label pink">{tr(i.status)}</span>
                <h3>{i.student_name}</h3>
                <p>{i.detail}</p>
                {i.resolution && (
                  <p>
                    <strong>{tr('Staff update:')}</strong> {i.resolution}
                  </p>
                )}
                {isAdmin && (
                  <button className="secondary" onClick={() => setTool(`incident:${i.id}`)}>
                    {tr('Update investigation')}
                  </button>
                )}
              </article>
            ))
          ) : (
            <Empty
              title={tr('Nothing needs investigating')}
              detail={tr('Unexpected absences will be flagged here for staff verification.')}
            />
          )}
          {data.grades.some((g) => !g.published) && (
            <>
              <Section title={tr('Draft grades')} />
              {data.grades
                .filter((g) => !g.published)
                .map((g) => (
                  <div className="draft-grade" key={g.id}>
                    <span className="row-copy">
                      <strong>{g.subject}</strong>
                      <small>
                        {g.title} · {g.score}/{g.max}
                      </small>
                    </span>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/grades/${g.id}/publish`,
                          {},
                          tr('Saved and shared successfully'),
                        )
                      }
                    >
                      {tr('Publish grade')}
                    </button>
                  </div>
                ))}
            </>
          )}
        </>
      )}
      {tool && (
        <Sheet title={titles[tool] || tr('Update attendance incident')} onClose={() => setTool('')}>
          <form onSubmit={submit} className="form-stack">
            {['note', 'grade', 'guardian', 'account', 'family'].includes(tool) && (
              <label>
                {tr('Student')}
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                  {data.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.section}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {['homework', 'grade'].includes(tool) && (
              <label>
                {tr('Subject')}
                <select name="subject" required>
                  {[...new Set(data.lessons.map((l) => l.subject))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            {['homework', 'grade', 'announcement'].includes(tool) && (
              <label>
                {tr('Title')}
                <input name="title" required maxLength={180} />
              </label>
            )}
            {tool === 'homework' && (
              <>
                <label>
                  {tr('Instructions')}
                  <textarea name="description" required rows={4} />
                </label>
                <label>
                  {tr('Due date')}
                  <input type="date" name="due" required defaultValue={data.date} />
                </label>
                <p className="form-help">
                  {tr('Publishing to class')}
                  {section}
                  {tr('. Change the selected student above to change class.')}
                </p>
              </>
            )}
            {tool === 'grade' && (
              <>
                <div className="form-pair">
                  <label>
                    {tr('Score')}
                    <input type="number" min="0" step="0.1" name="score" required />
                  </label>
                  <label>
                    {tr('Out of')}
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      defaultValue="100"
                      name="max"
                      required
                    />
                  </label>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" name="published" />
                  {tr('Publish to student and guardians')}
                </label>
              </>
            )}
            {['note', 'announcement'].includes(tool) && (
              <label>
                {tool === 'note' ? tr('Parent-visible note') : tr('Message')}
                <textarea name="content" rows={5} required maxLength={4000} />
              </label>
            )}
            {tool === 'account' && (
              <>
                <label>
                  {tr('Full name')}
                  <input name="name" required maxLength={180} />
                </label>
                <label>
                  {tr('Email')}
                  <input name="email" type="email" required />
                </label>
                <label>
                  {tr('Initial password')}
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  {tr('Role')}
                  <select name="role">
                    <option value="parent">{tr('Guardian')}</option>
                    <option value="teacher">{tr('Teacher')}</option>
                    <option value="student">{tr('Student')}</option>
                    <option value="admin">{tr('Administrator')}</option>
                  </select>
                </label>
                <label>
                  {tr('Assigned class (required for teachers)')}
                  <input name="section" placeholder="8A" />
                </label>
                <p className="form-help">
                  {tr(
                    'For a student account, the selected enrolled student is linked. Verify identity before securely sharing credentials. Guardian links are added separately.',
                  )}
                </p>
              </>
            )}
            {tool === 'student' && (
              <>
                <label>
                  {tr('Full name')}
                  <input name="name" required />
                </label>
                <label>
                  {tr('Class / section')}
                  <input name="section" required placeholder="8A" />
                </label>
              </>
            )}
            {tool === 'family' && (
              <>
                <label>
                  ولي الأمر الموثّق
                  <select name="guardianEmail" required>
                    {data.accounts
                      .filter((a) => a.role === 'parent')
                      .map((a) => (
                        <option key={a.id} value={a.email}>
                          {a.name} · {a.email}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  الرقم الوطني للطالب
                  <input
                    name="nationalId"
                    inputMode="numeric"
                    type="text"
                    maxLength={10}
                    required
                    dir="ltr"
                    autoComplete="off"
                  />
                </label>
                <label>
                  رمز دخول الطالب
                  <input
                    name="code"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    dir="ltr"
                  />
                </label>
                <p className="form-help">
                  اربط ولي الأمر بالطالب أولاً. لكل طالب رقم وطني ورمز مستقل، وبيانات الأشقاء تفتح
                  حساب العائلة نفسه. لا تُعرض الأرقام أو الرموز بعد الحفظ.
                </p>
                {data.familyAccess.find((a) => a.student_id === studentId) && (
                  <div className="family-config-status">
                    <ShieldCheck size={15} />
                    الدخول مفعّل باسم{' '}
                    {data.familyAccess.find((a) => a.student_id === studentId)?.guardian_name}.
                    الحفظ يحدّث الرمز ويسجّل خروج الجلسات الحالية للعائلة.
                  </div>
                )}
              </>
            )}
            {tool === 'guardian' && (
              <>
                <label>
                  {tr('Verified guardian’s existing email')}
                  <input name="guardianEmail" type="email" required />
                </label>
                <p className="form-help">
                  {tr(
                    'Verify the relationship outside the app before granting access. The guardian must already have an account in this school.',
                  )}
                </p>
              </>
            )}
            {tool === 'schedule' && (
              <ScheduleForm lessons={data.lessons} accounts={data.accounts} />
            )}
            {tool === 'lesson' && <NewLesson data={data} />}
            {tool === 'school' && (
              <>
                <label>
                  {tr('School name')}
                  <input name="name" defaultValue={data.school.name} required />
                </label>
                <label>
                  {tr('Timezone')}
                  <input name="timezone" defaultValue={data.school.timezone} required dir="ltr" />
                </label>
                <div className="form-pair">
                  <label>
                    {tr('Start')}
                    <input
                      name="start"
                      type="time"
                      defaultValue={data.school.start_time}
                      required
                    />
                  </label>
                  <label>
                    {tr('End')}
                    <input name="end" type="time" defaultValue={data.school.end_time} required />
                  </label>
                </div>
              </>
            )}
            {tool.startsWith('incident:') && (
              <>
                <label>
                  {tr('Investigation status')}
                  <select name="status">
                    <option value="investigating">
                      {tr('Investigating — whereabouts unverified')}
                    </option>
                    <option value="resolved">{tr('Resolved — verified by staff')}</option>
                  </select>
                </label>
                <label>
                  {tr('Verified findings / update')}
                  <textarea name="resolution" required rows={5} />
                </label>
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy ? tr('Saving…') : tr('Save and share')}
            </button>
          </form>
        </Sheet>
      )}
    </>
  );
}
function ScheduleForm({ lessons, accounts }: { lessons: Lesson[]; accounts: State['accounts'] }) {
  const [lid, setLid] = useState(lessons[0]?.id || '');
  const l = lessons.find((l) => l.id === lid);
  return (
    <>
      <label>
        {tr('Lesson')}
        <select name="lessonId" value={lid} onChange={(e) => setLid(e.target.value)}>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {tr(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][l.weekday])} · {tr(l.subject)} ·{' '}
              {l.start}
            </option>
          ))}
        </select>
      </label>
      {l && (
        <div key={l.id} className="form-stack">
          <label>
            {tr('Teacher')}
            <select
              name="teacherId"
              defaultValue={accounts.find((a) => a.name === l.teacher)?.id}
              required
            >
              {accounts
                .filter((a) => a.role === 'teacher' && a.section === l.section)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="form-pair">
            <label>
              {tr('Start')}
              <input type="time" name="start" required defaultValue={l.start} />
            </label>
            <label>
              {tr('End')}
              <input type="time" name="end" required defaultValue={l.end} />
            </label>
          </div>
          <label>
            {tr('Room')}
            <input name="room" defaultValue={l.room} required />
          </label>
        </div>
      )}
      <p className="form-help">
        {tr('Teacher, room, and class overlaps are checked before a change is saved.')}
      </p>
    </>
  );
}
function NewLesson({ data }: { data: State }) {
  const [section, setSection] = useState(
    data.student?.section || data.accounts.find((a) => a.role === 'teacher')?.section || '',
  );
  return (
    <>
      <label>
        {tr('Class / section')}
        <input
          name="section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          required
        />
      </label>
      <label>
        {tr('Teacher')}
        <select name="teacherId" required defaultValue="">
          <option value="" disabled>
            {tr('Choose a teacher')}
          </option>
          {data.accounts
            .filter((a) => a.role === 'teacher' && a.section === section)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        {tr('Subject')}
        <input name="subject" required />
      </label>
      <label>
        {tr('Weekday')}
        <select name="weekday">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <option key={d} value={i}>
              {tr(d)}
            </option>
          ))}
        </select>
      </label>
      <div className="form-pair">
        <label>
          {tr('Start')}
          <input name="start" type="time" required defaultValue={data.school.start_time} />
        </label>
        <label>
          {tr('End')}
          <input name="end" type="time" required />
        </label>
      </div>
      <label>
        {tr('Room')}
        <input name="room" required />
      </label>
      <p className="form-help">
        {tr('Teacher, room, and class overlaps are checked before a change is saved.')}
      </p>
    </>
  );
}
