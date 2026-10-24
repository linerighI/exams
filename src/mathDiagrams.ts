import { safeSvg } from './svgDiagram';
export type MathDiagram =
  | { type: 'function'; coefficients: number[]; range: number }
  | { type: 'triangle'; width: number; height: number }
  | { type: 'forces'; fx: number; fy: number };
export function mathDiagramSvg(input: MathDiagram) {
  const number = (n: number, min = -1000, max = 1000) => {
    if (!Number.isFinite(n) || n < min || n > max) throw Error('أدخل قيمًا محدودة وصحيحة للرسم');
    return n;
  };
  let body = '';
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7894b6" stroke-width="1.5"/>`;
  const label = (x: number, y: number, text: string) =>
    `<text x="${x}" y="${y}" font-size="15" fill="#244a78">${text}</text>`;
  if (input.type === 'function') {
    const r = number(input.range, 1, 100);
    if (input.coefficients.length < 1 || input.coefficients.length > 7)
      throw Error('حتى سبعة معاملات فقط');
    input.coefficients.forEach((n) => number(n));
    for (let i = -4; i <= 4; i++) {
      body += line(50, 160 + i * 26, 450, 160 + i * 26) + line(250 + i * 40, 30, 250 + i * 40, 290);
    }
    body +=
      line(50, 160, 450, 160) +
      line(250, 30, 250, 290) +
      label(450, 155, 'x') +
      label(258, 30, 'y') +
      label(52, 180, String(-r)) +
      label(430, 180, String(r)) +
      label(258, 50, String(r)) +
      label(258, 285, String(-r));
    let path = '',
      connected = false;
    for (let i = 0; i <= 500; i++) {
      const x = -r + (2 * r * i) / 500;
      const y = input.coefficients.reduceRight((value, c) => value * x + c, 0);
      if (!Number.isFinite(y) || Math.abs(y) > r) {
        connected = false;
        continue;
      }
      path += `${connected ? 'L' : 'M'}${(250 + (x / r) * 200).toFixed(2)},${(160 - (y / r) * 130).toFixed(2)} `;
      connected = true;
    }
    if (!path) throw Error('الدالة خارج النافذة؛ غيّر مجال الرسم');
    body += `<path d="${path}" fill="none" stroke="#2863b0" stroke-width="2.8"/>`;
  } else if (input.type === 'triangle') {
    const w = number(input.width, 0.1, 1000),
      h = number(input.height, 0.1, 1000),
      scale = Math.min(340 / w, 210 / h),
      x = 80,
      y = 255;
    body += `<path d="M${x},${y} L${x + w * scale},${y} L${x},${y - h * scale} Z" fill="#edf4ff" stroke="#2863b0" stroke-width="2.5"/>`;
    body +=
      label(x - 20, y + 10, 'A') +
      label(x + w * scale + 8, y + 10, 'B') +
      label(x - 20, y - h * scale - 5, 'C') +
      label(x + (w * scale) / 2, y + 30, `${w} cm`) +
      label(x + 10, y - (h * scale) / 2, `${h} cm`);
  } else if (input.type === 'forces') {
    const fx = number(input.fx),
      fy = number(input.fy);
    if (!fx && !fy) throw Error('أدخل قوة واحدة غير صفرية على الأقل');
    const scale = 150 / Math.max(Math.abs(fx), Math.abs(fy)),
      x = 250,
      y = 165;
    body +=
      line(50, y, 450, y) +
      line(x, 25, x, 295) +
      label(450, 155, 'x') +
      label(260, 25, 'y') +
      `<rect x="235" y="150" width="30" height="30" rx="4" fill="#e5efff" stroke="#2863b0"/>`;
    const arrow = (dx: number, dy: number, name: string, n: number) => {
      if (!n) return '';
      const ex = x + dx,
        ey = y + dy,
        angle = Math.atan2(dy, dx),
        a = angle + 0.45,
        b = angle - 0.45;
      return (
        `<path d="M${x},${y} L${ex},${ey}" stroke="#2863b0" stroke-width="3"/><polygon points="${ex},${ey} ${ex - 11 * Math.cos(a)},${ey - 11 * Math.sin(a)} ${ex - 11 * Math.cos(b)},${ey - 11 * Math.sin(b)}" fill="#2863b0"/>` +
        label(Math.min(330, ex + 8), Math.min(310, ey + 18), `${name} = ${n} N`)
      );
    };
    body += arrow(fx * scale, 0, 'Fx', fx) + arrow(0, -fy * scale, 'Fy', fy);
  } else throw Error('نوع رسم غير مدعوم');
  return safeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 330"><title>Math service 1 diagram</title><rect x="0" y="0" width="500" height="330" fill="#ffffff"/>${body}</svg>`,
  );
}
