/**
 * Interactive 3D opening grab handles for SARE selected rooms: renders distinct floating pills
 * above doors, double doors, and windows so users can drag openings along any wall or across corners.
 */
import * as THREE from 'three';
import type { CampusRoom, WallOpening } from '../../types';
import type { DroneCameraController } from '../droneCamera';
import type { CampusSceneGraph } from '../engine/proceduralCampusBuilder';
import {
  clampOpeningOffset,
  getOpeningEdgeOffset,
  getRoomEdges,
  nearestEdgeProjection,
  resolveOpeningEdgeIndex,
} from '../engine/roomPolygon';
import { snapCoord } from './editorOperations';

interface ActiveOpeningDrag {
  room: CampusRoom;
  opening: WallOpening;
  elevY: number;
  lastPatch: { wallIndex: number; wall: WallOpening['wall']; offset: number };
}

export class OpeningDragHandles {
  readonly group = new THREE.Group();
  private readonly pillGeo = new THREE.BoxGeometry(0.75, 0.2, 0.24);
  private readonly doorMat = new THREE.MeshBasicMaterial({ color: 0x0d9488 });
  private readonly windowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  private readonly pills: THREE.Mesh[] = [];
  private readonly ghost: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private drag: ActiveOpeningDrag | null = null;
  private currentRoom: CampusRoom | null = null;
  private currentElevY = 0;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly drone: DroneCameraController,
  ) {
    this.group.name = 'OpeningDragHandles';
    const gMat = new THREE.MeshBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.48, depthWrite: false });
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.32), gMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 25;
    scene.add(this.ghost, this.group);
    this.group.visible = false;
  }

  /** Sync grab pills above every opening of the currently selected room. */
  sync(room: CampusRoom | null, elevY: number, visible: boolean) {
    this.currentRoom = room;
    this.currentElevY = elevY;
    this.group.clear();
    this.pills.length = 0;
    if (!room || !visible || !room.openings?.length) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const edges = getRoomEdges(room);
    const wallH = Math.max(0.5, room.wallHeight || 3.2);
    const wallT = Math.max(0.08, room.wallThickness || 0.2);
    const rot = room.rotationY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    for (const op of room.openings) {
      const edge = edges[resolveOpeningEdgeIndex(op, edges.length)];
      if (!edge) continue;
      const off = clampOpeningOffset(getOpeningEdgeOffset(op), edge.length, op.width);
      const sillH = op.type === 'window' ? Math.min(0.95, wallH * 0.32) : 0;
      const topH = Math.min(wallH - 0.15, sillH + op.height);
      const lx = edge.mx + edge.ux * off + edge.nx * (wallT / 2);
      const lz = edge.mz + edge.uz * off + edge.nz * (wallT / 2);

      const pill = new THREE.Mesh(this.pillGeo, op.type === 'window' ? this.windowMat : this.doorMat);
      pill.position.set(room.x + lx * cos + lz * sin, elevY + Math.min(wallH + 0.14, topH + 0.18), room.z - lx * sin + lz * cos);
      pill.rotation.y = rot + edge.rotY;
      pill.userData = { openingId: op.id };
      pill.renderOrder = 27;
      this.group.add(pill);
      this.pills.push(pill);
    }
  }

  private hitFloor(clientX: number, clientY: number, elevY: number): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.floorPlane.constant = -elevY;
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, out);
  }

  /** Begin dragging a door, double door, or window by its grab pill or 3D mesh directly. */
  tryStartDrag(clientX: number, clientY: number, graph: CampusSceneGraph | null): boolean {
    if (!this.group.visible || !this.currentRoom || !this.currentRoom.openings?.length) return false;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    let openingId: string | null = null;
    const pillHits = this.raycaster.intersectObjects(this.pills, false);
    if (pillHits[0]?.object.userData?.openingId) {
      openingId = pillHits[0].object.userData.openingId as string;
    } else if (graph) {
      const roomGroup = graph.roomsById.get(this.currentRoom.id)?.group;
      if (roomGroup) {
        const meshHits = this.raycaster.intersectObject(roomGroup, true);
        let cur: THREE.Object3D | null = meshHits[0]?.object || null;
        while (cur && cur !== roomGroup) {
          if (cur.userData?.openingId) {
            openingId = cur.userData.openingId as string;
            break;
          }
          cur = cur.parent;
        }
      }
    }
    if (!openingId) return false;

    const op = this.currentRoom.openings.find((o) => o.id === openingId);
    if (!op) return false;
    const edges = getRoomEdges(this.currentRoom);
    const edgeIndex = resolveOpeningEdgeIndex(op, edges.length);
    this.drag = {
      room: this.currentRoom,
      opening: op,
      elevY: this.currentElevY,
      lastPatch: { wallIndex: edgeIndex, wall: edges[edgeIndex]?.wall || op.wall, offset: getOpeningEdgeOffset(op) },
    };
    this.drone.setOrbitEnabled(false);
    return true;
  }

  isDragging() {
    return Boolean(this.drag);
  }

  updateDrag(clientX: number, clientY: number, gridSnap: number) {
    if (!this.drag) return;
    const pt = this.hitFloor(clientX, clientY, this.drag.elevY);
    if (!pt) return;

    const { room, opening, elevY } = this.drag;
    const rot = room.rotationY || 0;
    const dx = pt.x - room.x;
    const dz = pt.z - room.z;
    const lx = dx * Math.cos(-rot) + dz * Math.sin(-rot);
    const lz = -dx * Math.sin(-rot) + dz * Math.cos(-rot);

    const proj = nearestEdgeProjection(room, lx, lz);
    const step = Math.min(0.25, gridSnap * 0.5);
    const clamped = clampOpeningOffset(snapCoord(proj.offset, step), proj.edge.length, opening.width);
    this.drag.lastPatch = { wallIndex: proj.edgeIndex, wall: proj.wall, offset: clamped };

    const wallH = Math.max(0.5, room.wallHeight || 3.2);
    const wallT = Math.max(0.08, room.wallThickness || 0.2);
    const sillH = opening.type === 'window' ? Math.min(0.95, wallH * 0.32) : 0;
    const paneH = Math.max(0.3, Math.min(wallH - 0.15, sillH + opening.height) - sillH);
    const gx = proj.edge.mx + proj.edge.ux * clamped + proj.edge.nx * (wallT / 2);
    const gz = proj.edge.mz + proj.edge.uz * clamped + proj.edge.nz * (wallT / 2);

    this.ghost.visible = true;
    this.ghost.scale.set(opening.width, paneH, wallT + 0.14);
    this.ghost.position.set(
      room.x + gx * Math.cos(rot) + gz * Math.sin(rot),
      elevY + sillH + paneH / 2,
      room.z - gx * Math.sin(rot) + gz * Math.cos(rot),
    );
    this.ghost.rotation.y = rot + proj.edge.rotY;
  }

  finishDrag(onCommit: (roomId: string, openingId: string, patch: Partial<WallOpening>) => void) {
    if (!this.drag) return;
    const { room, opening, lastPatch } = this.drag;
    this.drag = null;
    this.ghost.visible = false;
    this.drone.setOrbitEnabled(true);
    onCommit(room.id, opening.id, lastPatch);
  }

  dispose() {
    this.pillGeo.dispose();
    this.doorMat.dispose();
    this.windowMat.dispose();
    this.ghost.geometry.dispose();
    (this.ghost.material as THREE.Material).dispose();
  }
}
