/**
 * Floating detail window for Parents and Students rendered over the 3D Avatar stage:
 * opens Attendance & Absences, Timetable, Grades, Homework, or Notes without leaving the canvas.
 */
import { useState, type FormEvent } from 'react';
import { Award, BookOpen, Calendar, CheckCircle2, Megaphone, MessageSquare } from 'lucide-react';
import type { Language } from '../i18n';
import { JORDAN_WEEKDAYS, formatClock, weekdayOfDate } from '../jordanTime';
import { tr } from '../translations';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';

export type FamilyPanelSection = 'attendance' | 'schedule' | 'grades' | 'homework' | 'notes';

interface FamilyDetailWindowProps {
  section: FamilyPanelSection;
  data: State;
  lang: Language;
  busy: boolean;
  onClose: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Floating glass inspector window opened from the 3D Avatar's orbital cards. */
export function FamilyDetailWindow({
  section,
  data,
  lang,
  busy,
  onClose,
  mutate,
}: FamilyDetailWindowProps) {
  const st = data.student;
  const todayWd = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(todayWd >= 0 && todayWd <= 4 ? todayWd : 0);
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({});

  if (!st) return null;

  const titles: Record<FamilyPanelSection, { ar: string; en: string }> = {
    attendance: { ar: 'سجل الحضور والغياب', en: 'Attendance & Absences' },
    schedule: { ar: 'الجدول المدرسي', en: 'Class Timetable' },
    grades: { ar: 'العلامات والتقييمات', en: 'Published Grades' },
    homework: { ar: 'الواجبات المدرسية', en: 'Homework' },
    notes: { ar: 'الملاحظات والإعلانات', en: 'Notes & Announcements' },
  };

  const dayLessons = data.lessons
    .filter((l) => l.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));

  const submitHw = async (e: FormEvent, hwId: string) => {
    e.preventDefault();
    const content = (answerMap[hwId] || '').trim();
    if (!content) return;
    const ok = await mutate(`/homework/${hwId}/submit`, { content }, lang === 'ar' ? 'تم تسليم الواجب' : 'Submitted');
    if (ok) setAnswerMap({ ...answerMap, [hwId]: '' });
  };

