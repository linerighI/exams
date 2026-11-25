/**
 * Imperative Three.js runtime factory for SpatialViewport: orchestrates procedural
 * untextured campus building, crisp studio lighting, student/teacher 3D figure layers,
 * raycasting, interactive 3D Editor controller, and 3D-to-2D DOM anchor projection.
 */
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CampusEffectsController } from './campusEffects';
import { createStudioGradientTexture } from './campusTextures';
import { DroneCameraController } from './droneCamera';
import { CampusEditorController, type EditorControllerCallbacks } from './editor/CampusEditorController';
import { buildCampusGraph, disposeCampusGraph, type CampusSceneGraph } from './engine/proceduralCampusBuilder';
import { StudentPresenceLayer } from './figures/StudentPresenceLayer';
import { TeacherPresenceLayer } from './figures/TeacherPresenceLayer';
import { CampusHighlightController } from './highlightLayer';
import type { CampusBeacon, CampusLayout, TeacherPresenceRecord } from '../types';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';

export interface SpatialRuntimeRefs {
  editorMode: boolean;
  rooms: ResolvedSpatialRoom[];
  floor: FloorFilter;
  showRoofs: boolean;
  access: TeacherAccess;
  selectedSlotId: string | null;
  hoveredRoom: ResolvedSpatialRoom | null;
  teacherPresence: TeacherPresenceRecord[];
  onHoverRoom: (room: ResolvedSpatialRoom | null) => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onSelectTeacher: (teacherId: string) => void;
}

export interface SpatialRuntimeEngine {
  graph: CampusSceneGraph | null;
  highlights: CampusHighlightController;
  effects: CampusEffectsController;
  drone: DroneCameraController;
  studentFigures: StudentPresenceLayer;
  teacherFigures: TeacherPresenceLayer;
  editor: CampusEditorController;
  rebuildCampus: (layout: CampusLayout, beacons: CampusBeacon[], showBeacons: boolean) => CampusSceneGraph;
  dispose: () => void;
}

/** Initialize the WebGL 3D Spatial Campus engine, layers, raycaster, and render loop. */
export function createSpatialRuntime(options: {
  container: HTMLElement;
  fogOverlay: HTMLElement | null;
  pillRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  teacherPillRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  calloutEl: () => HTMLDivElement | null;
  propsRef: MutableRefObject<SpatialRuntimeRefs>;
  editorCallbacks: EditorControllerCallbacks;
}): SpatialRuntimeEngine {
  const { container, fogOverlay, pillRefs, teacherPillRefs, calloutEl, propsRef, editorCallbacks } = options;
  const initW = Math.max(1, container.clientWidth);
  const initH = Math.max(1, container.clientHeight);

  const scene = new THREE.Scene();
  scene.background = createStudioGradientTexture();

  const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.2, 260);
  camera.position.set(16, 28, 28);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initW, initH);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.98;
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.24;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8d0ee, 0.72));

  const sun = new THREE.DirectionalLight(0xfffcf5, 1.55);
  sun.position.set(34, 48, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 140;
  const d = 46;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.45);
  fillLight.position.set(-30, 24, -22);
  scene.add(fillLight);

  const highlights = new CampusHighlightController(scene);
  const effects = new CampusEffectsController(scene);
  const studentFigures = new StudentPresenceLayer(scene);
  const teacherFigures = new TeacherPresenceLayer(scene);
  const drone = new DroneCameraController(camera, renderer.domElement, (strength) => {
    if (fogOverlay) fogOverlay.style.opacity = String(strength * 0.92);
  });
  const editor = new CampusEditorController(scene, camera, renderer.domElement, drone, editorCallbacks);

  const engine: SpatialRuntimeEngine = {
    graph: null,
    highlights,
    effects,
    drone,
    studentFigures,
    teacherFigures,
    editor,
    rebuildCampus: (layout, beacons, showBeacons) => {
      disposeCampusGraph(engine.graph);
      const next = buildCampusGraph(layout, beacons, showBeacons);
      engine.graph = next;
      scene.add(next.root);
      return next;
    },
    dispose: () => {},
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos: { x: number; y: number } | null = null;
  let lastHoverSlot: string | null = null;

  const setRayFromEvent = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };

  const pickRoom = (e: PointerEvent): ResolvedSpatialRoom | null => {
    if (propsRef.current.editorMode) return null;
    setRayFromEvent(e);
    const hits = raycaster.intersectObjects(highlights.hitMeshes, false);
    return (hits[0]?.object.userData.room as ResolvedSpatialRoom) || null;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (propsRef.current.editorMode) {
      renderer.domElement.style.cursor = 'crosshair';
      if (lastHoverSlot) {
        lastHoverSlot = null;
        highlights.setHoveredRoom(null, null);
        propsRef.current.onHoverRoom(null);
      }
      return;
    }
    const room = pickRoom(e);
    const nextSlot = room?.slotId || null;
    renderer.domElement.style.cursor = room ? 'pointer' : 'grab';
    if (nextSlot !== lastHoverSlot) {
      lastHoverSlot = nextSlot;
      highlights.setHoveredRoom(room, propsRef.current.selectedSlotId);
      propsRef.current.onHoverRoom(room);
    }
  };
  const onPointerDown = (e: PointerEvent) => { downPos = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: PointerEvent) => {
    if (!downPos || propsRef.current.editorMode) {
      downPos = null;
      return;
    }
    const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (dist > 6) return;

    setRayFromEvent(e);
    const tHits = raycaster.intersectObjects(teacherFigures.hitMeshes, false);
    if (tHits[0]?.object.userData.teacherId) {
      propsRef.current.onSelectTeacher(String(tHits[0].object.userData.teacherId));
      return;
    }
    const room = pickRoom(e);
    if (room) propsRef.current.onSelectRoom(room);
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  const onResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  const projVec = new THREE.Vector3();
  let rafId = 0;

  const projectToScreen = (x: number, y: number, z: number) => {
    projVec.set(x, y, z).project(camera);
    if (projVec.z > 1) return null;
    return {
      x: (projVec.x * 0.5 + 0.5) * container.clientWidth,
      y: (-projVec.y * 0.5 + 0.5) * container.clientHeight,
    };
  };

  const tick = () => {
    rafId = requestAnimationFrame(tick);
    const delta = clock.getDelta();
    drone.update(delta);
    effects.update(delta);
    teacherFigures.update(delta);

    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const room of propsRef.current.rooms) {
      const el = pillRefs.current.get(room.slotId);
      if (!el) continue;
      const pt = projectToScreen(room.center[0], room.max[1] + 0.35, room.center[2]);
      const inBounds = pt && pt.x > 30 && pt.x < w - 30 && pt.y > 76 && pt.y < h - 24;
      if (!inBounds) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }

    for (const t of propsRef.current.teacherPresence) {
      const el = teacherPillRefs.current.get(t.teacher_id);
      if (!el) continue;
      const pt = projectToScreen(t.x, t.y + 1.55, t.z);
      if (!pt || pt.x < 20 || pt.x > w - 20 || pt.y < 70 || pt.y > h - 20) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
        el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }

    const hov = propsRef.current.hoveredRoom;
    const callEl = calloutEl();
    if (callEl && hov) {
      const pt = projectToScreen(hov.center[0], hov.center[1] + 0.8, hov.max[2] - 0.3);
      if (pt) callEl.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
    }
    renderer.render(scene, camera);
  };
  tick();

  engine.dispose = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    editor.dispose();
    drone.dispose();
    studentFigures.dispose();
    teacherFigures.dispose();
    disposeCampusGraph(engine.graph);
    envTex.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  };

  return engine;
}
