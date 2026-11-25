/**
 * Apple HIG Inspector controls for sculpting custom room corner shapes and moving/converting
 * doors, double doors, and windows across walls (complements direct 3D corner/pill dragging).
 */
import { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusRoom, WallOpening } from '../../types';
import { findRoomNeighbors } from '../engine/roomAdjacency';
import {
  clampOpeningOffset,
  getOpeningEdgeOffset,
  getRoomEdges,
  getRoomPoints,
  insertCornerOnLongestEdge,
  resolveOpeningEdgeIndex,
} from '../engine/roomPolygon';

export function RoomOpeningsPanel({
  room,
  floorRooms = [],
  lang,
  onUpdate,
  onToggleSharedWall,
}: {
  room: CampusRoom;
  floorRooms?: CampusRoom[];
  lang: Language;
  onUpdate: (patch: Partial<CampusRoom>) => void;
  onToggleSharedWall?: (roomId: string, edgeIndex: number, neighborId: string, neighborEdgeIndex: number) => void;
}) {
  const [selectedOpId, setSelectedOpId] = useState<string>('');
  const pts = getRoomPoints(room);
  const edges = getRoomEdges(room);
  const neighbors = findRoomNeighbors(room, floorRooms);
  const openings = room.openings || [];
  const activeOp = openings.find((o) => o.id === selectedOpId) || openings[0] || null;

  const updateOp = (opId: string, patch: Partial<WallOpening>) => {
    onUpdate({
      openings: openings.map((o) => (o.id === opId ? { ...o, ...patch } : o)),
    });
  };

  const removeOp = (opId: string) => {
    onUpdate({ openings: openings.filter((o) => o.id !== opId) });
  };

  const activeEdgeIdx = activeOp ? resolveOpeningEdgeIndex(activeOp, edges.length) : 0;
  const activeEdge = edges[activeEdgeIdx] || edges[0];
  const activeMaxOff = activeEdge && activeOp
    ? Math.max(0.05, Number((activeEdge.length / 2 - Math.min(activeEdge.length - 0.3, activeOp.width) / 2 - 0.14).toFixed(2)))
    : 1;
  const activeOff = activeOp ? clampOpeningOffset(getOpeningEdgeOffset(activeOp), activeEdge.length, activeOp.width) : 0;

  return (
    <div className="sp-form">
      <div className="sp-ed-card">
        <div className="sp-inline-head">
          <span>{lang === 'ar' ? `شكل الغرفة (${pts.length} نقاط)` : `Room Shape (${pts.length} pts)`}</span>
          <div className="sp-row-actions">
            <button
              type="button"
              className="sp-toggle-chip"
              onClick={() => onUpdate({ points: insertCornerOnLongestEdge(room) })}
            >
              <Plus size={12} /> {lang === 'ar' ? 'إضافة زاوية' : 'Add Corner'}
            </button>
            {room.points && room.points.length >= 3 && (
              <button type="button" className="sp-toggle-chip" onClick={() => onUpdate({ points: undefined })}>
                <RotateCcw size={12} /> {lang === 'ar' ? 'مستطيل' : 'Reset'}
              </button>
            )}
          </div>
        </div>
        <p className="sp-mini-hint">
          {lang === 'ar' ? 'اسحب الكرات الزرقاء على الزوايا أو الحواف في 3D لتشكيل أي مضلع' : 'Drag blue corner spheres in 3D to sculpt any polygon shape'}
        </p>
        {neighbors.length > 0 && (
          <div className="sp-chip-grid">
            {neighbors.map((nb) =>
              nb.autoMerged ? (
                <span key={`${nb.neighborId}-${nb.edgeIndex}`} className="sp-toggle-chip is-active">
                  {lang === 'ar' ? `مدمج تلقائياً مع ${nb.neighborLabel} ✓` : `Auto-merged: ${nb.neighborLabel} ✓`}
                </span>
              ) : (
                <button
                  key={`${nb.neighborId}-${nb.edgeIndex}`}
                  type="button"
                  className={`sp-toggle-chip ${nb.isMerged ? 'is-active' : ''}`}
                  onClick={() => onToggleSharedWall?.(room.id, nb.edgeIndex, nb.neighborId, nb.neighborEdgeIndex)}
                >
                  {nb.isMerged
                    ? lang === 'ar' ? `مفتوح مع ${nb.neighborLabel} ✓` : `Merged: ${nb.neighborLabel} ✓`
                    : lang === 'ar' ? `دمج الجدار مع ${nb.neighborLabel}` : `Merge wall: ${nb.neighborLabel}`}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {openings.length > 0 && activeOp && (
        <div className="sp-ed-card">
          <span>{lang === 'ar' ? 'تحريك وتعديل الأبواب والنوافذ' : 'Move Doors & Windows'}</span>
          <div className="sp-chip-grid">
            {openings.map((op) => {
              const eIdx = resolveOpeningEdgeIndex(op, edges.length) + 1;
              return (
                <button
                  key={op.id}
                  type="button"
                  className={`sp-toggle-chip ${activeOp.id === op.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedOpId(op.id)}
                >
                  {op.type === 'double_door' ? '🚪🚪' : op.type === 'door' ? '🚪' : '🪟'} #{eIdx}
                </button>
              );
            })}
          </div>

          <div className="sp-opening-card">
            <div className="sp-chip-grid">
              {(['door', 'double_door', 'window'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  className={`sp-toggle-chip ${activeOp.type === tp ? 'is-active' : ''}`}
                  onClick={() =>
                    updateOp(activeOp.id, {
                      type: tp,
                      width: tp === 'double_door' ? 2.1 : tp === 'window' ? 1.8 : 1.15,
                      height: tp === 'double_door' ? 2.35 : tp === 'window' ? 1.3 : 2.25,
                    })
                  }
                >
                  {tp === 'door' ? (lang === 'ar' ? 'باب' : 'Door') : tp === 'double_door' ? (lang === 'ar' ? 'مزدوج' : 'Double') : (lang === 'ar' ? 'نافذة' : 'Window')}
                </button>
              ))}
            </div>

            <div className="sp-row-2">
              <label className="sp-field">
                <span>{lang === 'ar' ? 'الجدار' : 'Wall'}</span>
                <select
                  value={activeEdgeIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const targetEdge = edges[idx];
                    if (!targetEdge) return;
                    updateOp(activeOp.id, {
                      wallIndex: idx,
                      wall: targetEdge.wall,
                      offset: clampOpeningOffset(activeOff, targetEdge.length, activeOp.width),
                    });
                  }}
                >
                  {edges.map((ed) => (
                    <option key={ed.index} value={ed.index}>
                      {lang === 'ar' ? `جدار ${ed.index + 1} (${ed.length.toFixed(1)}م)` : `Wall ${ed.index + 1} (${ed.length.toFixed(1)}m)`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sp-field">
                <span>{lang === 'ar' ? 'العرض (م)' : 'Width (m)'}</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.6}
                  max={Math.max(1.2, activeEdge.length - 0.3)}
                  value={activeOp.width}
                  onChange={(e) => updateOp(activeOp.id, { width: Math.max(0.6, Number(e.target.value) || 1.15) })}
                />
              </label>
            </div>

            <label className="sp-field">
              <span>{lang === 'ar' ? `الموقع على الجدار (${activeOff}م)` : `Wall Position (${activeOff}m)`}</span>
              <input
                type="range"
                min={-activeMaxOff}
                max={activeMaxOff}
                step={0.25}
                value={activeOff}
                onChange={(e) =>
                  updateOp(activeOp.id, {
                    wallIndex: activeEdgeIdx,
                    wall: activeEdge.wall,
                    offset: Number(e.target.value),
                  })
                }
              />
            </label>

            <div className="sp-inline-head">
              <p className="sp-mini-hint">
                {lang === 'ar' ? 'أو اسحب المقبض الملون فوق الباب/النافذة في 3D' : 'Or drag the colored bar above any opening in 3D'}
              </p>
              <button type="button" className="sp-icon-btn is-danger" onClick={() => removeOp(activeOp.id)} title={lang === 'ar' ? 'حذف الفتحة' : 'Delete opening'}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
