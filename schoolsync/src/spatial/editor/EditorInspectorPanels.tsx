/**
 * Focused inspector sub-sections for 3D Props, Spatial Assignments, Wings & Room Beacons,
 * keeping EditorInspectorWindow modular and strictly under 300 lines.
 */
import { useState, type FormEvent } from 'react';
import { Plus, RotateCw, Trash2 } from 'lucide-react';
import type { Language } from '../../i18n';
import { GlassSelect } from '../../windows/GlassSelect';
import type {
  CampusBeacon,
  CampusLayout,
  CampusProp,
  RoomKind,
  SpatialAssignment3D,
  State,
} from '../../types';

export const EDITOR_ROOM_KINDS: { value: RoomKind; ar: string; en: string }[] = [
  { value: 'classroom', ar: 'صف دراسي', en: 'Classroom' },
  { value: 'principal', ar: 'مكتب المدير', en: 'Principal Office' },
  { value: 'teachers', ar: 'غرفة المعلمين', en: 'Teachers Room' },
  { value: 'reception', ar: 'الاستقبال وشؤون الطلبة', en: 'Reception' },
  { value: 'counselor', ar: 'مكتب المساعد والمرشد', en: 'Counselor / Assistant' },
  { value: 'auditorium', ar: 'المسرح والأنشطة', en: 'Auditorium' },
  { value: 'library', ar: 'المكتبة والأرشيف', en: 'Library & Vault' },
  { value: 'lab', ar: 'مختبر الحاسوب', en: 'Computer Lab' },
  { value: 'courtyard', ar: 'الساحة المدرسية', en: 'Courtyard' },
  { value: 'corridor', ar: 'ممر', en: 'Corridor' },
  { value: 'custom', ar: 'مساحة مخصصة', en: 'Custom Zone' },
];

const PROP_SWATCHES = ['#f1f5f9', '#e4d4bf', '#007aff', '#34c759', '#ff9500', '#64748b'];

