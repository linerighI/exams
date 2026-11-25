/**
 * Principal's Office floating command window: school & Jordanian bell schedule settings,
 * class creation & 3D room slot labeling overview, subjects, and staff accounts.
 */
import { useState, type FormEvent } from 'react';
import { Check, Compass, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import type { Role, State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface PrincipalOfficeWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Principal command window for school hours, 3D room mapping, subjects, and accounts. */
export function PrincipalOfficeWindow({
  room,
  rooms,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  onEditRoom,
  mutate,
}: PrincipalOfficeWindowProps) {
  const [tab, setTab] = useState<'school' | 'rooms' | 'accounts'>('rooms');

  const [schoolForm, setSchoolForm] = useState({
    name: data.school.name,
    timezone: data.school.timezone,
    start: data.school.start_time,
    end: data.school.end_time,
    periodMinutes: Number(data.school.period_minutes || 45),
    breakMinutes: Number(data.school.break_minutes || 5),
    periodCount: Number(data.school.period_count || 7),
  });

  const [newClass, setNewClass] = useState({ name: '', gradeLevel: '' });
  const [newSub, setNewSub] = useState('');
  const [accForm, setAccForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher' as Role,
    section: data.classes[0]?.name || '',
  });

  const saveSchool = async (e: FormEvent) => {
    e.preventDefault();
    await mutate('/school', schoolForm, 'Saved successfully');
  };

  const addClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClass.name.trim()) return;
    const ok = await mutate(
      '/classes',
      { name: newClass.name.trim(), gradeLevel: newClass.gradeLevel.trim(), room: newClass.name.trim() },
      lang === 'ar' ? 'تمت إضافة الشعبة' : 'Class created',
    );
    if (ok) setNewClass({ name: '', gradeLevel: '' });
  };

  const addSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSub.trim()) return;
    const ok = await mutate('/subjects', { name: newSub.trim(), color: 'blue' }, 'Saved successfully');
    if (ok) setNewSub('');
  };

  const addAccount = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/accounts',
      {
        name: accForm.name,
        email: accForm.email,
        password: accForm.password,
        role: accForm.role,
        sections: accForm.role === 'teacher' && accForm.section ? [accForm.section] : undefined,
      },
      lang === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account created',
    );
    if (ok) setAccForm({ ...accForm, name: '', email: '', password: '' });
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'إدارة المدرسة والمبنى التفاعلي' : 'School & Spatial Management'}
      dock="right"
      width={470}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-segmented">
        <button type="button" className={tab === 'rooms' ? 'is-active' : ''} onClick={() => setTab('rooms')}>
          {lang === 'ar' ? 'الغرف والشعب' : 'Rooms & Classes'}
        </button>
        <button type="button" className={tab === 'school' ? 'is-active' : ''} onClick={() => setTab('school')}>
          {lang === 'ar' ? 'الدوام والجرس' : 'Bell & Hours'}
        </button>
        <button type="button" className={tab === 'accounts' ? 'is-active' : ''} onClick={() => setTab('accounts')}>
          {lang === 'ar' ? 'المواد والحسابات' : 'Subjects & Staff'}
        </button>
      </div>

      {tab === 'rooms' && (
        <div className="sp-tab-pane">
          <form className="sp-inline-box" onSubmit={(e) => void addClass(e)}>
            <div className="sp-row-2">
              <input
                required
                placeholder={lang === 'ar' ? 'اسم الشعبة الجديدة (مثل: العاشر هـ)' : 'New class name'}
                value={newClass.name}
                onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              />
              <input
                placeholder={lang === 'ar' ? 'المرحلة (الصف العاشر)' : 'Grade level'}
                value={newClass.gradeLevel}
                onChange={(e) => setNewClass({ ...newClass, gradeLevel: e.target.value })}
              />
            </div>
            <button type="submit" className="sp-btn-primary" disabled={busy}>
              <Plus size={14} />
              <span>{lang === 'ar' ? 'إضافة شعبة' : 'Add Class'}</span>
            </button>
          </form>

          <h4 className="sp-subhead">{lang === 'ar' ? 'مسميات الغرف على المجسم (٢٥ موقعاً)' : '3D Spatial Rooms (25)'}</h4>
          <div className="sp-list-stack">
            {rooms.map((r) => (
              <div key={r.slotId} className="sp-info-row">
                <div>
                  <strong>{r.label}</strong>
                  <small>
                    {r.slotId} · {r.className || (lang === 'ar' ? `طابق ${r.floor}` : `Floor ${r.floor}`)}
                  </small>
                </div>
                <div className="sp-row-actions">
                  <button type="button" className="sp-icon-btn" onClick={() => onFlyToRoom(r)} title={lang === 'ar' ? 'انتقال' : 'Fly'}>
                    <Compass size={14} />
                  </button>
                  <button type="button" className="sp-icon-btn" onClick={() => onEditRoom(r)} title={lang === 'ar' ? 'تسمية' : 'Label'}>
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h4 className="sp-subhead">{lang === 'ar' ? 'الشعب المسجلة' : 'Registered Classes'}</h4>
          <div className="sp-list-stack">
            {data.classes.map((c) => (
              <div key={c.id} className="sp-info-row">
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.grade_level || c.room}</small>
                </div>
                <button
                  type="button"
                  className="sp-icon-btn is-danger"
                  onClick={() => void mutate(`/classes/${c.id}/delete`, {}, lang === 'ar' ? 'تم حذف الشعبة' : 'Deleted')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'school' && (
        <form className="sp-form" onSubmit={(e) => void saveSchool(e)}>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'اسم المدرسة' : 'School Name'}</span>
            <input required value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} />
          </label>
          <div className="sp-row-2">
            <label className="sp-field">
              <span>{lang === 'ar' ? 'بداية الدوام' : 'Start'}</span>
              <input type="time" required value={schoolForm.start} onChange={(e) => setSchoolForm({ ...schoolForm, start: e.target.value })} />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'نهاية الدوام' : 'End'}</span>
              <input type="time" required value={schoolForm.end} onChange={(e) => setSchoolForm({ ...schoolForm, end: e.target.value })} />
            </label>
          </div>
          <div className="sp-row-3">
            <label className="sp-field">
              <span>{lang === 'ar' ? 'مدة الحصة (د)' : 'Period (m)'}</span>
              <input type="number" min={20} max={90} value={schoolForm.periodMinutes} onChange={(e) => setSchoolForm({ ...schoolForm, periodMinutes: Number(e.target.value) })} />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'الاستراحة (د)' : 'Break (m)'}</span>
              <input type="number" min={0} max={30} value={schoolForm.breakMinutes} onChange={(e) => setSchoolForm({ ...schoolForm, breakMinutes: Number(e.target.value) })} />
            </label>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'عدد الحصص' : 'Periods'}</span>
              <input type="number" min={1} max={10} value={schoolForm.periodCount} onChange={(e) => setSchoolForm({ ...schoolForm, periodCount: Number(e.target.value) })} />
            </label>
          </div>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <Check size={15} />
            <span>{lang === 'ar' ? 'حفظ إعدادات المدرسة' : 'Save School Settings'}</span>
          </button>
        </form>
      )}

      {tab === 'accounts' && (
        <div className="sp-tab-pane">
          <h4 className="sp-subhead">{lang === 'ar' ? 'إضافة مادة دراسية' : 'Add Subject'}</h4>
          <form className="sp-inline-box" onSubmit={(e) => void addSubject(e)}>
            <div className="sp-row-actions">
              <input
                required
                placeholder={lang === 'ar' ? 'اسم المادة الجديدة…' : 'New subject name…'}
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
              />
              <button type="submit" className="sp-btn-soft" disabled={busy}>
                <Plus size={14} />
                <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
              </button>
            </div>
          </form>

          <h4 className="sp-subhead">{lang === 'ar' ? 'إنشاء حساب معلم أو إدارة' : 'Create Staff Account'}</h4>
          <form className="sp-inline-box" autoComplete="off" onSubmit={(e) => void addAccount(e)}>
            <div className="sp-row-2">
              <input required name="staff-full-name" autoComplete="off" placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Full name'} value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
              <select value={accForm.role} onChange={(e) => setAccForm({ ...accForm, role: e.target.value as Role })}>
                <option value="teacher">{lang === 'ar' ? 'معلم' : 'Teacher'}</option>
                <option value="assistant">{lang === 'ar' ? 'مساعد المدير' : 'Assistant'}</option>
                <option value="admin">{lang === 'ar' ? 'مدير' : 'Admin'}</option>
                <option value="parent">{lang === 'ar' ? 'ولي أمر' : 'Parent'}</option>
              </select>
            </div>
            <div className="sp-row-2">
              <input type="email" required name="staff-new-email" autoComplete="off" placeholder="name@school.edu" value={accForm.email} onChange={(e) => setAccForm({ ...accForm, email: e.target.value })} />
              <input type="password" required minLength={12} name="staff-new-password" autoComplete="new-password" placeholder={lang === 'ar' ? 'كلمة مرور (١٢+)' : 'Password (12+)'} value={accForm.password} onChange={(e) => setAccForm({ ...accForm, password: e.target.value })} />
            </div>
            {accForm.role === 'teacher' && (
              <select value={accForm.section} onChange={(e) => setAccForm({ ...accForm, section: e.target.value })}>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
            <button type="submit" className="sp-btn-primary" disabled={busy}>
              <Plus size={14} />
              <span>{lang === 'ar' ? 'إنشاء الحساب' : 'Create Account'}</span>
            </button>
          </form>
        </div>
      )}
    </FloatingWindow>
  );
}
