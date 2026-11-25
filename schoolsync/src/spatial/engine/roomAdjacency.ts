/**
 * Architectural shared-wall engine for SARE: detects flush/touching walls between rooms
 * on the same floor, auto-merges adjacent corridors, cuts automatic door/window pass-throughs,
 * manages manual 1-click wall merges, and provides magnetic wall-to-wall snapping.
 */
import type { CampusRoom } from '../../types';
import {
  clampOpeningOffset,
  getOpeningEdgeOffset,
  getRoomEdges,
  resolveOpeningEdgeIndex,
} from './roomPolygon';

export interface WallCutout {
  start: number;
  end: number;
  sillH: number;
  topH: number;
  isFullMerge: boolean;
  bridgeDepth: number;
}

export interface RoomEdgeExtras {
  cutouts: Map<number, WallCutout[]>;
  backedEdges: Set<number>;
}

export interface RoomNeighborLink {
  neighborId: string;
  neighborLabel: string;
  edgeIndex: number;
  neighborEdgeIndex: number;
  autoMerged: boolean;
  isMerged: boolean;
}

interface WorldEdge {
  room: CampusRoom;
  index: number;
  length: number;
  mx: number;
  mz: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
}

function toWorldEdges(room: CampusRoom): WorldEdge[] {
  const rot = room.rotationY || 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return getRoomEdges(room).map((e) => ({
    room,
    index: e.index,
    length: e.length,
    mx: room.x + e.mx * cos + e.mz * sin,
    mz: room.z - e.mx * sin + e.mz * cos,
    ux: e.ux * cos + e.uz * sin,
    uz: -e.ux * sin + e.uz * cos,
    nx: e.nx * cos + e.nz * sin,
    nz: -e.nx * sin + e.nz * cos,
  }));
}

function matchOpposingEdge(ea: WorldEdge, eb: WorldEdge) {
  if (ea.ux * eb.ux + ea.uz * eb.uz > -0.95) return null;
  if (ea.nx * eb.nx + ea.nz * eb.nz > -0.95) return null;
  const dx = eb.mx - ea.mx;
  const dz = eb.mz - ea.mz;
  const perpDist = dx * -ea.nx + dz * -ea.nz;
  if (perpDist < -0.35 || perpDist > 0.45) return null;
  const along = dx * ea.ux + dz * ea.uz;
  const s0 = Math.max(-ea.length / 2, along - eb.length / 2);
  const s1 = Math.min(ea.length / 2, along + eb.length / 2);
  if (s1 - s0 < 0.45) return null;
  return { perpDist, s0, s1 };
}

/** Compute shared-wall cutouts, auto-merged corridors, and neighbor links for one floor. */
export function computeFloorAdjacency(floorRooms: CampusRoom[]) {
  const extrasByRoom = new Map<string, RoomEdgeExtras>();
  const neighborsByRoom = new Map<string, RoomNeighborLink[]>();
  const edgeLists = floorRooms.map((r) => ({ room: r, edges: toWorldEdges(r) }));

  for (const r of floorRooms) {
    extrasByRoom.set(r.id, { cutouts: new Map(), backedEdges: new Set() });
    neighborsByRoom.set(r.id, []);
  }

  const pushCutout = (roomId: string, edgeIndex: number, c: WallCutout) => {
    const ext = extrasByRoom.get(roomId)!;
    const list = ext.cutouts.get(edgeIndex) || [];
    list.push(c);
    ext.cutouts.set(edgeIndex, list);
  };

  for (let i = 0; i < edgeLists.length; i++) {
    for (let j = i + 1; j < edgeLists.length; j++) {
      const a = edgeLists[i];
      const b = edgeLists[j];
      for (const ea of a.edges) {
        for (const eb of b.edges) {
          const hit = matchOpposingEdge(ea, eb);
          if (!hit) continue;

          const autoMerged =
            (a.room.kind === 'corridor' && b.room.kind === 'corridor') ||
            (a.room.kind === 'courtyard' && b.room.kind === 'courtyard');
          const isMerged =
            autoMerged ||
            Boolean(a.room.openEdges?.includes(ea.index)) ||
            Boolean(b.room.openEdges?.includes(eb.index));

          neighborsByRoom.get(a.room.id)!.push({
            neighborId: b.room.id,
            neighborLabel: b.room.label || b.room.className || b.room.id,
            edgeIndex: ea.index,
            neighborEdgeIndex: eb.index,
            autoMerged,
            isMerged,
          });

          const revHit = matchOpposingEdge(eb, ea);
          if (!revHit) continue;
          neighborsByRoom.get(b.room.id)!.push({
            neighborId: a.room.id,
            neighborLabel: a.room.label || a.room.className || a.room.id,
            edgeIndex: eb.index,
            neighborEdgeIndex: ea.index,
            autoMerged,
            isMerged,
          });

          if (isMerged) {
            const bridge = Math.max(0, Number(hit.perpDist.toFixed(2)));
            pushCutout(a.room.id, ea.index, {
              start: hit.s0, end: hit.s1, sillH: 0, topH: Infinity, isFullMerge: true, bridgeDepth: bridge,
            });
            pushCutout(b.room.id, eb.index, {
              start: revHit.s0, end: revHit.s1, sillH: 0, topH: Infinity, isFullMerge: true, bridgeDepth: 0,
            });
            continue;
          }

          extrasByRoom.get(a.room.id)!.backedEdges.add(ea.index);
          extrasByRoom.get(b.room.id)!.backedEdges.add(eb.index);

          const projectOpenings = (srcRoom: CampusRoom, srcEdge: WorldEdge, srcEdgeCount: number, dstRoom: CampusRoom, dstEdge: WorldEdge, spanStart: number, spanEnd: number) => {
            const srcH = Math.max(0.5, srcRoom.wallHeight || 3.2);
            for (const op of srcRoom.openings || []) {
              if (resolveOpeningEdgeIndex(op, srcEdgeCount) !== srcEdge.index || op.type === 'arch') continue;
              const off = clampOpeningOffset(getOpeningEdgeOffset(op), srcEdge.length, op.width);
              const wx = srcEdge.mx + srcEdge.ux * off;
              const wz = srcEdge.mz + srcEdge.uz * off;
              const alongDst = (wx - dstEdge.mx) * dstEdge.ux + (wz - dstEdge.mz) * dstEdge.uz;
              const half = Math.min(srcEdge.length - 0.3, op.width) / 2;
              const start = Math.max(spanStart, alongDst - half);
              const end = Math.min(spanEnd, alongDst + half);
              if (end - start < 0.25) continue;
              const sillH = op.type === 'window' ? Math.min(0.95, srcH * 0.32) : 0;
              const topH = Math.min(srcH - 0.15, sillH + op.height);
              pushCutout(dstRoom.id, dstEdge.index, { start, end, sillH, topH, isFullMerge: false, bridgeDepth: 0 });
            }
          };

          projectOpenings(b.room, eb, b.edges.length, a.room, ea, hit.s0, hit.s1);
          projectOpenings(a.room, ea, a.edges.length, b.room, eb, revHit.s0, revHit.s1);
        }
      }
    }
  }

  return { extrasByRoom, neighborsByRoom };
}

