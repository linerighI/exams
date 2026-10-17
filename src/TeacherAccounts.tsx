import { useEffect, useState } from 'react';
import { Users, Plus, ShieldCheck, UserRound, LockKeyhole } from 'lucide-react';
import { api } from './api';
import type { TeacherAccount, SchoolClass } from './types';
import './teacherAssignments.css';

function GradeSelection({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: SchoolClass[];
  value: string[];
  onChange: (grades: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="teacher-grade-selection" disabled={disabled}>
      <legend>الصفوف المسندة</legend>
      <div>
        {choices.map(({ id, grade, section, count }) => {
          return (
            <label key={id}>
              <input
                type="checkbox"
                checked={value.includes(id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, id] : value.filter((g) => g !== id))
                }
              />
              <span>
                {grade} · {section}
                {count !== undefined && <small> · {count} طالب</small>}
              </span>
            </label>
          );
        })}
      </div>
      {!choices.length && (
        <small>لا توجد صفوف مسجلة بعد. أضف الطلاب أو استورد قائمتهم أولًا.</small>
      )}
    </fieldset>
  );
}
export default function TeacherAccounts({ notify }: { notify: (s: string) => void }) {
  const [account, setAccount] = useState<TeacherAccount>(),
    [accounts, setAccounts] = useState<TeacherAccount[]>([]),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [password, setPassword] = useState(''),
    [form, setForm] = useState({ username: '', name: '', password: '', classes: [] as string[] }),
    [classes, setClasses] = useState<SchoolClass[]>([]),
    [editingGrades, setEditingGrades] = useState(''),
    [assigned, setAssigned] = useState<string[]>([]);
  const refresh = async () => {
    const own = await api('/api/account');
    setAccount(own);
    setName(own.name);
    if (own.isAdmin) {
      setAccounts(await api('/api/teachers'));
      setClasses(await api('/api/teacher-classes'));
    }
  };
  useEffect(() => {
    void refresh().catch((e) => notify(e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card teacher-accounts">
      <div className="section-heading">
        <Users size={23} />
        <div>
          <h2>حسابات المعلمين</h2>
          <p>لكل معلم مكتبته وطلابه وامتحاناته الخاصة.</p>
        </div>
      </div>
      {account && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/api/account', 'PUT', {
                  name,
                  currentPassword,
                  ...(password ? { password } : {}),
                });
                setCurrentPassword('');
                setPassword('');
                notify('حُفظت بيانات حسابك');
              });
            }}
          >
            <div className="account-identity">
              <UserRound />
              <strong>{account.username}</strong>
              <span className="pill">{account.isAdmin ? 'مدير الحسابات' : 'معلم'}</span>
            </div>
            {!account.isAdmin && (
              <p className="assigned-grade-summary">
                صفوفك:{' '}
                {account.classes?.length
                  ? account.classes.map((c) => `${c.grade} · ${c.section}`).join('، ')
                  : 'لم تُسند صفوف بعد؛ تواصل مع مدير الحسابات'}
              </p>
            )}
            <div className="form-grid">
              <label className="field">
                الاسم المعروض
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                كلمة المرور الحالية
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                كلمة مرور جديدة (اختياري)
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>
            <button className="secondary" disabled={busy}>
              <LockKeyhole size={15} />
              حفظ حسابي
            </button>
          </form>
          {account.isAdmin && (
            <div className="account-admin">
              <h3>
                <ShieldCheck size={18} />
                إضافة معلم
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api('/api/teachers', 'POST', form);
                    setForm({ username: '', name: '', password: '', classes: [] });
                    notify('تم إنشاء حساب المعلم');
                  });
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    اسم مستخدم المعلم
                    <input
                      aria-label="اسم مستخدم المعلم الجديد"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      minLength={3}
                      maxLength={40}
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    اسم المعلم
                    <input
                      aria-label="اسم المعلم الجديد"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    كلمة المرور
                    <input
                      aria-label="كلمة مرور المعلم الجديد"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
                <GradeSelection
                  choices={classes}
                  value={form.classes}
                  onChange={(v) => setForm({ ...form, classes: v })}
                  disabled={busy}
                />
                <button className="primary" disabled={busy}>
                  <Plus size={15} />
                  إنشاء حساب المعلم
                </button>
              </form>
              <div className="account-list">
                {accounts.map((a) => (
                  <article key={a.id}>
                    <UserRound size={18} />
                    <span>
                      <strong>{a.name}</strong>
                      <small dir="ltr">{a.username}</small>
                      {!a.isAdmin && (
                        <small>
                          {a.classes?.length
                            ? a.classes.map((c) => `${c.grade} · ${c.section}`).join('، ')
                            : 'لا توجد صفوف مسندة'}
                        </small>
                      )}
                    </span>
                    <span className="pill">
                      {a.isAdmin ? 'مدير' : a.disabled ? 'موقوف' : 'نشط'}
                    </span>
                    {!a.isAdmin && (
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() => {
                          setEditingGrades(editingGrades === a.id ? '' : a.id);
                          setAssigned(
                            a.classes
                              ?.map((c) => c.id)
                              .filter((id) => classes.some((c) => c.id === id)) || [],
                          );
                        }}
                      >
                        إسناد الصفوف
                      </button>
                    )}
                    {!a.isAdmin && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api(`/api/teachers/${a.id}`, 'PATCH', { disabled: !a.disabled });
                          })
                        }
                      >
                        {a.disabled ? 'تفعيل' : 'إيقاف الحساب'}
                      </button>
                    )}
                    {editingGrades === a.id && (
                      <div className="teacher-grade-editor">
                        <GradeSelection
                          choices={classes}
                          value={assigned}
                          onChange={setAssigned}
                          disabled={busy}
                        />
                        <button
                          className="primary small"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(`/api/teachers/${a.id}`, 'PATCH', { classes: assigned });
                              setEditingGrades('');
                              notify('حُفظت الصفوف المسندة');
                            })
                          }
                        >
                          حفظ الصفوف
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