  return (
    <FloatingWindow
      id={`family-${section}`}
      title={lang === 'ar' ? titles[section].ar : titles[section].en}
      subtitle={`${st.name} · ${st.section}`}
      dock="right"
      width={440}
      zIndex={38}
      onFocus={() => {}}
      onClose={onClose}
    >
      {section === 'attendance' && (
        <div className="sp-tab-pane">
          <div className="sp-kpi-grid">
            <div className="sp-kpi-card">
              <strong className={`is-${st.today_status || 'blue'}`}>
                {st.today_status ? tr(st.today_status) : (lang === 'ar' ? 'غير مسجل' : 'Pending')}
              </strong>
              <small>{lang === 'ar' ? 'حالة اليوم' : 'Today'}</small>
            </div>
            <div className="sp-kpi-card">
              <strong className="is-coral">
                {data.attendance.filter((a) => a.status === 'absent').length}
              </strong>
              <small>{lang === 'ar' ? 'إجمالي الغياب' : 'Absences'}</small>
            </div>
            <div className="sp-kpi-card">
              <strong>{data.attendance.filter((a) => a.status === 'late').length}</strong>
              <small>{lang === 'ar' ? 'تأخر' : 'Late'}</small>
            </div>
          </div>

          <div className="sp-list-stack">
            {data.attendance.length === 0 ? (
              <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد سجلات حضور مسجلة بعد' : 'No attendance records yet'}</p>
            ) : (
              data.attendance.map((a) => (
                <div key={a.id} className="sp-info-row">
                  <div>
                    <strong>{a.subject}</strong>
                    <small>{a.date} · {a.start}</small>
                  </div>
                  <span className={`sp-status-tag is-${a.status}`}>{tr(a.status)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'schedule' && (
        <div className="sp-tab-pane">
          <div className="sp-weekday-pills">
            {JORDAN_WEEKDAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={weekday === d.id ? 'is-active' : ''}
                onClick={() => setWeekday(d.id)}
              >
                {lang === 'ar' ? d.ar : d.en}
              </button>
            ))}
          </div>
          <div className="sp-list-stack">
            {dayLessons.length === 0 ? (
              <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No lessons scheduled'}</p>
            ) : (
              dayLessons.map((l) => (
                <div key={l.id} className="sp-info-row">
                  <Calendar size={15} className="is-blue" />
                  <div>
                    <strong>{l.subject}</strong>
                    <small>{l.teacher} · {formatClock(l.start, lang)} – {formatClock(l.end, lang)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'grades' && (
        <div className="sp-list-stack">
          {data.grades.length === 0 ? (
            <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد علامات منشورة حتى الآن' : 'No published grades yet'}</p>
          ) : (
            data.grades.map((g) => (
              <div key={g.id} className="sp-info-row">
                <Award size={15} className="is-emerald" />
                <div>
                  <strong>{g.title}</strong>
                  <small>{g.subject} · {g.date}</small>
                </div>
                <b className="sp-grade-score">{g.score}/{g.max}</b>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'homework' && (
        <div className="sp-list-stack">
          {data.homework.length === 0 ? (
            <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد واجبات حالياً' : 'No homework assigned'}</p>
          ) : (
            data.homework.map((h) => (
              <div key={h.id} className="sp-inline-box">
                <div className="sp-note-head">
                  <BookOpen size={14} className="is-blue" />
                  <strong>{h.title}</strong>
                  <small>{h.subject} · {h.due}</small>
                </div>
                <p className="sp-small-copy">{h.description}</p>
                {h.submission ? (
                  <p className="sp-submitted-tag">
                    <CheckCircle2 size={13} />
                    <span>{lang === 'ar' ? `تم التسليم: ${h.submission}` : `Submitted: ${h.submission}`}</span>
                  </p>
                ) : data.user.role === 'student' ? (
                  <form className="sp-row-actions" onSubmit={(e) => void submitHw(e, h.id)}>
                    <input
                      required
                      placeholder={lang === 'ar' ? 'اكتب إجابتك…' : 'Your answer…'}
                      value={answerMap[h.id] || ''}
                      onChange={(e) => setAnswerMap({ ...answerMap, [h.id]: e.target.value })}
                    />
                    <button type="submit" className="sp-btn-primary" disabled={busy}>
                      {lang === 'ar' ? 'تسليم' : 'Submit'}
                    </button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {section === 'notes' && (
        <div className="sp-tab-pane">
          <h4 className="sp-subhead">{lang === 'ar' ? 'ملاحظات المعلمين' : 'Teacher Notes'}</h4>
          <div className="sp-list-stack">
            {data.notes.length === 0 ? (
              <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد ملاحظات مسجلة' : 'No notes yet'}</p>
            ) : (
              data.notes.map((n) => (
                <div key={n.id} className="sp-note-card">
                  <div className="sp-note-head">
                    <MessageSquare size={13} className="is-blue" />
                    <strong>{n.author}</strong>
                    <small>{n.created.slice(0, 10)}</small>
                  </div>
                  <p>{n.content}</p>
                </div>
              ))
            )}
          </div>
          <h4 className="sp-subhead">{lang === 'ar' ? 'إعلانات المدرسة' : 'School Announcements'}</h4>
          <div className="sp-list-stack">
            {data.announcements.map((a) => (
              <div key={a.id} className="sp-note-card">
                <div className="sp-note-head">
                  <Megaphone size={13} className="is-emerald" />
                  <strong>{a.title}</strong>
                  <small>{a.created.slice(0, 10)}</small>
                </div>
                <p>{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </FloatingWindow>
  );
}
