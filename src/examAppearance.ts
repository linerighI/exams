export type ExamAppearance = {
  accent: string;
  background: string;
  cardStyle: 'soft' | 'outlined';
  fontSize: 'normal' | 'large';
  welcome: string;
  referenceImage?: string;
  imageCaption?: string;
};
export const defaultAppearance: ExamAppearance = {
  accent: '#2863b0',
  background: '#f4f7fc',
  cardStyle: 'soft',
  fontSize: 'normal',
  welcome: 'خذ وقتك، اقرأ جيدًا، وثق بما تعلمته.',
};
export const examPalettes = [
  { name: 'أزرق هادئ', accent: '#2863b0', background: '#f4f7fc' },
  { name: 'أخضر مريح', accent: '#166855', background: '#f1f8f4' },
  { name: 'بنفسجي ناعم', accent: '#69419c', background: '#f7f3fc' },
  { name: 'دفء الورق', accent: '#85511d', background: '#fcf8ef' },
];
const luminance = (hex: string) => {
  const c = hex
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
};
export const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
export function appearanceReadable(value: ExamAppearance) {
  return contrast(value.accent, '#ffffff') >= 4.5 && contrast('#203650', value.background) >= 7;
}
