/**
 * Procedural untextured SARE room builder: extrudes custom polygon or rectangular slabs & walls,
 * framed single/double doors and glass windows (with automatic shared-wall pass-through cutouts
 * and seamless merged corridor/room bridges), corner posts, assignment pins, and 3D room states.
 */
import * as THREE from 'three';
import type { CampusRoom, RoomPoint, RoomStateKind, WallOpening } from '../../types';
import { buildAssignmentPinMesh } from './propLibrary';
import type { RoomEdgeExtras, WallCutout } from './roomAdjacency';
import {
  clampOpeningOffset,
  getOpeningEdgeOffset,
  getRoomEdges,
  getRoomPoints,
  resolveOpeningEdgeIndex,
  signedAreaXZ,
} from './roomPolygon';

export interface BuiltRoomVisual {
  roomId: string;
  floorId: string;
  wingId: string;
  group: THREE.Group;
  roofMesh: THREE.Mesh;
  materials: THREE.Material[];
  lines: THREE.LineBasicMaterial[];
  assignmentMeshes: THREE.Object3D[];
}

const STATE_COLOR_HEX: Record<Exclude<RoomStateKind, 'normal'>, number> = {
  highlight: 0x007aff,
  note: 0xff9500,
  alert: 0xff3b30,
  maintenance: 0x6366f1,
};

function buildPolygonShape(pts: RoomPoint[]): THREE.Shape {
  const ordered = signedAreaXZ(pts) >= 0 ? pts : [...pts].reverse();
  const shape = new THREE.Shape();
  shape.moveTo(ordered[0].x, -ordered[0].z);
  for (let i = 1; i < ordered.length; i++) {
    shape.lineTo(ordered[i].x, -ordered[i].z);
  }
  shape.closePath();
  return shape;
}

function addWallBox(
  parent: THREE.Group, w: number, h: number, t: number, cx: number, cy: number, cz: number,
  mat: THREE.Material, lineMat: THREE.LineBasicMaterial | null, castShadow = true,
) {
  if (w < 0.02 || h < 0.02) return;
  const geo = new THREE.BoxGeometry(w, h, t);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, cy, cz);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (lineMat) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), lineMat);
    edges.renderOrder = 2;
    mesh.add(edges);
  }
  parent.add(mesh);
}

function addFramedOpening(
  run: THREE.Group, roomId: string, op: WallOpening, cx: number, opW: number,
  sillH: number, topH: number, thickness: number, isBacked: boolean,
  glassMat: THREE.Material, frameMat: THREE.Material,
) {
  const paneH = Math.max(0.2, topH - sillH);
  const fT = thickness + (isBacked ? 0.08 : 0.035);
  const opGroup = new THREE.Group();
  opGroup.userData = { editorEntity: { type: 'room', id: roomId }, roomId, openingId: op.id };
  run.add(opGroup);

  addWallBox(opGroup, 0.055, paneH, fT, cx - opW / 2 + 0.027, sillH + paneH / 2, 0, frameMat, null);
  addWallBox(opGroup, 0.055, paneH, fT, cx + opW / 2 - 0.027, sillH + paneH / 2, 0, frameMat, null);
  addWallBox(opGroup, opW, 0.055, fT, cx, topH - 0.027, 0, frameMat, null);

  if (op.type === 'arch') return;
  const innerW = Math.max(0.2, opW - 0.11);
  const glassT = Math.max(0.04, thickness * 0.24);

  if (op.type === 'double_door') {
    const leafW = innerW / 2 - 0.02;
    addWallBox(opGroup, 0.04, paneH - 0.05, fT, cx, sillH + paneH / 2, 0, frameMat, null);
    addWallBox(opGroup, leafW, paneH - 0.05, glassT, cx - innerW / 4 - 0.01, sillH + paneH / 2, 0, glassMat, null, false);
    addWallBox(opGroup, leafW, paneH - 0.05, glassT, cx + innerW / 4 + 0.01, sillH + paneH / 2, 0, glassMat, null, false);
    addWallBox(opGroup, 0.03, 0.34, glassT + 0.05, cx - 0.1, sillH + 1.05, 0, frameMat, null, false);
    addWallBox(opGroup, 0.03, 0.34, glassT + 0.05, cx + 0.1, sillH + 1.05, 0, frameMat, null, false);
  } else if (op.type === 'door') {
    addWallBox(opGroup, innerW, paneH - 0.05, glassT, cx, sillH + paneH / 2, 0, glassMat, null, false);
    addWallBox(opGroup, 0.03, 0.3, glassT + 0.05, cx + innerW * 0.36, sillH + 1.05, 0, frameMat, null, false);
  } else {
    addWallBox(opGroup, innerW, paneH - 0.06, glassT, cx, sillH + paneH / 2, 0, glassMat, null, false);
    addWallBox(opGroup, 0.035, paneH - 0.06, fT * 0.85, cx, sillH + paneH / 2, 0, frameMat, null, false);
    addWallBox(opGroup, opW + 0.08, 0.055, thickness + 0.08, cx, sillH, 0, frameMat, null);
  }
}

