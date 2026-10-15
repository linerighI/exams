import { Orb } from './vendor/ai-orb';

// Keep every animated layer blue/white; disabling hue rotation prevents pink frames.
const palette = {
  mainBgStart: '#f1fbff',
  mainBgEnd: '#3889ed',
  shadowColor1: '#64b5ff00',
  shadowColor2: '#4b91e966',
  shadowColor3: '#ffffffed',
  shadowColor4: '#d6eeff',
  shapeAStart: '#b8e5ff',
  shapeAEnd: '#387de900',
  shapeBStart: '#ffffff',
  shapeBMiddle: '#9ed5ff',
  shapeBEnd: '#3e95ef00',
  shapeCStart: '#ffffff00',
  shapeCMiddle: '#d7efff00',
  shapeCEnd: '#397cdd',
  shapeDStart: '#ffffff00',
  shapeDMiddle: '#6fb8ff00',
  shapeDEnd: '#c1e9ff',
};
export default function BlueOrb({
  size = 1,
  animationSpeedBase = 0.6,
}: {
  size?: number;
  animationSpeedBase?: number;
}) {
  return (
    <Orb
      palette={palette}
      size={size}
      animationSpeedBase={animationSpeedBase}
      animationSpeedHue={0}
      hueRotation={0}
      mainOrbHueAnimation={false}
    />
  );
}
