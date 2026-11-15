/**
 * Visual Canvas Board for Unified Student Enrollment & National-ID Auto-Provisioning:
 * adding a student with their National ID automatically creates their login
 * (`username = nationalId`, `password = <first5>@Alshereqi.Edu`).
 */
import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Phone, UserPlus, Users } from 'lucide-react';
import { StudentAvatar } from '../components/StudentAvatar';
import type { Language } from '../i18n';
import { WinExpander } from '../schoolsync-ui';
import type { State } from '../types';

function previewAutoPassword(nationalId: string): string {
  const digits = nationalId.replace(/\D/g, '');
  return digits.length >= 5 ? `${digits.slice(0, 5)}@Alshereqi.Edu` : '';
}

export function StudentsEnrollPanel({
  data,
  lang,
  busy,
  mutate,
}: {
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  const [pickedStudentId, setPickedStudentId] = useState('');
  const [newNationalId, setNewNationalId] = useState('');
  const [assignNationalId, setAssignNationalId] = useState('');

  const handleEnroll = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const nid = String(f.get('nationalId') || '').trim();
    const ok = await mutate(
      '/students',
      {
        name: String(f.get('name') || ''),
        section: String(f.get('section') || ''),
        guardianPhone: String(f.get('guardianPhone') || ''),
        ...(nid ? { nationalId: nid } : {}),
      },
      nid
        ? ar
          ? 'تم تسجيل الطالب وإنشاء حسابه بالرقم الوطني تلقائياً'
          : 'Student enrolled & account created'
        : ar
          ? 'تم تسجيل الطالب بنجاح (يمكن إضافة الرقم الوطني لاحقاً)'
          : 'Student enrolled cleanly',
    );
    if (ok) {
      form.reset();
      setNewNationalId('');
    }
  };

  const handleAssignId = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pickedStudentId) return;
    if (
      await mutate(
        `/students/${pickedStudentId}/national-id`,
        { nationalId: assignNationalId },
        ar ? 'تم حفظ الرقم الوطني وإنشاء حساب الطالب تلقائياً' : 'National ID saved & account created',
      )
    ) {
      setAssignNationalId('');
    }
  };

  const enrolledPreviewPw = previewAutoPassword(newNationalId);
  const assignPreviewPw = previewAutoPassword(assignNationalId);

  return (
    <div className="canvas-board-stack" data-reveal>
      {data.students.length > 0 && (
        <WinExpander
          title={ar ? 'سجل الطلاب وحالة الحساب بالرقم الوطني' : 'Enrolled Students & Account Status'}
          subtitle={ar ? 'اضغط على أي طالب لإضافة أو تحديث رقمه الوطني' : 'Click any student to assign their National ID'}
          badge={data.students.length}
          icon={<Users size={16} />}
          defaultOpen={false}
        >
          <div className="enrolled-mini-grid">
            {data.students.map((s) => {
              const active = Boolean(s.has_account || s.national_id);
              const selected = pickedStudentId === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  data-stagger
                  className={`enrolled-mini-card t-surface ${selected ? 'selected' : ''}`}
                  onClick={() => {
                    setPickedStudentId(s.id);
                    setAssignNationalId(s.national_id || '');
                  }}
                >
                  <StudentAvatar name={s.name} initialsText={s.initials} color={s.color} size="sm" />
                  <div className="enrolled-mini-copy">
                    <strong>{s.name}</strong>
                    <small>
                      {s.section}
                      {s.national_id ? ` · ${s.national_id}` : ''}
                    </small>
                  </div>
                  <span className={`family-status-tag ${active ? 'linked' : ''}`}>
                    {active ? (
                      <>
                        <CheckCircle2 size={12} /> {ar ? 'مفعّل' : 'Active'}
                      </>
                    ) : ar ? (
                      'بانتظار الرقم الوطني'
                    ) : (
                      'Needs ID'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </WinExpander>
      )}

      <div className="enroll-canvas-grid">
        <form className="surface-card form-stack canvas-step-card t-surface" data-stagger onSubmit={handleEnroll}>
          <div className="step-card-head">
            <span className="step-num-badge">١</span>
            <div>
              <h3>
                <UserPlus size={16} /> {ar ? 'تسجيل طالب وإنشاء حسابه تلقائياً' : 'Enroll Student & Auto-Create Login'}
              </h3>
              <small>
                {ar
                  ? 'أضف الرقم الوطني ليُنشأ الحساب فوراً (أو أضفه لاحقاً عند توفره)'
                  : 'Provide National ID to auto-create login, or leave blank for later'}
              </small>
            </div>
          </div>
          <label>
            {ar ? 'اسم الطالب الرباعي' : 'Student full name'}
            <input name="name" required placeholder={ar ? 'مثال: عمر عبد الله خليل' : 'Full name'} />
          </label>
          <div className="split-fields">
            <label>
              {ar ? 'الشعبة / الصف' : 'Class'}
              <input name="section" list="hub-classes-list" required placeholder={ar ? 'الصف الثامن - أ' : '8A'} />
              <datalist id="hub-classes-list">
                {data.classes.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <label>
              {ar ? 'هاتف ولي الأمر' : 'Guardian phone'}
              <input name="guardianPhone" type="tel" dir="ltr" placeholder="079XXXXXXX" />
            </label>
          </div>
          <label>
            {ar ? 'الرقم الوطني للطالب (اختياري الآن)' : 'Student National ID (optional now)'}
            <input
              name="nationalId"
              inputMode="numeric"
              minLength={5}
              maxLength={20}
              dir="ltr"
              value={newNationalId}
              onChange={(e) => setNewNationalId(e.target.value)}
              placeholder="200XXXXXXX"
            />
          </label>
          {enrolledPreviewPw && (
            <small className="auto-cred-preview" dir="ltr">
              {ar ? 'كلمة المرور التلقائية: ' : 'Auto password: '}
              <strong>{enrolledPreviewPw}</strong>
            </small>
          )}
          <button className="primary" disabled={busy}>
            <Phone size={14} />
            {ar ? 'تسجيل الطالب' : 'Enroll student'}
          </button>
        </form>

        <form className="surface-card form-stack canvas-step-card t-surface" data-stagger onSubmit={handleAssignId}>
          <div className="step-card-head">
            <span className="step-num-badge">٢</span>
            <div>
              <h3>
                <KeyRound size={16} /> {ar ? 'إضافة أو تحديث الرقم الوطني لطالب' : 'Assign Student National ID'}
              </h3>
              <small>
                {ar
                  ? 'يُنشئ اسم المستخدم بالرقم الوطني وكلمة المرور (أول ٥ أرقام + @Alshereqi.Edu)'
                  : 'Creates username = National ID and password = first 5 digits + @Alshereqi.Edu'}
              </small>
            </div>
          </div>
          <label>
            {ar ? 'الطالب' : 'Student'}
            <select
              name="studentId"
              required
              value={pickedStudentId}
              onChange={(e) => {
                const sid = e.target.value;
                setPickedStudentId(sid);
                const found = data.students.find((x) => x.id === sid);
                setAssignNationalId(found?.national_id || '');
              }}
            >
              <option value="" disabled>
                {ar ? 'اختر طالباً' : 'Select student'}
              </option>
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.section})
                </option>
              ))}
            </select>
          </label>
          <label>
            {ar ? 'الرقم الوطني للطالب' : 'Student National ID'}
            <input
              name="nationalId"
              inputMode="numeric"
              minLength={5}
              maxLength={20}
              required
              dir="ltr"
              value={assignNationalId}
              onChange={(e) => setAssignNationalId(e.target.value)}
              placeholder="200XXXXXXX"
            />
          </label>
          {assignPreviewPw && (
            <small className="auto-cred-preview" dir="ltr">
              {ar ? 'كلمة المرور التلقائية: ' : 'Auto password: '}
              <strong>{assignPreviewPw}</strong>
            </small>
          )}
          <button className="primary" disabled={busy || !pickedStudentId}>
            <KeyRound size={14} />
            {ar ? 'حفظ وإنشاء الحساب تلقائياً' : 'Save & auto-create login'}
          </button>
        </form>
      </div>
    </div>
  );
}
