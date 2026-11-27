/**
 * Staff Attendance & Saved Schedule Profiles popovers for the Master Schedule header.
 */
import { useState } from 'react';
import { Plus, Trash2, UserCheck, UserX, X } from 'lucide-react';
import type { Language } from '../i18n';
import type { ScheduleProfileItem, ScheduleTeacherItem } from './scheduleTypes';

export function StaffAbsenceModal({
  teachers, lang, onClose, onToggle,
}: {
  teachers: ScheduleTeacherItem[];
  lang: Language;
  onClose: () => void;
  onToggle: (teacherId: string, isAbsent: boolean) => Promise<void>;
}) {
  return (
    <div className="sp-ms-modal-backdrop" onClick={onClose}>
      <div className="sp-ms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-ms-modal-head">
          <strong>{lang === 'ar' ? 'حضور وغياب المعلمين اليوم' : 'Daily Teacher Attendance'}</strong>
          <button type="button" className="sp-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="sp-ms-teacher-pick">
          {teachers.map((t) => (
            <div key={t.id} className={`sp-ms-tpick-row ${t.is_absent ? 'is-absent' : ''}`} onClick={() => void onToggle(t.id, !t.is_absent)}>
              <div>
                <strong>{t.name}</strong>
                <small>{t.is_absent ? (lang === 'ar' ? 'غائب' : 'Absent') : (lang === 'ar' ? 'حاضر على رأس عمله' : 'Present')}</small>
              </div>
              {t.is_absent ? <UserX size={15} /> : <UserCheck size={15} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScheduleProfilesModal({
  profiles, lang, busy, onClose, onSave, onLoad, onDelete,
}: {
  profiles: ScheduleProfileItem[];
  lang: Language;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  onLoad: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  return (
    <div className="sp-ms-modal-backdrop" onClick={onClose}>
      <div className="sp-ms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-ms-modal-head">
          <strong>{lang === 'ar' ? 'ملفات الجدول المحفوظة' : 'Saved Schedule Profiles'}</strong>
          <button type="button" className="sp-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="sp-row-actions">
          <input
            placeholder={lang === 'ar' ? 'اسم النسخة (مثلاً: الجدول الصيفي)…' : 'Profile name…'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="sp-btn-primary"
            disabled={busy || !name.trim()}
            onClick={() => { const n = name.trim(); setName(''); void onSave(n); }}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="sp-ms-teacher-pick">
          {profiles.length === 0 ? (
            <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد نسخ محفوظة بعد' : 'No saved profiles yet'}</p>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="sp-ms-tpick-row">
                <div className="sp-ms-prof-link" onClick={() => void onLoad(p.id)}>
                  <strong>{p.name}</strong>
                  <small>{new Date(p.created_at).toLocaleDateString()}</small>
                </div>
                <button type="button" className="sp-icon-btn is-danger" onClick={() => void onDelete(p.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
