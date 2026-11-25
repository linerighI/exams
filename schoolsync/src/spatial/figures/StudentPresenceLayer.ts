/**
 * Classroom Student Presence Layer: renders up to 5 faded black architectural figures
 * per bound classroom, animating smoothly upward/downward as absence percentage changes.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import type { State } from '../../types';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from '../roomCatalog';
import { createSilhouetteFigure, type SilhouetteFigureInstance } from './studentFigureShader';
import { computeFigureFormation, computeStudentFigures } from './studentPresenceMath';

interface RoomFigurePool {
  roomGroup: THREE.Group;
  figures: SilhouetteFigureInstance[];
  activeCount: number;
}

export class StudentPresenceLayer {
  readonly group = new THREE.Group();
  private readonly pools = new Map<string, RoomFigurePool>();

  constructor(scene: THREE.Scene) {
    this.group.name = 'StudentPresenceFigures';
    scene.add(this.group);
  }

  private getOrCreatePool(roomId: string): RoomFigurePool {
    let pool = this.pools.get(roomId);
    if (pool) return pool;
    const roomGroup = new THREE.Group();
    const figures: SilhouetteFigureInstance[] = [];
    for (let i = 0; i < 5; i++) {
      const fig = createSilhouetteFigure({ topHex: 0x111318, bottomHex: 0xf8fafc, scale: 0.92 });
      fig.group.visible = false;
      fig.opacityUniform.value = 0;
      fig.headMat.opacity = 0;
      roomGroup.add(fig.group);
      figures.push(fig);
    }
    this.group.add(roomGroup);
    pool = { roomGroup, figures, activeCount: 0 };
    this.pools.set(roomId, pool);
    return pool;
  }

  /** Synchronize max-5 student silhouette counts across visible classrooms. */
  sync(
    rooms: ResolvedSpatialRoom[],
    data: State | null,
    floor: FloorFilter,
    access: TeacherAccess,
  ) {
    const activeRoomIds = new Set<string>();

    for (const room of rooms) {
      if (room.kind !== 'classroom' || !room.className || !data) continue;
      if (floor !== 'all' && room.floorId !== floor) continue;
      if (access.restricted && !access.allowedSlots.has(room.slotId)) continue;

      const roster = data.students.filter((s) => s.section === room.className);
      const absentCount = roster.filter((s) => s.today_status === 'absent').length;
      const stats = computeStudentFigures(roster.length, absentCount);
      const slots = computeFigureFormation(
        stats.count,
        room.center[0],
        room.center[2],
        room.size[0],
        room.size[2],
        room.elevationY,
      );

      activeRoomIds.add(room.roomId);
      const pool = this.getOrCreatePool(room.roomId);
      pool.roomGroup.visible = true;

      for (let i = 0; i < 5; i++) {
        const fig = pool.figures[i];
        const targetPos = slots[i];
        if (targetPos) {
          const [tx, ty, tz] = targetPos;
          if (!fig.group.visible) {
            fig.group.visible = true;
            fig.group.position.set(tx, ty - 0.45, tz);
            gsap.killTweensOf([fig.group.position, fig.opacityUniform, fig.headMat]);
            gsap.to(fig.group.position, { y: ty, duration: 0.45, ease: 'power3.out' });
            gsap.to(fig.opacityUniform, { value: 1, duration: 0.4, ease: 'power2.out' });
            gsap.to(fig.headMat, { opacity: 1, duration: 0.4, ease: 'power2.out' });
          } else {
            gsap.to(fig.group.position, { x: tx, y: ty, z: tz, duration: 0.35, ease: 'power2.out' });
            gsap.to(fig.opacityUniform, { value: 1, duration: 0.25 });
            gsap.to(fig.headMat, { opacity: 1, duration: 0.25 });
          }
        } else if (fig.group.visible) {
          gsap.killTweensOf([fig.group.position, fig.opacityUniform, fig.headMat]);
          gsap.to(fig.group.position, { y: fig.group.position.y - 0.45, duration: 0.38, ease: 'power2.in' });
          gsap.to(fig.headMat, { opacity: 0, duration: 0.32 });
          gsap.to(fig.opacityUniform, {
            value: 0,
            duration: 0.35,
            ease: 'power2.in',
            onComplete: () => {
              fig.group.visible = false;
            },
          });
        }
      }
      pool.activeCount = stats.count;
    }

    for (const [id, pool] of this.pools) {
      if (!activeRoomIds.has(id)) {
        pool.roomGroup.visible = false;
      }
    }
  }

  dispose() {
    for (const pool of this.pools.values()) {
      for (const fig of pool.figures) {
        fig.headMat.dispose();
        fig.bodyMat.dispose();
      }
    }
    this.pools.clear();
  }
}
