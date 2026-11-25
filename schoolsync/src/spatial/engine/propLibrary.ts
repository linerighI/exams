/**
 * Unified 3D prop catalog & dispatcher for SARE (School Advanced Rendering Engine):
 * routes across detailed furniture, botanical/courtyard, and facility architectural builders.
 */
import * as THREE from 'three';
import type { SpatialAssignment3D } from '../../types';
import { buildFacilityProp } from './propFacilities';
import { buildFurnitureProp } from './propFurniture';
import { buildNatureProp } from './propNature';

export interface PropCatalogItem {
  id: string;
  category: 'furniture' | 'nature' | 'facilities' | 'pins';
  labelAr: string;
  labelEn: string;
  defaultScale: number;
}

export const PROP_CATALOG: PropCatalogItem[] = [
  { id: 'desk_cluster', category: 'furniture', labelAr: 'مقاعد طلبة 4x', labelEn: '4x Desk Cluster', defaultScale: 1 },
  { id: 'teacher_desk', category: 'furniture', labelAr: 'مكتب المعلم', labelEn: 'Teacher Desk', defaultScale: 1 },
  { id: 'whiteboard', category: 'furniture', labelAr: 'سبورة ذكية', labelEn: 'Smart Whiteboard', defaultScale: 1 },
  { id: 'lab_bench', category: 'furniture', labelAr: 'منصة حاسوب', labelEn: 'Lab Workstation', defaultScale: 1 },
  { id: 'bookshelf', category: 'furniture', labelAr: 'مكتبة وكتب', labelEn: 'Bookcase', defaultScale: 1 },
  { id: 'conference_table', category: 'furniture', labelAr: 'طاولة اجتماعات', labelEn: 'Meeting Table', defaultScale: 1 },
  { id: 'auditorium_stage', category: 'furniture', labelAr: 'منصة المسرح', labelEn: 'Stage Podium', defaultScale: 1 },
  { id: 'lockers', category: 'furniture', labelAr: 'خزائن طلبة', labelEn: 'Locker Bank', defaultScale: 1 },
  { id: 'ac_unit', category: 'furniture', labelAr: 'وحدة تكييف', labelEn: 'Wall AC Unit', defaultScale: 1 },
  { id: 'tree_round', category: 'nature', labelAr: 'شجرة مزروعة', labelEn: 'Courtyard Tree', defaultScale: 1 },
  { id: 'tree_cypress', category: 'nature', labelAr: 'شجرة سرو', labelEn: 'Cypress Tree', defaultScale: 1 },
  { id: 'planter', category: 'nature', labelAr: 'حوض نباتات', labelEn: 'Hedge Planter', defaultScale: 1 },
  { id: 'bench', category: 'nature', labelAr: 'مقعد ساحة', labelEn: 'Park Bench', defaultScale: 1 },
  { id: 'fountain', category: 'nature', labelAr: 'نافورة مياه', labelEn: 'Stone Fountain', defaultScale: 1 },
  { id: 'stairs', category: 'facilities', labelAr: 'درج طابقي', labelEn: 'Glass Staircase', defaultScale: 1 },
  { id: 'flagpole', category: 'facilities', labelAr: 'سارية علم', labelEn: 'Flagpole', defaultScale: 1 },
  { id: 'basketball_hoop', category: 'facilities', labelAr: 'ملعب سلة', labelEn: 'Basketball Hoop', defaultScale: 1 },
  { id: 'pergola', category: 'facilities', labelAr: 'مظلة خشبية', labelEn: 'Shade Pergola', defaultScale: 1 },
  { id: 'gate', category: 'facilities', labelAr: 'بوابة المدرسة', labelEn: 'Entrance Gate', defaultScale: 1 },
];

/** Build a high-detail untextured multi-part procedural 3D prefab centered at ground (0,0,0). */
export function buildPropMesh(
  prefabId: string,
  colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } {
  return (
    buildFurnitureProp(prefabId, colorTint) ||
    buildNatureProp(prefabId, colorTint) ||
    buildFacilityProp(prefabId, colorTint) || {
      root: new THREE.Group(),
      materials: [],
    }
  );
}

/** Build a hovering 3D spatial assignment beacon pin placed inside a room or zone. */
export function buildAssignmentPinMesh(assignment: SpatialAssignment3D): { root: THREE.Group; materials: THREE.Material[] } {
  const colorMap: Record<SpatialAssignment3D['type'], number> = {
    duty: 0x007aff,
    exam: 0xff3b30,
    homework_zone: 0x34c759,
    event: 0xaf52de,
  };
  const col = colorMap[assignment.type] || 0x007aff;
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: 0.18 });
  const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.44, 24), ringMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.16;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), mat);
  stem.position.y = 0.8;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
  gem.position.y = 1.65;
  gem.castShadow = true;
  root.add(base, stem, gem);
  return { root, materials: [mat, ringMat] };
}
