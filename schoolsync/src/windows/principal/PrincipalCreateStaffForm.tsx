/**
 * Collapsible staff/teacher account creation card rendered inside PrincipalTeachersTab.
 */
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { Language } from '../../i18n';
import type { Role, State } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface PrincipalCreateStaffFormProps {
  data: State;
  lang: Language;
  busy: boolean;
  onSuccess: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Form card to create a Teacher (with homeroom & subject), Assistant, Admin, or Parent account. */
export function PrincipalCreateStaffForm({
  data,
  lang,
  busy,
  onSuccess,
  mutate,
}: PrincipalCreateStaffFormProps) {
  const ar = lang === 'ar';
  const [accForm, setAccForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher' as Role,
    section: data.classes[0]?.name || '',
    subject: data.subjects[0]?.name || '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/accounts',
      {
        name: accForm.name.trim(),
        email: accForm.email.trim(),
        password: accForm.password,
        role: accForm.role,
        sections: accForm.role === 'teacher' && accForm.section ? [accForm.section] : undefined,
        subjects: accForm.role === 'teacher' && accForm.subject ? [accForm.subject] : undefined,
      },
      ar ? 'تم إنشاء الحساب بنجاح' : 'Account created',
    );
    if (ok) {
      setAccForm({ ...accForm, name: '', email: '', password: '' });
      onSuccess();
    }
  };

  return (
    <form className="sp-inline-box" autoComplete="off" onSubmit={(e) => void handleSubmit(e)}>
      <div className="sp-po-card-head">
        <strong>{ar ? 'إنشاء حساب معلم أو إدارة جديدة' : 'Create Teacher or Staff Account'}</strong>
      </div>
      <div className="sp-row-2">
        <label className="sp-field">
          <span>{ar ? 'الاسم الكامل' : 'Full Name'}</span>
          <input
            required
            name="staff-name"
            placeholder={ar ? 'مثال: أ. محمد العبدالله' : 'Full name'}
            value={accForm.name}
            onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
          />
        </label>
        <div className="sp-field">
          <span>{ar ? 'الصلاحية' : 'Role'}</span>
          <GlassSelect
            ariaLabel={ar ? 'الصلاحية' : 'Role'}
            value={accForm.role}
            options={[
              { value: 'teacher', label: ar ? 'معلم' : 'Teacher' },
              { value: 'assistant', label: ar ? 'مساعد المدير' : 'Assistant Principal' },
              { value: 'admin', label: ar ? 'مدير' : 'Principal' },
              { value: 'parent', label: ar ? 'ولي أمر' : 'Parent' },
            ]}
            onChange={(val) => setAccForm({ ...accForm, role: val as Role })}
          />
        </div>
      </div>
      <div className="sp-row-2">
        <label className="sp-field">
          <span>{ar ? 'البريد الإلكتروني' : 'Email'}</span>
          <input
            type="email"
            required
            dir="ltr"
            name="staff-email"
            placeholder="name@school.edu.jo"
            value={accForm.email}
            onChange={(e) => setAccForm({ ...accForm, email: e.target.value })}
          />
        </label>
        <label className="sp-field">
          <span>{ar ? 'كلمة المرور (١٢ حرفاً فأكثر)' : 'Password (12+ chars)'}</span>
          <input
            type="password"
            required
            minLength={12}
            name="staff-pass"
            autoComplete="new-password"
            value={accForm.password}
            onChange={(e) => setAccForm({ ...accForm, password: e.target.value })}
          />
        </label>
      </div>
      {accForm.role === 'teacher' && (
        <div className="sp-row-2">
          <div className="sp-field">
            <span>{ar ? 'الشعبة الأساسية (مربي الصف)' : 'Homeroom Section'}</span>
            <GlassSelect
              ariaLabel={ar ? 'الشعبة' : 'Section'}
              value={accForm.section}
              options={data.classes.map((c) => ({ value: c.name, label: c.name }))}
              onChange={(val) => setAccForm({ ...accForm, section: val })}
            />
          </div>
          <div className="sp-field">
            <span>{ar ? 'التخصص / المادة' : 'Subject'}</span>
            <GlassSelect
              ariaLabel={ar ? 'المادة' : 'Subject'}
              value={accForm.subject}
              options={data.subjects.map((s) => ({ value: s.name, label: s.name }))}
              onChange={(val) => setAccForm({ ...accForm, subject: val })}
            />
          </div>
        </div>
      )}
      <button type="submit" className="sp-btn-primary" disabled={busy}>
        <Plus size={14} />
        <span>{ar ? 'تأكيد وإنشاء الحساب' : 'Create Account'}</span>
      </button>
    </form>
  );
}