interface WallGapItem {
  start: number;
  end: number;
  sillH: number;
  topH: number;
  op: WallOpening | null;
  cutout: WallCutout | null;
}

function buildWallRun(
  roomId: string, span: number, wallHeight: number, thickness: number,
  openings: WallOpening[], cutouts: WallCutout[], isBacked: boolean,
  wallMat: THREE.Material, floorMat: THREE.Material, glassMat: THREE.Material, frameMat: THREE.Material, lineMat: THREE.LineBasicMaterial,
): THREE.Group {
  const run = new THREE.Group();
  const fullMerge = cutouts.some((c) => c.isFullMerge);
  const items: WallGapItem[] = cutouts.map((c) => ({ start: c.start, end: c.end, sillH: c.sillH, topH: c.topH, op: null, cutout: c }));

  if (!fullMerge) {
    for (const o of openings) {
      const clamped = clampOpeningOffset(getOpeningEdgeOffset(o), span, o.width);
      const half = Math.min(span - 0.3, o.width) / 2;
      const sillH = o.type === 'window' ? Math.min(0.95, wallHeight * 0.32) : 0;
      const topH = Math.min(wallHeight - 0.15, sillH + o.height);
      items.push({ start: clamped - half, end: clamped + half, sillH, topH, op: o, cutout: null });
    }
  }
  items.sort((a, b) => a.start - b.start || (a.op ? -1 : 1));

  let cursor = -span / 2;
  for (const item of items) {
    const effStart = Math.max(cursor, item.start);
    if (item.start > cursor + 0.04) {
      const segW = item.start - cursor;
      addWallBox(run, segW, wallHeight, thickness, cursor + segW / 2, wallHeight / 2, 0, wallMat, lineMat);
    }
    if (item.end > effStart + 0.04) {
      const gapW = item.end - effStart;
      const cx = effStart + gapW / 2;
      if (item.cutout?.isFullMerge) {
        if (item.cutout.bridgeDepth > 0.01) {
          addWallBox(run, gapW, 0.14, item.cutout.bridgeDepth + 0.04, cx, 0.07, -thickness / 2 - item.cutout.bridgeDepth / 2, floorMat, null, false);
        }
      } else {
        if (item.sillH > 0.05) addWallBox(run, gapW, item.sillH, thickness, cx, item.sillH / 2, 0, wallMat, lineMat);
        if (wallHeight - item.topH > 0.05) {
          const lH = wallHeight - item.topH;
          addWallBox(run, gapW, lH, thickness, cx, item.topH + lH / 2, 0, wallMat, lineMat);
        }
        if (item.op) {
          addFramedOpening(run, roomId, item.op, cx, gapW, item.sillH, item.topH, thickness, isBacked, glassMat, frameMat);
        }
      }
      cursor = Math.max(cursor, item.end);
    }
  }
  if (span / 2 > cursor + 0.04) {
    const tailW = span / 2 - cursor;
    addWallBox(run, tailW, wallHeight, thickness, cursor + tailW / 2, wallHeight / 2, 0, wallMat, lineMat);
  }
  return run;
}

function addRoomStateOverlay(group: THREE.Group, room: CampusRoom, wallH: number, materials: THREE.Material[]) {
  const st = room.roomState;
  if (!st || st === 'normal') return;
  const col = STATE_COLOR_HEX[st] || 0x007aff;
  const rimMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.72 });
  const washMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide });
  materials.push(rimMat, washMat);

  const pts = getRoomPoints(room);
  const edges = getRoomEdges(room);
  for (const e of edges) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, e.length - 0.16), 0.025, 0.14), rimMat);
    m.position.set(e.mx + e.nx * 0.14, 0.15, e.mz + e.nz * 0.14);
    m.rotation.y = e.rotY;
    group.add(m);
  }

  const wash = new THREE.Mesh(new THREE.ShapeGeometry(buildPolygonShape(pts)), washMat);
  wash.rotation.x = -Math.PI / 2;
  wash.position.y = 0.145;
  group.add(wash);

  if (st !== 'highlight') {
    const badgeMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.3 });
    materials.push(badgeMat);
    const e0 = edges[0];
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), badgeMat);
    diamond.position.set(pts[0].x + e0.ux * 0.35 + e0.nx * 0.35, wallH + 0.4, pts[0].z + e0.uz * 0.35 + e0.nz * 0.35);
    group.add(diamond);
  }
}

