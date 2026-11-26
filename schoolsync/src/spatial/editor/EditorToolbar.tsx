/**
 * Unified Apple Dynamic Top Pill with GSAP sliding floor segmenter + sleek icon-only CAD
 * Tool Ornament rail with sliding vertical active indicator and frosted hover tooltips.
 */
import { useRef, type ReactNode } from 'react';
import {
  Armchair,
  Check,
  Code2,
  Columns2,
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
import { gsapPop, useGsapEntrance, useGsapStagger, useSlidingPill, useVerticalSlideIndicator } from './editorMotion';

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
  sarOpen: boolean;
  onToggleSar: () => void;
  onPublish: () => void;
  onExit: () => void;
}

const TOOLS: { id: EditorTool; ar: string; en: string; tipAr: string; tipEn: string; icon: ReactNode; group: 0 | 1 | 2 }[] = [
  { id: 'select', ar: 'تحديد', en: 'Select', tipAr: 'تحديد وتحريك وتشكيل الزوايا والفتحات', tipEn: 'Select, move & reshape corners/openings', icon: <MousePointer2 size={17} />, group: 0 },
  { id: 'draw_room', ar: 'غرفة', en: 'Room', tipAr: 'اسحب على الشبكة لرسم غرفة جديدة', tipEn: 'Drag on grid to draw a new room', icon: <SquarePlus size={17} />, group: 0 },
  { id: 'door', ar: 'باب', en: 'Door', tipAr: 'إضافة باب مفرد على أي جدار', tipEn: 'Place a single door', icon: <DoorOpen size={17} />, group: 1 },
  { id: 'double_door', ar: 'مزدوج', en: 'Double', tipAr: 'إضافة باب مزدوج على أي جدار', tipEn: 'Place a double glass door', icon: <Columns2 size={17} />, group: 1 },
  { id: 'window', ar: 'نافذة', en: 'Window', tipAr: 'إضافة نافذة على أي جدار', tipEn: 'Place a framed window', icon: <Wind size={17} />, group: 1 },
  { id: 'prop', ar: 'أثاث', en: 'Props', tipAr: 'عناصر وديكور SARE ثلاثي الأبعاد', tipEn: 'SARE 3D Furniture & Props', icon: <Armchair size={17} />, group: 2 },
  { id: 'assignment', ar: 'مهمة', en: 'Pin', tipAr: 'وضع دبوس مهمة مكانية 3D', tipEn: 'Place a 3D assignment pin', icon: <Pin size={17} />, group: 2 },
  { id: 'paint_wing', ar: 'جناح', en: 'Wing', tipAr: 'تعيين الغرفة للجناح النشط', tipEn: 'Assign room to active wing', icon: <Paintbrush size={17} />, group: 2 },
  { id: 'beacon', ar: 'إشارة', en: 'Beacon', tipAr: 'إضافة نقطة إشارة موقع المعلم', tipEn: 'Place QR / BLE beacon', icon: <Radio size={17} />, group: 2 },
];

