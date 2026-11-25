/**
 * Procedural in-memory CanvasTexture helpers for the studio gradient backdrop and
 * subtle ambient skylight particles (building geometry stays purely untextured).
 */
import * as THREE from 'three';

let studioBgTex: THREE.CanvasTexture | null = null;
let particleTex: THREE.CanvasTexture | null = null;

/** Generate vertical sky-mist to soft cool-blue studio backdrop texture. */
export function createStudioGradientTexture(): THREE.CanvasTexture {
  if (studioBgTex) return studioBgTex;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f8fbff');
  grad.addColorStop(0.42, '#eef5fd');
  grad.addColorStop(0.75, '#ddeafa');
  grad.addColorStop(1, '#c7ddfa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 512);

  studioBgTex = new THREE.CanvasTexture(canvas);
  studioBgTex.colorSpace = THREE.SRGBColorSpace;
  return studioBgTex;
}

/** Generate soft radial glow sprite for ambient skylight dust motes. */
export function createParticleSprite(): THREE.CanvasTexture {
  if (particleTex) return particleTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.4, 'rgba(191, 222, 255, 0.55)');
  grad.addColorStop(1, 'rgba(191, 222, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  particleTex = new THREE.CanvasTexture(canvas);
  return particleTex;
}