/** Build an untextured SARE procedural 3D room with shared-wall merges & automatic cutouts. */
export function buildRoomVisual(room: CampusRoom, elevationY: number, extras?: RoomEdgeExtras): BuiltRoomVisual {
  const group = new THREE.Group();
  group.position.set(room.x, elevationY, room.z);
  group.rotation.y = room.rotationY || 0;
  group.userData = { editorEntity: { type: 'room', id: room.id }, roomId: room.id };

  const defaultFloor = room.kind === 'courtyard' ? 0xeaf1fa : room.kind === 'corridor' ? 0xeef3f9 : 0xf6f8fc;
  const floorMat = new THREE.MeshStandardMaterial({ color: room.floorColor || defaultFloor, roughness: 0.54, metalness: 0.01, transparent: true, opacity: 1 });
  const wallMat = new THREE.MeshStandardMaterial({ color: room.wallColor || 0xffffff, roughness: 0.48, metalness: 0.02, transparent: true, opacity: 1 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, roughness: 0.18, metalness: 0.04, clearcoat: 0.65, transparent: true, opacity: 0.58 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.34, metalness: 0.45, transparent: true, opacity: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.02, transparent: true, opacity: 1 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.28 });
  const materials: THREE.Material[] = [floorMat, wallMat, glassMat, frameMat, roofMat];
  const lines: THREE.LineBasicMaterial[] = [lineMat];

  const polyShape = buildPolygonShape(getRoomPoints(room));
  const slabGeo = new THREE.ExtrudeGeometry(polyShape, { depth: 0.14, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, floorMat);
  slab.receiveShadow = true;
  slab.userData = { editorEntity: { type: 'room', id: room.id }, roomId: room.id };
  slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo, 28), lineMat));
  group.add(slab);

  const wallH = Math.max(0.25, room.wallHeight || 3.2);
  const wallT = Math.max(0.08, room.wallThickness || 0.2);
  const edges = getRoomEdges(room);
  const allOpenings = room.openings || [];

  for (const edge of edges) {
    const edgeOpenings = allOpenings.filter((o) => resolveOpeningEdgeIndex(o, edges.length) === edge.index);
    const edgeCutouts = extras?.cutouts.get(edge.index) || [];
    const run = buildWallRun(
      room.id, edge.length, wallH, wallT, edgeOpenings, edgeCutouts,
      Boolean(extras?.backedEdges.has(edge.index)), wallMat, floorMat, glassMat, frameMat, lineMat,
    );
    run.position.set(edge.mx + edge.nx * (wallT / 2), 0, edge.mz + edge.nz * (wallT / 2));
    run.rotation.y = edge.rotY;
    group.add(run);

    const prev = edges[(edge.index - 1 + edges.length) % edges.length];
    const skipPost =
      edgeCutouts.some((c) => c.isFullMerge && c.start <= -edge.length / 2 + 0.28) ||
      (extras?.cutouts.get(prev.index) || []).some((c) => c.isFullMerge && c.end >= prev.length / 2 - 0.28);
    if (!skipPost) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(wallT * 0.52, wallT * 0.52, wallH, 10), wallMat);
      post.position.set(edge.a.x + (edge.nx + prev.nx) * wallT * 0.24, wallH / 2, edge.a.z + (edge.nz + prev.nz) * wallT * 0.24);
      post.castShadow = true;
      post.receiveShadow = true;
      group.add(post);
    }
  }

  addRoomStateOverlay(group, room, wallH, materials);

  const roofGeo = new THREE.ExtrudeGeometry(polyShape, { depth: 0.14, bevelEnabled: false });
  roofGeo.rotateX(-Math.PI / 2);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = wallH;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roofMesh.visible = false;
  group.add(roofMesh);

  const assignmentMeshes: THREE.Object3D[] = [];
  for (const a of room.assignments3D || []) {
    const pin = buildAssignmentPinMesh(a);
    pin.root.position.set(a.offsetX || 0, 0, a.offsetZ || 0);
    pin.root.userData = { editorEntity: { type: 'assignment', roomId: room.id, id: a.id }, assignment: a };
    group.add(pin.root);
    materials.push(...pin.materials);
    assignmentMeshes.push(pin.root);
  }

  return { roomId: room.id, floorId: room.floorId, wingId: room.wingId, group, roofMesh, materials, lines, assignmentMeshes };
}
