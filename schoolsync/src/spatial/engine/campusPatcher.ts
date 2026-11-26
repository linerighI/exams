/**
 * Incremental Three.js scene graph patcher for SARE: compares per-room & per-prop
 * SAR hashes so moving, resizing, or recoloring a room only disposes and rebuilds
 * that room (and its touching shared walls) without recreating the entire campus.
 */
import type * as THREE from 'three';
import type { CampusBeacon, CampusLayout } from '../../types';
import {
  buildCampusGraph,
  buildWrappedPropMesh,
  computeFloorKey,
  disposeCampusGraph,
  disposeObjectTree,
  hashBeaconsForScene,
  hashPropForScene,
  hashRoomForScene,
  populateBeaconMarkers,
  type CampusSceneGraph,
  type WingFloorBucket,
} from './proceduralCampusBuilder';
import { computeFloorAdjacency, type RoomEdgeExtras } from './roomAdjacency';
import { buildRoomVisual } from './roomMeshBuilder';

export { hashRoomForScene };

export interface PatchCampusResult {
  graph: CampusSceneGraph;
  rebuiltRooms: number;
  rebuiltProps: number;
  fullRebuild: boolean;
}

/** Incrementally patch only changed rooms/props/beacons in an active scene graph. */
export function patchCampusGraph(
  graph: CampusSceneGraph | null,
  layout: CampusLayout,
  beacons: CampusBeacon[] = [],
  showBeacons = false,
): PatchCampusResult {
  const floorKey = computeFloorKey(layout);
  if (!graph || graph.floorKey !== floorKey) {
    disposeCampusGraph(graph);
    const fresh = buildCampusGraph(layout, beacons, showBeacons);
    return {
      graph: fresh,
      rebuiltRooms: layout.rooms.length,
      rebuiltProps: layout.props.length,
      fullRebuild: true,
    };
  }

  const floorElev = new Map(layout.floors.map((f) => [f.id, f.elevationY]));
  const extrasByRoom = new Map<string, RoomEdgeExtras>();
  for (const fl of layout.floors) {
    const adj = computeFloorAdjacency(layout.rooms.filter((r) => r.floorId === fl.id));
    adj.extrasByRoom.forEach((v, k) => extrasByRoom.set(k, v));
  }

  const nextRoomIds = new Set(layout.rooms.map((r) => r.id));
  let rebuiltRooms = 0;

  for (const [id, oldRoom] of graph.roomsById.entries()) {
    if (!nextRoomIds.has(id)) {
      if (oldRoom.group.parent) oldRoom.group.parent.remove(oldRoom.group);
      disposeObjectTree(oldRoom.group);
      graph.roomsById.delete(id);
      graph.roomHashes.delete(id);
    }
  }

  for (const r of layout.rooms) {
    const elev = floorElev.get(r.floorId) ?? 0;
    const extras = extrasByRoom.get(r.id);
    const nextHash = hashRoomForScene(r, elev, extras);
    if (graph.roomHashes.get(r.id) === nextHash && graph.roomsById.has(r.id)) continue;

    const old = graph.roomsById.get(r.id);
    if (old) {
      if (old.group.parent) old.group.parent.remove(old.group);
      disposeObjectTree(old.group);
    }
    const built = buildRoomVisual(r, elev, extras);
    (graph.floorGroups.get(r.floorId) || graph.root).add(built.group);
    graph.roomsById.set(r.id, built);
    graph.roomHashes.set(r.id, nextHash);
    rebuiltRooms++;
  }

  const roomWingMap = new Map(layout.rooms.map((r) => [r.id, r.wingId]));
  const nextPropIds = new Set(layout.props.map((p) => p.id));
  let rebuiltProps = 0;

  for (const [id, oldProp] of graph.propsById.entries()) {
    if (!nextPropIds.has(id)) {
      if (oldProp.group.parent) oldProp.group.parent.remove(oldProp.group);
      disposeObjectTree(oldProp.group);
      graph.propsById.delete(id);
      graph.propHashes.delete(id);
    }
  }

  for (const p of layout.props) {
    const elev = floorElev.get(p.floorId) ?? p.y ?? 0;
    const wingId = (p.roomId && roomWingMap.get(p.roomId)) || layout.wings[0]?.id || 'main';
    const nextHash = hashPropForScene(p, elev, wingId);
    if (graph.propHashes.get(p.id) === nextHash && graph.propsById.has(p.id)) continue;

    const old = graph.propsById.get(p.id);
    if (old) {
      if (old.group.parent) old.group.parent.remove(old.group);
      disposeObjectTree(old.group);
    }
    const built = buildWrappedPropMesh(p, elev);
    (graph.floorGroups.get(p.floorId) || graph.root).add(built.root);
    graph.propsById.set(p.id, { floorId: p.floorId, wingId, group: built.root, materials: built.materials });
    graph.propHashes.set(p.id, nextHash);
    rebuiltProps++;
  }

  const nextBeaconHash = hashBeaconsForScene(beacons, showBeacons);
  if (nextBeaconHash !== graph.beaconHash) {
    populateBeaconMarkers(graph.beaconMarkers, beacons, showBeacons, floorElev);
    graph.beaconHash = nextBeaconHash;
  }

  // Refresh wing/floor buckets & raycast pickables cleanly
  const buckets = new Map<string, WingFloorBucket>();
  const getBucket = (wingId: string, floorId: string) => {
    const k = `${wingId}::${floorId}`;
    let b = buckets.get(k);
    if (!b) { b = { materials: [], lines: [], roofMeshes: [] }; buckets.set(k, b); }
    return b;
  };

  const pickables: THREE.Object3D[] = [];
  for (const r of layout.rooms) {
    const built = graph.roomsById.get(r.id);
    if (!built) continue;
    pickables.push(built.group);
    const b = getBucket(r.wingId, r.floorId);
    b.materials.push(...built.materials);
    b.lines.push(...built.lines);
    b.roofMeshes.push(built.roofMesh);
  }
  for (const [, p] of graph.propsById.entries()) {
    pickables.push(p.group);
    getBucket(p.wingId, p.floorId).materials.push(...p.materials);
  }
  pickables.push(...graph.beaconMarkers.children);

  graph.materialsByWingFloor = buckets;
  graph.pickables = pickables;

  return { graph, rebuiltRooms, rebuiltProps, fullRebuild: false };
}
