/**
 * Procedural architectural shape primitives for SARE (cube, classical pillar, cylinder,
 * archway, raised slab, pyramid, dome, and partition wall) — all scalable on X/Y/Z.
 */
import * as THREE from 'three';

function shapeMat(color: number, roughness = 0.42, metalness = 0.06) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 1 });
}

function addMesh(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Build a scalable architectural shape primitive centered at ground (0,0,0). */
export function buildShapeProp(
  prefabId: string,
  colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } | null {
  const root = new THREE.Group();
  const primary = shapeMat(colorTint ? new THREE.Color(colorTint).getHex() : 0xf1f5f9, 0.4, 0.06);
  const accent = shapeMat(0x94a3b8, 0.34, 0.25);
  const materials: THREE.Material[] = [primary, accent];

  switch (prefabId) {
    case 'shape_cube': {
      addMesh(root, new THREE.BoxGeometry(1.2, 1.2, 1.2), primary, 0.6);
      return { root, materials };
    }
    case 'shape_pillar': {
      addMesh(root, new THREE.BoxGeometry(0.68, 0.16, 0.68), accent, 0.08);
      addMesh(root, new THREE.CylinderGeometry(0.22, 0.26, 2.68, 20), primary, 1.5);
      addMesh(root, new THREE.BoxGeometry(0.68, 0.16, 0.68), accent, 2.92);
      return { root, materials };
    }
    case 'shape_cylinder': {
      addMesh(root, new THREE.CylinderGeometry(0.6, 0.6, 1.4, 24), primary, 0.7);
      return { root, materials };
    }
    case 'shape_arch': {
      for (const sx of [-0.9, 0.9]) {
        addMesh(root, new THREE.BoxGeometry(0.36, 2.2, 0.42), primary, 1.1).position.x = sx;
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.21, 12, 24, Math.PI), primary);
      arch.position.y = 2.2;
      arch.castShadow = true;
      arch.receiveShadow = true;
      root.add(arch);
      addMesh(root, new THREE.BoxGeometry(2.3, 0.18, 0.48), accent, 3.18);
      return { root, materials };
    }
    case 'shape_slab': {
      addMesh(root, new THREE.BoxGeometry(2.4, 0.28, 2.4), primary, 0.14);
      addMesh(root, new THREE.BoxGeometry(2.46, 0.05, 2.46), accent, 0.29);
      return { root, materials };
    }
    case 'shape_cone': {
      addMesh(root, new THREE.ConeGeometry(0.85, 1.8, 4), primary, 0.9).rotation.y = Math.PI / 4;
      return { root, materials };
    }
    case 'shape_dome': {
      addMesh(root, new THREE.SphereGeometry(1.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), primary, 0);
      addMesh(root, new THREE.CylinderGeometry(1.14, 1.16, 0.12, 24), accent, 0.06);
      return { root, materials };
    }
    case 'shape_wall_divider': {
      addMesh(root, new THREE.BoxGeometry(2.4, 2.1, 0.22), primary, 1.05);
      addMesh(root, new THREE.BoxGeometry(2.44, 0.08, 0.26), accent, 0.04);
      return { root, materials };
    }
    default:
      return null;
  }
}
