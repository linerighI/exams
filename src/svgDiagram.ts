const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
]);
const common = new Set([
  'id',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
]);
const coordinates = new Set([
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'width',
  'height',
]);
export function safeSvg(value: string) {
  let svg = value.trim().replace(/^<\?xml\s[^?]*\?>\s*/i, '');
  if (
    svg.length > 100000 ||
    !svg.startsWith('<svg') ||
    /[\u0000-\u0008]/.test(svg) ||
    /<!|<\?/.test(svg)
  )
    throw Error('استخدم SVG بسيطًا دون شيفرة أو مراجع خارجية');
  const tokens = svg.match(/<[^>]*>|[^<]+/g) || [];
  if (tokens.join('') !== svg || tokens.length > 2500) throw Error('صيغة SVG غير صالحة');
  const stack: string[] = [];
  let roots = 0,
    namespace = false,
    viewBox = '';
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (
        /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(token) ||
        (!stack.length && token.trim())
      )
        throw Error('نص SVG غير صالح');
      continue;
    }
    const close = token.match(/^<\/([A-Za-z]+)\s*>$/);
    if (close) {
      if (stack.pop() !== close[1]) throw Error('وسوم SVG غير متطابقة');
      continue;
    }
    const open = token.match(/^<([A-Za-z]+)([\s\S]*?)(\/?)>$/);
    if (!open || !tags.has(open[1])) throw Error('عنصر غير مسموح في SVG');
    if (!stack.length) {
      if (open[1] !== 'svg' || roots++) throw Error('يلزم رسم SVG واحد');
    } else if (open[1] === 'svg') throw Error('لا تضع SVG داخل رسم آخر');
    let attributes = open[2];
    const seen = new Set<string>();
    while (attributes.trim()) {
      const attr = attributes.match(/^\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/);
      if (!attr) throw Error('خصائص SVG غير صالحة');
      attributes = attributes.slice(attr[0].length);
      const name = attr[1],
        v = attr[2] ?? attr[3];
      if (seen.has(name)) throw Error('خاصية SVG مكررة');
      seen.add(name);
      if (
        !common.has(name) &&
        !coordinates.has(name) &&
        !['xmlns', 'viewBox', 'd', 'points'].includes(name)
      )
        throw Error('خاصية غير مسموحة في SVG');
      if (/(?:url\s*\(|javascript:|data:|https?:\/\/)/i.test(v) && name !== 'xmlns')
        throw Error('لا تستخدم روابط أو صورًا خارجية في SVG');
      if (name === 'xmlns') {
        if (open[1] !== 'svg' || v !== 'http://www.w3.org/2000/svg')
          throw Error('مساحة SVG غير صالحة');
        namespace = true;
      }
      if (name === 'viewBox') {
        const n = v
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        if (
          open[1] !== 'svg' ||
          n.length !== 4 ||
          n.some((x) => !Number.isFinite(x) || Math.abs(x) > 10000) ||
          n[2] <= 0 ||
          n[3] <= 0
        )
          throw Error('أبعاد SVG غير صالحة');
        viewBox = v;
      }
      if (
        coordinates.has(name) ||
        ['stroke-width', 'font-size', 'opacity', 'fill-opacity', 'stroke-opacity'].includes(name)
      )
        if (!/^-?\d+(?:\.\d+)?(?:px)?$/.test(v) || Math.abs(parseFloat(v)) > 10000)
          throw Error('إحداثيات SVG غير صالحة');
      if (name === 'd' && !/^[MmZzLlHhVvCcSsQqTtAa\d\s,.+eE-]+$/.test(v))
        throw Error('مسار SVG غير صالح');
      if (['points', 'stroke-dasharray'].includes(name) && !/^[\d\s,.+eE-]+$/.test(v))
        throw Error('نقاط SVG غير صالحة');
      if (
        name === 'transform' &&
        !/^(?:(?:translate|scale|rotate|matrix)\(\s*[-+.\deE,\s]+\)\s*)+$/.test(v)
      )
        throw Error('تحويل SVG غير صالح');
      if (
        ['fill', 'stroke'].includes(name) &&
        !/^(?:none|currentColor|#[\da-f]{3,8}|[a-z]{1,20})$/i.test(v)
      )
        throw Error('لون SVG غير صالح');
    }
    if (!open[3]) stack.push(open[1]);
  }
  if (stack.length || roots !== 1 || !viewBox) throw Error('أغلق وسوم الرسم وأضف viewBox');
  if (!namespace) svg = svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}
export async function svgToPng(value: string) {
  const svg = safeSvg(value),
    url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const view = svg
      .match(/viewBox\s*=\s*["']([^"']+)/)![1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const scale = Math.min(1.5, 1200 / Math.max(view[2], view[3]));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(view[2] * scale));
    canvas.height = Math.max(1, Math.round(view[3] * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { svg, image: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(url);
  }
}
