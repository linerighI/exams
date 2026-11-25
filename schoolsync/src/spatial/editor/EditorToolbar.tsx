/**
 * Top editor action bar, left vertical CAD tool rail, live metric readout pill,
 * and Blank Canvas onboarding prompt for the 3D School Model Editor Studio.
 */
import type { ReactNode } from 'react';
import {
  Armchair,
  Check,
  DoorOpen,
  Eraser,
  Layers,
  LocateFixed,
  MousePointer2,
  Paintbrush,
  Pin,
  Plus,
  Radio,
  Redo2,
  Sparkles,
  SquarePlus,
  Undo2,
  Wind,
  X,
} from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusLayout, SchoolClass } from '../../types';
import type { EditorTool } from '../engine/campusSchema';

interface EditorToolbarProps {
  draft: CampusLayout;
  tool: EditorTool;
  activeFloorId: string;
  activeWingId: string;
  gridSnap: number;
  onionSkin: boolean;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  busy: boolean;
  measureDims: { width: number; depth: number } | null;
  classes: SchoolClass[];
  lang: Language;
  onSelectTool: (t: EditorTool) => void;
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCycleSnap: () => void;
  onToggleOnion: () => void;
  onOpenGeo: () => void;
  onLoadStarter: () => void;
  onClearBlank: () => void;
  onPublish: () => void;
  onExit: () => void;
}

const TOOLS: { id: EditorTool; ar: string; en: string; tipAr: string; tipEn: string; icon: ReactNode; group: 0 | 1 | 2 }[] = [
  { id: 'select', ar: 'تحديد', en: 'Select', tipAr: 'تحديد وتحريك وتشكيل الزوايا والفتحات', tipEn: 'Select, move & reshape corners/openings', icon: <MousePointer2 size={16} />, group: 0 },
  { id: 'draw_room', ar: 'غرفة', en: 'Room', tipAr: 'اسحب على الشبكة لرسم غرفة جديدة', tipEn: 'Drag on grid to draw a new room', icon: <SquarePlus size={16} />, group: 0 },
  { id: 'door', ar: 'باب', en: 'Door', tipAr: 'إضافة باب مفرد على أي جدار', tipEn: 'Place a single door on a wall', icon: <DoorOpen size={16} />, group: 1 },
  { id: 'double_door', ar: 'مزدوج', en: 'Double', tipAr: 'إضافة باب مزدوج على أي جدار', tipEn: 'Place a double glass door on a wall', icon: <DoorOpen size={16} />, group: 1 },
  { id: 'window', ar: 'نافذة', en: 'Window', tipAr: 'إضافة نافذة على أي جدار', tipEn: 'Place a framed glass window on a wall', icon: <Wind size={16} />, group: 1 },
  { id: 'prop', ar: 'أثاث', en: 'Props', tipAr: 'عناصر وديكور SARE ثلاثي الأبعاد', tipEn: 'SARE 3D Furniture & Courtyard Props', icon: <Armchair size={16} />, group: 2 },
  { id: 'assignment', ar: 'مهمة', en: 'Pin', tipAr: 'وضع دبوس مهمة مكانية 3D', tipEn: 'Place a 3D spatial assignment pin', icon: <Pin size={16} />, group: 2 },
  { id: 'paint_wing', ar: 'جناح', en: 'Wing', tipAr: 'تعيين الغرفة للجناح النشط', tipEn: 'Assign room to the active wing', icon: <Paintbrush size={16} />, group: 2 },
  { id: 'beacon', ar: 'إشارة', en: 'Beacon', tipAr: 'إضافة نقطة إشارة موقع المعلم', tipEn: 'Place indoor beacon / QR anchor', icon: <Radio size={16} />, group: 2 },
];

