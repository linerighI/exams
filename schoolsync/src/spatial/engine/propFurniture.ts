/**
 * High-detail untextured multi-part architectural classroom & office furniture prefabs
 * for SARE (School Advanced Rendering Engine): slim metallic legs, drawers, monitors, books, lockers.
 */
import * as THREE from 'three';

function matStd(color: number, roughness = 0.5, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 1 });
}

function box(
  g: THREE.Group, w: number, h: number, d: number,
  x: number, y: number, z: number, mat: THREE.Material, rx = 0, ry = 0,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function cyl(
  g: THREE.Group, rt: number, rb: number, h: number,
  x: number, y: number, z: number, mat: THREE.Material, seg = 10,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function addDetailedChair(g: THREE.Group, x: number, z: number, wood: THREE.Material, metal: THREE.Material, pad: THREE.Material) {
  for (const lx of [-0.16, 0.16]) {
    for (const lz of [-0.16, 0.16]) cyl(g, 0.016, 0.014, 0.4, x + lx, 0.2, z + lz, metal, 8);
  }
  box(g, 0.38, 0.04, 0.36, x, 0.41, z, pad);
  box(g, 0.03, 0.32, 0.03, x - 0.15, 0.57, z + 0.16, metal);
  box(g, 0.03, 0.32, 0.03, x + 0.15, 0.57, z + 0.16, metal);
  box(g, 0.38, 0.18, 0.035, x, 0.68, z + 0.17, wood, -0.08);
}

/** Build detailed furniture prefab; returns null if prefabId is handled elsewhere. */
export function buildFurnitureProp(
  prefabId: string, colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } | null {
  const root = new THREE.Group();
  const birch = matStd(colorTint ? new THREE.Color(colorTint).getHex() : 0xe4d4bf, 0.48);
  const darkWood = matStd(0xbba286, 0.56);
  const metal = matStd(0x94a3b8, 0.28, 0.55);
  const screen = matStd(0x1e293b, 0.25, 0.2);
  const white = matStd(0xffffff, 0.38);
  const blue = matStd(0x007aff, 0.35);
  const pad = matStd(0x475569, 0.7);
  const coral = matStd(0xf43f5e, 0.4);
  const sage = matStd(0x34c759, 0.42);
  const materials: THREE.Material[] = [birch, darkWood, metal, screen, white, blue, pad, coral, sage];

  switch (prefabId) {
    case 'desk_cluster': {
      for (const sx of [-0.66, 0.66]) {
        for (const sz of [-0.66, 0.66]) {
          const dx = sx, dz = sz;
          for (const lx of [-0.36, 0.36]) for (const lz of [-0.21, 0.21]) cyl(root, 0.018, 0.016, 0.66, dx + lx, 0.33, dz + lz, metal, 8);
          box(root, 0.72, 0.11, 0.4, dx, 0.58, dz, darkWood);
          box(root, 0.86, 0.045, 0.54, dx, 0.67, dz, birch);
          box(root, 0.22, 0.02, 0.16, dx - 0.1, 0.705, dz - 0.04, white, 0, 0.12);
          box(root, 0.14, 0.014, 0.018, dx + 0.18, 0.7, dz + 0.08, blue, 0, -0.35);
          addDetailedChair(root, dx, dz + 0.46, birch, metal, pad);
        }
      }
      return { root, materials };
    }
    case 'teacher_desk': {
      for (const lx of [-0.78, 0.78]) for (const lz of [-0.36, 0.36]) box(root, 0.05, 0.72, 0.05, lx, 0.36, lz, metal);
      box(root, 1.66, 0.05, 0.82, 0, 0.73, 0, birch);
      box(root, 1.48, 0.42, 0.04, 0, 0.5, 0.36, darkWood);
      box(root, 0.44, 0.56, 0.68, 0.52, 0.38, 0, darkWood);
      for (let i = 0; i < 3; i++) {
        box(root, 0.38, 0.14, 0.03, 0.52, 0.2 + i * 0.17, -0.34, birch);
        box(root, 0.12, 0.018, 0.02, 0.52, 0.2 + i * 0.17, -0.36, metal);
      }
      // Open laptop + pen cup
      box(root, 0.34, 0.016, 0.23, -0.15, 0.76, 0.02, metal);
      box(root, 0.34, 0.22, 0.014, -0.15, 0.86, 0.13, screen, -0.22);
      cyl(root, 0.04, 0.036, 0.11, -0.58, 0.81, -0.15, blue, 12);
      // Executive swivel chair
      cyl(root, 0.03, 0.03, 0.24, 0, 0.2, -0.66, metal);
      cyl(root, 0.28, 0.28, 0.04, 0, 0.06, -0.66, metal, 5);
      box(root, 0.46, 0.06, 0.44, 0, 0.42, -0.66, pad);
      box(root, 0.44, 0.44, 0.06, 0, 0.68, -0.86, pad, -0.1);
      box(root, 0.04, 0.2, 0.32, -0.24, 0.52, -0.66, metal);
      box(root, 0.04, 0.2, 0.32, 0.24, 0.52, -0.66, metal);
      return { root, materials };
    }
    case 'whiteboard': {
      box(root, 2.52, 1.24, 0.05, 0, 1.56, 0, metal);
      box(root, 2.4, 1.12, 0.065, 0, 1.56, 0.01, white);
      box(root, 0.45, 0.05, 0.09, 0, 2.21, 0.03, screen);
      box(root, 1.9, 0.04, 0.12, 0, 0.94, 0.07, metal);
      box(root, 0.11, 0.028, 0.028, -0.35, 0.98, 0.09, blue, 0, 0.2);
      box(root, 0.11, 0.028, 0.028, -0.18, 0.98, 0.09, coral, 0, -0.1);
      box(root, 0.16, 0.04, 0.06, 0.25, 0.98, 0.09, darkWood);
      return { root, materials };
    }
    case 'lab_bench': {
      for (const lx of [-1.05, 1.05]) box(root, 0.05, 0.72, 0.7, lx, 0.36, 0, metal);
      box(root, 2.32, 0.05, 0.78, 0, 0.74, 0, white);
      for (const px of [-0.58, 0.58]) {
        box(root, 0.04, 0.16, 0.04, px, 0.85, -0.18, metal);
        box(root, 0.24, 0.02, 0.16, px, 0.77, -0.16, metal);
        box(root, 0.62, 0.36, 0.035, px, 1.02, -0.16, screen, -0.06);
        box(root, 0.42, 0.018, 0.15, px - 0.05, 0.77, 0.14, pad);
        box(root, 0.06, 0.02, 0.09, px + 0.24, 0.77, 0.14, screen);
        box(root, 0.18, 0.38, 0.36, px + 0.36, 0.2, 0, screen);
        cyl(root, 0.025, 0.025, 0.46, px, 0.23, 0.56, metal);
        cyl(root, 0.18, 0.18, 0.05, px, 0.47, 0.56, birch, 16);
      }
      return { root, materials };
    }
    case 'bookshelf': {
      box(root, 1.64, 1.88, 0.04, 0, 0.94, -0.2, darkWood);
      box(root, 0.05, 1.88, 0.42, -0.8, 0.94, 0, birch);
      box(root, 0.05, 1.88, 0.42, 0.8, 0.94, 0, birch);
      const bookCols = [blue, coral, sage, darkWood, white];
      for (let i = 0; i < 5; i++) {
        const y = 0.14 + i * 0.43;
        box(root, 1.62, 0.045, 0.42, 0, y, 0, birch);
        if (i < 4) {
          for (let k = 0; k < 6; k++) {
            const bw = 0.06 + (k % 2) * 0.02;
            const bh = 0.25 + ((k + i) % 3) * 0.04;
            box(root, bw, bh, 0.26, -0.6 + k * 0.17 + (i % 2) * 0.25, y + 0.025 + bh / 2, 0.03, bookCols[(k + i) % 5]);
          }
        }
      }
      return { root, materials };
    }
    case 'conference_table': {
      box(root, 2.2, 0.06, 1.24, 0, 0.73, 0, birch);
      cyl(root, 0.62, 0.62, 0.06, -1.1, 0.73, 0, birch, 20);
      cyl(root, 0.62, 0.62, 0.06, 1.1, 0.73, 0, birch, 20);
      cyl(root, 0.16, 0.24, 0.7, -0.85, 0.35, 0, metal, 14);
      cyl(root, 0.16, 0.24, 0.7, 0.85, 0.35, 0, metal, 14);
      box(root, 0.6, 0.02, 0.14, 0, 0.77, 0, screen);
      for (const x of [-0.95, 0, 0.95]) {
        addDetailedChair(root, x, 0.88, birch, metal, pad);
        addDetailedChair(root, x, -0.88, birch, metal, pad);
      }
      return { root, materials };
    }
    case 'auditorium_stage': {
      box(root, 4.6, 0.48, 2.6, 0, 0.24, 0, darkWood);
      box(root, 4.68, 0.06, 2.68, 0, 0.49, 0, birch);
      box(root, 1.5, 0.22, 0.5, 0, 0.11, 1.45, birch);
      box(root, 4.5, 1.9, 0.14, 0, 1.42, -1.22, white);
      for (let x = -2.0; x <= 2.01; x += 0.5) box(root, 0.08, 1.85, 0.18, x, 1.42, -1.18, darkWood);
      box(root, 0.68, 0.96, 0.48, 0, 1.0, 0.78, darkWood);
      box(root, 0.74, 0.05, 0.56, 0, 1.5, 0.78, birch, 0.16);
      cyl(root, 0.012, 0.012, 0.26, 0.15, 1.62, 0.72, screen);
      return { root, materials };
    }
    case 'lockers': {
      box(root, 1.96, 0.1, 0.48, 0, 0.05, 0, pad);
      box(root, 1.96, 1.75, 0.48, 0, 0.97, 0, white);
      for (let i = 0; i < 4; i++) {
        const lx = -0.72 + i * 0.48;
        box(root, 0.43, 1.64, 0.03, lx, 0.97, 0.24, metal);
        for (let v = 0; v < 3; v++) box(root, 0.26, 0.025, 0.02, lx, 1.56 - v * 0.07, 0.26, screen);
        box(root, 0.03, 0.14, 0.03, lx + 0.15, 1.02, 0.27, blue);
      }
      return { root, materials };
    }
    case 'ac_unit': {
      box(root, 1.25, 0.34, 0.24, 0, 2.35, 0, white);
      box(root, 1.15, 0.04, 0.08, 0, 2.22, 0.13, metal, 0.35);
      box(root, 0.06, 0.025, 0.02, 0.48, 2.3, 0.125, sage);
      return { root, materials };
    }
    case 'podium': {
      box(root, 0.72, 0.08, 0.56, 0, 0.04, 0, metal);
      box(root, 0.62, 1.04, 0.44, 0, 0.6, 0, darkWood);
      box(root, 0.74, 0.05, 0.56, 0, 1.14, 0.02, birch, 0.16);
      cyl(root, 0.012, 0.012, 0.24, 0.18, 1.26, -0.05, screen);
      return { root, materials };
    }
    case 'reception_desk': {
      box(root, 2.6, 1.06, 0.78, 0, 0.53, 0, white);
      box(root, 2.66, 0.06, 0.84, 0, 1.09, 0, birch);
      box(root, 2.3, 0.14, 0.06, 0, 0.55, 0.4, blue);
      box(root, 0.48, 0.3, 0.03, -0.5, 1.28, -0.1, screen);
      return { root, materials };
    }
    case 'sofa': {
      box(root, 2.1, 0.28, 0.86, 0, 0.24, 0, pad);
      box(root, 2.1, 0.52, 0.22, 0, 0.58, -0.32, pad);
      box(root, 0.2, 0.46, 0.86, -0.95, 0.44, 0, pad);
      box(root, 0.2, 0.46, 0.86, 0.95, 0.44, 0, pad);
      for (const lx of [-0.92, 0.92]) for (const lz of [-0.34, 0.34]) cyl(root, 0.025, 0.02, 0.12, lx, 0.06, lz, metal);
      return { root, materials };
    }
    case 'cafeteria_table': {
      box(root, 2.1, 0.06, 0.92, 0, 0.74, 0, birch);
      for (const sx of [-0.8, 0.8]) box(root, 0.06, 0.72, 0.72, sx, 0.36, 0, metal);
      for (const bz of [-0.68, 0.68]) {
        box(root, 1.95, 0.05, 0.34, 0, 0.44, bz, birch);
        for (const sx of [-0.75, 0.75]) box(root, 0.05, 0.42, 0.28, sx, 0.21, bz, metal);
      }
      return { root, materials };
    }
    case 'wall_tv': {
      box(root, 1.84, 1.06, 0.06, 0, 1.65, 0, screen);
      box(root, 1.76, 0.98, 0.07, 0, 1.65, 0.01, blue);
      box(root, 0.32, 0.22, 0.08, 0, 1.65, -0.04, metal);
      return { root, materials };
    }
    case 'trophy_case': {
      box(root, 1.7, 2.0, 0.48, 0, 1.0, 0, darkWood);
      for (let i = 0; i < 3; i++) box(root, 1.56, 0.04, 0.4, 0, 0.42 + i * 0.54, 0.02, white);
      for (const tx of [-0.45, 0, 0.45]) cyl(root, 0.08, 0.04, 0.24, tx, 1.12, 0.04, blue);
      return { root, materials };
    }
    case 'science_table': {
      box(root, 2.2, 0.06, 1.0, 0, 0.82, 0, screen);
      for (const lx of [-0.95, 0.95]) for (const lz of [-0.4, 0.4]) box(root, 0.06, 0.8, 0.06, lx, 0.4, lz, metal);
      cyl(root, 0.06, 0.08, 0.28, -0.5, 0.98, 0.1, sage);
      cyl(root, 0.05, 0.07, 0.22, 0.45, 0.95, -0.1, blue);
      return { root, materials };
    }
    case 'projector_screen': {
      box(root, 2.8, 0.12, 0.12, 0, 2.55, 0, metal);
      box(root, 2.6, 1.55, 0.03, 0, 1.72, 0, white);
      box(root, 2.66, 0.05, 0.05, 0, 0.94, 0, screen);
      return { root, materials };
    }
    default:
      return null;
  }
}
