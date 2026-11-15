/**
 * Principal (`admin`) & Assistant Principal (`assistant`) Interactive Canvas
 * Administration Workspace (`إدارة المدرسة`) with smooth `<Motion>` transitions.
 */
import { useState, type FormEvent } from 'react';
import { BookOpen, Database, GraduationCap, ShieldAlert, UserPlus, Users, Volume2 } from 'lucide-react';
import type { Language } from '../i18n';
import type { Role, State } from '../types';
import { Empty, Motion, Sheet } from '../ui';
import { ClassesSubjectsPanel } from './ClassesSubjectsPanel';
import { DatabaseInjectorPanel } from './DatabaseInjectorPanel';
import { StudentsEnrollPanel } from './StudentsEnrollPanel';
import { TeachersManager } from './TeachersManager';

export function AdminHub({
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
  const [tab, setTab] = useState<'classes' | 'teachers' | 'students' | 'notices' | 'database'>('classes');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountRole, setAccountRole] = useState<Role>('teacher');
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);

  const submitSimple = (url: string, msg: string) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (await mutate(url, values, msg)) form.reset();
  };

  const createAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const payload = {
      name: String(f.get('name') || ''),
      email: String(f.get('email') || ''),
      password: String(f.get('password') || ''),
      role: accountRole,
      sections: accountRole === 'teacher' ? teacherClasses : undefined,
      section: accountRole === 'teacher' ? teacherClasses[0] || String(f.get('section') || '') : undefined,
      studentId: accountRole === 'student' ? String(f.get('studentId') || '') : undefined,
    };
    if (await mutate('/accounts', payload, ar ? 'تم إنشاء الحساب بنجاح' : 'Account created')) {
      form.reset();
      setTeacherClasses([]);
      setShowAccountModal(false);
    }
  };

  return (
    <div className="admin-hub">
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{ar ? 'المدير ومساعد المدير · لوحة التحكم المرئية' : 'SCHOOL ADMINISTRATION CANVAS'}</div>
        <h1>
          {ar ? 'إدارة المدرسة' : 'Management'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'مساحة عمل تفاعلية لإدارة الشعب والمواد، تعيين المعلمين، وتسجيل الطلاب وأولياء الأمور.'
            : 'Interactive canvas for classes, curriculum subjects, teachers, and family onboarding.'}
        </p>
      </div>

      <div className="canvas-nav-grid" role="tablist" data-reveal>
        <button className={`canvas-tab-card t-surface ${tab === 'classes' ? 'selected' : ''}`} data-stagger onClick={() => setTab('classes')}>
          <BookOpen size={17} />
          <strong>{ar ? 'الشعب والمواد' : 'Classes & Subjects'}</strong>
          <small>{ar ? `${data.classes.length} شعب · ${data.subjects.length} مواد` : `${data.classes.length} classes`}</small>
        </button>
        <button className={`canvas-tab-card t-surface ${tab === 'teachers' ? 'selected' : ''}`} data-stagger onClick={() => setTab('teachers')}>
          <GraduationCap size={17} />
          <strong>{ar ? 'المعلمون والطاقم' : 'Staff'}</strong>
          <small>{ar ? `${data.teachers.length} معلم` : `${data.teachers.length} teachers`}</small>
        </button>
        <button className={`canvas-tab-card t-surface ${tab === 'students' ? 'selected' : ''}`} data-stagger onClick={() => setTab('students')}>
          <Users size={17} />
          <strong>{ar ? 'الطلاب والعائلة' : 'Students'}</strong>
          <small>{ar ? `${data.students.length} طالب` : `${data.students.length} students`}</small>
        </button>
        <button className={`canvas-tab-card t-surface ${tab === 'notices' ? 'selected' : ''}`} data-stagger onClick={() => setTab('notices')}>
          <Volume2 size={17} />
          <strong>{ar ? 'التعاميم' : 'Notices'}</strong>
          <small>{ar ? `${data.announcements.length} تعميم` : `${data.announcements.length} notices`}</small>
        </button>
        <button className={`canvas-tab-card t-surface ${tab === 'database' ? 'selected' : ''}`} data-stagger onClick={() => setTab('database')}>
          <Database size={17} />
          <strong>{ar ? 'قاعدة البيانات' : 'Database'}</strong>
          <small>{ar ? 'تصدير وحقن JSON' : 'Export & Inject'}</small>
        </button>
      </div>

      <Motion identity={`admin-canvas-${tab}`}>
        {tab === 'classes' && (
          <ClassesSubjectsPanel data={data} lang={lang} busy={busy} submitSimple={submitSimple} mutate={mutate} />
        )}

        {tab === 'teachers' && (
          <div className="canvas-board-stack" data-reveal>
            <section className="canvas-section-block">
              <header className="canvas-block-head">
                <div>
                  <span className="eyebrow">{ar ? 'الكادر التعليمي · اضغط على المعلم لتخصيص صفوفه ومواده' : 'TEACHING STAFF'}</span>
                  <h2>{ar ? 'ملفات المعلمين وتعييناتهم' : 'Teachers & Assignments'}</h2>
                </div>
                <div className="schedule-head-side">
                  <span className="canvas-count-badge">{ar ? `${data.teachers.length} معلمين` : `${data.teachers.length} teachers`}</span>
                  <button type="button" className="bell-trigger-btn active" onClick={() => setShowAccountModal(true)}>
                    <UserPlus size={14} />
                    <span>{ar ? 'إضافة حساب' : 'Add account'}</span>
                  </button>
                </div>
              </header>
              <TeachersManager data={data} lang={lang} mutate={mutate} busy={busy} />
            </section>
          </div>
        )}

        {tab === 'students' && (
          <StudentsEnrollPanel data={data} lang={lang} busy={busy} mutate={mutate} />
        )}

        {tab === 'database' && (
          <DatabaseInjectorPanel data={data} lang={lang} busy={busy} mutate={mutate} />
        )}

        {tab === 'notices' && (
          <div className="canvas-board-stack" data-reveal>
            <form
              className="surface-card form-stack"
              onSubmit={submitSimple('/announcements', ar ? 'تم نشر التعميم لجميع المستخدمين' : 'Announcement published')}
            >
              <h3>{ar ? 'إرسال تعميم مدرسي للجميع' : 'Publish School Announcement'}</h3>
              <label>
                {ar ? 'عنوان التعميم' : 'Title'}
                <input name="title" required />
              </label>
              <label>
                {ar ? 'نص التعميم' : 'Content'}
                <textarea name="content" rows={3} required />
              </label>
              <button className="primary" disabled={busy}>
                {ar ? 'نشر التعميم' : 'Publish announcement'}
              </button>
            </form>

            {data.incidents.length ? (
              data.incidents.map((inc) => (
                <div className="surface-card form-stack" key={inc.id}>
                  <div className="row-between">
                    <strong>
                      <ShieldAlert size={16} /> {inc.student_name}
                    </strong>
                    <small>{inc.date}</small>
                  </div>
                  <p>{inc.detail}</p>
                </div>
              ))
            ) : (
              <Empty
                title={ar ? 'لا توجد تعارضات حضور مفتوحة' : 'No open incidents'}
                detail={ar ? 'سجلات الحضور اليومية متطابقة.' : 'All attendance records match.'}
              />
            )}
          </div>
        )}
      </Motion>

      {showAccountModal && (
        <Sheet
          title={ar ? 'إنشاء حساب طاقم جديد (معلم / إدارة)' : 'Create Staff Account'}
          onClose={() => setShowAccountModal(false)}
        >
          <form className="form-stack" onSubmit={createAccount}>
            <div className="chip-row">
              {(
                [
                  ['teacher', ar ? 'معلم' : 'Teacher'],
                  ['assistant', ar ? 'مساعد المدير' : 'Assistant Principal'],
                  ['admin', ar ? 'مدير' : 'Principal'],
                ] as const
              ).map(([r, label]) => (
                <button
                  type="button"
                  key={r}
                  className={`chip-pill ${accountRole === r ? 'selected' : ''}`}
                  onClick={() => setAccountRole(r)}
                >
                  {label}
                </button>
              ))}
            </div>
            <small className="muted-note">
              {ar
                ? 'حسابات الطلاب وأولياء الأمور تُنشأ تلقائياً بالرقم الوطني من تبويب «الطلاب والعائلة».'
                : 'Student & family accounts are automatically created via National ID in Students.'}
            </small>
            <div className="split-fields">
              <label>
                {ar ? 'الاسم الكامل' : 'Full name'}
                <input name="name" required />
              </label>
              <label>
                {ar ? 'البريد الإلكتروني' : 'Email'}
                <input name="email" type="email" required dir="ltr" />
              </label>
            </div>
            <label>
              {ar ? 'كلمة المرور (١٢ حرفاً فأكثر)' : 'Password (12+ chars)'}
              <input name="password" type="password" minLength={12} required dir="ltr" />
            </label>

            {accountRole === 'teacher' && (
              <div className="assign-block">
                <small>{ar ? 'اختر الشعب المعيّنة للمعلم (أو اكتب اسم شعبة):' : 'Select classes:'}</small>
                <div className="chip-row">
                  {data.classes.map((c) => {
                    const selected = teacherClasses.includes(c.name);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        className={`chip-pill ${selected ? 'selected' : ''}`}
                        onClick={() =>
                          setTeacherClasses(
                            selected ? teacherClasses.filter((x) => x !== c.name) : [...teacherClasses, c.name],
                          )
                        }
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                {!teacherClasses.length && (
                  <input name="section" required placeholder={ar ? 'مثال: الصف التاسع - أ' : 'e.g. 9A'} />
                )}
              </div>
            )}

            <button className="primary" disabled={busy}>
              {ar ? 'إنشاء الحساب' : 'Create account'}
            </button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
