/**
 * Apple HIG swatches & state controls inside EditorInspectorWindow allowing
 * custom room wall/floor colors plus 3D room states (Highlight, Note, Alert, Maintenance).
 */
import type { Language } from '../../i18n';
import type { CampusRoom, RoomStateKind } from '../../types';
import { gsapPop } from './editorMotion';

const WALL_SWATCHES = ['#ffffff', '#f1f5f9', '#eff6ff', '#fef3c7', '#ecfdf5', '#fdf2f8'];
const FLOOR_SWATCHES = ['#f6f8fc', '#eaf1fa', '#fef9c3', '#e2e8f0', '#ede9fe'];

const STATE_OPTIONS: { key: RoomStateKind; ar: string; en: string }[] = [
  { key: 'normal', ar: 'عادي', en: 'Normal' },
  { key: 'highlight', ar: 'تمييز أزرق', en: 'Highlight' },
  { key: 'note', ar: 'ملاحظة', en: 'Note' },
  { key: 'alert', ar: 'تنبيه', en: 'Alert' },
  { key: 'maintenance', ar: 'صيانة', en: 'Maintenance' },
];

export function RoomAppearancePanel({
  room,
  lang,
  onUpdate,
}: {
  room: CampusRoom;
  lang: Language;
  onUpdate: (patch: Partial<CampusRoom>) => void;
}) {
  const curWall = room.wallColor || '#ffffff';
  const curFloor = room.floorColor || '#f6f8fc';
  const curState = room.roomState || 'normal';

  return (
    <div className="sp-ed-card">
      <div className="sp-chip-picker">
        <span>{lang === 'ar' ? 'لون الجدران' : 'Wall Color'}</span>
        <div className="sp-color-row">
          {WALL_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`sp-color-dot ${curWall.toLowerCase() === hex ? 'is-active' : ''}`}
              style={{ background: hex }}
              onClick={(e) => { gsapPop(e.currentTarget); onUpdate({ wallColor: hex }); }}
              title={hex}
            />
          ))}
          <input
            type="color"
            className="sp-color-picker"
            value={curWall}
            onChange={(e) => onUpdate({ wallColor: e.target.value })}
          />
        </div>
      </div>

      <div className="sp-chip-picker">
        <span>{lang === 'ar' ? 'لون الأرضية' : 'Floor Color'}</span>
        <div className="sp-color-row">
          {FLOOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`sp-color-dot ${curFloor.toLowerCase() === hex ? 'is-active' : ''}`}
              style={{ background: hex }}
              onClick={(e) => { gsapPop(e.currentTarget); onUpdate({ floorColor: hex }); }}
              title={hex}
            />
          ))}
          <input
            type="color"
            className="sp-color-picker"
            value={curFloor}
            onChange={(e) => onUpdate({ floorColor: e.target.value })}
          />
        </div>
      </div>

      <div className="sp-chip-picker">
        <span>{lang === 'ar' ? 'حالة الغرفة على المجسم' : 'Room State'}</span>
        <div className="sp-chip-grid">
          {STATE_OPTIONS.map((st) => (
            <button
              key={st.key}
              type="button"
              className={`sp-toggle-chip ${curState === st.key ? 'is-active' : ''}`}
              onClick={(e) => { gsapPop(e.currentTarget); onUpdate({ roomState: st.key }); }}
            >
              {lang === 'ar' ? st.ar : st.en}
            </button>
          ))}
        </div>
      </div>

      {curState !== 'normal' && (
        <label className="sp-field">
          <span>{lang === 'ar' ? 'ملاحظة الحالة الظاهرة' : 'Visible State Note'}</span>
          <input
            placeholder={lang === 'ar' ? 'مثال: قاعة اختبار أو صيانة التكييف…' : 'e.g. Exam hall or AC check…'}
            value={room.stateNote || ''}
            onChange={(e) => onUpdate({ stateNote: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
