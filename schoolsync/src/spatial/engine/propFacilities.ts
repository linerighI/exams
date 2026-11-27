/**
 * High-detail untextured facility prefabs (cantilevered glass-balustrade stairs, flagpole,
 * glass-backboard basketball hoop, slatted pergola, and stone school gate) for SARE.
 */
import * as THREE from 'three';

function stdMat(color: number, roughness = 0.46, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 1 });
}

function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Build detailed campus facility prefab; returns null if handled elsewhere. */
export function buildFacilityProp(
  prefabId: string, colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } | null {
  const root = new THREE.Group();
  const white = stdMat(0xffffff, 0.42);
  const metal = stdMat(0x94a3b8, 0.28, 0.55);
  const birch = stdMat(0xe4d4bf, 0.52);
  const blue = stdMat(colorTint ? new THREE.Color(colorTint).getHex() : 0x007aff, 0.38);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd, roughness: 0.14, clearcoat: 0.7, transparent: true, opacity: 0.5,
  });
  const materials: THREE.Material[] = [white, metal, birch, blue, glass];

  switch (prefabId) {
    case 'stairs': {
      // Angled central stringer + 10 steps + glass side balustrades
      box(root, 0.34, 0.28, 4.4, 0, 1.55, 0, white, -0.68);
      for (let i = 0; i < 10; i++) {
        box(root, 2.1, 0.1, 0.38, 0, 0.16 + i * 0.32, -1.6 + i * 0.36, white);
        box(root, 2.1, 0.03, 0.04, 0, 0.215 + i * 0.32, -1.42 + i * 0.36, metal);
      }
      box(root, 2.2, 0.16, 0.9, 0, 3.28, 2.15, white);
      for (const sx of [-1.04, 1.04]) {
        box(root, 0.04, 0.85, 4.2, sx, 2.1, 0, glass, -0.68);
        box(root, 0.06, 0.05, 4.3, sx, 2.54, 0, metal, -0.68);
        box(root, 0.05, 0.9, 0.05, sx, 0.45, -1.65, metal);
        box(root, 0.05, 0.9, 0.05, sx, 3.65, 1.95, metal);
      }
      return { root, materials };
    }
    case 'flagpole': {
      const gold = stdMat(0xf59e0b, 0.25, 0.7);
      materials.push(gold);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.28, 8), white);
      base.position.y = 0.14;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.075, 4.7, 12), metal);
      mast.position.y = 2.45;
      mast.castShadow = true;
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), gold);
      finial.position.y = 4.86;
      root.add(base, mast, finial);
      box(root, 0.46, 0.72, 0.045, 0.25, 4.25, 0.01, blue, 0, 0.06);
      box(root, 0.44, 0.72, 0.045, 0.67, 4.25, -0.02, blue, 0, -0.1);
      box(root, 0.36, 0.72, 0.045, 1.04, 4.25, 0.01, white, 0, 0.08);
      return { root, materials };
    }
    case 'basketball_hoop': {
      const orange = stdMat(0xff5a1f, 0.35);
      materials.push(orange);
      box(root, 0.56, 0.12, 0.56, 0, 0.06, 0, metal);
      box(root, 0.22, 1.35, 0.22, 0, 0.76, 0, blue);
      box(root, 0.14, 3.05, 0.14, 0, 1.62, 0, metal);
      box(root, 0.12, 0.12, 0.72, 0, 3.05, 0.34, metal);
      box(root, 1.48, 0.96, 0.05, 0, 3.05, 0.7, glass);
      box(root, 1.52, 0.05, 0.07, 0, 3.53, 0.7, white);
      box(root, 1.52, 0.05, 0.07, 0, 2.57, 0.7, white);
      box(root, 0.52, 0.38, 0.02, 0, 2.88, 0.73, orange);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 20), orange);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 2.7, 0.98);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.13, 0.36, 12, 1, true), white);
      net.position.set(0, 2.52, 0.98);
      root.add(rim, net);
      return { root, materials };
    }
    case 'pergola': {
      for (const sx of [-1.55, 1.55]) {
        for (const sz of [-1.25, 1.25]) {
          box(root, 0.3, 0.18, 0.3, sx, 0.09, sz, metal);
          box(root, 0.16, 2.55, 0.16, sx, 1.4, sz, white);
        }
        box(root, 0.16, 0.18, 2.85, sx, 2.72, 0, white);
      }
      for (let z = -1.25; z <= 1.26; z += 0.31) box(root, 3.38, 0.1, 0.08, 0, 2.84, z, birch, 0.25);
      return { root, materials };
    }
    case 'gate': {
      for (const sx of [-1.95, 1.95]) {
        box(root, 0.64, 0.2, 0.64, sx, 0.1, 0, metal);
        box(root, 0.54, 3.15, 0.54, sx, 1.72, 0, white);
        box(root, 0.64, 0.12, 0.64, sx, 3.34, 0, metal);
        box(root, 0.06, 2.2, 0.06, sx, 1.65, 0.28, blue);
      }
      box(root, 4.54, 0.42, 0.68, 0, 3.45, 0, white);
      box(root, 4.1, 0.1, 0.72, 0, 3.45, 0, blue);
      // Ajar double gate leaves
      box(root, 1.4, 1.75, 0.06, -1.0, 0.96, 0.25, glass, 0, 0.35);
      box(root, 1.4, 1.75, 0.06, 1.0, 0.96, 0.25, glass, 0, -0.35);
      return { root, materials };
    }
    case 'soccer_goal': {
      for (const sx of [-1.45, 1.45]) {
        box(root, 0.09, 1.85, 0.09, sx, 0.92, 0, white);
        box(root, 0.07, 0.07, 0.95, sx, 0.035, -0.45, white);
      }
      box(root, 3.0, 0.09, 0.09, 0, 1.85, 0, white);
      box(root, 2.9, 1.75, 0.04, 0, 0.92, -0.9, glass);
      return { root, materials };
    }
    case 'bike_rack': {
      box(root, 2.2, 0.05, 0.65, 0, 0.025, 0, metal);
      for (let x = -0.85; x <= 0.86; x += 0.42) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 16, Math.PI), metal);
        hoop.position.set(x, 0.05, 0);
        hoop.rotation.y = Math.PI / 2;
        root.add(hoop);
      }
      return { root, materials };
    }
    case 'water_cooler': {
      box(root, 0.46, 0.98, 0.46, 0, 0.49, 0, white);
      const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 14), glass);
      jug.position.y = 1.2;
      root.add(jug);
      return { root, materials };
    }
    case 'bus_shelter': {
      for (const sx of [-1.6, 1.6]) box(root, 0.12, 2.35, 0.12, sx, 1.18, -0.5, metal);
      box(root, 3.4, 2.1, 0.06, 0, 1.15, -0.5, glass);
      box(root, 3.6, 0.12, 1.4, 0, 2.4, 0.05, white, -0.06);
      box(root, 2.4, 0.08, 0.42, 0, 0.46, -0.18, birch);
      return { root, materials };
    }
    case 'guard_booth': {
      box(root, 2.1, 2.35, 2.1, 0, 1.18, 0, white);
      box(root, 2.3, 0.16, 2.3, 0, 2.42, 0, blue);
      box(root, 1.5, 0.85, 0.08, 0, 1.48, 1.04, glass);
      return { root, materials };
    }
    default:
      return null;
  }
}
