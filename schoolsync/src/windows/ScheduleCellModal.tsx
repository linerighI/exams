/**
 * Apple-style Cell Editor Modal for the Master Schedule: assign subject & teacher
 * (with conflict barrier), cancel/restore lesson, clear slot, or initiate swap.
 */
import { useState } from 'react';
import { ArrowRightLeft, Ban, RotateCcw, Trash2, UserX, X } from 'lucide-react';
import type { Language } from '../i18n';
import type { SubjectItem } from '../types';
import type { ScheduleLessonItem, ScheduleTeacherItem } from './scheduleTypes';

interface ScheduleCellModalProps {
  section: string;
  weekday: number;
  periodNumber: number;
  lesson?: ScheduleLessonItem;
  subjects: SubjectItem[];
  teachers: ScheduleTeacherItem[];
  lang: Language;
  busy: boolean;
  onClose: () => void;
  onSaveCell: (payload: Record<string, unknown>, msg: string) => Promise<void>;
  onStartSwap: () => void;
  onToggleAbsent: (teacherId: string, isAbsent: boolean) => Promise<void>;
}

const COLORS: ('blue' | 'peach' | 'mint' | 'lilac' | 'pink' | 'yellow')[] = ['blue', 'mint', 'peach', 'lilac', 'pink', 'yellow'];

/** Modal for editing, canceling, clearing, or swapping a single Master Schedule cell. */
export function ScheduleCellModal({
  section, weekday, periodNumber, lesson, subjects, teachers, lang, busy,
  onClose, onSaveCell, onStartSwap, onToggleAbsent,
}: ScheduleCellModalProps) {
  const [subject, setSubject] = useState(lesson?.subject || subjects[0]?.name || 'الرياضيات');
  const [teacherId, setTeacherId] = useState(lesson?.teacher_id || teachers[0]?.id || '');
  const [color, setColor] = useState<'blue' | 'peach' | 'mint' | 'lilac' | 'pink' | 'yellow'>(
    (lesson?.color as typeof COLORS[number]) || 'blue',
  );

  return (
    <div className="sp-ms-modal-backdrop" onClick={onClose}>
      <div className="sp-ms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-ms-modal-head">
          <div>
            <strong>{lang === 'ar' ? 'تعديل الحصة' : 'Edit Period'}</strong>
            <small>{section} · {lang === 'ar' ? `الحصة ${periodNumber}` : `Period ${periodNumber}`}</small>
          </div>
          <button type="button" className="sp-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {lesson && (
          <div className="sp-row-actions">
            <button
              type="button"
              className="sp-btn-soft"
              disabled={busy}
              onClick={() => void onSaveCell(
                { section, weekday, periodNumber, action: lesson.status === 'canceled' ? 'restore' : 'cancel' },
                lesson.status === 'canceled' ? (lang === 'ar' ? 'تمت استعادة الحصة' : 'Lesson restored') : (lang === 'ar' ? 'تم إلغاء الحصة' : 'Lesson canceled'),
              )}
            >
              {lesson.status === 'canceled' ? <RotateCcw size={13} /> : <Ban size={13} />}
              <span>{lesson.status === 'canceled' ? (lang === 'ar' ? 'استعادة' : 'Restore') : (lang === 'ar' ? 'إلغاء الحصة' : 'Cancel')}</span>
            </button>
            <button type="button" className="sp-btn-soft" onClick={onStartSwap}>
              <ArrowRightLeft size={13} />
              <span>{lang === 'ar' ? 'تبديل' : 'Swap'}</span>
            </button>
            <button
              type="button"
              className="sp-icon-btn is-danger"
              disabled={busy}
              onClick={() => void onSaveCell({ section, weekday, periodNumber, action: 'clear' }, lang === 'ar' ? 'تم مسح الحصة' : 'Slot cleared')}
              title={lang === 'ar' ? 'مسح' : 'Clear'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <label className="sp-field">
          <span>{lang === 'ar' ? 'المادة' : 'Subject'}</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} list="sp-ms-subjs" />
          <datalist id="sp-ms-subjs">
            {subjects.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
        </label>

        <div className="sp-color-row">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`sp-ms-cswatch is-${c} ${color === c ? 'is-active' : ''}`} onClick={() => setColor(c)} />
          ))}
        </div>

        <div className="sp-ms-teacher-pick">
          {teachers.map((t) => (
            <div
              key={t.id}
              className={`sp-ms-tpick-row ${teacherId === t.id ? 'is-active' : ''} ${t.is_absent ? 'is-absent' : ''}`}
              onClick={() => setTeacherId(t.id)}
            >
              <div>
                <strong>{t.name}</strong>
                <small>{t.is_absent ? (lang === 'ar' ? 'غائب اليوم' : 'Absent') : t.section || (lang === 'ar' ? 'معلم' : 'Teacher')}</small>
              </div>
              <button
                type="button"
                className="sp-icon-btn"
                title={lang === 'ar' ? 'تبديل حالة الغياب' : 'Toggle Absence'}
                onClick={(e) => { e.stopPropagation(); void onToggleAbsent(t.id, !t.is_absent); }}
              >
                <UserX size={13} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="sp-btn-primary"
          disabled={busy || !subject.trim() || !teacherId}
          onClick={() => void onSaveCell(
            { section, weekday, periodNumber, action: 'upsert', subject: subject.trim(), teacherId, color },
            lang === 'ar' ? 'تم حفظ الحصة' : 'Lesson saved',
          )}
        >
          {lang === 'ar' ? 'حفظ الحصة' : 'Save Slot'}
        </button>
      </div>
    </div>
  );
}
