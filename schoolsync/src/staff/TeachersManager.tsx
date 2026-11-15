/**
 * Teacher Roster & Canvas Profile Card (matching the two-column Assigned Classes,
 * Assigned Subjects, and Account Access layout) for Principals & Assistant Principals.
 */
import { useState } from 'react';
import { ArrowRight, BookOpen, Check, GraduationCap, ShieldCheck, UserCheck } from 'lucide-react';
import { StudentAvatar } from '../components/StudentAvatar';
import type { Language } from '../i18n';
import type { State, TeacherProfile } from '../types';
import { Empty, Motion } from '../ui';

export function TeachersManager({
  data,
  lang,
  mutate,
  busy,
}: {
  data: State;
  lang: Language;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const ar = lang === 'ar';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const teacher = data.teachers.find((t) => t.id === selectedId) || null;

  return (
    <Motion identity={teacher ? `teacher-${teacher.id}` : 'teachers-grid'}>
      {teacher ? (
        <TeacherDetailCard
          key={teacher.id}
          teacher={teacher}
          allClasses={data.classes.map((c) => c.name)}
          allSubjects={data.subjects.map((s) => s.name)}
          lang={lang}
          busy={busy}
          mutate={mutate}
          onBack={() => setSelectedId(null)}
        />
      ) : data.teachers.length ? (
        <div className="canvas-cards-grid">
          {data.teachers.map((t) => (
            <button className="teacher-row-card canvas-entity-card t-surface" data-stagger key={t.id} onClick={() => setSelectedId(t.id)}>
              <div className="student-card-identity">
                <StudentAvatar name={t.name} color="yellow" />
                <div>
                  <strong>{t.name}</strong>
                  <small dir="ltr">{t.email}</small>
                </div>
              </div>
              <div className="teacher-tags-summary">
                <span className="pill-soft">
                  {t.classes.length ? t.classes.join('، ') : ar ? 'بدون شعب' : 'No classes'}
                </span>
                <span className="pill-soft">
                  {t.subjects.length ? t.subjects.join('، ') : ar ? 'بدون مواد' : 'No subjects'}
                </span>
              </div>
              <div className="entity-card-foot">
                <span>
                  <UserCheck size={13} /> {ar ? 'لوحة صلاحيات المعلم' : 'Teacher Canvas'}
                </span>
                <span className="link-accent">{ar ? 'تعديل التعيين ←' : 'Configure →'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={ar ? 'لا يوجد معلمون بعد' : 'No teachers yet'}
          detail={ar ? 'أضف حساب معلم من النموذج أدناه ثم اضغط على بطاقته لتحديد صفوفه ومواده.' : 'Create a teacher account below to assign classes and subjects.'}
        />
      )}
    </Motion>
  );
}

function TeacherDetailCard({
  teacher,
  allClasses,
  allSubjects,
  lang,
  busy,
  mutate,
  onBack,
}: {
  teacher: TeacherProfile;
  allClasses: string[];
  allSubjects: string[];
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const ar = lang === 'ar';
  const [classes, setClasses] = useState<string[]>(teacher.classes);
  const [subjects, setSubjects] = useState<string[]>(teacher.subjects);

  const classPool = [...new Set([...allClasses, ...teacher.classes])];
  const subjectPool = [...new Set([...allSubjects, ...teacher.subjects])];

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const save = async () => {
    await mutate(
      `/teachers/${teacher.id}/assignments`,
      { classes, subjects },
      ar ? 'تم حفظ تعيينات المعلم بنجاح' : 'Teacher assignments saved',
    );
  };

  return (
    <div className="surface-card teacher-detail-card">
      <div className="row-between">
        <button className="text-button" onClick={onBack}>
          <ArrowRight size={16} />
          {ar ? 'رجوع لقائمة المعلمين' : 'Back to teachers'}
        </button>
        <span className="live-badge">
          <i /> {ar ? 'حساب معلم نشط' : 'Active Teacher'}
        </span>
      </div>

      <div className="teacher-canvas-hero">
        <StudentAvatar name={teacher.name} color="yellow" size="lg" />
        <div>
          <h3>{teacher.name}</h3>
          <small dir="ltr">{teacher.email}</small>
        </div>
      </div>

      <div className="teacher-canvas-columns">
        <div className="assign-block canvas-subpanel">
          <h4>
            <GraduationCap size={16} />
            {ar ? 'الصفوف المعيّنة' : 'Assigned Classes'}
          </h4>
          <div className="chip-row">
            {classPool.map((c) => {
              const on = classes.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  className={`chip-pill ${on ? 'selected' : ''}`}
                  onClick={() => toggle(classes, setClasses, c)}
                >
                  {on && <Check size={13} />}
                  {c}
                </button>
              );
            })}
            {!classPool.length && <small>{ar ? 'أضف شعباً دراسية أولاً' : 'Create classes first'}</small>}
          </div>
          <h4 style={{ marginTop: 10 }}>
            <ShieldCheck size={16} />
            {ar ? 'وصول الحساب' : 'Account Access'}
          </h4>
          <div className="assigned-mini-row">
            <span className="entity-monogram lilac">@</span>
            <div>
              <strong>{ar ? 'حساب المستخدم المرتبط' : 'Linked User Account'}</strong>
              <small dir="ltr">{teacher.email}</small>
            </div>
          </div>
        </div>

        <div className="assign-block canvas-subpanel">
          <h4>
            <BookOpen size={16} />
            {ar ? 'المواد المعيّنة' : 'Assigned Subjects'}
          </h4>
          <div className="chip-row">
            {subjectPool.map((sub) => {
              const on = subjects.includes(sub);
              return (
                <button
                  type="button"
                  key={sub}
                  className={`chip-pill ${on ? 'selected' : ''}`}
                  onClick={() => toggle(subjects, setSubjects, sub)}
                >
                  {on && <Check size={13} />}
                  {sub}
                </button>
              );
            })}
            {!subjectPool.length && <small>{ar ? 'أضف مواد دراسية أولاً' : 'Create subjects first'}</small>}
          </div>
        </div>
      </div>

      <button className="primary" disabled={busy} onClick={() => void save()}>
        {ar ? 'حفظ الصفوف والمواد للمعلم' : 'Save teacher assignments'}
      </button>
    </div>
  );
}
