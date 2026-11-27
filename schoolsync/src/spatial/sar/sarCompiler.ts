/**
 * Deterministic SAR -> CampusLayout compiler: resolves relative flush coordinates
 * (east_of/west_of/north_of/south_of), expands wing rows, recenters custom polygons,
 * clamps wall openings, resolves shared-wall merges, and anchors 3D props cleanly.
 */
import type { Language } from '../../i18n';
import type { CampusFloor, CampusLayout, CampusProp, CampusRoom, CampusWing, WallOpening } from '../../types';
import { DEFAULT_WING_COLORS } from '../engine/campusSchema';
import { computeFloorAdjacency } from '../engine/roomAdjacency';
import { clampOpeningOffset, getRoomEdges, recenterRoomPolygon, resolveOpeningEdgeIndex } from '../engine/roomPolygon';
import { CARDINAL_TO_IDX, PROP_META, computeRelativePos, defaultOpeningDims, expandSarRows, round2 } from './sarHelpers';
import { parseSar } from './sarParser';
import type { SarCompileResult, SarRoomAst } from './sarTypes';

/** Compile a SAR source program into a validated CampusLayout + diagnostics report. */
export function compileSarToLayout(source: string, lang: Language = 'ar'): SarCompileResult {
  const ast = parseSar(source);
  const diagnostics = [...ast.diagnostics];

  // 1. Build floors
  const floors: CampusFloor[] = [];
  let runningElev = 0;
  const floorSource = ast.floors.length ? ast.floors : [{ line: 1, id: 'floor-1', label: lang === 'ar' ? 'الطابق الأول' : 'Floor 1' }];
  floorSource.forEach((f, idx) => {
    const ch = Math.max(2.4, f.ceilingHeight ?? 3.4);
    const elev = f.elevationY ?? runningElev;
    floors.push({ id: f.id, index: idx + 1, labelAr: f.label, labelEn: f.label, elevationY: round2(elev), ceilingHeight: round2(ch) });
    runningElev = elev + ch;
  });
  const floorMap = new Map(floors.map((f) => [f.id, f]));

  // 2. Expand row generators + explicit rooms and ensure referenced floors exist
  const roomAsts: SarRoomAst[] = [...ast.rooms, ...expandSarRows(ast.rows)];
  for (const r of roomAsts) {
    if (!floorMap.has(r.floorId)) {
      const fl: CampusFloor = { id: r.floorId, index: floors.length + 1, labelAr: r.floorId, labelEn: r.floorId, elevationY: round2(runningElev), ceilingHeight: 3.4 };
      floors.push(fl);
      floorMap.set(fl.id, fl);
      runningElev += 3.4;
    }
  }

  // 3. Resolve absolute & relative room positions topologically
  const resolvedDims = new Map<string, { x: number; z: number; width: number; depth: number }>();
  const pendingRel = new Set<string>();

  for (const r of roomAsts) {
    if (!r.relative) {
      let x = r.at?.x ?? 0, z = r.at?.z ?? 0, width = r.width, depth = r.depth;
      if (r.points && r.points.length >= 3) {
        const rec = recenterRoomPolygon({ x, z, rotationY: (r.rotationDeg * Math.PI) / 180, assignments3D: r.assignments3D }, r.points);
        x = rec.x ?? x; z = rec.z ?? z; width = rec.width ?? width; depth = rec.depth ?? depth;
      }
      resolvedDims.set(r.id, { x, z, width, depth });
    } else {
      pendingRel.add(r.id);
    }
  }

  for (let pass = 0; pass <= roomAsts.length && pendingRel.size > 0; pass++) {
    let progressed = false;
    for (const r of roomAsts) {
      if (!pendingRel.has(r.id) || !r.relative) continue;
      const target = resolvedDims.get(r.relative.targetId);
      if (!target) continue;
      const pos = computeRelativePos({ width: r.width, depth: r.depth }, target, r.relative.dir, r.relative.gap, r.relative.align);
      resolvedDims.set(r.id, { x: pos.x, z: pos.z, width: r.width, depth: r.depth });
      pendingRel.delete(r.id);
      progressed = true;
    }
    if (!progressed) break;
  }

  for (const id of pendingRel) {
    const r = roomAsts.find((item) => item.id === id);
    if (r) {
      diagnostics.push({ line: r.line, severity: 'error', message: `Unresolved relative target '${r.relative?.targetId}' for room '${r.id}'` });
      resolvedDims.set(r.id, { x: 0, z: 0, width: r.width, depth: r.depth });
    }
  }

  // 4. Construct CampusRoom objects with recentered shapes & clamped openings
  let totalOpenings = 0;
  const rooms: CampusRoom[] = roomAsts.map((r) => {
    const fl = floorMap.get(r.floorId) || floors[0];
    const dims = resolvedDims.get(r.id) || { x: 0, z: 0, width: r.width, depth: r.depth };
    const rotationY = Number(((r.rotationDeg * Math.PI) / 180).toFixed(4));
    let x = dims.x, z = dims.z, width = r.width, depth = r.depth;
    let points = r.points;
    if (r.points && r.points.length >= 3) {
      const rec = recenterRoomPolygon({ x: r.relative ? dims.x : (r.at?.x ?? 0), z: r.relative ? dims.z : (r.at?.z ?? 0), rotationY, assignments3D: r.assignments3D }, r.points);
      x = rec.x ?? x; z = rec.z ?? z; width = rec.width ?? width; depth = rec.depth ?? depth; points = rec.points;
    }

    const edges = getRoomEdges({ width, depth, points });
    const openings: WallOpening[] = r.openings.map((op, oi) => {
      const def = defaultOpeningDims(op.type);
      const w = round2(op.width ?? def.width);
      const h = round2(op.height ?? def.height);
      const edgeIdx = resolveOpeningEdgeIndex({ id: '', wall: op.wall, wallIndex: op.wallIndex, offset: op.offset, width: w, height: h, type: op.type }, edges.length);
      const edgeLen = edges[edgeIdx]?.length || width;
      totalOpenings++;
      return {
        id: `${r.id}-op-${oi + 1}`,
        wall: op.wall,
        ...(typeof op.wallIndex === 'number' ? { wallIndex: op.wallIndex } : {}),
        offset: clampOpeningOffset(op.offset, edgeLen, w),
        width: w,
        height: h,
        type: op.type,
      };
    });

    const openEdgeSet = new Set<number>();
    for (const oe of r.openEdges) {
      openEdgeSet.add(typeof oe.wallIndex === 'number' ? oe.wallIndex : CARDINAL_TO_IDX[oe.wall || 'E']);
    }

    return {
      id: r.id,
      floorId: r.floorId,
      wingId: r.wingId,
      kind: r.kind,
      label: r.label,
      className: r.className,
      x,
      z,
      width,
      depth,
      ...(points ? { points } : {}),
      rotationY,
      wallHeight: round2(r.height ?? (r.kind === 'courtyard' ? 0.35 : fl.ceilingHeight - 0.2)),
      wallThickness: round2(r.thickness ?? 0.2),
      ...(r.wallColor ? { wallColor: r.wallColor } : {}),
      ...(r.floorColor ? { floorColor: r.floorColor } : {}),
      ...(r.roomState ? { roomState: r.roomState } : {}),
      ...(r.stateNote ? { stateNote: r.stateNote } : {}),
      ...(openEdgeSet.size ? { openEdges: [...openEdgeSet] } : {}),
      openings,
      assignments3D: r.assignments3D,
    };
  });

  // 5. Resolve `merge <targetId>` directives into exact shared wall edge indices per floor
  const astById = new Map(roomAsts.map((r) => [r.id, r]));
  for (const fl of floors) {
    const flRooms = rooms.filter((r) => r.floorId === fl.id);
    const { neighborsByRoom } = computeFloorAdjacency(flRooms);
    for (const rm of flRooms) {
      const srcAst = astById.get(rm.id);
      if (!srcAst?.merges.length) continue;
      const links = neighborsByRoom.get(rm.id) || [];
      const set = new Set(rm.openEdges || []);
      for (const mg of srcAst.merges) {
        const hit = links.find((l) => l.neighborId === mg.targetId);
        if (hit) set.add(hit.edgeIndex);
        else diagnostics.push({ line: mg.line, severity: 'warning', message: `Room '${rm.id}' cannot merge with '${mg.targetId}' (not flush/touching)` });
      }
      if (set.size) rm.openEdges = [...set];
    }
  }

  // 6. Build wings dynamically including any wingIds used by rooms
  const wingMap = new Map<string, CampusWing>();
  for (const w of ast.wings) {
    wingMap.set(w.id, { id: w.id, labelAr: w.label, labelEn: w.label, color: w.color, floorIds: [] });
  }
  for (const r of rooms) {
    if (!wingMap.has(r.wingId)) {
      const color = DEFAULT_WING_COLORS[wingMap.size % DEFAULT_WING_COLORS.length];
      wingMap.set(r.wingId, { id: r.wingId, labelAr: r.wingId === 'main' ? (lang === 'ar' ? 'الجناح الرئيسي' : 'Main Wing') : r.wingId, labelEn: r.wingId, color, floorIds: [] });
    }
    const wg = wingMap.get(r.wingId)!;
    if (!wg.floorIds.includes(r.floorId)) wg.floorIds.push(r.floorId);
  }
  const wings = [...wingMap.values()];
  if (!wings.length) wings.push({ id: 'main', labelAr: lang === 'ar' ? 'الجناح الرئيسي' : 'Main Wing', labelEn: 'Main Wing', color: '#007aff', floorIds: floors.map((f) => f.id) });

  // 7. Compile props anchored either `at (x,z)` or `in <roomId>`
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const props: CampusProp[] = ast.props.map((p, idx) => {
    const meta = PROP_META[p.prefabId] || { cat: 'furniture' as const, scale: 1 };
    let x = p.at?.x ?? 0, z = p.at?.z ?? 0, floorId = p.floorId, roomId: string | undefined;
    if (p.inRoomId) {
      const target = roomMap.get(p.inRoomId);
      if (target) {
        roomId = target.id; floorId = target.floorId;
        x = round2(target.x + p.offset.dx); z = round2(target.z + p.offset.dz);
      } else {
        diagnostics.push({ line: p.line, severity: 'warning', message: `Prop references unknown room '${p.inRoomId}'` });
      }
    }
    const fl = floorMap.get(floorId) || floors[0];
    return {
      id: `sar-prop-${idx + 1}`,
      floorId: fl.id,
      ...(roomId ? { roomId } : {}),
      prefabId: p.prefabId,
      category: p.modelUrl ? 'external' : meta.cat,
      x: round2(x),
      y: fl.elevationY,
      z: round2(z),
      rotationY: Number(Math.atan2(Math.sin((p.rotationDeg * Math.PI) / 180), Math.cos((p.rotationDeg * Math.PI) / 180)).toFixed(4)) || 0,
      scale: round2(p.scale ?? meta.scale),
      ...(p.scale3 ? { scaleX: round2(p.scale3.x), scaleY: round2(p.scale3.y), scaleZ: round2(p.scale3.z) } : {}),
      ...(p.colorTint ? { colorTint: p.colorTint } : {}),
      ...(p.modelUrl ? { modelUrl: p.modelUrl } : {}),
    };
  });

  const layout: CampusLayout = { meta: { version: 1, gridSize: ast.gridSize, unit: 'm', theme: ast.theme }, floors, wings, rooms, props };
  return {
    layout,
    diagnostics,
    stats: { floors: floors.length, wings: wings.length, rooms: rooms.length, props: props.length, openings: totalOpenings },
  };
}
