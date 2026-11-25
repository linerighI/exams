/**
 * Top-down architectural drone camera controller built on Three.js OrbitControls + GSAP.
 * Supports smooth pan, orbit, zoom, WASD glide, room fly-to, and dynamic teacher wing bounds.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import type { CampusLayout } from '../types';
import { computeDynamicWingBounds } from './engine/campusSchema';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';

export interface WingBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class DroneCameraController {
  readonly controls: OrbitControls;
  private readonly keys = new Set<string>();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private activeTween: gsap.core.Timeline | null = null;
  private wingBounds: WingBounds | null = null;
  private lastFogStrength = -1;
  private onBoundaryFog?: (strength: number) => void;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    onBoundaryFog?: (strength: number) => void,
  ) {
    this.onBoundaryFog = onBoundaryFog;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.085;
    this.controls.screenSpacePanning = false;
    this.controls.minPolarAngle = 0.16;
    this.controls.maxPolarAngle = 1.25;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 120;
    this.controls.panSpeed = 1.05;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.95;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    this.controls.addEventListener('start', () => {
      if (this.activeTween) {
        this.activeTween.kill();
        this.activeTween = null;
      }
    });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  setAutoOrbit(enabled: boolean) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 0.5;
  }

  setOrbitEnabled(enabled: boolean) {
    this.controls.enabled = enabled;
  }

  /** Disable left-click pan briefly when actively drawing rectangles on the drafting grid. */
  setEditorDrawMode(drawing: boolean) {
    this.controls.enablePan = !drawing;
  }

  /** Compute dynamic bounding box of allowed wings from active CampusLayout. */
  setTeacherBounds(access: TeacherAccess, layout?: CampusLayout | null) {
    if (!access.restricted || access.allowedWings.size === 0 || !layout) {
      this.wingBounds = null;
      this.emitBoundaryFog(0);
      return;
    }
    const bounds = computeDynamicWingBounds(layout, access.allowedWings);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const meta of Object.values(bounds)) {
      minX = Math.min(minX, meta.min[0]);
      maxX = Math.max(maxX, meta.max[0]);
      minZ = Math.min(minZ, meta.min[2]);
      maxZ = Math.max(maxZ, meta.max[2]);
    }
    this.wingBounds = Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null;
  }

  private emitBoundaryFog(strength: number) {
    const clamped = Math.max(0, Math.min(1, strength));
    if (Math.abs(clamped - this.lastFogStrength) > 0.03) {
      this.lastFogStrength = clamped;
      this.onBoundaryFog?.(clamped);
    }
  }

  /** Smoothly glide drone to target & offset camera position. */
  flyTo(target: THREE.Vector3, camPos: THREE.Vector3, duration = 0.8) {
    if (this.activeTween) this.activeTween.kill();
    const tObj = { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z };
    const cObj = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
    this.activeTween = gsap.timeline({ onComplete: () => { this.activeTween = null; } });
    this.activeTween.to(
      tObj,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        duration,
        ease: 'power3.out',
        onUpdate: () => this.controls.target.set(tObj.x, tObj.y, tObj.z),
      },
      0,
    );
    this.activeTween.to(
      cObj,
      {
        x: camPos.x,
        y: camPos.y,
        z: camPos.z,
        duration,
        ease: 'power3.out',
        onUpdate: () => this.camera.position.set(cObj.x, cObj.y, cObj.z),
      },
      0,
    );
  }

  /** Frame a selected room smoothly with space left for the docked window. */
  flyToRoom(room: ResolvedSpatialRoom, leaveWindowSpace = true) {
    const shiftX = leaveWindowSpace ? 2.6 : 0;
    const target = new THREE.Vector3(room.center[0] + shiftX, room.elevationY + 0.6, room.center[2]);
    const span = Math.max(room.size[0], room.size[2]);
    const dist = Math.max(14, span * 2.15);
    const camPos = new THREE.Vector3(target.x + dist * 0.45, target.y + dist * 0.9, target.z + dist * 0.72);
    this.flyTo(target, camPos, 0.75);
  }

  /** Fly drone to overview of the active floor, restricted wing bounds, or blank grid studio. */
  flyToFloor(floor: FloorFilter, layout?: CampusLayout | null, access?: TeacherAccess) {
    const floorObj = floor === 'all' ? null : layout?.floors.find((f) => f.id === floor) || null;
    const elev = Number(floorObj?.elevationY || 0);

    if (access?.restricted && access.allowedWings.size > 0 && this.wingBounds) {
      const cx = (this.wingBounds.minX + this.wingBounds.maxX) / 2;
      const cz = (this.wingBounds.minZ + this.wingBounds.maxZ) / 2;
      const span = Math.max(16, this.wingBounds.maxX - this.wingBounds.minX, this.wingBounds.maxZ - this.wingBounds.minZ);
      this.flyTo(
        new THREE.Vector3(cx, elev + 0.5, cz),
        new THREE.Vector3(cx + span * 0.45, elev + span * 0.92, cz + span * 0.75),
        0.8,
      );
      return;
    }

    const visibleRooms = (layout?.rooms || []).filter((r) => floor === 'all' || r.floorId === floor);
    if (visibleRooms.length === 0) {
      this.flyTo(new THREE.Vector3(0, elev, 0), new THREE.Vector3(14, elev + 26, 26), 0.75);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of visibleRooms) {
      minX = Math.min(minX, r.x - r.width / 2);
      maxX = Math.max(maxX, r.x + r.width / 2);
      minZ = Math.min(minZ, r.z - r.depth / 2);
      maxZ = Math.max(maxZ, r.z + r.depth / 2);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(24, maxX - minX, maxZ - minZ);
    this.flyTo(
      new THREE.Vector3(cx, elev + 0.4, cz),
      new THREE.Vector3(cx + span * 0.38, elev + span * 0.85, cz + span * 0.72),
      0.8,
    );
  }

  /** Advance WASD glide, enforce teacher wing fog bounds, and tick OrbitControls. */
  update(delta: number) {
    if (this.controls.enabled && !this.controls.autoRotate && this.keys.size > 0) {
      const speed = 18 * Math.min(delta, 0.05);
      this.camera.getWorldDirection(this.forward);
      this.forward.y = 0;
      if (this.forward.lengthSq() > 1e-4) this.forward.normalize();
      this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize();

      const move = new THREE.Vector3();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(this.forward);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(this.forward);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(this.right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(this.right);

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        this.controls.target.add(move);
        this.camera.position.add(move);
      }
    }

    if (this.wingBounds) {
      const t = this.controls.target;
      const dx = t.x < this.wingBounds.minX ? this.wingBounds.minX - t.x : t.x > this.wingBounds.maxX ? t.x - this.wingBounds.maxX : 0;
      const dz = t.z < this.wingBounds.minZ ? this.wingBounds.minZ - t.z : t.z > this.wingBounds.maxZ ? t.z - this.wingBounds.maxZ : 0;
      this.emitBoundaryFog(Math.hypot(dx, dz) / 5.5);
      const margin = 4.5;
      const clampedX = Math.max(this.wingBounds.minX - margin, Math.min(this.wingBounds.maxX + margin, t.x));
      const clampedZ = Math.max(this.wingBounds.minZ - margin, Math.min(this.wingBounds.maxZ + margin, t.z));
      if (clampedX !== t.x || clampedZ !== t.z) {
        this.camera.position.x += clampedX - t.x;
        this.camera.position.z += clampedZ - t.z;
        t.x = clampedX;
        t.z = clampedZ;
      }
    } else {
      this.emitBoundaryFog(0);
    }

    this.controls.update();
  }

  dispose() {
    if (this.activeTween) this.activeTween.kill();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.controls.dispose();
  }
}
