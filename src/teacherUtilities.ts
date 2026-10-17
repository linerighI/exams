export function latinDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, (n) => String(n.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (n) => String(n.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.')
    .replace(/−/g, '-');
}
export const unitGroups = {
  length: {
    label: 'الطول',
    units: [
      ['mm', 'ملليمتر', 0.001],
      ['cm', 'سنتيمتر', 0.01],
      ['m', 'متر', 1],
      ['km', 'كيلومتر', 1000],
    ],
  },
  mass: {
    label: 'الكتلة',
    units: [
      ['mg', 'ملليغرام', 0.000001],
      ['g', 'غرام', 0.001],
      ['kg', 'كيلوغرام', 1],
      ['t', 'طن', 1000],
    ],
  },
  time: {
    label: 'الزمن',
    units: [
      ['s', 'ثانية', 1],
      ['min', 'دقيقة', 60],
      ['h', 'ساعة', 3600],
      ['day', 'يوم', 86400],
    ],
  },
  area: {
    label: 'المساحة',
    units: [
      ['cm2', 'سم²', 0.0001],
      ['m2', 'م²', 1],
      ['dunum', 'دونم (١٠٠٠ م²)', 1000],
      ['km2', 'كم²', 1000000],
    ],
  },
  volume: {
    label: 'الحجم',
    units: [
      ['ml', 'ملليلتر / سم³', 0.001],
      ['l', 'لتر', 1],
      ['m3', 'م³', 1000],
    ],
  },
  temperature: {
    label: 'درجة الحرارة',
    units: [
      ['c', 'سلسيوس', 1],
      ['f', 'فهرنهايت', 1],
      ['k', 'كلفن', 1],
    ],
  },
} as const;
export type UnitGroup = keyof typeof unitGroups;
export function convertUnit(group: UnitGroup, input: string, from: string, to: string) {
  const text = latinDigits(input).trim();
  if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))
    throw Error('أدخل قيمة عددية صالحة');
  const n = Number(text);
  if (!Number.isFinite(n) || Math.abs(n) > 1e15) throw Error('القيمة خارج المجال المسموح');
  const units = unitGroups[group].units;
  const source = units.find((u) => u[0] === from),
    target = units.find((u) => u[0] === to);
  if (!source || !target) throw Error('اختر وحدتين من النوع نفسه');
  let value: number;
  if (group === 'temperature') {
    const c = from === 'f' ? ((n - 32) * 5) / 9 : from === 'k' ? n - 273.15 : n;
    if (c < -273.150000001) throw Error('درجة الحرارة أقل من الصفر المطلق');
    value = to === 'f' ? (c * 9) / 5 + 32 : to === 'k' ? c + 273.15 : c;
  } else value = (n * source[2]) / target[2];
  if (!Number.isFinite(value)) throw Error('الناتج خارج المجال المسموح');
  return Number(value.toPrecision(12));
}
export function describeNumbers(text: string) {
  const parts = latinDigits(text)
    .trim()
    .split(/[\s,،;؛]+/)
    .filter(Boolean);
  if (!parts.length || parts.length > 1000) throw Error('أدخل من قيمة واحدة إلى ١٠٠٠ قيمة');
  if (parts.some((s) => !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)))
    throw Error('افصل الأعداد بمسافة أو فاصلة، واستخدم النقطة للفاصل العشري');
  const values = parts.map(Number).sort((a, b) => a - b);
  if (values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e12))
    throw Error('إحدى القيم خارج المجال المسموح');
  const count = values.length,
    sum = values.reduce((a, b) => a + b, 0),
    mean = sum / count;
  return {
    count,
    sum,
    mean,
    median: count % 2 ? values[(count - 1) / 2] : (values[count / 2 - 1] + values[count / 2]) / 2,
    min: values[0],
    max: values[count - 1],
    range: values[count - 1] - values[0],
    populationSD: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / count),
  };
}
export function allocateQuestions(count: number, weights: number[]) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    !weights.length ||
    weights.length > 20 ||
    weights.some((w) => !Number.isFinite(w) || w < 0 || w > 1000) ||
    weights.reduce((a, b) => a + b, 0) <= 0
  )
    throw Error('حدد ١–١٠٠ سؤال وأوزانًا موجبة للمحتوى');
  const sum = weights.reduce((a, b) => a + b, 0),
    raw = weights.map((w) => (count * w) / sum),
    counts = raw.map(Math.floor);
  const order = raw
    .map((n, i) => ({ i, remainder: n - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const left = count - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) counts[order[i].i]++;
  return counts;
}
