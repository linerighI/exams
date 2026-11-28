/**
 * Principal Office -> Students Management tab: direct new-student enrollment
 * (with automatic family credential provisioning), section filtering, live attendance status,
 * profile launch, and 3D classroom fly-to.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Compass, Search, UserPlus, UserRound } from 'lucide-react';
import type { Language } from '../../i18n';
import type { ResolvedSpatialRoom } from '../../spatial/roomCatalog';
import type { State } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface PrincipalStudentsTabProps {
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  busy: boolean;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onOpenStudentProfile: (studentId: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

const ATT_LABEL_AR: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'بعذر',
};

/** Direct student enrollment & searchable school-wide student directory inside Principal Office. */
export function PrincipalStudentsTab({
  rooms,
  data,
  lang,
  busy,
  onFlyToRoom,
  onOpenStudentProfile,
  mutate,
}: PrincipalStudentsTabProps) {
  const ar = lang === 'ar';
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [form, setForm] = useState({
    name: '',
    section: data.classes[0]?.name || '',
    guardianPhone: '',
    nationalId: '',
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter((s) => !sectionFilter || s.section === sectionFilter)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q) ||
          (s.national_id && s.national_id.includes(q)),
      )
      .slice(0, 80);
  }, [data.students, query, sectionFilter]);

  const handleEnroll = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/students',
      {
        name: form.name.trim(),
        section: form.section || data.classes[0]?.name || '',
        guardianPhone: form.guardianPhone.trim(),
        nationalId: form.nationalId.trim(),
      },
      ar ? 'تم تسجيل الطالب وتجهيز بياناته بنجاح' : 'Student enrolled',
    );
    if (ok) {
      setForm({ ...form, name: '', guardianPhone: '', nationalId: '' });
      setShowEnroll(false);
    }
  };

  return (
    <div className="sp-tab-pane">
      <div className="sp-toolbar-row">
        <div className="sp-search-mini">
          <Search size={14} />
          <input
            placeholder={ar ? 'ابحث باسم الطالب أو الرقم الوطني…' : 'Search student name or ID…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ minWidth: 145 }}>
          <GlassSelect
            ariaLabel={ar ? 'تصفية حسب الشعبة' : 'Filter by class'}
            value={sectionFilter}
            options={[
              { value: '', label: ar ? 'كل الشعب' : 'All Classes' },
              ...data.classes.map((c) => ({ value: c.name, label: c.name })),
            ]}
            onChange={setSectionFilter}
          />
        </div>
        <button type="button" className="sp-btn-primary" onClick={() => setShowEnroll((v) => !v)}>
          <UserPlus size={14} />
          <span>{showEnroll ? (ar ? 'إغلاق' : 'Close') : (ar ? 'طالب جديد' : 'Enroll Student')}</span>
        </button>
      </div>

      {showEnroll && (
        <form className="sp-inline-box" onSubmit={(e) => void handleEnroll(e)}>
          <div className="sp-po-card-head">
            <strong>{ar ? 'تسجيل طالب جديد في المدرسة' : 'Enroll New Student'}</strong>
          </div>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{ar ? 'اسم الطالب الرباعي' : 'Student Full Name'}</span>
              <input
                required
                placeholder={ar ? 'مثال: ريان محمد العلي' : 'Full name'}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="sp-field">
              <span>{ar ? 'الشعبة الدراسية' : 'Class Section'}</span>
              <GlassSelect
                ariaLabel={ar ? 'الشعبة الدراسية' : 'Section'}
                value={form.section}
                options={data.classes.map((c) => ({ value: c.name, label: c.name }))}
                onChange={(val) => setForm({ ...form, section: val })}
              />
            </div>
          </div>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{ar ? 'هاتف ولي الأمر (اختياري)' : 'Guardian Phone'}</span>
              <input
                dir="ltr"
                placeholder="0790000000"
                value={form.guardianPhone}
                onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
              />
            </label>
            <label className="sp-field">
              <span>{ar ? 'الرقم الوطني (١٠ أرقام · ينشئ حساب دخول)' : 'National ID (auto-account)'}</span>
              <input
                dir="ltr"
                placeholder="2000000001"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </label>
          </div>
          <p className="sp-po-hint">
            {ar
              ? 'إدخال الرقم الوطني يُنشئ تلقائياً حساب دخول للطالب من بوابة الأهل والطلبة.'
              : 'Providing a National ID automatically creates a Family/Student portal login.'}
          </p>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <UserPlus size={14} />
            <span>{ar ? 'تثبيت تسجيل الطالب' : 'Confirm Enrollment'}</span>
          </button>
        </form>
      )}

      <div className="sp-list-stack">
        {filtered.length === 0 ? (
          <p className="sp-empty-note">{ar ? 'لا يوجد طلبة مطابقون للتصفية' : 'No matching students'}</p>
        ) : (
          filtered.map((st) => {
            const clsRoom = rooms.find((r) => r.className === st.section);
            return (
              <div key={st.id} className="sp-info-row">
                <button type="button" className="sp-student-name-btn" onClick={() => onOpenStudentProfile(st.id)}>
                  <span className="sp-mini-avatar">{st.initials || <UserRound size={13} />}</span>
                  <div>
                    <strong>{st.name}</strong>
                    <small>
                      {st.section}
                      {st.national_id ? ` · ${st.national_id}` : ''}
                    </small>
                  </div>
                </button>
                <div className="sp-row-actions">
                  {st.today_status && (
                    <span className={`sp-status-tag is-${st.today_status}`}>
                      {ar ? ATT_LABEL_AR[st.today_status] || st.today_status : st.today_status}
                    </span>
                  )}
                  {clsRoom && (
                    <button
                      type="button"
                      className="sp-icon-btn"
                      title={ar ? 'انتقال إلى الصف' : 'Fly to classroom'}
                      onClick={() => onFlyToRoom(clsRoom)}
                    >
                      <Compass size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
