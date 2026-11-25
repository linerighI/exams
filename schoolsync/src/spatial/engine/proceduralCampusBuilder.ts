/**
 * Builds and manages the complete procedural Three.js campus scene graph from a
 * CampusLayout blueprint: architectural studio grid, rooms, props, beacons, and floor/wing groups.
 */
import * as THREE from 'three';
import type { CampusBeacon, CampusLayout } from '../../types';
import { buildPropMesh } from './propLibrary';
import { computeFloorAdjacency, type RoomEdgeExtras } from './roomAdjacency';
import { buildRoomVisual, type BuiltRoomVisual } from './roomMeshBuilder';

export interface CampusSceneGraph {
  root: THREE.Group;
  ground: THREE.Mesh;
  gridHelper: THREE.GridHelper;
  roomsById: Map<string, BuiltRoomVisual>;
  propsById: Map<string, { floorId: string; wingId: string; group: THREE.Group; materials: THREE.Material[] }>;
  beaconMarkers: THREE.Group;
  floorGroups: Map<string, THREE.Group>;
  materialsByWingFloor: Map<string, { materials: THREE.Material[]; lines: THREE.LineBasicMaterial[]; roofMeshes: THREE.Mesh[] }>;
  pickables: THREE.Object3D[];
}

function disposeObjectTree(obj: THREE.Object3D) {
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

/** Build an untextured 3D procedural campus from a blueprint + optional beacon nodes. */
export function buildCampusGraph(
  layout: CampusLayout,
  beacons: CampusBeacon[] = [],
  showBeacons = false,
): CampusSceneGraph {
  const root = new THREE.Group();
  root.name = 'ProceduralCampusRoot';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.ShadowMaterial({ opacity: 0.16 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  root.add(ground);

  const gridHelper = new THREE.GridHelper(90, 90, 0xbfd1e8, 0xdce6f4);
  gridHelper.position.y = -0.01;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.55;
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
  const propsById = new Map<string, { floorId: string; wingId: string; group: THREE.Group; materials: THREE.Material[] }>();
  const materialsByWingFloor = new Map<string, { materials: THREE.Material[]; lines: THREE.LineBasicMaterial[]; roofMeshes: THREE.Mesh[] }>();
  const pickables: THREE.Object3D[] = [];

  const getBucket = (wingId: string, floorId: string) => {
    const k = `${wingId}::${floorId}`;
    let b = materialsByWingFloor.get(k);
    if (!b) {
      b = { materials: [], lines: [], roofMeshes: [] };
      materialsByWingFloor.set(k, b);
    }
    return b;
  };

  const extrasByRoom = new Map<string, RoomEdgeExtras>();
  for (const fl of layout.floors) {
    const flRooms = layout.rooms.filter((r) => r.floorId === fl.id);
    const adj = computeFloorAdjacency(flRooms);
    adj.extrasByRoom.forEach((v, k) => extrasByRoom.set(k, v));
  }

  for (const r of layout.rooms) {
    const elev = floorElev.get(r.floorId) ?? 0;
    const built = buildRoomVisual(r, elev, extrasByRoom.get(r.id));
    const parent = floorGroups.get(r.floorId) || root;
    parent.add(built.group);
    roomsById.set(r.id, built);
    pickables.push(built.group);

    const b = getBucket(r.wingId, r.floorId);
    b.materials.push(...built.materials);
    b.lines.push(...built.lines);
    b.roofMeshes.push(built.roofMesh);
  }

  const roomWingMap = new Map(layout.rooms.map((r) => [r.id, r.wingId]));

  for (const p of layout.props) {
    const built = buildPropMesh(p.prefabId, p.colorTint);
    const elev = floorElev.get(p.floorId) ?? p.y ?? 0;
    built.root.position.set(p.x, elev, p.z);
    built.root.rotation.y = p.rotationY || 0;
    built.root.scale.setScalar(p.scale || 1);
    built.root.userData = { editorEntity: { type: 'prop', id: p.id }, propId: p.id };
    built.root.traverse((c) => {
      c.userData = { ...c.userData, editorEntity: { type: 'prop', id: p.id } };
    });

    const parent = floorGroups.get(p.floorId) || root;
    parent.add(built.root);
    const wingId = (p.roomId && roomWingMap.get(p.roomId)) || layout.wings[0]?.id || 'main';
    propsById.set(p.id, { floorId: p.floorId, wingId, group: built.root, materials: built.materials });
    pickables.push(built.root);

    const b = getBucket(wingId, p.floorId);
    b.materials.push(...built.materials);
  }

  const beaconMarkers = new THREE.Group();
  beaconMarkers.name = 'BeaconMarkers';
  beaconMarkers.visible = showBeacons;
  if (showBeacons) {
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
      beaconMarkers.add(marker);
      pickables.push(marker);
    }
  }
  root.add(beaconMarkers);

  return {
    root,
    ground,
    gridHelper,
    roomsById,
    propsById,
    beaconMarkers,
    floorGroups,
    materialsByWingFloor,
    pickables,
  };
}
