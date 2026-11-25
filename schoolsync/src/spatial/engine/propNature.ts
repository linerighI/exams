/**
 * High-detail untextured courtyard, botanical, seating, and water fountain 3D prefabs
 * for SARE (School Advanced Rendering Engine).
 */
import * as THREE from 'three';

function stdMat(color: number, roughness = 0.56, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, opacity: 1 });
}

function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Build detailed landscape/nature prefab; returns null if not a nature prefab. */
export function buildNatureProp(
  prefabId: string, colorTint?: string,
): { root: THREE.Group; materials: THREE.Material[] } | null {
  const root = new THREE.Group();
  const stone = stdMat(0xffffff, 0.42);
  const soil = stdMat(0x8d7b68, 0.88);
  const bark = stdMat(0xb6997b, 0.72);
  const sage = stdMat(colorTint ? new THREE.Color(colorTint).getHex() : 0x5ca373, 0.64);
  const deepLeaf = stdMat(0x478a5d, 0.68);
  const birch = stdMat(0xe4d4bf, 0.5);
  const metal = stdMat(0x94a3b8, 0.3, 0.5);
  const materials: THREE.Material[] = [stone, soil, bark, sage, deepLeaf, birch, metal];

  switch (prefabId) {
    case 'tree_round': {
      box(root, 1.56, 0.12, 1.56, 0, 0.06, 0, metal);
      box(root, 1.72, 0.34, 1.72, 0, 0.28, 0, stone);
      box(root, 1.84, 0.08, 1.84, 0, 0.48, 0, stone);
      box(root, 1.52, 0.06, 1.52, 0, 0.49, 0, soil);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.1, 8), bark);
      trunk.position.y = 1.02;
      trunk.castShadow = true;
      const limb1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.65, 7), bark);
      limb1.position.set(0.2, 1.48, 0.12);
      limb1.rotation.z = -0.45;
      limb1.castShadow = true;
      const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.76, 1), sage);
      c1.position.set(0, 2.02, 0);
      c1.castShadow = true;
      const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.54, 1), deepLeaf);
      c2.position.set(0.42, 1.92, 0.24);
      c2.castShadow = true;
      const c3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), sage);
      c3.position.set(-0.36, 1.86, -0.22);
      c3.castShadow = true;
      root.add(trunk, limb1, c1, c2, c3);
      return { root, materials };
    }
    case 'tree_cypress': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.54, 0.46, 12), stone);
      pot.position.y = 0.23;
      pot.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.72, 0.08, 12), stone);
      rim.position.y = 0.46;
      const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 12), soil);
      dirt.position.y = 0.48;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 8), bark);
      stem.position.y = 0.75;
      const t1 = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.45, 9), deepLeaf);
      t1.position.y = 1.45;
      t1.castShadow = true;
      const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.35, 9), sage);
      t2.position.y = 2.05;
      t2.castShadow = true;
      const t3 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 9), deepLeaf);
      t3.position.y = 2.62;
      t3.castShadow = true;
      root.add(pot, rim, dirt, stem, t1, t2, t3);
      return { root, materials };
    }
    case 'planter': {
      box(root, 2.26, 0.08, 0.84, 0, 0.04, 0, metal);
      box(root, 2.36, 0.36, 0.94, 0, 0.26, 0, stone);
      box(root, 2.46, 0.07, 1.02, 0, 0.46, 0, stone);
      box(root, 2.1, 0.05, 0.72, 0, 0.47, 0, soil);
      for (const sx of [-0.68, 0, 0.68]) {
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(sx === 0 ? 0.4 : 0.33, 1), sx === 0 ? sage : deepLeaf);
        bush.position.set(sx, 0.66, 0);
        bush.scale.set(1.15, 0.78, 0.9);
        bush.castShadow = true;
        root.add(bush);
      }
      return { root, materials };
    }
    case 'bench': {
      for (const sx of [-0.74, 0.74]) {
        box(root, 0.07, 0.42, 0.5, sx, 0.21, 0, metal);
        box(root, 0.07, 0.44, 0.06, sx, 0.62, -0.25, metal, -0.18);
      }
      box(root, 1.44, 0.04, 0.06, 0, 0.2, 0, metal);
      for (let z = -0.16; z <= 0.19; z += 0.115) box(root, 1.92, 0.04, 0.095, 0, 0.43, z, birch);
      box(root, 1.92, 0.1, 0.045, 0, 0.59, -0.24, birch, -0.18);
      box(root, 1.92, 0.1, 0.045, 0, 0.72, -0.26, birch, -0.18);
      return { root, materials };
    }
    case 'fountain': {
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc, roughness: 0.08, clearcoat: 0.9, transparent: true, opacity: 0.74,
      });
      materials.push(waterMat);
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.52, 0.38, 12), stone);
      outer.position.y = 0.19;
      outer.castShadow = true;
      outer.receiveShadow = true;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.26, 0.12, 16), waterMat);
      water.position.y = 0.34;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.86, 12), stone);
      col.position.y = 0.62;
      col.castShadow = true;
      const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.32, 0.2, 12), stone);
      upperBowl.position.y = 1.05;
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.48, 10), waterMat);
      jet.position.y = 1.32;
      root.add(outer, water, col, upperBowl, jet);
      return { root, materials };
    }
    default:
      return null;
  }
}