/** Find all touching adjacent neighbor rooms for a single room on the same floor. */
export function findRoomNeighbors(room: CampusRoom, floorRooms: CampusRoom[]): RoomNeighborLink[] {
  const peers = floorRooms.filter((r) => r.floorId === room.floorId);
  return computeFloorAdjacency(peers).neighborsByRoom.get(room.id) || [];
}

/** Magnetically snap a room translation flush against nearby opposing neighbor walls. */
export function snapRoomTranslationToNeighbors(
  room: CampusRoom,
  floorRooms: CampusRoom[],
  threshold = 0.42,
): { x: number; z: number } {
  const peers = floorRooms.filter((r) => r.id !== room.id && r.floorId === room.floorId);
  if (!peers.length) return { x: room.x, z: room.z };

  const myEdges = toWorldEdges(room);
  let snapDx: number | null = null;
  let snapDz: number | null = null;
  let bestAbsX = threshold + 0.01;
  let bestAbsZ = threshold + 0.01;
  let bestAny: { dx: number; dz: number; dist: number } | null = null;

  for (const ea of myEdges) {
    for (const p of peers) {
      for (const eb of toWorldEdges(p)) {
        if (ea.ux * eb.ux + ea.uz * eb.uz > -0.95) continue;
        if (ea.nx * eb.nx + ea.nz * eb.nz > -0.95) continue;
        const dx = eb.mx - ea.mx;
        const dz = eb.mz - ea.mz;
        const along = dx * ea.ux + dz * ea.uz;
        const s0 = Math.max(-ea.length / 2, along - eb.length / 2);
        const s1 = Math.min(ea.length / 2, along + eb.length / 2);
        if (s1 - s0 < 0.45) continue;

        const perp = dx * -ea.nx + dz * -ea.nz;
        if (Math.abs(perp) > threshold) continue;
        const moveX = -ea.nx * perp;
        const moveZ = -ea.nz * perp;
        if (Math.abs(-ea.nx) > 0.7 && Math.abs(perp) < bestAbsX) {
          bestAbsX = Math.abs(perp);
          snapDx = moveX;
        } else if (Math.abs(-ea.nz) > 0.7 && Math.abs(perp) < bestAbsZ) {
          bestAbsZ = Math.abs(perp);
          snapDz = moveZ;
        } else if (!bestAny || Math.abs(perp) < bestAny.dist) {
          bestAny = { dx: moveX, dz: moveZ, dist: Math.abs(perp) };
        }
      }
    }
  }

  if (snapDx !== null || snapDz !== null) {
    return {
      x: Number((room.x + (snapDx || 0)).toFixed(2)),
      z: Number((room.z + (snapDz || 0)).toFixed(2)),
    };
  }
  if (bestAny) {
    return {
      x: Number((room.x + bestAny.dx).toFixed(2)),
      z: Number((room.z + bestAny.dz).toFixed(2)),
    };
  }
  return { x: room.x, z: room.z };
}
