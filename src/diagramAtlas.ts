import { safeSvg } from './svgDiagram';
export type AtlasBox = [number, number, number, number];
export function atlasCrop(box: unknown, width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 64000000
  )
    throw Error('أبعاد لوحة الرسوم غير صالحة أو تتجاوز 64 مليون بكسل.');
  if (
    !Array.isArray(box) ||
    box.length !== 4 ||
    box.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) ||
    box[2] <= box[0] ||
    box[3] <= box[1]
  )
    throw Error('atlasBox يجب أن يكون [left,top,right,bottom] بين 0 و1 وبمساحة موجبة.');
  const x = Math.floor(box[0] * width),
    y = Math.floor(box[1] * height),
    right = Math.min(width, Math.ceil(box[2] * width)),
    bottom = Math.min(height, Math.ceil(box[3] * height));
  if (right - x < 8 || bottom - y < 8) throw Error('إطار الرسم صغير جدًا؛ راجع إحداثيات atlasBox.');
  return { x, y, width: right - x, height: bottom - y };
}
export async function attachDiagramAtlas(data: any, file: File) {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 12 * 1024 * 1024)
    throw Error('اختر لوحة PNG أو JPG حتى 12 ميغابايت.');
  const questions = data?.questions;
  if (!Array.isArray(questions) || questions.length > 1000) throw Error('استورد JSON أولًا.');
  if (questions.some((q) => !q || typeof q.id !== 'string' || !q.id.trim()))
    throw Error('يجب أن يكون لكل سؤال معرف id ثابت.');
  const linked = questions.filter((q) => q.atlasBox != null);
  if (!linked.length)
    throw Error(
      'لا توجد إطارات atlasBox في JSON. استخدم SVG لكل سؤال أو أضف إطارات اللوحة إلى JSON.',
    );
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw Error('معرفات الأسئلة مكررة؛ لا يمكن ربط الرسوم بأمان.');
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    atlasCrop([0, 0, 1, 1], width, height);
    if (
      data.diagramAtlas?.width &&
      data.diagramAtlas?.height &&
      Math.abs(width / height - data.diagramAtlas.width / data.diagramAtlas.height) > 0.01
    )
      throw Error('نسبة أبعاد اللوحة لا تطابق diagramAtlas في JSON؛ اختر اللوحة المطابقة.');
    const rects = new Map(linked.map((q) => [q.id, atlasCrop(q.atlasBox, width, height)]));
    let bytes = 0;
    const updated = questions.map((q) => {
      const r = rects.get(q.id);
      if (!r) return q;
      const scale = Math.min(1, 1800 / Math.max(r.width, r.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(r.width * scale);
      canvas.height = Math.round(r.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('تعذر تجهيز الرسم.');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/png');
      canvas.width = 1;
      canvas.height = 1;
      bytes += image.length;
      if (image.length > 2900000 || bytes > 32000000)
        throw Error(
          'الرسوم الناتجة كبيرة جدًا؛ استخدم SVG مستقلًا أو لوحة أصغر. لم تُغيّر الأسئلة.',
        );
      // The selected atlas is an explicit replacement; discard an older SVG/source crop.
      return { ...q, image, svg: null, box: null, requiresImage: true };
    });
    return { data: { ...data, questions: updated }, count: linked.length };
  } finally {
    bitmap.close();
  }
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function diagramSheet(questions: any[], title = 'رسوم الأسئلة') {
  const rows = questions.filter((q) => q.svg || q.image);
  if (!rows.length) throw Error('لا توجد رسوم جاهزة في البنك.');
  if (rows.length > 1000) throw Error('الحد الأقصى 1000 رسم.');
  const width = 2400,
    cellWidth = 780,
    cellHeight = 600,
    height = 120 + Math.ceil(rows.length / 3) * cellHeight;
  const boxes: Record<string, AtlasBox> = Object.create(null);
  if (new Set(rows.map((q) => q.id)).size !== rows.length) throw Error('معرفات الرسوم مكررة.');
  const content = rows
    .map((q, i) => {
      const x = 30 + (i % 3) * cellWidth,
        y = 110 + Math.floor(i / 3) * cellHeight,
        innerX = x + 24,
        innerY = y + 65,
        w = cellWidth - 48,
        h = cellHeight - 95;
      let drawing = '';
      if (q.svg) {
        const svg = safeSvg(q.svg),
          view = svg.match(/viewBox\s*=\s*["']([^"']+)/)![1];
        const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
        drawing =
          '<svg x="' +
          innerX +
          '" y="' +
          innerY +
          '" width="' +
          w +
          '" height="' +
          h +
          '" viewBox="' +
          view +
          '" preserveAspectRatio="xMidYMid meet">' +
          inner +
          '</svg>';
      } else {
        if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(q.image))
          throw Error('صورة الرسم غير صالحة.');
        drawing =
          '<image x="' +
          innerX +
          '" y="' +
          innerY +
          '" width="' +
          w +
          '" height="' +
          h +
          '" href="' +
          q.image +
          '" preserveAspectRatio="xMidYMid meet"/>';
      }
      boxes[q.id] = [innerX / width, innerY / height, (innerX + w) / width, (innerY + h) / height];
      return (
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        (cellWidth - 12) +
        '" height="' +
        (cellHeight - 14) +
        '" rx="18" fill="white" stroke="#d4e2f4"/><text x="' +
        (x + 25) +
        '" y="' +
        (y + 38) +
        '" font-size="25" font-family="Arial" fill="#315e95">' +
        escape(String(q.id)) +
        '</text>' +
        drawing
      );
    })
    .join('');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '"><rect width="100%" height="100%" fill="#f3f7fd"/><text x="1200" y="65" text-anchor="middle" font-family="Arial" font-size="34" fill="#315e95">' +
    escape(title) +
    '</text>' +
    content +
    '</svg>';
  if (svg.length > 36000000) throw Error('اللوحة كبيرة جدًا؛ صدّر مجموعة أصغر من الرسوم.');
  return { svg, boxes, width, height, count: rows.length };
}
