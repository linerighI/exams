/**
 * Floating Apple HIG right-side Inspector window inside the 3D School Editor:
 * delegates Prop, 3D Assignment, and Wing/Beacon sections cleanly to keep under 300 lines.
 */
import { useState } from 'react';
import { Copy, CopyPlus, QrCode, Trash2 } from 'lucide-react';
import type { Language } from '../../i18n';
import type {
  CampusBeacon,
  CampusLayout,
  CampusProp,
  CampusRoom,
  RoomKind,
  SpatialAssignment3D,
  State,
} from '../../types';
import { buildRoomQrPayload } from '../../tracking/beaconScanner';
import { FloatingWindow } from '../../windows/FloatingWindow';
import type { SelectedEditorEntity } from '../engine/campusSchema';
import { AssignmentInspectorSection, EDITOR_ROOM_KINDS, PropInspectorSection, WingsBeaconSection } from './EditorInspectorPanels';
import { RoomAppearancePanel } from './RoomAppearancePanel';
import { RoomOpeningsPanel } from './RoomOpeningsPanel';
import { computePointsBounds } from '../engine/roomPolygon';

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

/** Contextual Apple HIG inspector panel for the active 3D Editor entity or wings. */
export function EditorInspectorWindow({
  draft,
  selected,
  activeWingId,
  beacons,
  data,
  lang,
  onSelectWing,
  onAddWing,
  onUpdateRoom,
  onToggleSharedWall,
  onUpdateProp,
  onUpdateAssignment,
  onDuplicate,
  onDelete,
  onRegisterQrBeacon,
  onDeleteBeacon,
}: EditorInspectorWindowProps) {
  const [copiedId, setCopiedId] = useState('');

  const selRoom = selected?.type === 'room' ? draft.rooms.find((r) => r.id === selected.id) : null;
  const selProp = selected?.type === 'prop' ? draft.props.find((p) => p.id === selected.id) : null;
  const selAssignRoom = selected?.type === 'assignment' ? draft.rooms.find((r) => r.id === selected.roomId) : null;
  const selAssign =
    selected?.type === 'assignment' && selAssignRoom
      ? selAssignRoom.assignments3D.find((a) => a.id === selected.id)
      : null;

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
      width={340}
      zIndex={42}
      onFocus={() => {}}
    >
      {selRoom ? (
        <div className="sp-form">
          <div className="sp-ed-card">
            <label className="sp-field">
              <span>{lang === 'ar' ? 'اسم الغرفة' : 'Room Name'}</span>
              <input value={selRoom.label} onChange={(e) => onUpdateRoom(selRoom.id, { label: e.target.value })} />
            </label>
            <div className="sp-row-2">
              <label className="sp-field">
                <span>{lang === 'ar' ? 'النوع' : 'Function'}</span>
                <select value={selRoom.kind} onChange={(e) => onUpdateRoom(selRoom.id, { kind: e.target.value as RoomKind })}>
                  {EDITOR_ROOM_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{lang === 'ar' ? k.ar : k.en}</option>
                  ))}
                </select>
              </label>
              <label className="sp-field">
                <span>{lang === 'ar' ? 'الجناح' : 'Wing'}</span>
                <select value={selRoom.wingId} onChange={(e) => onUpdateRoom(selRoom.id, { wingId: e.target.value })}>
                  {draft.wings.map((w) => (
                    <option key={w.id} value={w.id}>{lang === 'ar' ? w.labelAr : w.labelEn}</option>
                  ))}
                </select>
              </label>
            </div>

            {selRoom.kind === 'classroom' && (
              <label className="sp-field">
                <span>{lang === 'ar' ? 'ربط بشعبة دراسية' : 'Linked Class'}</span>
                <select
                  value={selRoom.className}
                  onChange={(e) => {
                    const cls = e.target.value;
                    onUpdateRoom(selRoom.id, { className: cls, label: cls || selRoom.label });
                  }}
                >
                  <option value="">{lang === 'ar' ? '— بدون ربط —' : '— None —'}</option>
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="sp-row-3">
              <label className="sp-field">
                <span>{lang === 'ar' ? 'العرض (م)' : 'Width'}</span>
                <input
                  type="number"
                  step={0.5}
                  min={2}
                  max={80}
                  value={selRoom.width}
                  onChange={(e) => {
                    const nw = Math.max(2, Number(e.target.value));
                    if (selRoom.points?.length) {
                      const curW = Math.max(1.5, computePointsBounds(selRoom.points).width);
                      const s = nw / curW;
                      onUpdateRoom(selRoom.id, {
                        width: nw,
                        points: selRoom.points.map((p) => ({ x: Number((p.x * s).toFixed(2)), z: p.z })),
                      });
                    } else {
                      onUpdateRoom(selRoom.id, { width: nw });
                    }
                  }}
                />
              </label>
              <label className="sp-field">
                <span>{lang === 'ar' ? 'العمق (م)' : 'Depth'}</span>
                <input
                  type="number"
                  step={0.5}
                  min={2}
                  max={80}
                  value={selRoom.depth}
                  onChange={(e) => {
                    const nd = Math.max(2, Number(e.target.value));
                    if (selRoom.points?.length) {
                      const curD = Math.max(1.5, computePointsBounds(selRoom.points).depth);
                      const s = nd / curD;
                      onUpdateRoom(selRoom.id, {
                        depth: nd,
                        points: selRoom.points.map((p) => ({ x: p.x, z: Number((p.z * s).toFixed(2)) })),
                      });
                    } else {
                      onUpdateRoom(selRoom.id, { depth: nd });
                    }
                  }}
                />
              </label>
              <label className="sp-field">
                <span>{lang === 'ar' ? 'الارتفاع' : 'Height'}</span>
                <input type="number" step={0.2} min={0.3} max={6} value={selRoom.wallHeight} onChange={(e) => onUpdateRoom(selRoom.id, { wallHeight: Math.max(0.3, Number(e.target.value)) })} />
              </label>
            </div>
          </div>

          <RoomOpeningsPanel
            room={selRoom}
            floorRooms={draft.rooms}
            lang={lang}
            onUpdate={(patch) => onUpdateRoom(selRoom.id, patch)}
            onToggleSharedWall={onToggleSharedWall}
          />

          <RoomAppearancePanel
            room={selRoom}
            lang={lang}
            onUpdate={(patch) => onUpdateRoom(selRoom.id, patch)}
          />

          <div className="sp-ed-card">
            <div className="sp-row-actions">
              <button
                type="button"
                className="sp-btn-soft"
                onClick={() => onRegisterQrBeacon(selRoom)}
                title={lang === 'ar' ? 'تسجيل الغرفة كرمز QR لمسح حضور المعلم عند الباب' : 'Register this room as a QR door check-in point'}
              >
                <QrCode size={14} />
                <span>{lang === 'ar' ? 'تسجيل إشارة QR' : 'Register QR'}</span>
              </button>
              <button
                type="button"
                className="sp-btn-ghost"
                onClick={() => copyQrLink(selRoom.id)}
                title={lang === 'ar' ? 'نسخ رابط فحص QR لطباعته أو فتحه من تطبيق المعلم' : 'Copy QR check-in payload link'}
              >
                <Copy size={13} />
                <span>{copiedId === selRoom.id ? '✓' : 'URL'}</span>
              </button>
            </div>
            <p className="sp-mini-hint">
              {lang === 'ar' ? 'لطباعة رمز QR على باب الغرفة وتحديد موقع المعلم تلقائياً عند المسح' : 'Generates & copies a QR check-in token for automatic teacher location logging'}
            </p>
          </div>

          <div className="sp-row-actions">
            <button type="button" className="sp-btn-soft" onClick={onDuplicate}>
              <CopyPlus size={14} />
              <span>{lang === 'ar' ? 'تكرار' : 'Duplicate'}</span>
            </button>
            <button type="button" className="sp-icon-btn is-danger" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : selProp ? (
        <PropInspectorSection prop={selProp} lang={lang} onUpdateProp={onUpdateProp} onDelete={onDelete} />
      ) : selAssign && selAssignRoom ? (
        <AssignmentInspectorSection
          roomId={selAssignRoom.id}
          assignment={selAssign}
          data={data}
          lang={lang}
          onUpdateAssignment={onUpdateAssignment}
          onDelete={onDelete}
        />
      ) : (
        <WingsBeaconSection
          draft={draft}
          activeWingId={activeWingId}
          beacons={beacons}
          lang={lang}
          onSelectWing={onSelectWing}
          onAddWing={onAddWing}
          onDeleteBeacon={onDeleteBeacon}
        />
      )}
    </FloatingWindow>
  );
}
