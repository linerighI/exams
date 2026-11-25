/**
 * Live 3D visual effects: subtle ambient skylight particles, pulsing selection halo,
 * and active-lesson emerald beacons (campus foliage props live cleanly in propLibrary.ts).
 */
import * as THREE from 'three';
import type { State } from '../types';
import { createParticleSprite } from './campusTextures';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';
import { getRoomLiveSnapshot } from './RoomCalloutLayer';

/** Manages floating skylight particles, pulsing selection halo, and live class beacons. */
export class CampusEffectsController {
  readonly group = new THREE.Group();
  private readonly particles: THREE.Points;
  private readonly haloRing: THREE.Mesh;
  private readonly haloMat: THREE.MeshBasicMaterial;
  private readonly beaconGroup = new THREE.Group();
  private selectedRoom: ResolvedSpatialRoom | null = null;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'CampusEffects';

    const count = 85;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 14 + 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 42;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.55,
      map: createParticleSprite(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, pMat);
    this.group.add(this.particles);

    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0x3898ff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.haloRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.42, 48), this.haloMat);
    this.haloRing.rotation.x = -Math.PI / 2;
    this.haloRing.visible = false;
    this.haloRing.renderOrder = 14;
    this.group.add(this.haloRing);
    this.group.add(this.beaconGroup);

    scene.add(this.group);
  }

  setSelectedRoom(room: ResolvedSpatialRoom | null) {
    this.selectedRoom = room;
    this.haloRing.visible = Boolean(room);
    if (room) {
      const span = Math.min(room.size[0], room.size[2]) * 0.34;
      this.haloRing.scale.setScalar(Math.max(1, span));
    }
  }

  /** Place softly glowing emerald beacons above classrooms actively in session right now. */
  syncLiveBeacons(rooms: ResolvedSpatialRoom[], data: State | null, floor: FloorFilter, access: TeacherAccess) {
    while (this.beaconGroup.children.length > 0) {
      const child = this.beaconGroup.children.pop() as THREE.Mesh;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    if (!data) return;

    for (const room of rooms) {
      if (room.kind !== 'classroom' || !room.className) continue;
      if (floor !== 'all' && room.floorId !== floor) continue;
      if (access.restricted && !access.allowedSlots.has(room.slotId)) continue;
      const snap = getRoomLiveSnapshot(room, data);
      if (!snap.activeLesson) continue;

      const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 });
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 1), mat);
      orb.position.set(room.center[0], room.max[1] + 0.9, room.center[2]);
      orb.userData.baseY = room.max[1] + 0.9;
      this.beaconGroup.add(orb);
    }
  }

  update(delta: number) {
    this.elapsed += delta;
    this.particles.rotation.y = this.elapsed * 0.015;
    this.particles.position.y = Math.sin(this.elapsed * 0.35) * 0.4;

    if (this.selectedRoom && this.haloRing.visible) {
      const bob = Math.sin(this.elapsed * 2.8) * 0.14;
      this.haloRing.position.set(
        this.selectedRoom.center[0],
        this.selectedRoom.max[1] + 0.18 + bob,
        this.selectedRoom.center[2],
      );
      this.haloMat.opacity = 0.48 + Math.sin(this.elapsed * 3.2) * 0.24;
    }

    this.beaconGroup.children.forEach((child, idx) => {
      const baseY = Number(child.userData.baseY || 4);
      child.position.y = baseY + Math.sin(this.elapsed * 2.4 + idx) * 0.18;
      child.rotation.y = this.elapsed * 1.4 + idx;
    });
  }
}
