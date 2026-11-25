/**
 * Interactive 3D CAD corner vertex & wall-edge handles for SARE selected rooms:
 * drag corner spheres freely to sculpt polygons (or trapezoids/L-shapes), or drag wall
 * bars outward/inward to resize walls with grid snap and live outline preview.
 */
import * as THREE from 'three';
import type { CampusRoom, RoomPoint } from '../../types';
import type { DroneCameraController } from '../droneCamera';
import { computePointsBounds, getRoomEdges, getRoomPoints, recenterRoomPolygon } from '../engine/roomPolygon';
import { snapCoord } from './editorOperations';

interface ActiveShapeDrag {
  room: CampusRoom;
  kind: 'corner' | 'edge';
  index: number;
  basePts: RoomPoint[];
  lastPts: RoomPoint[];
  elevY: number;
}

export class RoomResizeHandles {
  readonly group = new THREE.Group();
  private readonly corners: THREE.Mesh[] = [];
  private readonly edges: THREE.Mesh[] = [];
  private readonly cornerGeo = new THREE.SphereGeometry(0.24, 16, 16);
  private readonly edgeGeo = new THREE.BoxGeometry(0.95, 0.22, 0.22);
  private readonly cornerMat = new THREE.MeshBasicMaterial({ color: 0x007aff });
  private readonly edgeMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
  private readonly preview: THREE.LineSegments;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private drag: ActiveShapeDrag | null = null;
  private currentRoom: CampusRoom | null = null;
  private currentElevY = 0;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly drone: DroneCameraController,
  ) {
    this.group.name = 'RoomShapeHandles';
    const previewGeo = new THREE.BufferGeometry();
    this.preview = new THREE.LineSegments(previewGeo, new THREE.LineBasicMaterial({ color: 0x007aff }));
    this.preview.visible = false;
    this.preview.renderOrder = 25;
    scene.add(this.preview, this.group);
    this.group.visible = false;
  }

  private ensureHandlePool(count: number) {
    if (this.corners.length === count) return;
    this.group.clear();
    this.corners.length = 0;
    this.edges.length = 0;
    for (let i = 0; i < count; i++) {
      const c = new THREE.Mesh(this.cornerGeo, this.cornerMat);
      c.userData = { handleKind: 'corner', index: i };
      c.renderOrder = 27;
      const e = new THREE.Mesh(this.edgeGeo, this.edgeMat);
      e.userData = { handleKind: 'edge', index: i };
      e.renderOrder = 26;
      this.group.add(c, e);
      this.corners.push(c);
      this.edges.push(e);
    }
  }

  /** Position corner spheres & wall-edge resize bars around the selected room. */
  sync(room: CampusRoom | null, elevY: number, visible: boolean) {
    this.currentRoom = room;
    this.currentElevY = elevY;
    if (!room || !visible) {
      this.group.visible = false;
      return;
    }
    const pts = getRoomPoints(room);
    const roomEdges = getRoomEdges(room);
    this.ensureHandlePool(pts.length);
    this.group.visible = true;

    const h = Math.max(0.5, room.wallHeight || 3.2) + 0.18;
    const rot = room.rotationY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    pts.forEach((p, i) => {
      const c = this.corners[i];
      c.position.set(room.x + p.x * cos + p.z * sin, elevY + h + 0.04, room.z - p.x * sin + p.z * cos);
    });
    roomEdges.forEach((edge, i) => {
      const bar = this.edges[i];
      bar.position.set(room.x + edge.mx * cos + edge.mz * sin, elevY + h, room.z - edge.mx * sin + edge.mz * cos);
      bar.rotation.y = rot + edge.rotY;
    });
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

  /** Start dragging a corner sphere or wall edge bar if clicked; returns true if captured. */
  tryStartDrag(clientX: number, clientY: number): boolean {
    if (!this.group.visible || !this.currentRoom) return false;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.corners, ...this.edges], false);
    if (!hits[0]) return false;

    const r = this.currentRoom;
    const basePts = getRoomPoints(r);
    this.drag = {
      room: r,
      kind: hits[0].object.userData.handleKind as 'corner' | 'edge',
      index: hits[0].object.userData.index as number,
      basePts,
      lastPts: basePts.map((p) => ({ ...p })),
      elevY: this.currentElevY,
    };
    this.drone.setOrbitEnabled(false);
    return true;
  }

  isDragging() {
    return Boolean(this.drag);
  }

  private updatePreviewWireframe(room: CampusRoom, pts: RoomPoint[], elevY: number) {
    const wallH = Math.max(0.5, room.wallHeight || 3.2);
    const rot = room.rotationY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const verts: number[] = [];
    const toWorld = (p: RoomPoint, y: number) => [room.x + p.x * cos + p.z * sin, y, room.z - p.x * sin + p.z * cos];

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      verts.push(...toWorld(a, elevY + 0.05), ...toWorld(b, elevY + 0.05));
      verts.push(...toWorld(a, elevY + wallH), ...toWorld(b, elevY + wallH));
      verts.push(...toWorld(a, elevY + 0.05), ...toWorld(a, elevY + wallH));
    }
    this.preview.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.preview.geometry = g;
    this.preview.visible = true;
  }

  updateDrag(clientX: number, clientY: number, gridSnap: number, onMeasure: (d: { width: number; depth: number }) => void) {
    if (!this.drag) return;
    const pt = this.hitFloor(clientX, clientY, this.drag.elevY);
    if (!pt) return;

    const { room, kind, index, basePts } = this.drag;
    const rot = room.rotationY || 0;
    const dx = pt.x - room.x;
    const dz = pt.z - room.z;
    const lx = dx * Math.cos(-rot) + dz * Math.sin(-rot);
    const lz = -dx * Math.sin(-rot) + dz * Math.cos(-rot);
    const nextPts = basePts.map((p) => ({ ...p }));

    if (kind === 'corner') {
      const sx = Number(snapCoord(lx, gridSnap).toFixed(2));
      const sz = Number(snapCoord(lz, gridSnap).toFixed(2));
      const prev = nextPts[(index - 1 + nextPts.length) % nextPts.length];
      const next = nextPts[(index + 1) % nextPts.length];
      if (Math.hypot(sx - prev.x, sz - prev.z) < 1.1 || Math.hypot(sx - next.x, sz - next.z) < 1.1) return;
      nextPts[index] = { x: sx, z: sz };
    } else {
      const origEdges = getRoomEdges({ width: room.width, depth: room.depth, points: basePts });
      const edge = origEdges[index];
      const outwardX = -edge.nx;
      const outwardZ = -edge.nz;
      const shift = snapCoord((lx - edge.mx) * outwardX + (lz - edge.mz) * outwardZ, gridSnap);
      const j = (index + 1) % nextPts.length;
      nextPts[index] = {
        x: Number((basePts[index].x + outwardX * shift).toFixed(2)),
        z: Number((basePts[index].z + outwardZ * shift).toFixed(2)),
      };
      nextPts[j] = {
        x: Number((basePts[j].x + outwardX * shift).toFixed(2)),
        z: Number((basePts[j].z + outwardZ * shift).toFixed(2)),
      };
    }

    const bounds = computePointsBounds(nextPts);
    if (bounds.width < 1.8 || bounds.depth < 1.8) return;
    this.drag.lastPts = nextPts;
    this.updatePreviewWireframe(room, nextPts, this.drag.elevY);
    onMeasure({ width: bounds.width, depth: bounds.depth });
  }

  finishDrag(onCommit: (roomId: string, patch: Partial<CampusRoom>) => void) {
    if (!this.drag) return;
    const { room, lastPts } = this.drag;
    this.drag = null;
    this.preview.visible = false;
    this.drone.setOrbitEnabled(true);
    onCommit(room.id, recenterRoomPolygon(room, lastPts));
  }

  dispose() {
    this.cornerGeo.dispose();
    this.edgeGeo.dispose();
    this.cornerMat.dispose();
    this.edgeMat.dispose();
    this.preview.geometry.dispose();
  }
}
