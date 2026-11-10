import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  Eye,
  GraduationCap,
  MessageCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { State } from './types';
import type { Language } from './i18n';
import { Empty, Section, initials } from './ui';
import { tr } from './translations';
import { minutes, schoolNow } from './screens';
export function SchoolDashboard({
  data,
  lang,
  go,
  action,
}: {
  data: State;
  lang: Language;
  go: (view: string) => void;
  action: (tool: string) => void;
}) {
  const ar = lang === 'ar';
  const admin = data.user.role === 'admin';
  const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay();
  const lessons = data.schoolWorkspace?.lessons.filter((l) => l.weekday === weekday) || [];
  const now = schoolNow(data);
  const next = lessons.find((l) => minutes(l.end) > now);
  const sections = [...new Set(data.students.map((s) => s.section))];
  const lessonIds = new Set(lessons.map((l) => l.id));
  const recorded = data.rosterAttendance.filter((a) => lessonIds.has(a.lesson_id)).length;
  const expected = lessons.reduce(
    (total, l) => total + data.students.filter((s) => s.section === l.section).length,
    0,
  );
  const incidents = data.incidents.filter((i) => i.status !== 'resolved');
  return (
    <div className="school-dashboard">
      <div className="page-intro" data-reveal>
        <span className="eyebrow">
          {admin
            ? ar
              ? 'إدارة المدرسة'
              : 'SCHOOL ADMINISTRATION'
            : ar
              ? 'مساحة المعلم'
              : 'TEACHER WORKSPACE'}
        </span>
        <h1>
          {ar ? 'أهلاً،' : 'Hello,'} {data.user.name.split(' ')[0]}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {admin
            ? ar
              ? 'نظرة على المدرسة، ثم الخطوة التي تحتاج اهتمامك.'
              : 'Your school at a glance. Then, what needs your attention.'
            : ar
              ? 'حصصك وطلابك ومهامك، في مساحة مخصصة لك.'
              : 'Your lessons, students, and teaching tasks, together.'}
        </p>
      </div>
      <section className="school-shift" data-reveal>
        <div className="card-top">
          <span className="eyebrow">{ar ? 'يومك في المدرسة' : 'YOUR SCHOOL DAY'}</span>
          <CalendarDays size={19} />
        </div>
        <h2>{next ? next.subject : ar ? 'كل شيء في مكانه.' : 'Everything in its place.'}</h2>
        <p>
          {next
            ? `${tr(next.section)} · ${next.start} — ${next.end} · ${next.room}`
            : ar
              ? 'راجع سجل اليوم، أو حضّر خطواتك القادمة.'
              : 'Review today’s records, or prepare your next steps.'}
        </p>
        <button className="text-button" onClick={() => go('schedule')}>
          {ar ? 'عرض جدول الحصص' : 'View teaching timetable'}
          <ArrowLeft size={15} />
        </button>
      </section>
      <div className="school-stats" data-reveal>
        <button onClick={() => go('classes')}>
          <Users size={18} />
          <strong>{data.students.length}</strong>
          <small>{ar ? 'طلاب ضمن صلاحياتك' : 'Accessible students'}</small>
        </button>
        <button onClick={() => go('classes')}>
          <GraduationCap size={18} />
          <strong>{sections.length}</strong>
          <small>{ar ? 'شعب دراسية' : 'Class sections'}</small>
        </button>
        <button onClick={() => go('schedule')}>
          <CalendarDays size={18} />
          <strong>{lessons.length}</strong>
          <small>{ar ? 'حصص اليوم' : 'Lessons today'}</small>
        </button>
      </div>
      <Section title={ar ? 'من أين تبدأ؟' : 'Where would you like to start?'} />
      <div className="school-actions" data-reveal>
        {[
          {
            id: 'attendance',
            label: ar ? 'تسجيل الحضور' : 'Take attendance',
            detail: ar ? 'سجّل حالة كل طالب في حصتك.' : 'Record each student in your lesson.',
            icon: CheckCheck,
          },
          {
            id: 'homework',
            label: ar ? 'إسناد واجب' : 'Assign homework',
            detail: ar ? 'تعليمات واضحة، ومتابعة أسهل.' : 'Clear instructions. Easier follow-up.',
            icon: BookOpen,
          },
          {
            id: 'grade',
            label: ar ? 'إدارة العلامات' : 'Manage grades',
            detail: ar
              ? 'سجّل العلامات وانشر المعتمد منها.'
              : 'Record grades and publish approved results.',
            icon: GraduationCap,
          },
          {
            id: 'note',
            label: ar ? 'ملاحظة لولي الأمر' : 'Share a parent note',
            detail: ar ? 'شارك ملاحظة تخص طالباً.' : 'Share an observation about a student.',
            icon: MessageCircle,
          },
        ].map((x) => (
          <button key={x.id} onClick={() => action(x.id)}>
            <span className="subject-icon blue">
              <x.icon size={20} />
            </span>
            <span className="row-copy">
              <strong>{x.label}</strong>
              <small>{x.detail}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <Section title={ar ? 'متابعة اليوم' : 'Today’s follow-up'} />
      <section className="school-followup" data-reveal>
        <span className="school-followup-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h3>{ar ? 'اكتمال تسجيل الحضور' : 'Attendance recording'}</h3>
          <p>
            {ar
              ? `${recorded} من ${expected} حالات الحضور المتوقعة للحصص المجدولة اليوم`
              : `${recorded} of ${expected} expected attendance records for today’s scheduled lessons`}
          </p>
        </div>
        <button className="text-button" onClick={() => action('attendance')}>
          {ar ? 'متابعة' : 'Review'}
        </button>
      </section>
      {incidents.length > 0 && (
        <button className="school-incident-count" onClick={() => go('classroom')}>
          <ShieldCheck size={19} />
          {ar
            ? `${incidents.length} حالات حضور تحتاج إلى متابعة المدرسة`
            : `${incidents.length} attendance incidents need staff follow-up`}
          <ArrowLeft size={16} />
        </button>
      )}
      <Section
        title={ar ? 'الشعب والطلاب' : 'Classes and students'}
        action={ar ? 'عرض الكل' : 'View all'}
        onAction={() => go('classes')}
      />
      <div className="school-section-list" data-reveal>
        {sections.map((section) => (
          <button key={section} onClick={() => go('classes')}>
            <span className="subject-icon blue">
              <Users size={19} />
            </span>
            <span className="row-copy">
              <strong>{tr(section)}</strong>
              <small>
                {data.students.filter((s) => s.section === section).length}{' '}
                {ar ? 'طلاب' : 'students'}
              </small>
            </span>
            <ArrowLeft size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
export function SchoolClasses({
  data,
  lang,
  onOpenClass,
  onPreview,
  busy,
}: {
  data: State;
  lang: Language;
  onOpenClass: (section: string) => void;
  onPreview: (id: string) => void;
  busy: boolean;
}) {
  const [section, setSection] = useState('all');
  const [search, setSearch] = useState('');
  const ar = lang === 'ar';
  const sections = [...new Set(data.students.map((s) => s.section))];
  const students = data.students.filter(
    (s) => (section === 'all' || s.section === section) && s.name.includes(search),
  );
  return (
    <div className="school-classes">
      <div className="page-intro" data-reveal>
        <span className="eyebrow">{ar ? 'للعمل داخل المدرسة' : 'FOR YOUR SCHOOL WORK'}</span>
        <h1>
          {ar ? 'الشعب والطلاب' : 'Classes & students'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'اختر شعبة لإدارة أعمالك، أو عاين ما يراه ولي أمر طالب محدد.'
            : 'Open a class to manage your work, or explicitly preview one student’s family dashboard.'}
        </p>
      </div>
      <div className="school-section-cards" data-reveal>
        {sections.map((s) => (
          <button key={s} onClick={() => onOpenClass(s)} disabled={busy}>
            <Users size={23} />
            <strong>{tr(s)}</strong>
            <span>
              {data.students.filter((x) => x.section === s).length} {ar ? 'طلاب' : 'students'}
            </span>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      <Section title={ar ? 'دليل الطلاب' : 'Student directory'} />
      <div className="school-roster-filters">
        <input
          aria-label={ar ? 'البحث عن طالب' : 'Search students'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? 'ابحث بالاسم…' : 'Search by name…'}
        />
        <select
          aria-label={ar ? 'الشعبة الدراسية' : 'Class section'}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="all">{ar ? 'كل الشعب' : 'All sections'}</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </select>
      </div>
      {students.map((s) => (
        <article className="school-roster-student" key={s.id} data-reveal>
          <span className={`avatar ${s.color}`}>{s.initials || initials(s.name)}</span>
          <span className="row-copy">
            <strong>{s.name}</strong>
            <small>{tr(s.section)}</small>
          </span>
          <button className="family-preview-button" disabled={busy} onClick={() => onPreview(s.id)}>
            <Eye size={15} />
            {ar ? 'معاينة ولي الأمر' : 'Family preview'}
          </button>
        </article>
      ))}
      {!students.length && (
        <Empty
          title={ar ? 'لا توجد نتائج' : 'No matching students'}
          detail={ar ? 'جرّب اسماً آخر أو شعبة مختلفة.' : 'Try a different name or section.'}
        />
      )}
    </div>
  );
}
export function SchoolTimetable({
  data,
  lang,
  action,
}: {
  data: State;
  lang: Language;
  action: (tool: string, section?: string, lessonId?: string) => void;
}) {
  const today = new Date(`${data.date}T12:00:00Z`).getUTCDay();
  const [weekday, setWeekday] = useState(today);
  const ar = lang === 'ar';
  const lessons = (data.schoolWorkspace?.lessons || []).filter((l) => l.weekday === weekday);
  return (
    <div>
      <div className="page-intro" data-reveal>
        <span className="eyebrow">{ar ? 'جدول عمل المدرسة' : 'SCHOOL TEACHING TIMETABLE'}</span>
        <h1>
          {ar ? 'جدول الحصص' : 'Teaching timetable'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'حصص الشعب والمعلمين ضمن صلاحيات حسابك.'
            : 'Classes and teaching assignments within your account’s access.'}
        </p>
      </div>
      <div className="school-weekday-picker" data-reveal>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <button key={day} aria-pressed={weekday === index} onClick={() => setWeekday(index)}>
            {tr(day)}
          </button>
        ))}
      </div>
      {data.user.role === 'admin' && (
        <button className="secondary school-timetable-edit" onClick={() => action('schedule')}>
          {ar ? 'إدارة جدول الحصص' : 'Manage timetable'}
          <CalendarDays size={16} />
        </button>
      )}
      {lessons.map((l) => (
        <article className="school-teaching-lesson" key={l.id} data-reveal>
          <span className="school-lesson-time">
            {l.start}
            <small>{l.end}</small>
          </span>
          <div className="row-copy">
            <strong>{l.subject}</strong>
            <small>
              {tr(l.section)} · {l.room} · {l.teacher}
            </small>
          </div>
          <button
            className="icon-button"
            disabled={weekday !== today}
            aria-label={`${ar ? 'تسجيل حضور' : 'Take attendance'} ${l.subject} ${tr(l.section)}`}
            onClick={() => action('attendance', l.section, l.id)}
          >
            <CheckCheck size={18} />
          </button>
        </article>
      ))}
      {!lessons.length && (
        <Empty
          title={ar ? 'لا توجد حصص في هذا اليوم' : 'No lessons on this day'}
          detail={ar ? 'اختر يوماً آخر من الجدول.' : 'Choose a different weekday.'}
        />
      )}
    </div>
  );
}
