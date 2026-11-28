/**
 * Teachers & homework tab inside ClassroomWindow: displays locked Class Lead Teacher,
 * manager lead-teacher reassignment selector, subject teachers, and homework creation.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { BookOpen, UserCheck } from 'lucide-react';
import type { Language } from '../i18n';
import { sortClassTeachers } from '../spatial/leadTeacher';
import { isManagerRole, type State } from '../types';
import { GlassSelect } from './GlassSelect';

interface ClassroomTeachersTabProps {
  className: string;
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Displays locked class lead teacher, subject teachers, and inline homework form. */
export function ClassroomTeachersTab({
  className,
  data,
  lang,
  busy,
  mutate,
}: ClassroomTeachersTabProps) {
  const [hwOpen, setHwOpen] = useState(false);
  const [hwForm, setHwForm] = useState({ subject: '', title: '', description: '', due: data.date });
  const manager = isManagerRole(data.user.role);
  const cls = useMemo(() => data.classes.find((c) => c.name === className), [data.classes, className]);

  const { lead, others } = useMemo(
    () => sortClassTeachers(data, className),
    [data, className],
  );
  const orderedTeachers = lead ? [lead, ...others] : others;
  const classHomework = useMemo(
    () => (data.schoolWorkspace?.homework || []).filter((h) => h.section === className),
    [data.schoolWorkspace, className],
  );

  const handleAssignLead = async (teacherId: string) => {
    if (!cls) return;
    await mutate(
      `/classes/${cls.id}/lead-teacher`,
      { teacherId: teacherId || null },
      lang === 'ar' ? 'تم تثبيت مربي الصف' : 'Class lead teacher updated',
    );
  };

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
      <div className="sp-section-split">
        <h4 className="sp-subhead">{lang === 'ar' ? 'مربي الصف ومعلمو الشعبة' : 'Class Lead & Teachers'}</h4>
        {manager && cls && data.teachers.length > 0 && (
          <div style={{ minWidth: 185 }}>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'تعيين مربي الصف' : 'Assign Lead Teacher'}
              value={lead?.id || ''}
              options={[
                { value: '', label: lang === 'ar' ? '— تعيين مربي الصف —' : '— Select Lead —' },
                ...data.teachers.map((t) => ({ value: t.id, label: t.name })),
              ]}
              onChange={(val) => void handleAssignLead(val)}
            />
          </div>
        )}
      </div>

      <div className="sp-list-stack">
        {orderedTeachers.length === 0 ? (
          <p className="sp-empty-note">{lang === 'ar' ? 'لا يوجد معلمون مرتبطون بهذه الشعبة بعد' : 'No assigned teachers yet'}</p>
        ) : (
          orderedTeachers.map((t) => {
            const isLead = lead?.id === t.id;
            return (
              <div key={t.id} className="sp-info-row">
                <UserCheck size={15} className="is-blue" />
                <div>
                  <strong>
                    {t.name}
                    {isLead && (
                      <span className="sp-live-chip">
                        {lang === 'ar' ? 'مربي الصف' : 'Class Lead'}
                      </span>
                    )}
                  </strong>
                  <small>{t.subjects.join(' · ') || t.email}</small>
                </div>
              </div>
            );
          })
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
