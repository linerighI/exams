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
const tones = {
  blue: palette,
  red: { ...palette, mainBgStart: '#fff2f3', mainBgEnd: '#e65a71', shadowColor1: '#ee758900', shadowColor2: '#c34d7066',
    shadowColor4: '#ffdde2', shapeAStart: '#ffd3dd', shapeAEnd: '#dd467200', shapeBMiddle: '#ffbdce', shapeBEnd: '#ec628300',
    shapeCStart: '#ffffff00', shapeCMiddle: '#ffe0e800', shapeCEnd: '#d84e75', shapeDMiddle: '#f997b100', shapeDEnd: '#ffd8e2' },
  green: { ...palette, mainBgStart: '#eefff7', mainBgEnd: '#29b68e', shadowColor1: '#63dfb500', shadowColor2: '#259c7c66',
    shadowColor4: '#d2ffee', shapeAStart: '#a5f5d9', shapeAEnd: '#249d7a00', shapeBMiddle: '#a2f2d4', shapeBEnd: '#34c59600',
    shapeCStart: '#ffffff00', shapeCMiddle: '#d6ffed00', shapeCEnd: '#249b7e', shapeDMiddle: '#6cdeb500', shapeDEnd: '#c1f9e1' },
};
export default function BlueOrb({
  size = 1,
  animationSpeedBase = 0.6,
  tone = 'blue',
}: {
  size?: number;
  animationSpeedBase?: number;
  tone?: 'blue' | 'red' | 'green';
}) {
  return (
    <Orb
      palette={tones[tone]}
      size={size}
      animationSpeedBase={animationSpeedBase}
      animationSpeedHue={0}
      hueRotation={0}
      mainOrbHueAnimation={false}
    />
  );
}
