/**
 * Reception & Student Affairs floating window: enroll new students, browse the full
 * 368-student school directory (clicking opens profile or flies to room), and manage guardians.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Compass, Search, UserPlus, UserRound } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { isManagerRole, type State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface ReceptionWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onOpenStudentProfile: (studentId: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Student enrollment & school-wide directory floating window. */
export function ReceptionWindow({
  room,
  rooms,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  onOpenStudentProfile,
  mutate,
}: ReceptionWindowProps) {
  const manager = isManagerRole(data.user.role);
  const [tab, setTab] = useState<'directory' | 'enroll'>('directory');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    section: data.classes[0]?.name || '',
    guardianPhone: '',
    nationalId: '',
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q) ||
          (s.national_id && s.national_id.includes(q)),
      )
      .slice(0, 60);
  }, [data.students, query]);

  const handleEnroll = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate('/students', form, lang === 'ar' ? 'تم تسجيل الطالب بنجاح' : 'Student enrolled');
    if (ok) {
      setForm({ name: '', section: form.section, guardianPhone: '', nationalId: '' });
      setTab('directory');
    }
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={`${data.students.length} ${lang === 'ar' ? 'طالب مسجل في المدرسة' : 'enrolled students'}`}
      dock="right"
      width={460}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      {manager && (
        <div className="sp-segmented">
          <button type="button" className={tab === 'directory' ? 'is-active' : ''} onClick={() => setTab('directory')}>
            {lang === 'ar' ? 'دليل الطلبة' : 'Directory'}
          </button>
          <button type="button" className={tab === 'enroll' ? 'is-active' : ''} onClick={() => setTab('enroll')}>
            <UserPlus size={13} />
            <span>{lang === 'ar' ? 'تسجيل طالب جديد' : 'Enroll Student'}</span>
          </button>
        </div>
      )}

      {tab === 'directory' && (
        <div className="sp-tab-pane">
          <div className="sp-search-mini">
            <Search size={14} />
            <input
              placeholder={lang === 'ar' ? 'ابحث بالاسم أو الشعبة أو الرقم الوطني…' : 'Search by name, class, ID…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="sp-list-stack">
            {filtered.map((st) => {
              const clsRoom = rooms.find((r) => r.className === st.section);
              return (
                <div key={st.id} className="sp-info-row">
                  <button
                    type="button"
                    className="sp-student-name-btn"
                    onClick={() => onOpenStudentProfile(st.id)}
                  >
                    <span className="sp-mini-avatar">
                      {st.initials || <UserRound size={13} />}
                    </span>
                    <div>
                      <strong>{st.name}</strong>
                      <small>{st.section}</small>
                    </div>
                  </button>
                  {clsRoom && (
                    <button
                      type="button"
                      className="sp-icon-btn"
                      title={lang === 'ar' ? 'انتقال إلى الصف' : 'Fly to classroom'}
                      onClick={() => onFlyToRoom(clsRoom)}
                    >
                      <Compass size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {manager && tab === 'enroll' && (
        <form className="sp-form" onSubmit={(e) => void handleEnroll(e)}>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'اسم الطالب الرباعي' : 'Student Full Name'}</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'الشعبة الدراسية' : 'Section'}</span>
            <select required value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              {data.classes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{lang === 'ar' ? 'هاتف ولي الأمر' : 'Guardian Phone'}</span>
              <input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'الرقم الوطني (ينشئ حساباً تلقائياً)' : 'National ID (auto-account)'}</span>
              <input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <UserPlus size={15} />
            <span>{lang === 'ar' ? 'تثبيت تسجيل الطالب' : 'Enroll Student'}</span>
          </button>
        </form>
      )}
    </FloatingWindow>
  );
}
