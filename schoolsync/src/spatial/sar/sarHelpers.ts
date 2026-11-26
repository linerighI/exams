/**
 * Pure geometry, opening-dimension, prop metadata, and batch-row expansion
 * helpers used by the SAR compiler (zero Three.js imports so tests run cleanly in Node).
 */
import type { CampusProp, WallOpening } from '../../types';
import type { SarAlign, SarOpeningAst, SarRelativeDir, SarRoomAst, SarRowAst } from './sarTypes';

export const CARDINAL_TO_IDX: Record<WallOpening['wall'], number> = { N: 0, E: 1, S: 2, W: 3 };

export const PROP_META: Record<string, { cat: CampusProp['category']; scale: number }> = {
  desk_cluster: { cat: 'furniture', scale: 1 },
  teacher_desk: { cat: 'furniture', scale: 1 },
  whiteboard: { cat: 'furniture', scale: 1 },
  lab_bench: { cat: 'furniture', scale: 1 },
  bookshelf: { cat: 'furniture', scale: 1 },
  conference_table: { cat: 'furniture', scale: 1 },
  auditorium_stage: { cat: 'furniture', scale: 1 },
  lockers: { cat: 'furniture', scale: 1 },
  ac_unit: { cat: 'furniture', scale: 1 },
  tree_round: { cat: 'nature', scale: 1 },
  tree_cypress: { cat: 'nature', scale: 1 },
  planter: { cat: 'nature', scale: 1 },
  bench: { cat: 'nature', scale: 1 },
  fountain: { cat: 'nature', scale: 1 },
  stairs: { cat: 'facilities', scale: 1 },
  flagpole: { cat: 'facilities', scale: 1 },
  basketball_hoop: { cat: 'facilities', scale: 1 },
  pergola: { cat: 'facilities', scale: 1 },
  gate: { cat: 'facilities', scale: 1 },
};

export const round2 = (n: number) => Number(n.toFixed(2));

/** Compute 0.00m flush coordinates relative to an already-placed target room. */
export function computeRelativePos(
  room: { width: number; depth: number },
  target: { x: number; z: number; width: number; depth: number },
  dir: SarRelativeDir,
  gap: number,
  align: SarAlign,
): { x: number; z: number } {
  const alignZ = align === 'start'
    ? target.z - target.depth / 2 + room.depth / 2
    : align === 'end' ? target.z + target.depth / 2 - room.depth / 2 : target.z;
  const alignX = align === 'start'
    ? target.x - target.width / 2 + room.width / 2
    : align === 'end' ? target.x + target.width / 2 - room.width / 2 : target.x;

  if (dir === 'east_of') return { x: round2(target.x + target.width / 2 + room.width / 2 + gap), z: round2(alignZ) };
  if (dir === 'west_of') return { x: round2(target.x - target.width / 2 - room.width / 2 - gap), z: round2(alignZ) };
  if (dir === 'south_of') return { x: round2(alignX), z: round2(target.z + target.depth / 2 + room.depth / 2 + gap) };
  return { x: round2(alignX), z: round2(target.z - target.depth / 2 - room.depth / 2 - gap) };
}

/** Return architectural default dimensions (meters) for each SAR opening type. */
export function defaultOpeningDims(type: WallOpening['type']) {
  if (type === 'double_door') return { width: 2.1, height: 2.35 };
  if (type === 'window') return { width: 1.8, height: 1.3 };
  if (type === 'arch') return { width: 2.2, height: 2.5 };
  return { width: 1.15, height: 2.25 };
}

/** Expand SAR batch `row` statements into deterministic concrete room AST entries. */
export function expandSarRows(rows: SarRowAst[]): SarRoomAst[] {
  const expanded: SarRoomAst[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const openings: SarOpeningAst[] = [];
      if (row.doorWall) openings.push({ line: row.line, type: 'door', wall: row.doorWall, offset: 0 });
      if (row.doubleDoorWall) openings.push({ line: row.line, type: 'double_door', wall: row.doubleDoorWall, offset: 0 });
      if (row.windowWall) {
        const span = row.windowWall === 'E' || row.windowWall === 'W' ? row.depth : row.width;
        openings.push({ line: row.line, type: 'window', wall: row.windowWall, offset: 0, width: round2(Math.min(2.4, Math.max(1.2, span * 0.45))) });
      }
      expanded.push({
        line: row.line,
        id: `${row.idPrefix}${i + 1}`,
        label: `${row.labelPrefix} ${i + 1}`,
        kind: row.kind,
        className: '',
        floorId: row.floorId,
        wingId: row.wingId,
        width: row.width,
        depth: row.depth,
        height: row.height,
        rotationDeg: 0,
        at: { x: round2(row.start.x + row.step.dx * i), z: round2(row.start.z + row.step.dz * i) },
        openings,
        merges: [],
        openEdges: [],
        wallColor: row.wallColor,
        floorColor: row.floorColor,
        assignments3D: [],
      });
    }
  }
  return expanded;
}
