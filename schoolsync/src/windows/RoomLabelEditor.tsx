/**
 * Principal floating room-label editor allowing instant renaming, room-type assignment,
 * and class linking for any of the 25 3D architectural spaces.
 */
import { useState, type FormEvent } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { serializeLayoutToSar } from '../spatial/sar/sarSerializer';
import type { CampusLayout, RoomKind, State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { GlassSelect } from './GlassSelect';

interface RoomLabelEditorProps {
  room: ResolvedSpatialRoom;
  layout: CampusLayout;
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

const KIND_OPTIONS: { value: RoomKind; ar: string; en: string }[] = [
  { value: 'classroom', ar: 'صف دراسي', en: 'Classroom' },
  { value: 'principal', ar: 'مكتب المدير', en: 'Principal Office' },
  { value: 'teachers', ar: 'غرفة المعلمين', en: 'Teachers Room' },
  { value: 'reception', ar: 'الاستقبال وشؤون الطلبة', en: 'Reception' },
  { value: 'counselor', ar: 'مكتب المساعد والمرشد', en: 'Counselor / Assistant' },
  { value: 'auditorium', ar: 'المسرح والأنشطة', en: 'Auditorium' },
  { value: 'library', ar: 'المكتبة والأرشيف', en: 'Library & Vault' },
  { value: 'lab', ar: 'مختبر الحاسوب', en: 'Computer Lab' },
  { value: 'courtyard', ar: 'الساحة المدرسية', en: 'Courtyard' },
  { value: 'custom', ar: 'غرفة مخصصة', en: 'Custom Room' },
];

/** Floating inline editor for Principal room labeling and class-slot mapping. */
export function RoomLabelEditor({
  room,
  layout,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  mutate,
}: RoomLabelEditorProps) {
  const [label, setLabel] = useState(room.label);
  const [kind, setKind] = useState<RoomKind>(room.kind);
  const [className, setClassName] = useState(room.className);

  const wingObj = layout.wings.find((w) => w.id === room.wing);
  const wingLabel = wingObj ? (lang === 'ar' ? wingObj.labelAr : wingObj.labelEn) : room.wing;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleanClass = kind === 'classroom' ? className : '';
    const finalLabel = label.trim() || cleanClass || room.label;
    const nextLayout: CampusLayout = {
      ...layout,
      rooms: layout.rooms.map((r) =>
        r.id === room.roomId ? { ...r, label: finalLabel, kind, className: cleanClass } : r,
      ),
    };
    const ok = await mutate(
      '/campus-layout',
      { status: 'published', sar: serializeLayoutToSar(nextLayout) },
      lang === 'ar' ? 'تم حفظ اسم القاعة على المجسم' : 'Room label saved',
    );
    if (ok) onClose();
  };

  return (
    <FloatingWindow
      id={`edit-${room.slotId}`}
      title={lang === 'ar' ? 'تخصيص اسم القاعة' : 'Label 3D Room'}
      subtitle={`${wingLabel} · ${room.slotId}`}
      dock="left"
      width={360}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <form className="sp-form" onSubmit={(e) => void handleSave(e)}>
        <label className="sp-field">
          <span>{lang === 'ar' ? 'الاسم الظاهر على المجسم' : 'Display Label'}</span>
          <input
            required
            placeholder={lang === 'ar' ? 'مثال: التاسع أ أو مختبر العلوم' : 'e.g. Grade 9A'}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <div className="sp-field">
          <span>{lang === 'ar' ? 'وظيفة الغرفة' : 'Room Function'}</span>
          <GlassSelect
            ariaLabel={lang === 'ar' ? 'وظيفة الغرفة' : 'Room Function'}
            value={kind}
            options={KIND_OPTIONS.map((opt) => ({ value: opt.value, label: lang === 'ar' ? opt.ar : opt.en }))}
            onChange={(val) => setKind(val as RoomKind)}
          />
        </div>

        {kind === 'classroom' && (
          <div className="sp-field">
            <span>{lang === 'ar' ? 'ربط بشعبة دراسية' : 'Linked School Class'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'ربط بشعبة دراسية' : 'Linked School Class'}
              value={className}
              options={[
                { value: '', label: lang === 'ar' ? '— قاعة فارغة / بدون ربط —' : '— Unlinked —' },
                ...data.classes.map((c) => ({
                  value: c.name,
                  label: `${c.name}${c.grade_level ? ` (${c.grade_level})` : ''}`,
                })),
              ]}
              onChange={(nextCls) => {
                setClassName(nextCls);
                if (nextCls && (!label || label === room.className || label.startsWith('قاعة'))) {
                  setLabel(nextCls);
                }
              }}
            />
          </div>
        )}

        <div className="sp-row-actions">
          <span className="sp-hint-inline">
            <MapPin size={12} />
            {room.slotId}
          </span>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <Check size={15} />
            <span>{lang === 'ar' ? 'حفظ التسمية' : 'Save Label'}</span>
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