/** Apple HIG 3D Editor Studio tool rail, floor bar, and blank-canvas onboarding. */
export function EditorToolbar({
  draft,
  tool,
  activeFloorId,
  gridSnap,
  onionSkin,
  canUndo,
  canRedo,
  dirty,
  busy,
  measureDims,
  lang,
  onSelectTool,
  onSelectFloor,
  onAddFloor,
  onUndo,
  onRedo,
  onCycleSnap,
  onToggleOnion,
  onOpenGeo,
  onLoadStarter,
  onClearBlank,
  onPublish,
  onExit,
}: EditorToolbarProps) {
  return (
    <>
      <div className="sp-editor-topbar">
        <span className="sp-sare-tag" title="SARE — School Advanced Rendering Engine">SARE</span>
        <div className="sp-editor-floors">
          {draft.floors.map((fl) => (
            <button
              key={fl.id}
              type="button"
              className={`sp-ed-pill ${activeFloorId === fl.id ? 'is-active' : ''}`}
              onClick={() => onSelectFloor(fl.id)}
            >
              {lang === 'ar' ? fl.labelAr : fl.labelEn}
            </button>
          ))}
          <button type="button" className="sp-ed-icon" onClick={onAddFloor} title={lang === 'ar' ? 'إضافة طابق' : 'Add Floor'}>
            <Plus size={14} />
          </button>
        </div>

        <div className="sp-editor-actions">
          <button type="button" className="sp-ed-icon" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
            <Undo2 size={15} />
          </button>
          <button type="button" className="sp-ed-icon" onClick={onRedo} disabled={!canRedo} title="Ctrl+Y">
            <Redo2 size={15} />
          </button>
          <button type="button" className="sp-ed-pill" onClick={onCycleSnap} title={lang === 'ar' ? 'شبكة المحاذاة' : 'Grid Snap'}>
            {gridSnap}m
          </button>
          <button
            type="button"
            className={`sp-ed-icon ${onionSkin ? 'is-active' : ''}`}
            onClick={onToggleOnion}
            title={lang === 'ar' ? 'شفافية الطابق السفلي' : 'Floor Onion-Skin'}
          >
            <Layers size={15} />
          </button>
          <button type="button" className="sp-ed-icon" onClick={onOpenGeo} title={lang === 'ar' ? 'معايرة GPS' : 'GPS Anchor'}>
            <LocateFixed size={15} />
          </button>
          <button type="button" className="sp-ed-pill" onClick={onLoadStarter}>
            <Sparkles size={13} />
            <span>{lang === 'ar' ? 'نموذج جاهز' : 'Starter'}</span>
          </button>
          <button type="button" className="sp-ed-icon" onClick={onClearBlank} title={lang === 'ar' ? 'مسح الكل' : 'Blank Canvas'}>
            <Eraser size={15} />
          </button>
          <button type="button" className="sp-btn-primary sp-ed-publish" onClick={onPublish} disabled={busy}>
            <Check size={14} />
            <span>{dirty ? (lang === 'ar' ? 'نشر المجسم' : 'Publish Live') : lang === 'ar' ? 'منشور ✓' : 'Published ✓'}</span>
          </button>
          <button type="button" className="sp-ed-icon" onClick={onExit} title={lang === 'ar' ? 'إغلاق المحرر' : 'Exit Editor'}>
            <X size={15} />
          </button>
        </div>
      </div>

      <aside className="sp-editor-rail" aria-label="3D Editor Tools">
        {TOOLS.map((t, i) => (
          <div key={t.id}>
            {i > 0 && TOOLS[i - 1].group !== t.group && <div className="sp-rail-sep" />}
            <button
              type="button"
              className={`sp-rail-btn ${tool === t.id ? 'is-active' : ''}`}
              onClick={() => onSelectTool(t.id)}
              title={lang === 'ar' ? t.tipAr : t.tipEn}
            >
              {t.icon}
              <span>{lang === 'ar' ? t.ar : t.en}</span>
            </button>
          </div>
        ))}
      </aside>

      {measureDims && (
        <div className="sp-editor-measure">
          {measureDims.width.toFixed(1)}m × {measureDims.depth.toFixed(1)}m
        </div>
      )}

      {draft.rooms.length === 0 && (
        <div className="sp-editor-empty-banner">
          <strong>{lang === 'ar' ? 'مساحة بناء ثلاثية الأبعاد فارغة' : 'Blank 3D Architectural Studio'}</strong>
          <p>
            {lang === 'ar'
              ? 'اختر «رسم غرفة» واسحب على الشبكة لبناء مدرستك من الصفر، أو حمّل نموذجاً قابلاً للتعديل.'
              : 'Pick "Draw Room" and drag on the grid to build from scratch, or load an editable starter.'}
          </p>
          <div className="sp-row-actions">
            <button type="button" className="sp-btn-primary" onClick={() => onSelectTool('draw_room')}>
              <SquarePlus size={14} />
              <span>{lang === 'ar' ? 'ابدأ برسم غرفة' : 'Draw First Room'}</span>
            </button>
            <button type="button" className="sp-btn-soft" onClick={onLoadStarter}>
              <Sparkles size={14} />
              <span>{lang === 'ar' ? 'تحميل نموذج المدرسة' : 'Load Starter Campus'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
