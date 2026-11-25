/**
 * Procedural minimalist architectural human silhouettes: rounded charcoal-black head
 * floating above a smooth tapered body with custom vertical black-to-white fade GLSL shader.
 */
import * as THREE from 'three';

const BODY_VERTEX_SHADER = `
  varying float vHeightNorm;
  void main() {
    vHeightNorm = clamp(position.y / 0.72, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BODY_FRAGMENT_SHADER = `
  uniform vec3 uTopColor;
  uniform vec3 uBottomColor;
  uniform float uOpacity;
  varying float vHeightNorm;
  void main() {
    float colorMix = smoothstep(0.02, 0.42, vHeightNorm);
    vec3 col = mix(uBottomColor, uTopColor, colorMix);
    float alphaFade = smoothstep(0.0, 0.40, vHeightNorm);
    gl_FragColor = vec4(col, alphaFade * 0.96 * uOpacity);
  }
`;

let sharedHeadGeo: THREE.SphereGeometry | null = null;
let sharedBodyGeo: THREE.LatheGeometry | null = null;

function getSharedGeometries() {
  if (!sharedHeadGeo) {
    sharedHeadGeo = new THREE.SphereGeometry(0.13, 18, 14);
  }
  if (!sharedBodyGeo) {
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.175, 0.0),
      new THREE.Vector2(0.165, 0.22),
      new THREE.Vector2(0.148, 0.45),
      new THREE.Vector2(0.115, 0.62),
      new THREE.Vector2(0.055, 0.72),
    ];
    sharedBodyGeo = new THREE.LatheGeometry(profile, 22);
  }
  return { headGeo: sharedHeadGeo, bodyGeo: sharedBodyGeo };
}

export interface SilhouetteFigureInstance {
  group: THREE.Group;
  headMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.ShaderMaterial;
  ringMat?: THREE.MeshBasicMaterial;
  ringMesh?: THREE.Mesh;
  opacityUniform: { value: number };
}

/** Create one faded black silhouette (student default or slightly taller teacher variant). */
export function createSilhouetteFigure(options: {
  topHex?: number;
  bottomHex?: number;
  scale?: number;
  withStatusRing?: boolean;
  ringColor?: number;
} = {}): SilhouetteFigureInstance {
  const {
    topHex = 0x111318,
    bottomHex = 0xf8fafc,
    scale = 1,
    withStatusRing = false,
    ringColor = 0x007aff,
  } = options;

  const { headGeo, bodyGeo } = getSharedGeometries();
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const opacityUniform = { value: 1 };
  const headMat = new THREE.MeshStandardMaterial({
    color: topHex,
    roughness: 0.36,
    metalness: 0.06,
    transparent: true,
    opacity: 1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.89;
  head.castShadow = true;

  const bodyMat = new THREE.ShaderMaterial({
    vertexShader: BODY_VERTEX_SHADER,
    fragmentShader: BODY_FRAGMENT_SHADER,
    uniforms: {
      uTopColor: { value: new THREE.Color(topHex) },
      uBottomColor: { value: new THREE.Color(bottomHex) },
      uOpacity: opacityUniform,
    },
    transparent: true,
    depthWrite: false,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body, head);

  let ringMat: THREE.MeshBasicMaterial | undefined;
  let ringMesh: THREE.Mesh | undefined;
  if (withStatusRing) {
    ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.34, 32), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.03;
    group.add(ringMesh);
  }

  return { group, headMat, bodyMat, ringMat, ringMesh, opacityUniform };
}
