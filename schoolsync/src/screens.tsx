import { tr } from './translations';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Sparkles,
  Sun,
  Volume2,
} from 'lucide-react';
import type { State, Homework, Lesson } from './types';
import { Empty, Section, initials } from './ui';
import { words, type Language } from './i18n';
import { DayPulse } from './Orb';
export type ScreenProps = {
  data: State;
  lang: Language;
  go: (tab: string) => void;
  openWork: (work: Homework) => void;
  openLesson: (lesson: Lesson) => void;
  openFocus: () => void;
  openNotice: () => void;
  openCompanion: () => void;
  preview?: boolean;
};
export function minutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function schoolNow(data: State) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: data.school.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  return minutes(p);
}
export function dailyLessons(data: State, date = data.date) {
  return data.lessons
    .filter((l) => l.weekday === new Date(`${date}T12:00:00Z`).getUTCDay())
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function Home(props: ScreenProps) {
  const {
    data,
    lang,
    go,
    openWork,
    openLesson,
    openFocus,
    openNotice,
    openCompanion,
    preview = false,
  } = props;
  const t = words[lang];
  const family = data.user.role === 'parent' || preview;
  const staff = ['teacher', 'admin'].includes(data.user.role);
  const lessons = dailyLessons(data);
  const now = schoolNow(data);
  const active = lessons.find((l) => minutes(l.start) <= now && minutes(l.end) > now);
  const next = lessons.find((l) => minutes(l.start) > now);
  const start = lessons[0]?.start || data.school.start_time;
  const end = lessons.at(-1)?.end || data.school.end_time;
  const progress = lessons.length
    ? Math.max(0, Math.min(100, ((now - minutes(start)) / (minutes(end) - minutes(start))) * 100))
    : 0;
  const recorded = data.attendance.filter((a) => a.date === data.date);
  const pending = data.homework.filter((h) => !h.submission);
  const schoolDate = new Date(`${data.date}T12:00:00Z`);
  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">
          <span className="tiny-sun">
            <Sun size={14} />
          </span>
          {schoolDate.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <h1>
          {preview ? (
            lang === 'ar' ? (
              `يوم ${data.student?.name.split(' ')[0]}`
            ) : (
              `${data.student?.name.split(' ')[0]}’s day`
            )
          ) : (
            <>
              {lang === 'ar' ? 'أهلاً،' : tr('Hey,')} {data.user.name.split(' ')[0]}
            </>
          )}
          <span className="greeting-dot">.</span>
          <span className="wave">✳</span>
        </h1>
        <p>
          {family
            ? lang === 'ar'
              ? `يوم ${data.student?.name.split(' ')[0] || 'طالبك'}، خطوة بخطوة.`
              : 'Their day, one little moment at a time.'
            : staff
              ? lang === 'ar'
                ? `يوم ${data.student?.name.split(' ')[0] || 'الطالب'} كما تراه عائلته.`
                : 'The school day, as their family sees it.'
              : t.hello}
        </p>
      </div>
      <section className="day-card" data-reveal>
        <div className="card-top">
          <span className="eyebrow dark">
            {family
              ? lang === 'ar'
                ? 'يومه الدراسي في لمحة'
                : 'Their school day, at a glance'
              : t.day}
          </span>
          <span className="small-pill">
            <span className={active ? 'status-dot' : 'status-dot quiet'} />
            {active
              ? lang === 'ar'
                ? 'اليوم الدراسي'
                : tr('School is in session')
              : lessons.length
                ? now < minutes(start)
                  ? tr('A fresh start ahead')
                  : tr('School day complete')
                : tr('A little time to recharge')}
          </span>
        </div>
        <div className="day-body">
          <div>
            <h2>
              {active
                ? active.subject
                : next
                  ? tr('Ready for a\ngood day?')
                  : lang === 'ar'
                    ? family
                      ? lessons.length && now >= minutes(end)
                        ? 'اكتمل اليوم الدراسي'
                        : 'يوم دراسي منظم'
                      : lessons.length && now >= minutes(end)
                        ? 'اكتمل يومك الدراسي'
                        : 'يوم دراسي منظم'
                    : tr('Your day.\nIn sync.')}
            </h2>
            <p>
              {active
                ? `${active.start} – ${active.end} · ${active.room}`
                : next
                  ? lang === 'ar'
                    ? `${next.subject} تبدأ الساعة ${next.start}`
                    : `${next.subject} starts at ${next.start}`
                  : lang === 'ar'
                    ? family
                      ? 'يمكنك متابعة الواجبات والعلامات وسجل الحضور.'
                      : 'راجع واجباتك واستعد للغد بكل هدوء.'
                    : tr('Every little step counts.')}
            </p>
            <button
              className="round-link"
              aria-label={tr('Open schedule')}
              onClick={() => go('schedule')}
            >
              <ArrowUpRight size={23} />
            </button>
          </div>
          <DayPulse progress={progress} onClick={openCompanion} />
        </div>
        <div className="day-progress">
          <div>
            <span>
              {lessons.length
                ? lang === 'ar'
                  ? `${Math.round(progress)}٪ من يومك الدراسي`
                  : `${Math.round(progress)}% of your school day`
                : tr('No lessons scheduled today')}
            </span>
            <span>
              {lessons.length
                ? lang === 'ar'
                  ? `حتى ${end}`
                  : `Until ${end}`
                : tr('Enjoy your day')}
            </span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="day-foot">
            <span>
              <CheckCheck size={14} />
              {recorded.length
                ? `${recorded.filter((a) => a.status === 'present' || a.status === 'late').length} ${lang === 'ar' ? 'مرات حضور مؤكدة' : 'attendance checks confirmed'}`
                : tr('Attendance not yet recorded')}
            </span>
            <span>{data.student?.section ? `${tr('Class')} ${tr(data.student.section)}` : ''}</span>
          </div>
        </div>
      </section>
      <div className="feature-pair" data-reveal>
        <button
          className="mini-card lavender"
          onClick={() => (family || staff ? go('homework') : openFocus())}
        >
          <div className="mini-top">
            <span className="icon-tile">
              {family || staff ? <BookOpen size={20} /> : <Clock size={20} />}
            </span>
            <ArrowUpRight size={19} />
          </div>
          <h3>
            {family || staff
              ? lang === 'ar'
                ? 'واجبات بخطوات واضحة'
                : 'A little learning at home'
              : tr('A moment to focus')}
          </h3>
          <p>
            {family || staff
              ? lang === 'ar'
                ? pending.length
                  ? `${pending.length} واجبات بانتظار تسليم الطالب`
                  : 'لا توجد واجبات متأخرة · الكل منجز'
                : `${pending.length} assignments to do`
              : tr('Small sessions. Big things.')}
          </p>
          <span className="mini-bottom">
            {family || staff
              ? lang === 'ar'
                ? 'متابعة الواجبات'
                : 'View homework'
              : tr('Start a study session')}
            <ArrowRight size={14} />
          </span>
          {!family && !staff && (
            <span className="timer-art">
              25<span>:00</span>
            </span>
          )}
        </button>
        <button className="mini-card sky" onClick={() => go('inbox')}>
          <div className="mini-top">
            <span className="icon-tile">
              <MessageCircle size={20} />
            </span>
            <ArrowUpRight size={19} />
          </div>
          <h3>{tr('Stay in the loop')}</h3>
          <p>{tr('A little hello goes a long way.')}</p>
          <span className="mini-bottom">
            <span className="mini-avatar">
              {initials(data.contacts.find((c) => c.role === 'teacher')?.name || '')}
            </span>
            {family
              ? lang === 'ar'
                ? 'التواصل مع المدرسة'
                : 'Contact the school'
              : tr('Talk to your teacher')}
          </span>
          <div className="bubble-art">
            <i />
            <i />
            <i />
          </div>
        </button>
      </div>
      <section data-reveal>
        <Section title={family?(lang==='ar'?`حصص ${data.student?.name.split(' ')[0]} اليوم`:'Their lessons today'):t.next} action={t.view} onAction={() => go('schedule')} />
        {lessons.length ? (
          <div className="lesson-preview">
            {(next
              ? [
                  next,
                  ...lessons.filter((l) => l.id !== next.id && minutes(l.start) > now).slice(0, 1),
                ]
              : lessons.slice(0, 2)
            ).map((l) => (
              <button key={l.id} className="lesson-row" onClick={() => openLesson(l)}>
                <span className={`subject-icon ${l.color}`}>
                  <BookOpen size={21} />
                </span>
                <span className="row-copy">
                  <strong>{tr(l.subject)}</strong>
                  <small>
                    {l.room} <span>·</span> {l.teacher}
                  </small>
                </span>
                <span className="row-time">
                  {l.start}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={tr('A clear timetable')}
            detail={tr('No classes are scheduled for today.')}
          />
        )}
      </section>
      <section data-reveal>
        <Section
          title={family?(lang==='ar'?`واجبات ${data.student?.name.split(' ')[0]}`:'Their homework'):t.work}
          action={`${pending.length} ${lang === 'ar' ? family?'للمتابعة':'للإنجاز' : 'to follow'}`}
          onAction={() => go('homework')}
        />
        {pending.length ? (
          pending.slice(0, 2).map((h) => (
            <button key={h.id} className="homework-row" onClick={() => openWork(h)}>
              <span className={`task-check ${h.color}`}>
                <BookOpen size={17} />
              </span>
              <span className="row-copy">
                <small className="subject-label">{tr(h.subject)}</small>
                <strong>{h.title}</strong>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))
        ) : (
          <Empty title={tr('All caught up')} detail={tr('A little breathing room. Nice work.')} />
        )}
      </section>
      {data.notes[0] && (
        <button className="teacher-note" data-reveal onClick={() => go('notes')}>
          <span className="note-star">
            <Sparkles size={24} />
          </span>
          <span>
            <small>{tr('A little encouragement')}</small>
            <p>{data.notes[0].content}</p>
            <strong>
              {data.notes[0].author} <span>{tr('· Your teacher')}</span>
            </strong>
          </span>
        </button>
      )}
      <section data-reveal>
        <Section title={t.updates} action={t.view} onAction={openNotice} />
        {data.announcements.slice(0, 1).map((a) => (
          <button className="announcement" key={a.id} onClick={openNotice}>
            <span className="announcement-art">
              <Volume2 size={32} />
            </span>
            <span className="row-copy">
              <small>{tr('SCHOOL NOTICEBOARD')}</small>
              <strong>{a.title}</strong>
              <span>{tr('Good things are happening.')}</span>
            </span>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </section>
      <p className="end-note">
        <Sparkles size={13} /> {tr('A little more connected. Every day.')}
      </p>
    </>
  );
}
export function Schedule({ data, lang, openLesson }: ScreenProps) {
  const [offset, setOffset] = useState(0);
  const selected = new Date(`${data.date}T12:00:00Z`);
  selected.setUTCDate(selected.getUTCDate() + offset);
  const date = selected.toISOString().slice(0, 10);
  const lessons = dailyLessons(data, date);
  const now = offset === 0 ? schoolNow(data) : -1;
  const t = words[lang];
  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{tr('ONE THING AT A TIME')}</div>
        <h1>
          {t.schedule}
          <span className="greeting-dot">.</span>
        </h1>
        <p>{data.user.role!=='student'?(lang==='ar'?'جدول حصص الطالب كما اعتمدته المدرسة.':'The student’s timetable, as configured by the school.'):tr('Your day has a rhythm. Find yours.')}</p>
      </div>
      <div className="calendar-card" data-reveal>
        <div className="calendar-month">
          <button
            className="icon-button"
            aria-label={tr('Previous week')}
            onClick={() => setOffset(offset - 7)}
          >
            <ChevronLeft size={20} />
          </button>
          <strong>
            {selected.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
              month: 'long',
              year: 'numeric',
            })}
          </strong>
          <button
            className="icon-button"
            aria-label={tr('Next week')}
            onClick={() => setOffset(offset + 7)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(selected);
            d.setUTCDate(d.getUTCDate() - selected.getUTCDay() + i);
            const o = Math.round(
              (d.getTime() - new Date(`${data.date}T12:00:00Z`).getTime()) / 86400000,
            );
            return (
              <button
                className={o === offset ? 'selected' : ''}
                onClick={() => setOffset(o)}
                key={i}
              >
                <small>
                  {d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { weekday: 'short' })}
                </small>
                <strong>{d.getUTCDate()}</strong>
                <i className={o === 0 ? 'today-dot' : ''} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="section-heading" data-reveal>
        <h2>
          {offset === 0
            ? tr('Today’s rhythm')
            : selected.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { weekday: 'long' })}
        </h2>
        <span className="muted">
          {lessons.length} {tr('lessons')}
        </span>
      </div>
      <div className="timeline" data-reveal>
        {lessons.map((l) => {
          const active = now >= minutes(l.start) && now < minutes(l.end);
          const complete = now >= minutes(l.end);
          const check = data.attendance.find((a) => a.lesson_id === l.id && a.date === date);
          return (
            <div className={`timeline-item ${active ? 'current' : ''}`} key={l.id}>
              <div className="time-label">
                <strong>{l.start}</strong>
                <small>{l.end}</small>
                <i />
              </div>
              <button className={`schedule-card ${l.color}`} onClick={() => openLesson(l)}>
                <div className="card-top">
                  <span className="eyebrow dark">
                    {active ? tr('HAPPENING NOW') : complete ? tr('EARLIER TODAY') : l.room}
                  </span>
                  <span>{complete ? <Check size={17} /> : <ArrowUpRight size={17} />}</span>
                </div>
                <h2>{tr(l.subject)}</h2>
                <p>{l.teacher}</p>
                <div className="schedule-foot">
                  <span>
                    <MapPin size={13} />
                    {l.room}
                  </span>
                  <span>
                    {check
                      ? tr(check.status)
                      : active
                        ? `${minutes(l.end) - now} ${lang === 'ar' ? 'دقيقة متبقية' : 'min left'}`
                        : `${minutes(l.end) - minutes(l.start)} ${tr('min')}`}
                  </span>
                </div>
                {active && (
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${((now - minutes(l.start)) / (minutes(l.end) - minutes(l.start))) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {!lessons.length && (
        <Empty
          title={tr('Room for a slow day')}
          detail={tr('There are no lessons scheduled on this date.')}
        />
      )}
    </>
  );
}
export function HomeworkScreen({ data, lang, openWork }: ScreenProps) {
  const [filter, setFilter] = useState('todo');
  const [search, setSearch] = useState('');
  const filtered = data.homework.filter(
    (h) =>
      (filter === 'all' || (filter === 'done' ? h.submission : !h.submission)) &&
      `${h.title} ${h.subject}`.toLowerCase().includes(search.toLowerCase()),
  );
  const done = data.homework.filter((h) => h.submission).length;
  const t = words[lang];
  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{tr('A LITTLE FOCUS GOES A LONG WAY')}</div>
        <h1>
          {t.homework}
          <span className="greeting-dot">.</span>
        </h1>
        <p>{data.user.role!=='student'?(lang==='ar'?'تعليمات المدرسة، ومواعيد التسليم، وحالة واجبات الطالب.':'School instructions, deadlines, and the student’s submission status.'):tr('Make room for your next little win.')}</p>
      </div>
      <div className="task-summary" data-reveal>
        <span>
          <strong>
            {done}
            <small> / {data.homework.length}</small>
          </strong>
          <p>{tr('assignments submitted')}</p>
        </span>
        <span
          className="completion-ring"
          style={{
            background: `conic-gradient(var(--ink) ${data.homework.length ? (done / data.homework.length) * 100 : 0}%,var(--line) 0)`,
          }}
        >
          <span>
            <CheckCheck size={24} />
          </span>
        </span>
      </div>
      <input
        className="search"
        aria-label={tr('Search homework')}
        placeholder={tr('Find an assignment…')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="segmented" data-reveal>
        {[
          ['todo', data.user.role!=='student'?(lang==='ar'?'غير مسلّمة':'Not submitted'):t.pending],
          ['done', t.done],
          ['all', t.all],
        ].map(([v, label]) => (
          <button key={v} className={filter === v ? 'selected' : ''} onClick={() => setFilter(v)}>
            {label}
          </button>
        ))}
      </div>
      <div className="homework-grid" data-reveal>
        {filtered.map((h, i) => (
          <button
            key={h.id}
            className={`assignment-card ${h.color}`}
            onClick={() => openWork(h)}
            style={{ '--tilt': `${i % 2 === 0 ? -1 : 1}deg` } as React.CSSProperties}
          >
            <div className="card-top">
              <span className="eyebrow dark">{tr(h.subject)}</span>
              <span className="due-pill">
                {h.due === data.date
                  ? tr('Today')
                  : new Date(`${h.due}T12:00:00Z`).toLocaleDateString(
                      lang === 'ar' ? 'ar-JO' : 'en-GB',
                      {
                        day: 'numeric',
                        month: 'short',
                      },
                    )}
              </span>
            </div>
            <h2>{h.title}</h2>
            <p>{h.description}</p>
            <div className="assignment-foot">
              <span>
                {h.submission ? (
                  <>
                    <Check size={14} /> {tr('Submitted')}
                  </>
                ) : (
                  <>
                    <span className="status-dot" />
                    {data.user.role!=='student'?(lang==='ar'?'لم يسلّم الطالب بعد':'Not yet submitted by the student'):tr('Ready when you are')}
                  </>
                )}
              </span>
              <span className="circle-arrow">
                <ArrowUpRight size={19} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title={tr('Nothing on this list')}
          detail={tr('Try another filter, or enjoy a well-earned pause.')}
        />
      )}
    </>
  );
}
