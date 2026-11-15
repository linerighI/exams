/**
 * Jordanian Schedule Modal Forms (`Sheet`): Bell & Duty Settings and Smart
 * Period Assignment for Principals and Assistant Principals.
 */
import type { FormEvent } from 'react';
import { Sparkles, UserPlus } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, type PeriodSlot } from '../jordanTime';
import type { Lesson, School, SchoolClass, TeacherProfile } from '../types';
import { Sheet } from '../ui';

export function BellSettingsForm({
  school,
  lang,
  busy,
  onSubmit,
  onClose,
  embedded = false,
}: {
  school: School;
  lang: Language;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
  embedded?: boolean;
}) {
  const ar = lang === 'ar';
  const body = (
    <form className="form-stack" onSubmit={onSubmit}>
      <div className="split-fields">
        <label>
          {ar ? 'بداية الدوام' : 'Start time'}
          <input name="start" type="time" defaultValue={school.start_time} required dir="ltr" />
        </label>
        <label>
          {ar ? 'نهاية الدوام' : 'End time'}
          <input name="end" type="time" defaultValue={school.end_time} required dir="ltr" />
        </label>
      </div>
      <div className="split-fields three">
        <label>
          {ar ? 'الحصة (د)' : 'Period (m)'}
          <input name="periodMinutes" type="number" min={20} max={90} defaultValue={school.period_minutes || 45} required />
        </label>
        <label>
          {ar ? 'استراحة (د)' : 'Break (m)'}
          <input name="breakMinutes" type="number" min={0} max={30} defaultValue={school.break_minutes ?? 5} required />
        </label>
        <label>
          {ar ? 'عدد الحصص' : 'Count'}
          <input name="periodCount" type="number" min={1} max={10} defaultValue={school.period_count || 8} required />
        </label>
      </div>
      <label>
        {ar ? 'أساتذة المناوبة والملاحظات اليومية' : 'Duty teachers & notes'}
        <input name="dutyNotes" defaultValue={school.duty_notes || ''} placeholder={ar ? 'أدخل أسماء المناوبين...' : 'Duty teachers...'} />
      </label>
      <button className="primary" disabled={busy}>
        {ar ? 'حفظ التوقيت' : 'Save bell schedule'}
      </button>
    </form>
  );
  if (embedded) return body;
  return (
    <Sheet title={ar ? 'إعدادات التوقيت والمناوبة' : 'Bell Timing & Duty'} onClose={onClose}>
      {body}
    </Sheet>
  );
}

export function LessonAssignDrawer({
  lang,
  busy,
  weekdayLabel,
  targetSection,
  targetSlot,
  targetClassMeta,
  allSections,
  assignableTeachers,
  subjectOptions,
  pickedSubject,
  setPickedSubject,
  dayLessons,
  onChangeSection,
  onSubmit,
  onClose,
}: {
  lang: Language;
  busy: boolean;
  weekdayLabel: string;
  targetSection: string;
  targetSlot: PeriodSlot;
  targetClassMeta?: SchoolClass;
  allSections: string[];
  assignableTeachers: TeacherProfile[];
  subjectOptions: string[];
  pickedSubject: string;
  setPickedSubject: (s: string) => void;
  dayLessons: Lesson[];
  onChangeSection: (s: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
}) {
  const ar = lang === 'ar';
  const titleText = ar ? `${weekdayLabel} · تعيين ${targetSlot.labelAr}` : `${weekdayLabel} · ${targetSlot.labelEn}`;

  return (
    <Sheet title={titleText} onClose={onClose}>
      <form className="form-stack" onSubmit={onSubmit}>
        <div className="meta-pill live" style={{ width: 'fit-content' }}>
          <bdi className="clock-token">{formatClock(targetSlot.start, lang)}</bdi>
          <span>–</span>
          <bdi className="clock-token">{formatClock(targetSlot.end, lang)}</bdi>
        </div>

        <div className="split-fields">
          <label>
            {ar ? 'الشعبة / الصف' : 'Class'}
            {allSections.length ? (
              <select name="section" value={targetSection} onChange={(e) => onChangeSection(e.target.value)}>
                {allSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            ) : (
              <input name="section" required value={targetSection} onChange={(e) => onChangeSection(e.target.value)} />
            )}
          </label>
          <label>
            {ar ? 'القاعة / المختبر' : 'Room'}
            <input name="room" required defaultValue={targetClassMeta?.room || (ar ? 'القاعة ١٠١' : 'Room 101')} />
          </label>
        </div>

        <label>
          {ar ? 'المعلم' : 'Teacher'}
          {assignableTeachers.length ? (
            <select name="teacherId" required defaultValue={assignableTeachers[0].id}>
              {assignableTeachers.map((t) => {
                const busyElsewhere = dayLessons.find(
                  (l) => l.teacher === t.name && l.period_number === targetSlot.periodNumber && l.section !== targetSection,
                );
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} {busyElsewhere ? (ar ? `(مشغول في ${busyElsewhere.section})` : `(in ${busyElsewhere.section})`) : ''}
                  </option>
                );
              })}
            </select>
          ) : (
            <div className="empty-teacher-callout">
              <UserPlus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginInlineEnd: 6 }} />
              {ar
                ? 'لا يوجد معلمون مسجلون بعد. أضف حساب معلم من تبويب «الإدارة ← المعلمون والطاقم» أولاً.'
                : 'No teachers registered yet. Add a teacher in Management → Staff first.'}
            </div>
          )}
        </label>

        <div className="assign-block">
          <small>{ar ? 'اختر المادة الدراسية أو اكتب اسمها:' : 'Subject:'}</small>
          <div className="chip-row">
            {subjectOptions.map((sub) => (
              <button
                type="button"
                key={sub}
                className={`chip-pill ${pickedSubject === sub ? 'selected' : ''}`}
                onClick={() => setPickedSubject(sub)}
              >
                {sub}
              </button>
            ))}
          </div>
          <input
            name="subject"
            required
            value={pickedSubject}
            onChange={(e) => setPickedSubject(e.target.value)}
            placeholder={ar ? 'اسم المادة الدراسية...' : 'Subject name...'}
          />
        </div>

        <button className="primary" disabled={busy || !assignableTeachers.length}>
          <Sparkles size={15} />
          {ar ? 'تثبيت الحصة في الجدول' : 'Save period to schedule'}
        </button>
      </form>
    </Sheet>
  );
}
