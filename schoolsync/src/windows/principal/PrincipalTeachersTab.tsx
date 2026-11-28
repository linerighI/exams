/**
 * Principal Office -> Teachers & Staff tab: full searchable teachers directory,
 * inline Wing/Class/Subject assignment editor, live absence toggle, and staff account creator.
 */
import { useMemo, useState } from 'react';
import { Check, Layers, Search, UserCheck, UserPlus, UserX } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusLayout, State, TeacherProfile, WingId } from '../../types';
import { PrincipalCreateStaffForm } from './PrincipalCreateStaffForm';

interface PrincipalTeachersTabProps {
  layout: CampusLayout;
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Teachers management directory + account creation inside Principal Office. */
export function PrincipalTeachersTab({
  layout,
  data,
  lang,
  busy,
  mutate,
}: PrincipalTeachersTabProps) {
  const ar = lang === 'ar';
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWings, setEditWings] = useState<WingId[]>([]);
  const [editClasses, setEditClasses] = useState<string[]>([]);
  const [editSubjects, setEditSubjects] = useState<string[]>([]);

  const wingNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of layout.wings) map.set(w.id, ar ? w.labelAr : w.labelEn);
    return map;
  }, [layout.wings, ar]);

  const teachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.teachers.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subjects.some((s) => s.toLowerCase().includes(q)) ||
        t.classes.some((c) => c.toLowerCase().includes(q)),
    );
  }, [data.teachers, query]);

  const adminAccounts = useMemo(
    () => data.accounts.filter((a) => a.role === 'admin' || a.role === 'assistant'),
    [data.accounts],
  );

  const startEdit = (t: TeacherProfile) => {
    if (editingId === t.id) return setEditingId(null);
    setEditingId(t.id);
    setEditWings(t.wings || []);
    setEditClasses(t.classes || []);
    setEditSubjects(t.subjects || []);
  };

  const toggleItem = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const handleSaveAssignments = async (teacherId: string) => {
    const ok = await mutate(
      `/teachers/${teacherId}/assignments`,
      { classes: editClasses, subjects: editSubjects, wings: editWings },
      ar ? 'تم تحديث مهام وأجنحة المعلم' : 'Teacher assignments saved',
    );
    if (ok) setEditingId(null);
  };

  return (
    <div className="sp-tab-pane">
      <div className="sp-toolbar-row">
        <div className="sp-search-mini">
          <Search size={14} />
          <input
            placeholder={ar ? 'ابحث باسم المعلم أو المادة أو الشعبة…' : 'Search teachers, subjects…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" className="sp-btn-primary" onClick={() => setShowCreate((v) => !v)}>
          <UserPlus size={14} />
          <span>{showCreate ? (ar ? 'إغلاق' : 'Close') : (ar ? 'إضافة معلم / موظف' : 'Add Staff')}</span>
        </button>
      </div>

      {showCreate && (
        <PrincipalCreateStaffForm
          data={data}
          lang={lang}
          busy={busy}
          onSuccess={() => setShowCreate(false)}
          mutate={mutate}
        />
      )}

      <div className="sp-list-stack" style={{ background: 'transparent', border: 'none', boxShadow: 'none', gap: 9, overflow: 'visible' }}>
        {teachers.length === 0 ? (
          <p className="sp-empty-note">{ar ? 'لا يوجد معلمون مسجلون مطابقون للبحث' : 'No teachers found'}</p>
        ) : (
          teachers.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div key={t.id} className="sp-po-teacher-card">
                <div className="sp-po-teacher-top">
                  <div className="sp-po-teacher-id">
                    <span className="sp-mini-avatar">{t.name.slice(0, 2)}</span>
                    <div>
                      <strong>{t.name}</strong>
                      <small>{t.email}</small>
                    </div>
                  </div>
                  <div className="sp-row-actions">
                    <button
                      type="button"
                      className={`sp-po-absent-btn ${t.isAbsent ? 'is-absent' : ''}`}
                      onClick={() =>
                        void mutate(
                          '/schedule/teacher-absence',
                          { teacherId: t.id, isAbsent: !t.isAbsent },
                          t.isAbsent ? (ar ? 'تم تسجيل المعلم حاضراً' : 'Marked present') : (ar ? 'تم تسجيل المعلم غائباً' : 'Marked absent'),
                        )
                      }
                    >
                      {t.isAbsent ? <UserX size={12} /> : <UserCheck size={12} />}
                      <span>{t.isAbsent ? (ar ? 'غائب اليوم' : 'Absent') : (ar ? 'على رأس عمله' : 'Present')}</span>
                    </button>
                    <button type="button" className="sp-btn-soft" onClick={() => startEdit(t)}>
                      <Layers size={13} />
                      <span>{isEditing ? (ar ? 'إغلاق' : 'Close') : (ar ? 'الأجنحة والشعب' : 'Assign')}</span>
                    </button>
                  </div>
                </div>

                <div className="sp-po-badges">
                  {t.homeroomSection && (
                    <span className="sp-po-badge is-emerald">
                      {ar ? `مربي: ${t.homeroomSection}` : `Lead: ${t.homeroomSection}`}
                    </span>
                  )}
                  {(t.wings || []).map((w) => (
                    <span key={w} className="sp-po-badge is-blue">{wingNames.get(w) || w}</span>
                  ))}
                  {t.subjects.map((sub) => <span key={sub} className="sp-po-badge">{sub}</span>)}
                  {t.classes.map((cls) => <span key={cls} className="sp-po-badge">{cls}</span>)}
                </div>

                {isEditing && (
                  <div className="sp-po-teacher-editor">
                    <div className="sp-chip-picker">
                      <span>{ar ? 'الأجنحة المسموحة على المجسم ثلاثي الأبعاد' : 'Allowed 3D Wings'}</span>
                      <div className="sp-chip-grid">
                        {layout.wings.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className={`sp-toggle-chip ${editWings.includes(w.id) ? 'is-active' : ''}`}
                            onClick={() => setEditWings(toggleItem(editWings, w.id))}
                          >
                            {ar ? w.labelAr : w.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sp-chip-picker">
                      <span>{ar ? 'الشعب المكلّف بتدريسها' : 'Assigned Classes'}</span>
                      <div className="sp-chip-grid">
                        {data.classes.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`sp-toggle-chip ${editClasses.includes(c.name) ? 'is-active' : ''}`}
                            onClick={() => setEditClasses(toggleItem(editClasses, c.name))}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sp-chip-picker">
                      <span>{ar ? 'المواد الدراسية' : 'Subjects'}</span>
                      <div className="sp-chip-grid">
                        {data.subjects.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`sp-toggle-chip ${editSubjects.includes(s.name) ? 'is-active' : ''}`}
                            onClick={() => setEditSubjects(toggleItem(editSubjects, s.name))}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" className="sp-btn-primary" disabled={busy} onClick={() => void handleSaveAssignments(t.id)}>
                      <Check size={14} />
                      <span>{ar ? 'حفظ صلاحيات المعلم' : 'Save Permissions'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {adminAccounts.length > 0 && (
        <>
          <h4 className="sp-subhead">{ar ? `الإدارة المدرسية (${adminAccounts.length})` : `Administration (${adminAccounts.length})`}</h4>
          <div className="sp-list-stack">
            {adminAccounts.map((a) => (
              <div key={a.id} className="sp-info-row">
                <div>
                  <strong>{a.name}</strong>
                  <small>{a.email}</small>
                </div>
                <span className="sp-po-badge is-blue">
                  {a.role === 'admin' ? (ar ? 'مدير' : 'Principal') : (ar ? 'مساعد المدير' : 'Assistant')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
