/**
 * Doors & Windows tab for the 4-Tab Apple SARE Inspector: switch opening types,
 * reassign target walls, adjust width/offset with instant visual feedback, or remove.
 */
import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusRoom, WallOpening } from '../../types';
import { GlassSelect } from '../../windows/GlassSelect';
import {
  clampOpeningOffset,
  getOpeningEdgeOffset,
  getRoomEdges,
  resolveOpeningEdgeIndex,
} from '../engine/roomPolygon';
import { gsapPop } from './editorMotion';

export function RoomOpeningsPanel({
  room,
  lang,
  onUpdate,
}: {
  room: CampusRoom;
  lang: Language;
  onUpdate: (patch: Partial<CampusRoom>) => void;
}) {
  const [selectedOpId, setSelectedOpId] = useState<string>('');
  const edges = getRoomEdges(room);
  const openings = room.openings || [];
  const activeOp = openings.find((o) => o.id === selectedOpId) || openings[0] || null;

  const updateOp = (opId: string, patch: Partial<WallOpening>) => {
    onUpdate({ openings: openings.map((o) => (o.id === opId ? { ...o, ...patch } : o)) });
  };

  if (!openings.length || !activeOp) {
    return (
      <div className="sp-ed-card">
        <p className="sp-mini-hint">
          {lang === 'ar' ? 'اختر أداة باب أو مزدوج أو نافذة من الشريط واضغط على أي جدار للإضافة.' : 'Pick Door, Double, or Window on the rail and click any wall to place.'}
        </p>
      </div>
    );
  }

  const activeEdgeIdx = resolveOpeningEdgeIndex(activeOp, edges.length);
  const activeEdge = edges[activeEdgeIdx] || edges[0];
  const activeMaxOff = Math.max(0.05, Number((activeEdge.length / 2 - Math.min(activeEdge.length - 0.3, activeOp.width) / 2 - 0.14).toFixed(2)));
  const activeOff = clampOpeningOffset(getOpeningEdgeOffset(activeOp), activeEdge.length, activeOp.width);

  return (
    <div className="sp-ed-card">
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
              onClick={(e) => {
                gsapPop(e.currentTarget);
                updateOp(activeOp.id, {
                  type: tp,
                  width: tp === 'double_door' ? 2.1 : tp === 'window' ? 1.8 : 1.15,
                  height: tp === 'double_door' ? 2.35 : tp === 'window' ? 1.3 : 2.25,
                });
              }}
            >
              {tp === 'door' ? (lang === 'ar' ? 'باب' : 'Door') : tp === 'double_door' ? (lang === 'ar' ? 'مزدوج' : 'Double') : (lang === 'ar' ? 'نافذة' : 'Window')}
            </button>
          ))}
        </div>

        <div className="sp-field">
          <span>{lang === 'ar' ? 'الجدار' : 'Wall'}</span>
          <GlassSelect
            ariaLabel={lang === 'ar' ? 'جدار الفتحة' : 'Opening Wall'}
            value={String(activeEdgeIdx)}
            options={edges.map((ed) => ({
              value: String(ed.index),
              label: lang === 'ar' ? `جدار ${ed.index + 1} (${ed.length.toFixed(1)}م)` : `Wall ${ed.index + 1} (${ed.length.toFixed(1)}m)`,
            }))}
            onChange={(val) => {
              const idx = Number(val);
              const targetEdge = edges[idx];
              if (targetEdge) updateOp(activeOp.id, { wallIndex: idx, wall: targetEdge.wall, offset: clampOpeningOffset(activeOff, targetEdge.length, activeOp.width) });
            }}
          />
        </div>

        <div className="sp-stepper-row">
          <span>{lang === 'ar' ? 'العرض' : 'Width'}</span>
          <div className="sp-stepper">
            <button type="button" className="sp-stepper-btn" onClick={(e) => { gsapPop(e.currentTarget); updateOp(activeOp.id, { width: Math.max(0.6, Number((activeOp.width - 0.15).toFixed(2))) }); }}>
              <Minus size={12} />
            </button>
            <input type="number" step={0.1} value={activeOp.width} onChange={(e) => updateOp(activeOp.id, { width: Math.max(0.6, Number(e.target.value) || 1.15) })} />
            <em>m</em>
            <button type="button" className="sp-stepper-btn" onClick={(e) => { gsapPop(e.currentTarget); updateOp(activeOp.id, { width: Math.min(Math.max(1.2, activeEdge.length - 0.3), Number((activeOp.width + 0.15).toFixed(2))) }); }}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        <label className="sp-field">
          <span>{lang === 'ar' ? `الموقع (${activeOff}م)` : `Offset (${activeOff}m)`}</span>
          <input
            type="range"
            min={-activeMaxOff}
            max={activeMaxOff}
            step={0.25}
            value={activeOff}
            onChange={(e) => updateOp(activeOp.id, { wallIndex: activeEdgeIdx, wall: activeEdge.wall, offset: Number(e.target.value) })}
          />
        </label>

        <div className="sp-inline-head">
          <p className="sp-mini-hint">{lang === 'ar' ? 'أو اسحب المقبض فوق الفتحة في 3D' : 'Or drag handle directly in 3D'}</p>
          <button type="button" className="sp-icon-btn is-danger" onClick={() => onUpdate({ openings: openings.filter((o) => o.id !== activeOp.id) })} title={lang === 'ar' ? 'حذف الفتحة' : 'Delete'}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
