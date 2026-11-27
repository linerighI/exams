/**
 * Unified 3D prop catalog, procedural builder dispatcher, and cached GLTF/GLB
 * external model loader for SARE (School Advanced Rendering Engine).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SpatialAssignment3D } from '../../types';
import { buildFacilityProp } from './propFacilities';
import { buildFurnitureProp } from './propFurniture';
import { buildNatureProp } from './propNature';
import { buildShapeProp } from './propShapes';

export interface PropCatalogItem {
  id: string;
  category: 'shapes' | 'furniture' | 'nature' | 'facilities';
  labelAr: string;
  labelEn: string;
  defaultScale: number;
}

export const PROP_CATALOG: PropCatalogItem[] = [
  // Architectural Custom Shapes
  { id: 'shape_cube', category: 'shapes', labelAr: 'مكعب معماري', labelEn: 'Cube Block', defaultScale: 1 },
  { id: 'shape_pillar', category: 'shapes', labelAr: 'عمود معماري', labelEn: 'Pillar', defaultScale: 1 },
  { id: 'shape_cylinder', category: 'shapes', labelAr: 'أسطوانة', labelEn: 'Cylinder', defaultScale: 1 },
  { id: 'shape_arch', category: 'shapes', labelAr: 'قوس معماري', labelEn: 'Archway', defaultScale: 1 },
  { id: 'shape_slab', category: 'shapes', labelAr: 'منصة / رصيف', labelEn: 'Platform Slab', defaultScale: 1 },
  { id: 'shape_cone', category: 'shapes', labelAr: 'هرم / قمة', labelEn: 'Pyramid', defaultScale: 1 },
  { id: 'shape_dome', category: 'shapes', labelAr: 'قبة نصفية', labelEn: 'Dome', defaultScale: 1 },
  { id: 'shape_wall_divider', category: 'shapes', labelAr: 'جدار فاصل', labelEn: 'Divider Wall', defaultScale: 1 },
  // Classroom & Office Furniture
  { id: 'desk_cluster', category: 'furniture', labelAr: 'مقاعد طلبة 4x', labelEn: '4x Desk Cluster', defaultScale: 1 },
  { id: 'teacher_desk', category: 'furniture', labelAr: 'مكتب المعلم', labelEn: 'Teacher Desk', defaultScale: 1 },
  { id: 'whiteboard', category: 'furniture', labelAr: 'سبورة ذكية', labelEn: 'Smart Whiteboard', defaultScale: 1 },
  { id: 'lab_bench', category: 'furniture', labelAr: 'منصة حاسوب', labelEn: 'Lab Workstation', defaultScale: 1 },
  { id: 'bookshelf', category: 'furniture', labelAr: 'مكتبة وكتب', labelEn: 'Bookcase', defaultScale: 1 },
  { id: 'conference_table', category: 'furniture', labelAr: 'طاولة اجتماعات', labelEn: 'Meeting Table', defaultScale: 1 },
  { id: 'auditorium_stage', category: 'furniture', labelAr: 'منصة المسرح', labelEn: 'Stage Podium', defaultScale: 1 },
  { id: 'lockers', category: 'furniture', labelAr: 'خزائن طلبة', labelEn: 'Locker Bank', defaultScale: 1 },
  { id: 'ac_unit', category: 'furniture', labelAr: 'وحدة تكييف', labelEn: 'Wall AC Unit', defaultScale: 1 },
  { id: 'podium', category: 'furniture', labelAr: 'منصة خطابة', labelEn: 'Lectern', defaultScale: 1 },
  { id: 'reception_desk', category: 'furniture', labelAr: 'كاونتر استقبال', labelEn: 'Reception Desk', defaultScale: 1 },
  { id: 'sofa', category: 'furniture', labelAr: 'أريكة جلوس', labelEn: 'Lounge Sofa', defaultScale: 1 },
  { id: 'cafeteria_table', category: 'furniture', labelAr: 'طاولة مقصف', labelEn: 'Cafeteria Table', defaultScale: 1 },
  { id: 'wall_tv', category: 'furniture', labelAr: 'شاشة عرض', labelEn: 'Smart Display', defaultScale: 1 },
  { id: 'trophy_case', category: 'furniture', labelAr: 'خزانة جوائز', labelEn: 'Trophy Case', defaultScale: 1 },
  { id: 'science_table', category: 'furniture', labelAr: 'طاولة مختبر', labelEn: 'Science Bench', defaultScale: 1 },
  { id: 'projector_screen', category: 'furniture', labelAr: 'شاشة بروجكتر', labelEn: 'Projector Screen', defaultScale: 1 },
  // Nature & Courtyard
  { id: 'tree_round', category: 'nature', labelAr: 'شجرة مزروعة', labelEn: 'Courtyard Tree', defaultScale: 1 },
  { id: 'tree_cypress', category: 'nature', labelAr: 'شجرة سرو', labelEn: 'Cypress Tree', defaultScale: 1 },
  { id: 'palm_tree', category: 'nature', labelAr: 'نخلة ساحة', labelEn: 'Palm Tree', defaultScale: 1 },
  { id: 'planter', category: 'nature', labelAr: 'حوض نباتات', labelEn: 'Hedge Planter', defaultScale: 1 },
  { id: 'flower_bed', category: 'nature', labelAr: 'حوض أزهار', labelEn: 'Flower Bed', defaultScale: 1 },
  { id: 'hedge_row', category: 'nature', labelAr: 'سياج نباتي', labelEn: 'Hedge Row', defaultScale: 1 },
  { id: 'bench', category: 'nature', labelAr: 'مقعد ساحة', labelEn: 'Park Bench', defaultScale: 1 },
  { id: 'fountain', category: 'nature', labelAr: 'نافورة مياه', labelEn: 'Stone Fountain', defaultScale: 1 },
  { id: 'stone_path', category: 'nature', labelAr: 'ممر حجري', labelEn: 'Stone Path', defaultScale: 1 },
  { id: 'lamp_post', category: 'nature', labelAr: 'عمود إنارة', labelEn: 'Lamp Post', defaultScale: 1 },
  // Campus Facilities
  { id: 'stairs', category: 'facilities', labelAr: 'درج طابقي', labelEn: 'Glass Staircase', defaultScale: 1 },
  { id: 'flagpole', category: 'facilities', labelAr: 'سارية علم', labelEn: 'Flagpole', defaultScale: 1 },
  { id: 'basketball_hoop', category: 'facilities', labelAr: 'ملعب سلة', labelEn: 'Basketball Hoop', defaultScale: 1 },
  { id: 'soccer_goal', category: 'facilities', labelAr: 'مرمى كرة قدم', labelEn: 'Soccer Goal', defaultScale: 1 },
  { id: 'pergola', category: 'facilities', labelAr: 'مظلة خشبية', labelEn: 'Shade Pergola', defaultScale: 1 },
  { id: 'gate', category: 'facilities', labelAr: 'بوابة المدرسة', labelEn: 'Entrance Gate', defaultScale: 1 },
  { id: 'bike_rack', category: 'facilities', labelAr: 'موقف دراجات', labelEn: 'Bike Rack', defaultScale: 1 },
  { id: 'water_cooler', category: 'facilities', labelAr: 'مبرد مياه', labelEn: 'Water Cooler', defaultScale: 1 },
  { id: 'bus_shelter', category: 'facilities', labelAr: 'مظلة باصات', labelEn: 'Bus Shelter', defaultScale: 1 },
  { id: 'guard_booth', category: 'facilities', labelAr: 'غرفة حراسة', labelEn: 'Guard Booth', defaultScale: 1 },
];

const gltfCache = new Map<string, Promise<THREE.Group>>();
const gltfLoader = new GLTFLoader();
gltfLoader.setCrossOrigin('anonymous');

function loadNormalizedGltf(url: string): Promise<THREE.Group> {
  let p = gltfCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then((gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.01);
      const norm = 1.6 / maxDim;
      model.scale.multiplyScalar(norm);
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box2.min.y, -center.z);
      model.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      return model;
    }).catch((err) => {
      gltfCache.delete(url);
      throw err;
    });
    gltfCache.set(url, p);
  }
  return p;
}

/** Build a procedural 3D prefab or load an external GLTF/GLB asset into the group. */
export function buildPropMesh(
  prefabId: string,
  colorTint?: string,
  modelUrl?: string,
): { root: THREE.Group; materials: THREE.Material[] } {
  if (modelUrl) {
    const root = new THREE.Group();
    const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 });
    const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), placeholderMat);
    placeholder.position.y = 0.4;
    root.add(placeholder);
    void loadNormalizedGltf(modelUrl)
      .then((template) => {
        root.remove(placeholder);
        placeholder.geometry.dispose();
        placeholderMat.dispose();
        const clone = template.clone(true);
        clone.traverse((c) => {
          c.userData = { ...c.userData, ...root.userData };
        });
        root.add(clone);
      })
      .catch(() => {
        // Replace loading placeholder with a clean architectural fallback block if offline/404
        placeholderMat.color.setHex(0xe2e8f0);
        placeholderMat.opacity = 0.92;
        placeholderMat.transparent = false;
      });
    return { root, materials: [placeholderMat] };
  }
  return (
    buildShapeProp(prefabId, colorTint) ||
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
    duty: 0x007aff, exam: 0xff3b30, homework_zone: 0x34c759, event: 0xaf52de,
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
