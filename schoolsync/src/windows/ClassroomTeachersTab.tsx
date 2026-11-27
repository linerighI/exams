/**
 * Teachers & homework tab inside ClassroomWindow: lists assigned class teachers,
 * homework items, and inline homework assignment form.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { BookOpen, UserCheck } from 'lucide-react';
import type { Language } from '../i18n';
import type { State } from '../types';

interface ClassroomTeachersTabProps {
  className: string;
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Displays class teachers and lets staff publish new class homework. */
export function ClassroomTeachersTab({
  className,
  data,
  lang,
  busy,
  mutate,
}: ClassroomTeachersTabProps) {
  const [hwOpen, setHwOpen] = useState(false);
  const [hwForm, setHwForm] = useState({ subject: '', title: '', description: '', due: data.date });

  const classTeachers = useMemo(
    () => data.teachers.filter((t) => t.classes.includes(className)),
    [data.teachers, className],
  );
  const classHomework = useMemo(
    () => (data.schoolWorkspace?.homework || []).filter((h) => h.section === className),
    [data.schoolWorkspace, className],
  );

  const handleCreateHomework = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/homework',
      {
        section: className,
        subject: hwForm.subject || data.subjects[0]?.name || 'الرياضيات',
        title: hwForm.title,
        description: hwForm.description,
        due: hwForm.due,
      },
      lang === 'ar' ? 'تم نشر الواجب للشعبة' : 'Homework assigned',
    );
    if (ok) {
      setHwOpen(false);
      setHwForm({ subject: '', title: '', description: '', due: data.date });
    }
  };

  return (
    <div className="sp-tab-pane">
      <h4 className="sp-subhead">{lang === 'ar' ? 'مربي الصف ومعلمو الشعبة' : 'Class Lead & Assigned Teachers'}</h4>
      <div className="sp-list-stack">
        {classTeachers.length === 0 ? (
          <p className="sp-empty-note">{lang === 'ar' ? 'لا يوجد مربي صف مرتبط بعد' : 'No class lead teacher assigned'}</p>
        ) : (
          classTeachers.map((t, idx) => (
            <div key={t.id} className="sp-info-row">
              <UserCheck size={15} className="is-blue" />
              <div>
                <strong>
                  {t.name}
                  {idx === 0 && (
                    <span className="sp-live-chip">
                      {lang === 'ar' ? 'مربي الصف' : 'Class Lead'}
                    </span>
                  )}
                </strong>
                <small>{t.subjects.join(' · ') || t.email}</small>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sp-section-split">
        <h4 className="sp-subhead">{lang === 'ar' ? 'الواجبات المدرسية' : 'Homework'}</h4>
        <button type="button" className="sp-btn-soft" onClick={() => setHwOpen(!hwOpen)}>
          <BookOpen size={13} />
          <span>{lang === 'ar' ? 'واجب جديد' : 'Assign'}</span>
        </button>
      </div>

      {hwOpen && (
        <form className="sp-inline-box" onSubmit={(e) => void handleCreateHomework(e)}>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{lang === 'ar' ? 'المادة' : 'Subject'}</span>
              <input
                required
                placeholder={data.subjects[0]?.name || 'الرياضيات'}
                value={hwForm.subject}
                onChange={(e) => setHwForm({ ...hwForm, subject: e.target.value })}
              />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'الموعد' : 'Due'}</span>
              <input
                type="date"
                required
                value={hwForm.due}
                onChange={(e) => setHwForm({ ...hwForm, due: e.target.value })}
              />
            </label>
          </div>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'عنوان الواجب' : 'Title'}</span>
            <input
              required
              value={hwForm.title}
              onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })}
            />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'التفاصيل' : 'Instructions'}</span>
            <input
              required
              value={hwForm.description}
              onChange={(e) => setHwForm({ ...hwForm, description: e.target.value })}
            />
          </label>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            {lang === 'ar' ? 'نشر الواجب' : 'Publish Homework'}
          </button>
        </form>
      )}

      <div className="sp-list-stack">
        {classHomework.map((h) => (
          <div key={h.id} className="sp-info-row">
            <div>
              <strong>{h.title}</strong>
              <small>{h.subject} · {h.due}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
