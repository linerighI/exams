/**
 * Imperative Three.js SARE 3D Model Editor controller: handles grid drawing, interactive
 * wall resize handles, single/double door & window punching, props, wing paint & TransformControls.
 */
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { CampusRoom, WallOpening } from '../../types';
import type { DroneCameraController } from '../droneCamera';
import type { EditorTool, SelectedEditorEntity } from '../engine/campusSchema';
import type { CampusSceneGraph } from '../engine/proceduralCampusBuilder';
import { snapCoord } from './editorStore';
import { OpeningDragHandles } from './openingDragHandles';
import { nearestEdgeProjection } from '../engine/roomPolygon';
import { RoomResizeHandles } from './roomResizeHandles';

export interface EditorControllerCallbacks {
  getState: () => {
    active: boolean;
    tool: EditorTool;
    activeFloorId: string;
    activeFloorY: number;
    gridSnap: number;
    selected: SelectedEditorEntity;
    selectedRoom: CampusRoom | null;
    getRoom: (id: string) => CampusRoom | null;
    graph: CampusSceneGraph | null;
  };
  onSelectEntity: (entity: SelectedEditorEntity) => void;
  onCreateRoom: (rect: { x: number; z: number; width: number; depth: number }) => void;
  onTransformCommit: (entity: SelectedEditorEntity, x: number, z: number, rotationY: number) => void;
  onResizeCommit: (roomId: string, patch: Partial<CampusRoom>) => void;
  onAddOpening: (roomId: string, wall: WallOpening['wall'], offset: number, type: 'door' | 'double_door' | 'window', wallIndex: number) => void;
  onMoveOpening: (roomId: string, openingId: string, patch: Partial<WallOpening>) => void;
  onAddProp: (x: number, z: number) => void;
  onAddAssignment: (roomId: string, offsetX: number, offsetZ: number) => void;
  onPaintWing: (roomId: string) => void;
  onAddBeacon: (roomId: string | null, x: number, z: number) => void;
  onDrawMeasure: (dims: { width: number; depth: number } | null) => void;
}

