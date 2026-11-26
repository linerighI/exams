/**
 * Builds and manages the procedural Three.js campus scene graph from a compiled SAR
 * CampusLayout blueprint: studio grid, rooms, props, beacons, floor groups, and dirty hashes.
 */
import * as THREE from 'three';
import type { CampusBeacon, CampusLayout, CampusProp, CampusRoom } from '../../types';
import { buildPropMesh } from './propLibrary';
import { computeFloorAdjacency, type RoomEdgeExtras } from './roomAdjacency';
import { buildRoomVisual, type BuiltRoomVisual } from './roomMeshBuilder';

export interface WingFloorBucket {
  materials: THREE.Material[];
  lines: THREE.LineBasicMaterial[];
  roofMeshes: THREE.Mesh[];
}

export interface PropEntry {
  floorId: string;
  wingId: string;
  group: THREE.Group;
  materials: THREE.Material[];
}

export interface CampusSceneGraph {
  root: THREE.Group;
  ground: THREE.Mesh;
  gridHelper: THREE.GridHelper;
  floorKey: string;
  roomsById: Map<string, BuiltRoomVisual>;
  roomHashes: Map<string, string>;
  propsById: Map<string, PropEntry>;
  propHashes: Map<string, string>;
  beaconMarkers: THREE.Group;
  beaconHash: string;
  floorGroups: Map<string, THREE.Group>;
  materialsByWingFloor: Map<string, WingFloorBucket>;
  pickables: THREE.Object3D[];
}

/** Dispose geometries and materials recursively for a Three.js object subtree. */
export function disposeObjectTree(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

/** Dispose every Three.js geometry and material in a previously built campus graph. */
export function disposeCampusGraph(graph: CampusSceneGraph | null) {
  if (!graph) return;
  if (graph.root.parent) graph.root.parent.remove(graph.root);
  disposeObjectTree(graph.root);
}

export function computeFloorKey(layout: CampusLayout): string {
  return layout.floors.map((f) => `${f.id}:${f.elevationY}`).join('|');
}

export function hashRoomForScene(room: CampusRoom, elev: number, extras?: RoomEdgeExtras): string {
  const cutouts = extras
    ? [...extras.cutouts.entries()].sort((a, b) => a[0] - b[0])
    : [];
  const backed = extras ? [...extras.backedEdges].sort((a, b) => a - b) : [];
  return JSON.stringify([room, elev, backed, cutouts]);
}

export function hashPropForScene(prop: CampusProp, elev: number, wingId: string): string {
  return JSON.stringify([prop.prefabId, prop.floorId, wingId, prop.roomId, prop.x, prop.z, prop.rotationY, prop.scale, prop.colorTint, elev]);
}

export function hashBeaconsForScene(beacons: CampusBeacon[], showBeacons: boolean): string {
  return showBeacons ? JSON.stringify(beacons) : 'hidden';
}

export function populateBeaconMarkers(
  group: THREE.Group,
  beacons: CampusBeacon[],
  showBeacons: boolean,
  floorElev: Map<string, number>,
) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObjectTree(child);
  }
  group.visible = showBeacons;
  if (!showBeacons) return;
  const discGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.08, 20);
  for (const bc of beacons) {
    const mat = new THREE.MeshStandardMaterial({
      color: bc.beacon_type === 'qr' ? 0x007aff : 0x10b981,
      emissive: bc.beacon_type === 'qr' ? 0x007aff : 0x10b981,
      emissiveIntensity: 0.25,
    });
    const marker = new THREE.Mesh(discGeo, mat);
    const elev = floorElev.get(bc.floor_id) ?? bc.y ?? 0;
    marker.position.set(bc.x, elev + 0.18, bc.z);
    marker.userData = { editorEntity: { type: 'beacon', id: bc.id }, beacon: bc };
    group.add(marker);
  }
}

export function buildWrappedPropMesh(p: CampusProp, elev: number) {
  const built = buildPropMesh(p.prefabId, p.colorTint);
  built.root.position.set(p.x, elev, p.z);
  built.root.rotation.y = p.rotationY || 0;
  built.root.scale.setScalar(p.scale || 1);
  built.root.userData = { editorEntity: { type: 'prop', id: p.id }, propId: p.id };
  built.root.traverse((c) => {
    c.userData = { ...c.userData, editorEntity: { type: 'prop', id: p.id } };
  });
  return built;
}