export function PropInspectorSection({
  prop,
  lang,
  onUpdateProp,
  onDelete,
}: {
  prop: CampusProp;
  lang: Language;
  onUpdateProp: (id: string, patch: Partial<CampusProp>) => void;
  onDelete: () => void;
}) {
  const sx = prop.scaleX ?? prop.scale;
  const sy = prop.scaleY ?? prop.scale;
  const sz = prop.scaleZ ?? prop.scale;

  return (
    <div className="sp-form">
      <div className="sp-ed-card">
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{lang === 'ar' ? 'الدوران' : 'Rotation'}</span>
            <button
              type="button"
              className="sp-btn-soft"
              onClick={() => onUpdateProp(prop.id, { rotationY: (prop.rotationY + Math.PI / 4) % (Math.PI * 2) })}
            >
              <RotateCw size={14} />
              <span>+45°</span>
            </button>
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'الحجم العام' : 'Uniform'}</span>
            <input
              type="number"
              step={0.1}
              min={0.2}
              max={10}
              value={prop.scale}
              onChange={(e) => {
                const v = Math.max(0.2, Math.min(10, Number(e.target.value) || 1));
                onUpdateProp(prop.id, { scale: v, scaleX: v, scaleY: v, scaleZ: v });
              }}
            />
          </label>
        </div>
        <div className="sp-row-3">
          {([['X', sx, 'scaleX'], ['Y', sy, 'scaleY'], ['Z', sz, 'scaleZ']] as const).map(([lbl, val, key]) => (
            <label key={key} className="sp-field">
              <span>{lbl}</span>
              <input
                type="number"
                step={0.1}
                min={0.2}
                max={20}
                value={val}
                onChange={(e) => onUpdateProp(prop.id, { [key]: Math.max(0.2, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="sp-ed-card">
        <span className="sp-field-lbl">{lang === 'ar' ? 'لون العنصر' : 'Color Tint'}</span>
        <div className="sp-color-row">
          {PROP_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`sp-color-dot ${prop.colorTint === hex ? 'is-active' : ''}`}
              style={{ background: hex }}
              onClick={() => onUpdateProp(prop.id, { colorTint: hex })}
            />
          ))}
          <input
            type="color"
            className="sp-color-picker"
            value={prop.colorTint || '#f1f5f9'}
            onChange={(e) => onUpdateProp(prop.id, { colorTint: e.target.value })}
          />
        </div>
      </div>

      <button type="button" className="sp-btn-ghost" onClick={onDelete}>
        <Trash2 size={14} />
        <span>{lang === 'ar' ? 'حذف العنصر' : 'Remove Prop'}</span>
      </button>
    </div>
  );
}

export function AssignmentInspectorSection({
  roomId,
  assignment,
  data,
  lang,
  onUpdateAssignment,
  onDelete,
}: {
  roomId: string;
  assignment: SpatialAssignment3D;
  data: State;
  lang: Language;
  onUpdateAssignment: (roomId: string, id: string, patch: Partial<SpatialAssignment3D>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="sp-form">
      <label className="sp-field">
        <span>{lang === 'ar' ? 'عنوان المهمة 3D' : '3D Assignment Title'}</span>
        <input
          value={assignment.title}
          onChange={(e) => onUpdateAssignment(roomId, assignment.id, { title: e.target.value })}
        />
      </label>
      <div className="sp-row-2">
        <div className="sp-field">
          <span>{lang === 'ar' ? 'النوع' : 'Type'}</span>
          <GlassSelect
            ariaLabel={lang === 'ar' ? 'نوع المهمة' : 'Assignment Type'}
            value={assignment.type}
            options={[
              { value: 'duty', label: lang === 'ar' ? 'مناوبة' : 'Duty' },
              { value: 'exam', label: lang === 'ar' ? 'قاعة امتحان' : 'Exam Zone' },
              { value: 'homework_zone', label: lang === 'ar' ? 'نشاط / واجب' : 'Activity' },
              { value: 'event', label: lang === 'ar' ? 'فعالية' : 'Event' },
            ]}
            onChange={(val) =>
              onUpdateAssignment(roomId, assignment.id, { type: val as SpatialAssignment3D['type'] })
            }
          />
        </div>
        <div className="sp-field">
          <span>{lang === 'ar' ? 'المكلّف' : 'Assignee'}</span>
          <GlassSelect
            ariaLabel={lang === 'ar' ? 'المكلّف' : 'Assignee'}
            value={assignment.assigneeId}
            options={[
              { value: '', label: lang === 'ar' ? 'عام' : 'General' },
              ...data.teachers.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={(val) => onUpdateAssignment(roomId, assignment.id, { assigneeId: val })}
          />
        </div>
      </div>
      <button type="button" className="sp-btn-ghost" onClick={onDelete}>
        <Trash2 size={14} />
        <span>{lang === 'ar' ? 'حذف المهمة' : 'Delete Pin'}</span>
      </button>
    </div>
  );
}

export function WingsBeaconSection({
  draft,
  activeWingId,
  beacons,
  lang,
  onSelectWing,
  onAddWing,
  onDeleteBeacon,
}: {
  draft: CampusLayout;
  activeWingId: string;
  beacons: CampusBeacon[];
  lang: Language;
  onSelectWing: (id: string) => void;
  onAddWing: (name: string) => void;
  onDeleteBeacon: (id: string) => void;
}) {
  const [newWingName, setNewWingName] = useState('');
  const handleAddWing = (e: FormEvent) => {
    e.preventDefault();
    if (!newWingName.trim()) return;
    onAddWing(newWingName.trim());
    setNewWingName('');
  };

  return (
    <div className="sp-form">
      <div className="sp-chip-picker">
        <span>{lang === 'ar' ? 'الأجنحة (للرسم وتخصيص المعلمين)' : 'Campus Wings'}</span>
        <div className="sp-chip-grid">
          {draft.wings.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`sp-toggle-chip ${activeWingId === w.id ? 'is-active' : ''}`}
              onClick={() => onSelectWing(w.id)}
            >
              {lang === 'ar' ? w.labelAr : w.labelEn}
            </button>
          ))}
        </div>
      </div>
      <form className="sp-row-actions" onSubmit={handleAddWing}>
        <input
          placeholder={lang === 'ar' ? 'إضافة جناح جديد…' : 'New wing name…'}
          value={newWingName}
          onChange={(e) => setNewWingName(e.target.value)}
        />
        <button type="submit" className="sp-btn-soft">
          <Plus size={14} />
        </button>
      </form>
      {beacons.length > 0 && (
        <>
          <h4 className="sp-subhead">{lang === 'ar' ? 'الإشارات المعايرة' : 'Room Beacons'}</h4>
          <div className="sp-list-stack">
            {beacons.map((b) => (
              <div key={b.id} className="sp-info-row">
                <div>
                  <strong>
                    {b.beacon_type.toUpperCase()} · {b.room_id}
                  </strong>
                  <small>{b.identifier}</small>
                </div>
                <button type="button" className="sp-icon-btn is-danger" onClick={() => onDeleteBeacon(b.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