/** Coordinates Three.js TransformControls, RoomResizeHandles, and CAD interactions. */
export class CampusEditorController {
  readonly group = new THREE.Group();
  private readonly transform: TransformControls;
  private readonly resizeHandles: RoomResizeHandles;
  private readonly openingHandles: OpeningDragHandles;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly previewBox: THREE.Mesh;
  private readonly cursorRing: THREE.Mesh;
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private drawStart: THREE.Vector3 | null = null;
  private attachedEntity: SelectedEditorEntity = null;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly drone: DroneCameraController,
    private readonly callbacks: EditorControllerCallbacks,
  ) {
    this.group.name = 'CampusEditorHelpers';
    const pMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.25, depthWrite: false });
    this.previewBox = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 1), pMat);
    this.previewBox.visible = false;
    this.previewBox.renderOrder = 22;

    const cMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    this.cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 24), cMat);
    this.cursorRing.rotation.x = -Math.PI / 2;
    this.cursorRing.visible = false;
    this.cursorRing.renderOrder = 23;

    this.group.add(this.previewBox, this.cursorRing);
    scene.add(this.group);

    this.resizeHandles = new RoomResizeHandles(scene, camera, domElement, drone);
    this.openingHandles = new OpeningDragHandles(scene, camera, domElement, drone);
    this.transform = new TransformControls(camera, domElement);
    this.transform.showY = false;
    this.transform.setTranslationSnap(0.5);
    this.transform.getHelper().visible = false;
    scene.add(this.transform.getHelper());

    this.transform.addEventListener('dragging-changed', (ev) => {
      const dragging = Boolean((ev as { value?: unknown }).value);
      this.drone.setOrbitEnabled(!dragging);
      if (!dragging && this.transform.object && this.attachedEntity) {
        const obj = this.transform.object;
        const { gridSnap } = this.callbacks.getState();
        this.callbacks.onTransformCommit(
          this.attachedEntity,
          snapCoord(obj.position.x, gridSnap),
          snapCoord(obj.position.z, gridSnap),
          obj.rotation.y,
        );
      }
    });

    domElement.addEventListener('pointerdown', this.onDown);
    domElement.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
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

  private hitPickable(clientX: number, clientY: number): { entity: SelectedEditorEntity; point: THREE.Vector3 } | null {
    const { graph, activeFloorId } = this.callbacks.getState();
    if (!graph || graph.pickables.length === 0) return null;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(graph.pickables, true);
    for (const h of hits) {
      let cur: THREE.Object3D | null = h.object;
      while (cur) {
        const ent = cur.userData?.editorEntity as SelectedEditorEntity | undefined;
        if (ent) {
          const entFloor = ent.type === 'room' ? graph.roomsById.get(ent.id)?.floorId : ent.type === 'prop' ? graph.propsById.get(ent.id)?.floorId : ent.type === 'assignment' ? graph.roomsById.get(ent.roomId)?.floorId : activeFloorId;
          if (!entFloor || entFloor === activeFloorId) return { entity: ent, point: h.point };
          break;
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    const st = this.callbacks.getState();
    if (!st.active || e.button !== 0 || this.transform.dragging) return;
    if (st.tool === 'select') {
      if (this.openingHandles.tryStartDrag(e.clientX, e.clientY, st.graph) || this.resizeHandles.tryStartDrag(e.clientX, e.clientY)) {
        this.transform.getHelper().visible = false;
        return;
      }
    }

    const elev = st.activeFloorY;
    if (st.tool === 'draw_room') {
      const pt = this.hitFloor(e.clientX, e.clientY, elev);
      if (pt) this.drawStart = new THREE.Vector3(snapCoord(pt.x, st.gridSnap), elev, snapCoord(pt.z, st.gridSnap));
      return;
    }

    const picked = this.hitPickable(e.clientX, e.clientY);
    if (st.tool === 'select') {
      this.callbacks.onSelectEntity(picked ? picked.entity : null);
      return;
    }
    if (st.tool === 'prop') {
      const pt = this.hitFloor(e.clientX, e.clientY, elev);
      if (pt) this.callbacks.onAddProp(snapCoord(pt.x, st.gridSnap * 0.5), snapCoord(pt.z, st.gridSnap * 0.5));
      return;
    }
    if (st.tool === 'beacon') {
      const pt = this.hitFloor(e.clientX, e.clientY, elev);
      if (pt) this.callbacks.onAddBeacon(picked?.entity?.type === 'room' ? picked.entity.id : null, snapCoord(pt.x, 0.25), snapCoord(pt.z, 0.25));
      return;
    }
    if (!picked?.entity || picked.entity.type !== 'room') return;
    const roomObj = st.graph?.roomsById.get(picked.entity.id)?.group;
    if (!roomObj) return;
    const localPt = roomObj.worldToLocal(picked.point.clone());

    if (st.tool === 'paint_wing') {
      this.callbacks.onPaintWing(picked.entity.id);
    } else if (st.tool === 'assignment') {
      this.callbacks.onAddAssignment(picked.entity.id, localPt.x, localPt.z);
    } else if (st.tool === 'door' || st.tool === 'double_door' || st.tool === 'window') {
      const targetRoom = st.getRoom(picked.entity.id);
      if (targetRoom) {
        const proj = nearestEdgeProjection(targetRoom, localPt.x, localPt.z);
        this.callbacks.onAddOpening(picked.entity.id, proj.wall, proj.offset, st.tool, proj.edgeIndex);
      }
    }
  };

  private onMove = (e: PointerEvent) => {
    const st = this.callbacks.getState();
    if (!st.active) {
      this.cursorRing.visible = false;
      this.previewBox.visible = false;
      return;
    }
    if (this.openingHandles.isDragging()) {
      this.openingHandles.updateDrag(e.clientX, e.clientY, st.gridSnap);
      return;
    }
    if (this.resizeHandles.isDragging()) {
      this.resizeHandles.updateDrag(e.clientX, e.clientY, st.gridSnap, this.callbacks.onDrawMeasure);
      return;
    }
    const pt = this.hitFloor(e.clientX, e.clientY, st.activeFloorY);
    if (!pt) return;
    const sx = snapCoord(pt.x, st.gridSnap);
    const sz = snapCoord(pt.z, st.gridSnap);

    if (this.drawStart && st.tool === 'draw_room') {
      const w = Math.max(2, Math.abs(sx - this.drawStart.x));
      const d = Math.max(2, Math.abs(sz - this.drawStart.z));
      this.previewBox.visible = true;
      this.previewBox.scale.set(w, 3.2, d);
      this.previewBox.position.set((sx + this.drawStart.x) / 2, st.activeFloorY + 1.6, (sz + this.drawStart.z) / 2);
      this.callbacks.onDrawMeasure({ width: w, depth: d });
    } else if (st.tool !== 'select') {
      this.cursorRing.visible = true;
      this.cursorRing.position.set(sx, st.activeFloorY + 0.16, sz);
    } else {
      this.cursorRing.visible = false;
    }
  };

  private onUp = (e: PointerEvent) => {
    const curSt = this.callbacks.getState();
    this.transform.getHelper().visible = Boolean(curSt.active && curSt.tool === 'select' && this.attachedEntity);
    this.drone.setOrbitEnabled(true);
    if (this.openingHandles.isDragging()) { this.openingHandles.finishDrag(this.callbacks.onMoveOpening); return; }
    if (this.resizeHandles.isDragging()) { this.resizeHandles.finishDrag(this.callbacks.onResizeCommit); this.callbacks.onDrawMeasure(null); return; }
    if (!this.drawStart) return;
    const st = this.callbacks.getState();
    const pt = this.hitFloor(e.clientX, e.clientY, st.activeFloorY);
    this.previewBox.visible = false;
    this.callbacks.onDrawMeasure(null);
    const start = this.drawStart;
    this.drawStart = null;
    if (!pt) return;
    const sx = snapCoord(pt.x, st.gridSnap);
    const sz = snapCoord(pt.z, st.gridSnap);
    const w = Math.abs(sx - start.x);
    const d = Math.abs(sz - start.z);
    if (w >= 1.5 && d >= 1.5) {
      this.callbacks.onCreateRoom({ x: (sx + start.x) / 2, z: (sz + start.z) / 2, width: w, depth: d });
    }
  };

  /** Attach TransformControls & N/S/E/W wall resize bars to the active selected entity. */
  sync(
    active: boolean, tool: EditorTool, selected: SelectedEditorEntity,
    selectedRoom: CampusRoom | null, elevY: number, graph: CampusSceneGraph | null, gridSnap: number,
  ) {
    this.group.visible = active;
    this.drone.setEditorDrawMode(active && tool === 'draw_room');
    if (!this.resizeHandles.isDragging() && !this.openingHandles.isDragging() && !this.transform.dragging) this.drone.setOrbitEnabled(true);
    this.transform.setTranslationSnap(gridSnap);
    const showHandles = active && tool === 'select' && selected?.type === 'room';
    this.resizeHandles.sync(selectedRoom, elevY, showHandles);
    this.openingHandles.sync(selectedRoom, elevY, showHandles);

    if (!active || tool !== 'select' || !selected || !graph) {
      this.transform.detach();
      this.transform.getHelper().visible = false;
      this.attachedEntity = null;
      return;
    }
    const target = selected.type === 'room'
      ? graph.roomsById.get(selected.id)?.group
      : selected.type === 'prop'
        ? graph.propsById.get(selected.id)?.group
        : undefined;
    if (target) {
      this.attachedEntity = selected;
      this.transform.attach(target);
      this.transform.getHelper().visible = true;
    } else {
      this.transform.detach();
      this.transform.getHelper().visible = false;
      this.attachedEntity = null;
    }
  }

  dispose() {
    this.openingHandles.dispose();
    this.resizeHandles.dispose();
    this.transform.detach();
    this.transform.dispose();
    this.domElement.removeEventListener('pointerdown', this.onDown);
    this.domElement.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }
}
