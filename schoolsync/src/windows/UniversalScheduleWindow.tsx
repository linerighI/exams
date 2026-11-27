/**
 * Universal School Schedule Modal: lets managers define a single weekly timetable template
 * (with automatic Class Lead Teacher assignment per class) and apply it to all classes at once.
 */
import { useState } from 'react';
import { CalendarRange, Check, Plus, Trash2 } from 'lucide-react';
import type { Language } from '../i18n';
import { JORDAN_WEEKDAYS, buildPeriodSlots } from '../jordanTime';
import type { State } from '../types';
import { GlassSelect } from './GlassSelect';

interface UniversalEntry {
  id: string;
  weekday: number;
  periodNumber: number;
  subject: string;
  teacherId: string;
}

interface UniversalSchedulePanelProps {
  data: State;
  lang: Language;
  busy: boolean;
  onDone: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Inline universal timetable template editor used inside SchoolScheduleWindow. */
export function UniversalSchedulePanel({
  data,
  lang,
  busy,
  onDone,
  mutate,
}: UniversalSchedulePanelProps) {
  const slots = buildPeriodSlots(data.school);
  const [weekday, setWeekday] = useState<number>(0);
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [subject, setSubject] = useState<string>(data.subjects[0]?.name || 'الرياضيات');
  const [teacherId, setTeacherId] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [entries, setEntries] = useState<UniversalEntry[]>(() => [
    { id: 'u-1', weekday: 0, periodNumber: 1, subject: data.subjects[0]?.name || 'الرياضيات', teacherId: '' },
    { id: 'u-2', weekday: 0, periodNumber: 2, subject: data.subjects[1]?.name || 'اللغة العربية', teacherId: '' },
  ]);

  const addEntry = () => {
    if (!subject.trim()) return;
    setEntries((prev) => [
      ...prev.filter((e) => !(e.weekday === weekday && e.periodNumber === periodNumber)),
      { id: `u-${Date.now()}`, weekday, periodNumber, subject: subject.trim(), teacherId },
    ]);
  };

  const applyAllDays = () => {
    const dayRows = entries.filter((e) => e.weekday === weekday);
    if (!dayRows.length) return;
    const next: UniversalEntry[] = [];
    for (const d of JORDAN_WEEKDAYS) {
      for (const r of dayRows) {
        next.push({ ...r, id: `u-${d.id}-${r.periodNumber}`, weekday: d.id });
      }
    }
    setEntries(next);
  };

  const handleApply = async () => {
    if (!entries.length) return;
    const ok = await mutate(
      '/lessons/universal',
      {
        replaceExisting,
        entries: entries.map((e) => ({
          weekday: e.weekday,
          periodNumber: e.periodNumber,
          subject: e.subject,
          ...(e.teacherId ? { teacherId: e.teacherId } : {}),
        })),
      },
      lang === 'ar'
        ? `تم تطبيق الجدول الموحد على جميع الصفوف (${data.classes.length})`
        : `Universal schedule applied to all ${data.classes.length} classes`,
    );
    if (ok) onDone();
  };

  const dayEntries = entries
    .filter((e) => e.weekday === weekday)
    .sort((a, b) => a.periodNumber - b.periodNumber);

  return (
      <div className="sp-tab-pane">
        <div className="sp-weekday-pills">
          {JORDAN_WEEKDAYS.map((d) => (
            <button key={d.id} type="button" className={weekday === d.id ? 'is-active' : ''} onClick={() => setWeekday(d.id)}>
              {lang === 'ar' ? d.ar : d.en}
            </button>
          ))}
        </div>

        <div className="sp-inline-box">
          <div className="sp-row-2">
            <div className="sp-field">
              <span>{lang === 'ar' ? 'الحصة' : 'Period'}</span>
              <GlassSelect
                ariaLabel={lang === 'ar' ? 'الحصة' : 'Period'}
                value={String(periodNumber)}
                options={slots.map((s) => ({ value: String(s.periodNumber), label: `${lang === 'ar' ? s.labelAr : s.labelEn} (${s.start})` }))}
                onChange={(v) => setPeriodNumber(Number(v))}
              />
            </div>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'المادة' : 'Subject'}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} list="sp-univ-subjects" />
              <datalist id="sp-univ-subjects">
                {data.subjects.map((s) => <option key={s.id} value={s.name} />)}
              </datalist>
            </label>
          </div>

          <div className="sp-field">
            <span>{lang === 'ar' ? 'المعلم (أو مربي الصف تلقائياً)' : 'Teacher (or Class Lead Teacher)'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'المعلم' : 'Teacher'}
              value={teacherId}
              options={[
                { value: '', label: lang === 'ar' ? 'مربي كل صف تلقائياً (Class Lead)' : 'Auto: Class Lead Teacher' },
                ...data.teachers.map((t) => ({ value: t.id, label: t.name })),
              ]}
              onChange={setTeacherId}
            />
          </div>

          <div className="sp-row-actions">
            <button type="button" className="sp-btn-soft" onClick={addEntry}>
              <Plus size={14} />
              <span>{lang === 'ar' ? 'إضافة للجدول الموحد' : 'Add Period'}</span>
            </button>
            <button type="button" className="sp-btn-ghost" onClick={applyAllDays}>
              <CalendarRange size={14} />
              <span>{lang === 'ar' ? 'نسخ لجميع الأيام' : 'Copy to Sun–Thu'}</span>
            </button>
          </div>
        </div>

        <div className="sp-list-stack">
          {dayEntries.length === 0 ? (
            <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد حصص في هذا اليوم بالقالب' : 'No template periods for this day'}</p>
          ) : (
            dayEntries.map((e) => {
              const tName = e.teacherId
                ? data.teachers.find((t) => t.id === e.teacherId)?.name
                : lang === 'ar' ? 'مربي الصف تلقائياً' : 'Class Lead Teacher';
              return (
                <div key={e.id} className="sp-lesson-card">
                  <div className="sp-lesson-meta">
                    <strong>{lang === 'ar' ? `الحصة ${e.periodNumber}` : `Period ${e.periodNumber}`} · {e.subject}</strong>
                    <small>{tName}</small>
                  </div>
                  <button
                    type="button"
                    className="sp-icon-btn is-danger"
                    onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <label className="sp-ios-switch-row">
          <span>{lang === 'ar' ? 'استبدال الحصص المتعارضة في الصفوف' : 'Replace existing periods'}</span>
          <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
        </label>

        <button type="button" className="sp-btn-primary" disabled={busy || entries.length === 0} onClick={() => void handleApply()}>
          <Check size={14} />
          <span>{lang === 'ar' ? `تطبيق على جميع الصفوف (${entries.length} حصة)` : `Apply to All Classes (${entries.length})`}</span>
        </button>
      </div>
  );
}