/** Floating unified SARE top capsule + icon-only tool ornament with GSAP motion. */
export function EditorToolbar({
  draft, tool, activeFloorId, gridSnap, onionSkin, canUndo, canRedo, dirty, busy, measureDims, lang,
  onSelectTool, onSelectFloor, onAddFloor, onUndo, onRedo, onCycleSnap, onToggleOnion,
  onOpenGeo, onLoadStarter, onClearBlank, sarOpen, onToggleSar, onPublish, onExit,
}: EditorToolbarProps) {
  const topbarRef = useRef<HTMLDivElement>(null);
  const floorTrackRef = useRef<HTMLDivElement>(null);
  const floorPillRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const railPillRef = useRef<HTMLSpanElement>(null);

  useGsapEntrance(
    topbarRef,
    { opacity: 0, y: -18, scale: 0.96, xPercent: -50 },
    { opacity: 1, y: 0, scale: 1, xPercent: -50, duration: 0.42, ease: 'back.out(1.25)' },
    [],
  );
  useSlidingPill(floorTrackRef, floorPillRef, 'button.is-active', [activeFloorId, draft.floors.length, lang]);
  useVerticalSlideIndicator(railRef, railPillRef, 'button.is-active', [tool]);
  useGsapStagger(railRef, '.sp-rail-btn', [], { x: -10, scale: 0.9, stagger: 0.022, duration: 0.3 });

  return (
    <>
      <div ref={topbarRef} className="sp-editor-topbar">
        <span className="sp-brand-mini">SchoolSync</span>
        <span className="sp-sare-tag" title="SARE — School Advanced Rendering Engine">SARE</span>

        <div className="sp-editor-floors">
          <div ref={floorTrackRef} className="sp-seg-track is-floors">
            <span ref={floorPillRef} className="sp-seg-pill" aria-hidden="true" />
            {draft.floors.map((fl) => (
              <button
                key={fl.id}
                type="button"
                className={activeFloorId === fl.id ? 'is-active' : ''}
                onClick={() => onSelectFloor(fl.id)}
              >
                {lang === 'ar' ? fl.labelAr : fl.labelEn}
              </button>
            ))}
          </div>
          <button type="button" className="sp-ed-icon" onClick={(e) => { gsapPop(e.currentTarget); onAddFloor(); }} title={lang === 'ar' ? 'إضافة طابق' : 'Add Floor'}>
            <Plus size={14} />
          </button>
        </div>

        <div className="sp-editor-actions">
          <button type="button" className="sp-ed-icon" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z"><Undo2 size={15} /></button>
          <button type="button" className="sp-ed-icon" onClick={onRedo} disabled={!canRedo} title="Ctrl+Y"><Redo2 size={15} /></button>
          <button type="button" className="sp-ed-pill" onClick={(e) => { gsapPop(e.currentTarget); onCycleSnap(); }} title={lang === 'ar' ? 'شبكة المحاذاة' : 'Grid Snap'}>
            {gridSnap}m
          </button>
          <button type="button" className={`sp-ed-icon ${onionSkin ? 'is-active' : ''}`} onClick={onToggleOnion} title={lang === 'ar' ? 'شفافية الطابق السفلي' : 'Floor Onion-Skin'}>
            <Layers size={15} />
          </button>
          <button type="button" className="sp-ed-icon" onClick={onOpenGeo} title={lang === 'ar' ? 'معايرة GPS' : 'GPS Anchor'}>
            <LocateFixed size={15} />
          </button>
          <button type="button" className="sp-ed-pill" onClick={(e) => { gsapPop(e.currentTarget); onLoadStarter(); }}>
            <Sparkles size={13} />
            <span>{lang === 'ar' ? 'نموذج جاهز' : 'Starter'}</span>
          </button>
          <button
            type="button"
            data-action="sar-studio"
            className={`sp-ed-pill ${sarOpen ? 'is-active' : ''}`}
            onClick={(e) => { gsapPop(e.currentTarget); onToggleSar(); }}
            title={lang === 'ar' ? 'محرر لغة SAR الهندسية' : 'SAR Architecture Code'}
          >
            <Code2 size={13} />
            <span>SAR</span>
          </button>
          <button type="button" className="sp-ed-icon" onClick={onClearBlank} title={lang === 'ar' ? 'مسح الكل' : 'Blank Canvas'}>
            <Eraser size={15} />
          </button>
          <button type="button" className="sp-btn-primary sp-ed-publish" onClick={(e) => { gsapPop(e.currentTarget); onPublish(); }} disabled={busy}>
            <Check size={14} />
            <span>{dirty ? (lang === 'ar' ? 'نشر المجسم' : 'Publish Live') : lang === 'ar' ? 'منشور ✓' : 'Published ✓'}</span>
          </button>
          <button type="button" className="sp-ed-icon" onClick={onExit} title={lang === 'ar' ? 'إغلاق المحرر' : 'Exit Editor'}>
            <X size={15} />
          </button>
        </div>
      </div>

      <aside ref={railRef} className="sp-editor-rail" aria-label="3D Editor Tools">
        <span ref={railPillRef} className="sp-rail-active-bg" aria-hidden="true" />
        {TOOLS.map((t, i) => (
          <div key={t.id} className="sp-rail-item">
            {i > 0 && TOOLS[i - 1].group !== t.group && <div className="sp-rail-sep" />}
            <button
              type="button"
              data-tool={t.id}
              aria-label={lang === 'ar' ? t.ar : t.en}
              className={`sp-rail-btn ${tool === t.id ? 'is-active' : ''}`}
              onClick={() => onSelectTool(t.id)}
              title={lang === 'ar' ? t.tipAr : t.tipEn}
            >
              {t.icon}
              <span className="sp-rail-tip">{lang === 'ar' ? t.ar : t.en}</span>
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
              ? 'اختر «غرفة» من الشريط الجانبي واسحب على الشبكة للبناء، أو حمّل نموذجاً جاهزاً.'
              : 'Pick Room on the rail and drag to build from scratch, or load an editable starter.'}
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
            <button type="button" className="sp-btn-soft" onClick={onToggleSar}>
              <Code2 size={14} />
              <span>SAR</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
