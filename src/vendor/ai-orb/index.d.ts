import type { ComponentType } from 'react';
type Props = {
  palette?: Record<string, string>;
  size?: number;
  animationSpeedBase?: number;
  animationSpeedHue?: number;
  hueRotation?: number;
  mainOrbHueAnimation?: boolean;
  blobAOpacity?: number;
  blobBOpacity?: number;
  noShadow?: boolean;
};
export const Orb: ComponentType<Props>;
