/**
 * Manages 3D raycast picking boxes, translucent Apple Blue hover/selection volumes,
 * dynamic floor cutaway/onion-skin transitions, and teacher frosted-fog wing isolation.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import type { CampusLayout } from '../types';
import { computeDynamicWingBounds } from './engine/campusSchema';
import type { CampusSceneGraph } from './engine/proceduralCampusBuilder';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';

interface RoomHighlightBox {
  fill: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  rim: THREE.LineSegments;
  rimMat: THREE.LineBasicMaterial;
}

function makeRoomHighlight(colorHex: number): RoomHighlightBox {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const fillMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const fill = new THREE.Mesh(geo, fillMat);
  fill.visible = false;
  fill.renderOrder = 10;

  const rimMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.92 });
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geo), rimMat);
  rim.visible = false;
  rim.renderOrder = 11;

  return { fill, fillMat, rim, rimMat };
}

function positionHighlight(box: RoomHighlightBox, room: ResolvedSpatialRoom | null, opacity: number) {
  if (!room) {
    box.fill.visible = false;
    box.rim.visible = false;
    return;
  }
  box.fill.visible = true;
  box.rim.visible = true;
  box.fill.position.set(room.center[0], room.center[1], room.center[2]);
  box.fill.rotation.y = room.rotationY || 0;
  box.fill.scale.set(Math.max(0.2, room.size[0] - 0.1), Math.max(0.2, room.size[1] - 0.1), Math.max(0.2, room.size[2] - 0.1));
  box.rim.position.copy(box.fill.position);
  box.rim.rotation.copy(box.fill.rotation);
  box.rim.scale.copy(box.fill.scale);
  box.fillMat.opacity = opacity;
}

export class CampusHighlightController {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];
  private readonly hoverBox = makeRoomHighlight(0x007aff);
  private readonly selectBox = makeRoomHighlight(0x007aff);
  private readonly fogGroup = new THREE.Group();
  private readonly fogMeshes: { wingId: string; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private currentAccess: TeacherAccess | null = null;
  private currentFloor: FloorFilter = 'all';

  constructor(scene: THREE.Scene) {
    this.group.name = 'CampusHighlights';
    this.group.add(this.hoverBox.fill, this.hoverBox.rim, this.selectBox.fill, this.selectBox.rim, this.fogGroup);
    scene.add(this.group);
  }

  /** Rebuild dynamic frosted-fog boxes matching custom editor wings. */
  private syncFogMeshes(layout: CampusLayout | null | undefined, access: TeacherAccess, floor: FloorFilter) {
    for (const item of this.fogMeshes) {
      this.fogGroup.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.mat.dispose();
    }
    this.fogMeshes.length = 0;

    if (!layout || !access.restricted) return;
    const bounds = computeDynamicWingBounds(layout, new Set());
    for (const [wingId, meta] of Object.entries(bounds)) {
      if (access.allowedWings.has(wingId)) continue;
      if (floor !== 'all' && !layout.rooms.some((r) => r.wingId === wingId && r.floorId === floor)) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xeef3fa,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(1, meta.max[0] - meta.min[0] + 0.6),
          Math.max(1, meta.max[1] - meta.min[1] + 0.5),
          Math.max(1, meta.max[2] - meta.min[2] + 0.6),
        ),
        mat,
      );
      mesh.position.set(meta.center[0], meta.center[1] + 0.1, meta.center[2]);
      mesh.renderOrder = 20;
      this.fogGroup.add(mesh);
      this.fogMeshes.push({ wingId, mesh, mat });
    }
  }

  /** Rebuild invisible room picking volumes whenever room catalog or floor filter changes. */
  syncHitBoxes(rooms: ResolvedSpatialRoom[], floor: FloorFilter, access: TeacherAccess) {
    this.currentFloor = floor;
    this.currentAccess = access;
    for (const m of this.hitMeshes) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.hitMeshes.length = 0;

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const room of rooms) {
      if (floor !== 'all' && room.floorId !== floor) continue;
      if (access.restricted && !access.allowedSlots.has(room.slotId)) continue;
      const geo = new THREE.BoxGeometry(room.size[0], room.size[1], room.size[2]);
      const hit = new THREE.Mesh(geo, hitMat);
      hit.position.set(room.center[0], room.center[1], room.center[2]);
      hit.rotation.y = room.rotationY || 0;
      hit.userData = { slotId: room.slotId, room };
      this.group.add(hit);
      this.hitMeshes.push(hit);
    }
  }

  setHoveredRoom(room: ResolvedSpatialRoom | null, selectedSlotId: string | null) {
    if (room && room.slotId === selectedSlotId) {
      positionHighlight(this.hoverBox, null, 0);
      return;
    }
    positionHighlight(this.hoverBox, room, 0.14);
  }

  setSelectedRoom(room: ResolvedSpatialRoom | null) {
    positionHighlight(this.selectBox, room, 0.24);
    if (room) positionHighlight(this.hoverBox, null, 0);
  }

  /** Animate floor cutaway, optional onion-skin underlay, roof visibility, and teacher wing fog. */
  applySceneVisibility(
    graph: CampusSceneGraph | null,
    layout: CampusLayout | null | undefined,
    floor: FloorFilter,
    showRoofs: boolean,
    access: TeacherAccess,
    onionSkin = false,
  ) {
    this.currentFloor = floor;
    this.currentAccess = access;
    if (!graph || !layout) return;

    const activeFloorObj = floor === 'all' ? null : layout.floors.find((f) => f.id === floor) || null;
    for (const f of layout.floors) {
      const fg = graph.floorGroups.get(f.id);
      if (!fg) continue;
      const visible = Boolean(
        floor === 'all' ||
        f.id === floor ||
        (onionSkin && activeFloorObj && f.index < activeFloorObj.index),
      );
      fg.visible = visible;
    }

    for (const [key, bucket] of graph.materialsByWingFloor) {
      const [wingId, floorId] = key.split('::');
      const fObj = layout.floors.find((f) => f.id === floorId);
      const isActiveFloor = floor === 'all' || floorId === floor;
      const isOnion = Boolean(!isActiveFloor && onionSkin && activeFloorObj && fObj && fObj.index < activeFloorObj.index);
      const wingMult = access.restricted && !access.allowedWings.has(wingId) ? 0.22 : 1;
      const targetAlpha = (isActiveFloor ? 1 : isOnion ? 0.22 : 0) * wingMult;

      for (const m of bucket.materials) {
        gsap.to(m, { opacity: targetAlpha, duration: 0.35, ease: 'power2.out' });
      }
      for (const l of bucket.lines) {
        gsap.to(l, { opacity: targetAlpha * 0.28, duration: 0.35, ease: 'power2.out' });
      }
      for (const rm of bucket.roofMeshes) {
        rm.visible = Boolean(showRoofs && isActiveFloor);
      }
    }

    this.syncFogMeshes(layout, access, floor);
  }

  getFloor() {
    return this.currentFloor;
  }

  getAccess() {
    return this.currentAccess;
  }
}
