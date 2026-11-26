/**
 * Shape tab for the 4-Tab Apple SARE Inspector: Room identity, inline macOS numeric steppers,
 * polygon corner addition/reset, and iOS-style toggles for shared-wall merging.
 */
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusLayout, CampusRoom, RoomKind, SchoolClass } from '../../types';
import { GlassSelect } from '../../windows/GlassSelect';
import { findRoomNeighbors } from '../engine/roomAdjacency';
import { computePointsBounds, getRoomPoints, insertCornerOnLongestEdge } from '../engine/roomPolygon';
import { EDITOR_ROOM_KINDS } from './EditorInspectorPanels';
import { gsapPop } from './editorMotion';

interface RoomShapeTabProps {
  room: CampusRoom;
  draft: CampusLayout;
  classes: SchoolClass[];
  lang: Language;
  onUpdate: (patch: Partial<CampusRoom>) => void;
  onToggleSharedWall: (roomId: string, edgeIndex: number, neighborId: string, neighborEdgeIndex: number) => void;
}

export function RoomShapeTab({ room, draft, classes, lang, onUpdate, onToggleSharedWall }: RoomShapeTabProps) {
  const pts = getRoomPoints(room);
  const neighbors = findRoomNeighbors(room, draft.rooms);

  const stepDim = (axis: 'width' | 'depth' | 'wallHeight', delta: number) => {
    if (axis === 'wallHeight') {
      onUpdate({ wallHeight: Math.max(0.4, Math.min(6, Number(((room.wallHeight || 3.2) + delta).toFixed(1)))) });
      return;
    }
    const nextVal = Math.max(2, Math.min(80, Number((room[axis] + delta).toFixed(1))));
    if (room.points?.length) {
      const b = computePointsBounds(room.points);
      const scale = nextVal / Math.max(1.5, axis === 'width' ? b.width : b.depth);
      onUpdate({
        [axis]: nextVal,
        points: room.points.map((p) => ({
          x: axis === 'width' ? Number((p.x * scale).toFixed(2)) : p.x,
          z: axis === 'depth' ? Number((p.z * scale).toFixed(2)) : p.z,
        })),
      });
    } else {
      onUpdate({ [axis]: nextVal });
    }
  };

  return (
    <div className="sp-form">
      <div className="sp-ed-card">
        <label className="sp-field">
          <span>{lang === 'ar' ? 'اسم الغرفة' : 'Room Name'}</span>
          <input value={room.label} onChange={(e) => onUpdate({ label: e.target.value })} />
        </label>
        <div className="sp-row-2">
          <div className="sp-field">
            <span>{lang === 'ar' ? 'النوع' : 'Type'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'نوع الغرفة' : 'Room Type'}
              value={room.kind}
              options={EDITOR_ROOM_KINDS.map((k) => ({ value: k.value, label: lang === 'ar' ? k.ar : k.en }))}
              onChange={(val) => onUpdate({ kind: val as RoomKind })}
            />
          </div>
          <div className="sp-field">
            <span>{lang === 'ar' ? 'الجناح' : 'Wing'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'الجناح' : 'Wing'}
              value={room.wingId}
              options={draft.wings.map((w) => ({ value: w.id, label: lang === 'ar' ? w.labelAr : w.labelEn }))}
              onChange={(val) => onUpdate({ wingId: val })}
            />
          </div>
        </div>
        {room.kind === 'classroom' && (
          <div className="sp-field">
            <span>{lang === 'ar' ? 'الشعبة المرتبطة' : 'Linked Class'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'الشعبة المرتبطة' : 'Linked Class'}
              value={room.className}
              options={[
                { value: '', label: lang === 'ar' ? '— بدون ربط —' : '— None —' },
                ...classes.map((c) => ({ value: c.name, label: c.name })),
              ]}
              onChange={(cls) => onUpdate({ className: cls, label: cls || room.label })}
            />
          </div>
        )}
      </div>

      <div className="sp-ed-card">
        {([
          { axis: 'width' as const, label: lang === 'ar' ? 'العرض' : 'Width', val: room.width, step: 0.5 },
          { axis: 'depth' as const, label: lang === 'ar' ? 'العمق' : 'Depth', val: room.depth, step: 0.5 },
          { axis: 'wallHeight' as const, label: lang === 'ar' ? 'الارتفاع' : 'Height', val: room.wallHeight || 3.2, step: 0.2 },
        ]).map((row) => (
          <div key={row.axis} className="sp-stepper-row">
            <span>{row.label}</span>
            <div className="sp-stepper">
              <button type="button" className="sp-stepper-btn" onClick={(e) => { gsapPop(e.currentTarget); stepDim(row.axis, -row.step); }}>
                <Minus size={12} />
              </button>
              <input
                type="number"
                step={row.step}
                value={row.val}
                aria-label={row.label}
                onChange={(e) => stepDim(row.axis, (Number(e.target.value) || row.val) - row.val)}
              />
              <em>m</em>
              <button type="button" className="sp-stepper-btn" onClick={(e) => { gsapPop(e.currentTarget); stepDim(row.axis, row.step); }}>
                <Plus size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sp-ed-card">
        <div className="sp-inline-head">
          <span>{lang === 'ar' ? `شكل الغرفة (${pts.length} نقاط)` : `Shape (${pts.length} pts)`}</span>
          <div className="sp-row-actions">
            <button type="button" className="sp-toggle-chip" onClick={(e) => { gsapPop(e.currentTarget); onUpdate({ points: insertCornerOnLongestEdge(room) }); }}>
              <Plus size={12} /> {lang === 'ar' ? 'إضافة زاوية' : 'Add Corner'}
            </button>
            {room.points && room.points.length >= 3 && (
              <button type="button" className="sp-toggle-chip" onClick={() => onUpdate({ points: undefined })}>
                <RotateCcw size={12} /> {lang === 'ar' ? 'مستطيل' : 'Reset'}
              </button>
            )}
          </div>
        </div>
        {neighbors.map((nb) => (
          <div key={`${nb.neighborId}-${nb.edgeIndex}`} className="sp-ios-switch-row">
            <span>
              {nb.autoMerged
                ? lang === 'ar' ? `مدمج تلقائياً مع ${nb.neighborLabel}` : `Auto-merged: ${nb.neighborLabel}`
                : nb.isMerged
                  ? lang === 'ar' ? `مفتوح مع ${nb.neighborLabel}` : `Merged: ${nb.neighborLabel}`
                  : lang === 'ar' ? `دمج الجدار مع ${nb.neighborLabel}` : `Merge Wall: ${nb.neighborLabel}`}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={nb.isMerged}
              disabled={nb.autoMerged}
              className={`sp-ios-switch ${nb.isMerged ? 'is-on' : ''}`}
              onClick={() => onToggleSharedWall(room.id, nb.edgeIndex, nb.neighborId, nb.neighborEdgeIndex)}
            >
              <span className="sp-ios-knob" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
