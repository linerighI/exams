/**
 * Zero-scroll 4-Tab Apple SARE Inspector (`الشكل` | `الفتحات` | `المظهر` | `ذكي`):
 * features a GSAP sliding segmented pill, staggered tab transitions, and contextual panels.
 */
import { useRef, useState } from 'react';
import { Copy, CopyPlus, QrCode, Trash2 } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusBeacon, CampusLayout, CampusProp, CampusRoom, SpatialAssignment3D, State } from '../../types';
import { buildRoomQrPayload } from '../../tracking/beaconScanner';
import { FloatingWindow } from '../../windows/FloatingWindow';
import type { SelectedEditorEntity } from '../engine/campusSchema';
import { AssignmentInspectorSection, PropInspectorSection, WingsBeaconSection } from './EditorInspectorPanels';
import { gsapPop, useGsapStagger, useSlidingPill } from './editorMotion';
import { RoomAppearancePanel } from './RoomAppearancePanel';
import { RoomOpeningsPanel } from './RoomOpeningsPanel';
import { RoomShapeTab } from './RoomShapeTab';

type InspectorTab = 'shape' | 'doors' | 'style' | 'smart';

const ROOM_TABS: { key: InspectorTab; ar: string; en: string }[] = [
  { key: 'shape', ar: 'الشكل', en: 'Shape' },
  { key: 'doors', ar: 'الفتحات', en: 'Doors' },
  { key: 'style', ar: 'المظهر', en: 'Style' },
  { key: 'smart', ar: 'ذكي', en: 'Smart' },
];

interface EditorInspectorWindowProps {
  draft: CampusLayout;
  selected: SelectedEditorEntity;
  activeWingId: string;
  beacons: CampusBeacon[];
  data: State;
  lang: Language;
  onSelectWing: (id: string) => void;
  onAddWing: (label: string) => void;
  onUpdateRoom: (id: string, patch: Partial<CampusRoom>) => void;
  onToggleSharedWall: (roomId: string, edgeIndex: number, neighborId: string, neighborEdgeIndex: number) => void;
  onUpdateProp: (id: string, patch: Partial<CampusProp>) => void;
  onUpdateAssignment: (roomId: string, id: string, patch: Partial<SpatialAssignment3D>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRegisterQrBeacon: (room: CampusRoom) => void;
  onDeleteBeacon: (id: string) => void;
}

/** Tabbed macOS-inspired 3D Editor Inspector window with GSAP micro-animations. */
export function EditorInspectorWindow({
  draft, selected, activeWingId, beacons, data, lang, onSelectWing, onAddWing, onUpdateRoom,
  onToggleSharedWall, onUpdateProp, onUpdateAssignment, onDuplicate, onDelete, onRegisterQrBeacon, onDeleteBeacon,
}: EditorInspectorWindowProps) {
  const [copiedId, setCopiedId] = useState('');
  const [tab, setTab] = useState<InspectorTab>('shape');
  const tabTrackRef = useRef<HTMLDivElement>(null);
  const tabPillRef = useRef<HTMLSpanElement>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);

  const selRoom = selected?.type === 'room' ? draft.rooms.find((r) => r.id === selected.id) : null;
  const selProp = selected?.type === 'prop' ? draft.props.find((p) => p.id === selected.id) : null;
  const selAssignRoom = selected?.type === 'assignment' ? draft.rooms.find((r) => r.id === selected.roomId) : null;
  const selAssign = selected?.type === 'assignment' && selAssignRoom ? selAssignRoom.assignments3D.find((a) => a.id === selected.id) : null;

  useSlidingPill(tabTrackRef, tabPillRef, 'button.is-active', [tab, selRoom?.id, lang]);
  useGsapStagger(tabBodyRef, '.sp-ed-card', [tab, selRoom?.id], { y: 8, scale: 0.98, stagger: 0.03, duration: 0.24 });