/** Build an untextured 3D procedural campus from a compiled blueprint + beacons. */
export function buildCampusGraph(
  layout: CampusLayout,
  beacons: CampusBeacon[] = [],
  showBeacons = false,
): CampusSceneGraph {
  const root = new THREE.Group();
  root.name = 'ProceduralCampusRoot';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.ShadowMaterial({ opacity: 0.11 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  root.add(ground);

  const gridHelper = new THREE.GridHelper(90, 90, 0xc3d5ec, 0xe1eaf7);
  gridHelper.position.y = -0.01;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.42;
  root.add(gridHelper);

  const floorGroups = new Map<string, THREE.Group>();
  const floorElev = new Map<string, number>();
  for (const f of layout.floors) {
    const fg = new THREE.Group();
    fg.name = `Floor_${f.id}`;
    fg.userData = { floorId: f.id, elevationY: f.elevationY };
    root.add(fg);
    floorGroups.set(f.id, fg);
    floorElev.set(f.id, f.elevationY);
  }

  const roomsById = new Map<string, BuiltRoomVisual>();
  const roomHashes = new Map<string, string>();
  const propsById = new Map<string, PropEntry>();
  const propHashes = new Map<string, string>();
  const materialsByWingFloor = new Map<string, WingFloorBucket>();
  const pickables: THREE.Object3D[] = [];

  const getBucket = (wingId: string, floorId: string) => {
    const k = `${wingId}::${floorId}`;
    let b = materialsByWingFloor.get(k);
    if (!b) { b = { materials: [], lines: [], roofMeshes: [] }; materialsByWingFloor.set(k, b); }
    return b;
  };

  const extrasByRoom = new Map<string, RoomEdgeExtras>();
  for (const fl of layout.floors) {
    const adj = computeFloorAdjacency(layout.rooms.filter((r) => r.floorId === fl.id));
    adj.extrasByRoom.forEach((v, k) => extrasByRoom.set(k, v));
  }

  for (const r of layout.rooms) {
    const elev = floorElev.get(r.floorId) ?? 0;
    const extras = extrasByRoom.get(r.id);
    const built = buildRoomVisual(r, elev, extras);
    (floorGroups.get(r.floorId) || root).add(built.group);
    roomsById.set(r.id, built);
    roomHashes.set(r.id, hashRoomForScene(r, elev, extras));
    pickables.push(built.group);

    const b = getBucket(r.wingId, r.floorId);
    b.materials.push(...built.materials);
    b.lines.push(...built.lines);
    b.roofMeshes.push(built.roofMesh);
  }

  const roomWingMap = new Map(layout.rooms.map((r) => [r.id, r.wingId]));
  for (const p of layout.props) {
    const elev = floorElev.get(p.floorId) ?? p.y ?? 0;
    const wingId = (p.roomId && roomWingMap.get(p.roomId)) || layout.wings[0]?.id || 'main';
    const built = buildWrappedPropMesh(p, elev);
    (floorGroups.get(p.floorId) || root).add(built.root);
    propsById.set(p.id, { floorId: p.floorId, wingId, group: built.root, materials: built.materials });
    propHashes.set(p.id, hashPropForScene(p, elev, wingId));
    pickables.push(built.root);

    getBucket(wingId, p.floorId).materials.push(...built.materials);
  }

  const beaconMarkers = new THREE.Group();
  beaconMarkers.name = 'BeaconMarkers';
  populateBeaconMarkers(beaconMarkers, beacons, showBeacons, floorElev);
  pickables.push(...beaconMarkers.children);
  root.add(beaconMarkers);

  return {
    root, ground, gridHelper, floorKey: computeFloorKey(layout),
    roomsById, roomHashes, propsById, propHashes,
    beaconMarkers, beaconHash: hashBeaconsForScene(beacons, showBeacons),
    floorGroups, materialsByWingFloor, pickables,
  };
}
