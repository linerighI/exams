/**
 * Shared 2D XZ polygon geometry helpers for SARE custom-shaped rooms and walls:
 * supports clockwise/arbitrary polygon corners, inward wall normals, edge projections,
 * legacy N/E/S/W opening mapping, and clean vertex insertion for multi-corner shapes.
 */
import type { CampusRoom, RoomPoint, WallOpening } from '../../types';

export interface RoomEdge {
  index: number;
  wall: WallOpening['wall'];
  a: RoomPoint;
  b: RoomPoint;
  mx: number;
  mz: number;
  length: number;
  rotY: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
}

const LEGACY_EDGE_BY_WALL: Record<WallOpening['wall'], number> = { N: 0, E: 1, S: 2, W: 3 };
const WALL_BY_INDEX: WallOpening['wall'][] = ['N', 'E', 'S', 'W'];

/** Return room corner polygon in local XZ coordinates (falls back to 4 rectangle corners). */
export function getRoomPoints(room: Pick<CampusRoom, 'width' | 'depth' | 'points'>): RoomPoint[] {
  if (room.points && room.points.length >= 3) {
    return room.points.map((p) => ({ x: p.x, z: p.z }));
  }
  const hw = room.width / 2;
  const hd = room.depth / 2;
  return [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
}

/** Twice signed shoelace area in XZ screen-like coordinates (+X right, +Z south). */
export function signedAreaXZ(pts: RoomPoint[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum * 0.5;
}

/** Compute bounding box and dimensions of a local XZ corner polygon. */
export function computePointsBounds(pts: RoomPoint[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const width = Math.max(1.5, Number((maxX - minX).toFixed(2)));
  const depth = Math.max(1.5, Number((maxZ - minZ).toFixed(2)));
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

/** Build ordered wall segments with exact Three.js Y rotation and inward wall normals. */
export function getRoomEdges(room: Pick<CampusRoom, 'width' | 'depth' | 'points'>): RoomEdge[] {
  const pts = getRoomPoints(room);
  const area = signedAreaXZ(pts);
  const sign = area >= 0 ? 1 : -1;
  return pts.map((a, index) => {
    const b = pts[(index + 1) % pts.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const ux = dx / length;
    const uz = dz / length;
    const nx = -uz * sign;
    const nz = ux * sign;
    const rotY = Math.atan2(-dz, dx);
    return {
      index,
      wall: WALL_BY_INDEX[index % 4],
      a,
      b,
      mx: (a.x + b.x) / 2,
      mz: (a.z + b.z) / 2,
      length,
      rotY,
      ux,
      uz,
      nx,
      nz,
    };
  });
}

/** Resolve which polygon edge index owns a given door/window opening. */
export function resolveOpeningEdgeIndex(op: WallOpening, edgeCount: number): number {
  if (typeof op.wallIndex === 'number' && op.wallIndex >= 0 && op.wallIndex < edgeCount) {
    return op.wallIndex;
  }
  const mapped = LEGACY_EDGE_BY_WALL[op.wall] ?? 0;
  return Math.min(mapped, Math.max(0, edgeCount - 1));
}

/** Convert legacy N/E/S/W opening offsets so S/E keep identical world coordinates. */
export function getOpeningEdgeOffset(op: WallOpening): number {
  if (typeof op.wallIndex === 'number') return op.offset;
  return op.wall === 'S' || op.wall === 'E' ? -op.offset : op.offset;
}

/** Clamp an opening's along-wall offset so frames never spill past corners. */
export function clampOpeningOffset(offset: number, edgeLength: number, openingWidth: number): number {
  const maxHalf = Math.max(0.05, edgeLength / 2 - Math.min(edgeLength - 0.3, openingWidth) / 2 - 0.14);
  return Number(Math.max(-maxHalf, Math.min(maxHalf, offset)).toFixed(2));
}

/** Project a room-local XZ point onto the closest wall segment and return offset & metadata. */
export function nearestEdgeProjection(room: Pick<CampusRoom, 'width' | 'depth' | 'points'>, localX: number, localZ: number) {
  const edges = getRoomEdges(room);
  let best = edges[0];
  let bestDist = Infinity;
  let bestOffset = 0;

  for (const e of edges) {
    const px = localX - e.mx;
    const pz = localZ - e.mz;
    const rawAlong = px * e.ux + pz * e.uz;
    const half = Math.max(0.1, e.length / 2 - 0.25);
    const clampedAlong = Math.max(-half, Math.min(half, rawAlong));
    const cx = e.mx + e.ux * clampedAlong;
    const cz = e.mz + e.uz * clampedAlong;
    const dist = Math.hypot(localX - cx, localZ - cz);
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
      bestOffset = Number(rawAlong.toFixed(2));
    }
  }

  return { edgeIndex: best.index, wall: best.wall, offset: bestOffset, dist: bestDist, edge: best };
}

/** Split the longest edge at its midpoint so the user can sculpt multi-corner custom shapes. */
export function insertCornerOnLongestEdge(room: Pick<CampusRoom, 'width' | 'depth' | 'points'>): RoomPoint[] {
  const pts = getRoomPoints(room);
  const edges = getRoomEdges(room);
  let maxLen = -1;
  let splitIdx = 0;
  for (const e of edges) {
    if (e.length > maxLen) {
      maxLen = e.length;
      splitIdx = e.index;
    }
  }
  const edge = edges[splitIdx];
  const next = [...pts];
  next.splice(splitIdx + 1, 0, {
    x: Number(edge.mx.toFixed(2)),
    z: Number(edge.mz.toFixed(2)),
  });
  return next;
}

/** Recenter local polygon vertices around their bounding center without moving walls in world space. */
export function recenterRoomPolygon(
  room: Pick<CampusRoom, 'x' | 'z' | 'rotationY' | 'assignments3D'>,
  nextPts: RoomPoint[],
): Partial<CampusRoom> {
  const b = computePointsBounds(nextPts);
  const cx = Number(b.centerX.toFixed(2));
  const cz = Number(b.centerZ.toFixed(2));
  const rot = room.rotationY || 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const newX = Number((room.x + cx * cos + cz * sin).toFixed(2));
  const newZ = Number((room.z - cx * sin + cz * cos).toFixed(2));
  const shiftedPts = nextPts.map((p) => ({
    x: Number((p.x - cx).toFixed(2)),
    z: Number((p.z - cz).toFixed(2)),
  }));
  const shiftedAssign = (room.assignments3D || []).map((a) => ({
    ...a,
    offsetX: Number(((a.offsetX || 0) - cx).toFixed(2)),
    offsetZ: Number(((a.offsetZ || 0) - cz).toFixed(2)),
  }));
  return {
    x: newX,
    z: newZ,
    width: b.width,
    depth: b.depth,
    points: shiftedPts,
    assignments3D: shiftedAssign,
  };
}