  const copyQrLink = (roomId: string) => {
    void navigator.clipboard?.writeText(buildRoomQrPayload(roomId));
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(''), 1800);
  };

  return (
    <FloatingWindow
      id="editor-inspector"
      title={
        selRoom
          ? selRoom.label || (lang === 'ar' ? 'خصائص الغرفة' : 'Room Inspector')
          : selProp
            ? lang === 'ar' ? 'عنصر وديكور 3D' : '3D Prop'
            : selAssign
              ? lang === 'ar' ? 'مهمة مكانية 3D' : '3D Assignment'
              : lang === 'ar' ? 'الأجنحة والإشارات' : 'Wings & Beacons'
      }
      dock="right"
      width={326}
      zIndex={42}
      onFocus={() => {}}
    >
      {selRoom ? (
        <div className="sp-form">
          <div ref={tabTrackRef} className="sp-seg-track is-4" role="tablist">
            <span ref={tabPillRef} className="sp-seg-pill" aria-hidden="true" />
            {ROOM_TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                {lang === 'ar' ? t.ar : t.en}
              </button>
            ))}
          </div>

          <div ref={tabBodyRef}>
            {tab === 'shape' && (
              <RoomShapeTab
                room={selRoom}
                draft={draft}
                classes={data.classes}
                lang={lang}
                onUpdate={(patch) => onUpdateRoom(selRoom.id, patch)}
                onToggleSharedWall={onToggleSharedWall}
              />
            )}
            {tab === 'doors' && (
              <RoomOpeningsPanel room={selRoom} lang={lang} onUpdate={(patch) => onUpdateRoom(selRoom.id, patch)} />
            )}
            {tab === 'style' && (
              <RoomAppearancePanel room={selRoom} lang={lang} onUpdate={(patch) => onUpdateRoom(selRoom.id, patch)} />
            )}
            {tab === 'smart' && (
              <div className="sp-form">
                <div className="sp-ed-card">
                  <div className="sp-row-actions">
                    <button type="button" className="sp-btn-soft" onClick={(e) => { gsapPop(e.currentTarget); onRegisterQrBeacon(selRoom); }}>
                      <QrCode size={14} />
                      <span>{lang === 'ar' ? 'تسجيل إشارة QR' : 'Register QR'}</span>
                    </button>
                    <button type="button" className="sp-btn-ghost" onClick={(e) => { gsapPop(e.currentTarget); copyQrLink(selRoom.id); }}>
                      <Copy size={13} />
                      <span>{copiedId === selRoom.id ? '✓' : 'URL'}</span>
                    </button>
                  </div>
                  <p className="sp-mini-hint">
                    {lang === 'ar' ? 'لطباعة رمز QR على باب الغرفة وتحديد موقع المعلم تلقائياً عند المسح' : 'Generates & copies a QR check-in token for automatic teacher location logging'}
                  </p>
                </div>
                <div className="sp-ed-card">
                  <div className="sp-row-actions">
                    <button type="button" className="sp-btn-soft" onClick={(e) => { gsapPop(e.currentTarget); onDuplicate(); }}>
                      <CopyPlus size={14} />
                      <span>{lang === 'ar' ? 'تكرار الغرفة' : 'Duplicate'}</span>
                    </button>
                    <button type="button" className="sp-icon-btn is-danger" onClick={onDelete} title={lang === 'ar' ? 'حذف' : 'Delete'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : selProp ? (
        <PropInspectorSection prop={selProp} lang={lang} onUpdateProp={onUpdateProp} onDelete={onDelete} />
      ) : selAssign && selAssignRoom ? (
        <AssignmentInspectorSection roomId={selAssignRoom.id} assignment={selAssign} data={data} lang={lang} onUpdateAssignment={onUpdateAssignment} onDelete={onDelete} />
      ) : (
        <WingsBeaconSection draft={draft} activeWingId={activeWingId} beacons={beacons} lang={lang} onSelectWing={onSelectWing} onAddWing={onAddWing} onDeleteBeacon={onDeleteBeacon} />
      )}
    </FloatingWindow>
  );
}
