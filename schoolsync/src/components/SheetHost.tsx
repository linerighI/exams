/**
 * Centralized modal Sheet host for family preview, sibling switcher, homework/lesson
 * inspection, live Blue Orb companion, focus timer, privacy, and password rotation.
 */
import { ArrowRight, ArrowUpRight, Bell, BookOpen, ShieldCheck } from 'lucide-react';
import { FamilyChooser } from '../FamilyChooser';
import { FamilyPreview } from '../FamilyPreview';
import { OrbCompanion } from '../family/OrbCompanion';
import { words, type Language } from '../i18n';
import { formatClock } from '../jordanTime';
import { tr } from '../translations';
import type { Homework, Lesson, State } from '../types';
import { Empty, Section, Sheet } from '../ui';
import { FocusTimer } from './FocusTimer';

export function SheetHost({
  sheet,
  setSheet,
  data,
  lang,
  staff,
  busy,
  switching,
  work,
  setWork,
  lesson,
  go,
  selectStudent,
  mutate,
}: {
  sheet: string;
  setSheet: (s: string) => void;
  data: State;
  lang: Language;
  staff: boolean;
  busy: boolean;
  switching: boolean;
  work: Homework | null;
  setWork: (h: Homework) => void;
  lesson: Lesson | null;
  go: (tab: string) => void;
  selectStudent: (id: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  const t = words[lang];

  return (
    <>
      {staff && sheet === 'family-preview' && (
        <Sheet
          title={ar ? `معاينة ولي الأمر · ${data.student?.name}` : `Family preview · ${data.student?.name}`}
          onClose={() => setSheet('')}
        >
          <FamilyPreview key={data.student?.id} data={data} lang={lang} />
        </Sheet>
      )}

      {!staff && sheet === 'children' && (
        <Sheet title={ar ? 'اختيار الطالب للمتابعة' : 'Select child'} onClose={() => setSheet('')}>
          <FamilyChooser data={data} lang={lang} compact onSelect={selectStudent} busy={switching} />
        </Sheet>
      )}

      {sheet === 'work' && work && (
        <Sheet title={work.subject} onClose={() => setSheet('')}>
          <div className={`work-detail ${work.color}`}>
            <span className="eyebrow dark">
              {tr('DUE')} {work.due}
            </span>
            <h2>{work.title}</h2>
            <p>{work.description}</p>
            <small>
              {tr('Assigned by')} {work.teacher}
            </small>
          </div>
          {data.user.role === 'student' ? (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await mutate(
                    `/homework/${work.id}/submit`,
                    { content: f.get('content') },
                    tr('Your work has been submitted'),
                  )
                )
                  setSheet('');
              }}
            >
              <label>
                {tr('Your work')}
                <textarea name="content" defaultValue={work.submission || ''} rows={6} required maxLength={4000} />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? tr('Submitting…') : work.submission ? tr('Update submission') : tr('Submit your work')}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <div className="surface">
              <strong>{work.submission ? tr('Submitted work') : ar ? 'لم يُسلّم بعد' : 'Not submitted yet'}</strong>
              <p className="pre-wrap">{work.submission || tr('The student’s submitted answer will appear here.')}</p>
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'lesson' && lesson && (
        <Sheet title={lesson.subject} onClose={() => setSheet('')}>
          <div className={`work-detail ${lesson.color}`}>
            <span className="eyebrow dark">
              {lesson.period_number ? (ar ? `الحصة ${lesson.period_number}` : `Period ${lesson.period_number}`) : tr('YOUR TIMETABLE')}
            </span>
            <h2>
              {formatClock(lesson.start, lang)} — {formatClock(lesson.end, lang)}
            </h2>
            <p>
              {lesson.room} · {lesson.teacher}
            </p>
            <small>
              {ar ? 'الشعبة' : 'Class'} {lesson.section}
            </small>
          </div>
          <Section title={tr('A little preparation')} />
          {data.homework
            .filter((h) => h.subject === lesson.subject)
            .map((h) => (
              <button
                className="homework-row"
                key={h.id}
                onClick={() => {
                  setWork(h);
                  setSheet('work');
                }}
              >
                <BookOpen size={20} />
                <span className="row-copy">
                  <strong>{h.title}</strong>
                  <small>
                    {tr('Due')} {h.due}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
        </Sheet>
      )}

      {!staff && sheet === 'companion' && (
        <Sheet title={ar ? 'نبض اليوم المدرسي' : 'Day Companion'} onClose={() => setSheet('')}>
          <OrbCompanion
            data={data}
            lang={lang}
            go={(next) => {
              setSheet('');
              go(next);
            }}
            openWork={(h) => {
              setWork(h);
              setSheet('work');
            }}
            focus={() => setSheet('focus')}
          />
        </Sheet>
      )}

      {data.user.role === 'student' && sheet === 'focus' && (
        <Sheet title={tr('A moment to focus')} onClose={() => setSheet('')}>
          <FocusTimer />
        </Sheet>
      )}

      {['notifications', 'notices'].includes(sheet) && (
        <Sheet
          title={sheet === 'notifications' ? t.notifications : ar ? 'لوحة تعاميم المدرسة' : 'School Noticeboard'}
          onClose={() => setSheet('')}
        >
          {(sheet === 'notifications' ? data.notifications : data.announcements).length ? (
            (sheet === 'notifications' ? data.notifications : data.announcements).map((n) => (
              <article className="notice" key={n.id}>
                <span className="notice-icon">
                  <Bell size={18} />
                </span>
                <div>
                  <small>{n.created.slice(0, 10)}</small>
                  <h3>{n.title}</h3>
                  <p>{n.content}</p>
                </div>
              </article>
            ))
          ) : (
            <Empty title={ar ? 'لا توجد إشعارات حالياً' : 'Quiet moment'} detail={tr('New school updates will appear here.')} />
          )}
        </Sheet>
      )}

      {sheet === 'privacy' && (
        <Sheet title={tr('Your data, with care')} onClose={() => setSheet('')}>
          <div className="privacy-copy">
            <ShieldCheck size={32} />
            <h3>{tr('A space built around trust.')}</h3>
            <p>{tr('Your account only sees school records authorized for your role. Guardian accounts are linked to specific students; teachers work with assigned classes.')}</p>
            <small>
              {tr('School timezone:')} {data.school.timezone}
            </small>
          </div>
        </Sheet>
      )}

      {sheet === 'password' && (
        <Sheet
          title={data.user.role === 'parent' ? (ar ? 'تغيير رمز دخول الطالب' : 'Change child access code') : tr('Change password')}
          onClose={() => setSheet('')}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              if (
                await mutate(
                  data.user.role === 'parent' ? '/family-code' : '/password',
                  data.user.role === 'parent' ? { ...values, studentId: data.student?.id } : values,
                  tr('Password updated'),
                )
              )
                setSheet('');
            }}
          >
            <label>
              {data.user.role === 'parent' ? (ar ? 'رمز الطالب الحالي' : 'Current child code') : tr('Current password')}
              <input name="currentPassword" type="password" autoComplete="current-password" required />
            </label>
            <label>
              {data.user.role === 'parent' ? (ar ? 'رمز الطالب الجديد' : 'New child code') : tr('New password')}
              <input name="newPassword" type="password" autoComplete="new-password" minLength={data.user.role === 'parent' ? 8 : 12} required />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? tr('Saving…') : tr('Save changes')}
            </button>
          </form>
        </Sheet>
      )}
    </>
  );
}
