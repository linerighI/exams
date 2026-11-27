/**
 * High-craft procedural architectural shape primitives for SARE: stepped classical pillars,
 * slatted acoustic wood-and-glass dividers, molded archways, chamfered cubes, and domes.
 */
import * as THREE from 'three';

function std(color: number, roughness = 0.42, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 1 });
}

function add(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Build a detailed architectural shape primitive centered at ground (0,0,0). */
export function buildShapeProp(
  prefabId: string,
  colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } | null {
  const root = new THREE.Group();
  const stone = std(colorTint ? new THREE.Color(colorTint).getHex() : 0xf8fafc, 0.38, 0.04);
  const trim = std(0x64748b, 0.28, 0.45);
  const wood = std(0xd6bfa3, 0.52, 0.04);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfdbfe, roughness: 0.12, clearcoat: 0.8, transparent: true, opacity: 0.45 });
  const materials: THREE.Material[] = [stone, trim, wood, glass];

  switch (prefabId) {
    case 'shape_cube': {
      add(root, new THREE.BoxGeometry(1.24, 0.1, 1.24), trim, 0, 0.05, 0);
      add(root, new THREE.BoxGeometry(1.16, 1.04, 1.16), stone, 0, 0.62, 0);
      add(root, new THREE.BoxGeometry(1.22, 0.08, 1.22), trim, 0, 1.18, 0);
      add(root, new THREE.BoxGeometry(1.2, 0.06, 1.2), wood, 0, 0.62, 0);
      return { root, materials };
    }
    case 'shape_pillar': {
      add(root, new THREE.BoxGeometry(0.76, 0.12, 0.76), trim, 0, 0.06, 0);
      add(root, new THREE.BoxGeometry(0.62, 0.14, 0.62), stone, 0, 0.19, 0);
      add(root, new THREE.CylinderGeometry(0.27, 0.3, 0.1, 20), trim, 0, 0.31, 0);
      add(root, new THREE.CylinderGeometry(0.21, 0.25, 2.32, 20), stone, 0, 1.52, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        add(root, new THREE.CylinderGeometry(0.025, 0.025, 2.24, 8), trim, Math.cos(a) * 0.22, 1.52, Math.sin(a) * 0.22);
      }
      add(root, new THREE.CylinderGeometry(0.28, 0.22, 0.14, 20), trim, 0, 2.75, 0);
      add(root, new THREE.BoxGeometry(0.72, 0.12, 0.72), stone, 0, 2.88, 0);
      add(root, new THREE.BoxGeometry(0.78, 0.06, 0.78), trim, 0, 2.97, 0);
      return { root, materials };
    }
    case 'shape_cylinder': {
      add(root, new THREE.CylinderGeometry(0.66, 0.68, 0.12, 24), trim, 0, 0.06, 0);
      add(root, new THREE.CylinderGeometry(0.58, 0.6, 1.22, 24), stone, 0, 0.73, 0);
      add(root, new THREE.CylinderGeometry(0.64, 0.64, 0.08, 24), trim, 0, 1.38, 0);
      return { root, materials };
    }
    case 'shape_arch': {
      for (const sx of [-0.95, 0.95]) {
        add(root, new THREE.BoxGeometry(0.52, 0.14, 0.56), trim, sx, 0.07, 0);
        add(root, new THREE.BoxGeometry(0.38, 2.05, 0.44), stone, sx, 1.16, 0);
        add(root, new THREE.BoxGeometry(0.48, 0.1, 0.52), trim, sx, 2.22, 0);
      }
      const arch = add(root, new THREE.TorusGeometry(0.95, 0.2, 14, 28, Math.PI), stone, 0, 2.24, 0);
      arch.castShadow = true;
      add(root, new THREE.BoxGeometry(0.26, 0.34, 0.48), trim, 0, 3.22, 0);
      add(root, new THREE.BoxGeometry(2.44, 0.12, 0.54), trim, 0, 3.4, 0);
      return { root, materials };
    }
    case 'shape_slab': {
      add(root, new THREE.BoxGeometry(2.56, 0.14, 2.56), trim, 0, 0.07, 0);
      add(root, new THREE.BoxGeometry(2.38, 0.16, 2.38), stone, 0, 0.22, 0);
      add(root, new THREE.BoxGeometry(2.24, 0.04, 2.24), wood, 0, 0.32, 0);
      return { root, materials };
    }
    case 'shape_cone': {
      add(root, new THREE.BoxGeometry(1.36, 0.14, 1.36), trim, 0, 0.07, 0);
      add(root, new THREE.ConeGeometry(0.86, 1.72, 4), stone, 0, 1.0, 0, Math.PI / 4);
      return { root, materials };
    }
    case 'shape_dome': {
      add(root, new THREE.CylinderGeometry(1.18, 1.22, 0.16, 28), trim, 0, 0.08, 0);
      add(root, new THREE.SphereGeometry(1.1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 0.16, 0);
      add(root, new THREE.SphereGeometry(0.14, 14, 12), trim, 0, 1.3, 0);
      return { root, materials };
    }
    case 'shape_wall_divider': {
      // Architectural acoustic slat + frosted glass partition in brushed metal frame
      add(root, new THREE.BoxGeometry(2.44, 0.08, 0.24), trim, 0, 0.04, 0);
      add(root, new THREE.BoxGeometry(2.44, 0.08, 0.2), trim, 0, 2.12, 0);
      for (const sx of [-1.17, 1.17]) add(root, new THREE.BoxGeometry(0.08, 2.1, 0.2), trim, sx, 1.08, 0);
      add(root, new THREE.BoxGeometry(1.1, 1.98, 0.04), glass, 0.56, 1.08, 0);
      for (let x = -1.04; x <= -0.04; x += 0.16) add(root, new THREE.BoxGeometry(0.07, 1.98, 0.14), wood, x, 1.08, 0);
      add(root, new THREE.BoxGeometry(0.08, 2.02, 0.16), stone, -0.02, 1.08, 0);
      return { root, materials };
    }
    default:
      return null;
  }
}
