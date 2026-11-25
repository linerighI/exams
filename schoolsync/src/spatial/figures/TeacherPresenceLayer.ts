/**
 * Live 3D Teacher Presence Layer: renders distinct taller charcoal-navy teacher figures
 * with Apple Blue / Emerald / Amber status floor rings, smooth WebSocket coordinate gliding,
 * interactive click picking, and optional movement trail polylines.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import type { CampusLayout, TeacherPresenceRecord } from '../../types';
import type { FloorFilter } from '../roomCatalog';
import { createSilhouetteFigure, type SilhouetteFigureInstance } from './studentFigureShader';

interface TeacherNode {
  fig: SilhouetteFigureInstance;
  hitMesh: THREE.Mesh;
  record: TeacherPresenceRecord;
}

const STATUS_RING_HEX: Record<TeacherPresenceRecord['status'], number> = {
  in_class: 0x007aff,
  on_campus: 0x34c759,
  mismatch: 0xff9500,
  offline: 0x94a3b8,
};

export class TeacherPresenceLayer {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];
  private readonly nodes = new Map<string, TeacherNode>();
  private readonly trailGroup = new THREE.Group();
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'TeacherPresenceFigures';
    this.trailGroup.name = 'TeacherMovementTrail';
    this.group.add(this.trailGroup);
    scene.add(this.group);
  }

  private getOrCreateNode(record: TeacherPresenceRecord): TeacherNode {
    let node = this.nodes.get(record.teacher_id);
    if (node) return node;

    const fig = createSilhouetteFigure({
      topHex: 0x0f172a,
      bottomHex: 0xeff6ff,
      scale: 1.28,
      withStatusRing: true,
      ringColor: STATUS_RING_HEX[record.status] || 0x007aff,
    });

    // Subtle Apple Blue collar ring distinguishing teachers from students at a glance
    const collarMat = new THREE.MeshBasicMaterial({ color: 0x007aff, side: THREE.DoubleSide });
    const collar = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.145, 20), collarMat);
    collar.rotation.x = -Math.PI / 2;
    collar.position.y = 0.74;
    fig.group.add(collar);

    const hitGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.3, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.y = 0.65;
    hitMesh.userData = { teacherId: record.teacher_id, teacherPresence: record };
    fig.group.add(hitMesh);

    fig.group.position.set(record.x, record.y + 0.14, record.z);
    this.group.add(fig.group);
    this.hitMeshes.push(hitMesh);
    node = { fig, hitMesh, record };
    this.nodes.set(record.teacher_id, node);
    return node;
  }

  /** Sync all teacher 3D figures for the active manager radar & glide smoothly to new coords. */
  sync(
    presenceList: TeacherPresenceRecord[],
    layout: CampusLayout | null | undefined,
    floor: FloorFilter,
    isManager: boolean,
  ) {
    if (!isManager) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const seen = new Set<string>();
    const roomOccupancy = new Map<string, number>();

    for (const rec of presenceList) {
      if (!rec.room_id && rec.status === 'offline') continue;
      if (floor !== 'all' && rec.floor_id && rec.floor_id !== floor) continue;

      seen.add(rec.teacher_id);
      const node = this.getOrCreateNode(rec);
      node.record = rec;
      node.hitMesh.userData.teacherPresence = rec;
      node.fig.group.visible = true;

      // Offset teachers sharing a room (e.g. Teachers Room) slightly so figures never overlap
      const key = rec.room_id || `${Math.round(rec.x)}-${Math.round(rec.z)}`;
      const slotIdx = roomOccupancy.get(key) || 0;
      roomOccupancy.set(key, slotIdx + 1);
      const angle = slotIdx * 1.4;
      const spread = slotIdx === 0 ? 0 : 0.72;
      const elev = layout?.floors.find((f) => f.id === rec.floor_id)?.elevationY ?? rec.y ?? 0;

      const tx = rec.x + Math.cos(angle) * spread;
      const ty = elev + 0.14;
      const tz = rec.z + Math.sin(angle) * spread;

      gsap.to(node.fig.group.position, { x: tx, y: ty, z: tz, duration: 0.85, ease: 'power2.out' });

      const hex = STATUS_RING_HEX[rec.status] || 0x007aff;
      if (node.fig.ringMat) {
        node.fig.ringMat.color.setHex(hex);
        node.fig.ringMat.opacity = rec.status === 'offline' ? 0.42 : 0.88;
      }
      const alpha = rec.status === 'offline' ? 0.58 : 1;
      node.fig.opacityUniform.value = alpha;
      node.fig.headMat.opacity = alpha;
    }

    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) node.fig.group.visible = false;
    }
  }

  /** Draw or clear a 3D movement trail polyline on the floor for an inspected teacher. */
  setTrail(
    points: { x: number; floor_id: string | null; z: number }[],
    layout: CampusLayout | null | undefined,
  ) {
    while (this.trailGroup.children.length > 0) {
      const child = this.trailGroup.children.pop() as THREE.Line;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    if (points.length < 2) return;

    const floorElev = new Map((layout?.floors || []).map((f) => [f.id, f.elevationY]));
    const verts = points.map(
      (p) => new THREE.Vector3(p.x, (p.floor_id ? floorElev.get(p.floor_id) ?? 0 : 0) + 0.22, p.z),
    );
    const geo = new THREE.BufferGeometry().setFromPoints(verts);
    const mat = new THREE.LineBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.82 });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 15;
    this.trailGroup.add(line);
  }

  update(delta: number) {
    this.elapsed += delta;
    for (const node of this.nodes.values()) {
      if (!node.fig.group.visible || !node.fig.ringMesh) continue;
      if (node.record.status === 'in_class' || node.record.status === 'mismatch') {
        const pulse = 1 + Math.sin(this.elapsed * 3.2) * 0.14;
        node.fig.ringMesh.scale.setScalar(pulse);
      } else {
        node.fig.ringMesh.scale.setScalar(1);
      }
    }
  }

  dispose() {
    this.setTrail([], null);
    for (const node of this.nodes.values()) {
      node.fig.headMat.dispose();
      node.fig.bodyMat.dispose();
      node.fig.ringMat?.dispose();
    }
    this.nodes.clear();
  }
}
