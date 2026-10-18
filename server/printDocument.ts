import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import katex from 'katex';
import { mathSegments } from '../src/mathNotation';

export const escapeHTML = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
let assets: string | undefined;
function printAssets() {
  if (assets) return assets;
  const req = createRequire(import.meta.url);
  const root = dirname(req.resolve('katex/package.json'));
  const css = readFileSync(join(root, 'dist/katex.min.css'), 'utf8').replace(
    /url\((?:['"])?fonts\/([^)'"\s]+)(?:['"])?\)/g,
    (_, name: string) =>
      `url(data:font/${name.endsWith('woff2') ? 'woff2' : name.endsWith('woff') ? 'woff' : 'ttf'};base64,${readFileSync(join(root, 'dist/fonts', name)).toString('base64')})`,
  );
  const fonts = [400, 700]
    .map(
      (weight) =>
        `@font-face{font-family:Tajawal;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(req.resolve(`@fontsource/tajawal/files/tajawal-arabic-${weight}-normal.woff2`)).toString('base64')})}`,
    )
    .join('');
  assets = css + fonts;
  return assets;
}
export const printMath = (value: string) =>
  mathSegments(value || '')
    .map((p) => {
      if (!p.math) return escapeHTML(p.text);
      try {
        return `<span dir="ltr" class="formula">${katex.renderToString(p.text, { throwOnError: true, trust: false, displayMode: !!p.display, maxExpand: 200 })}</span>`;
      } catch {
        return `<span class="warning">${escapeHTML(p.text)}</span>`;
      }
    })
    .join('');
export const printImage = (image: unknown) =>
  typeof image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
    ? `<img class="question-image" src="${image}" alt="رسم السؤال">`
    : '';

export function printDocument(
  title: string,
  school: string,
  subtitle: string,
  content: string,
  confidential = false,
) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${escapeHTML(title)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><style>${printAssets()}
  *{box-sizing:border-box}body{font-family:Tajawal,Arial;color:#203650;font-size:13px;line-height:1.8;margin:0;overflow-wrap:anywhere}h1,h2,h3,p{margin:0 0 10px}h1{font-size:30px;line-height:1.35;color:#183f6c}h2{font-size:21px;color:#1d527c}h3{font-size:16px}header{border-top:7px solid #247f96;border-bottom:1px solid #cbdce7;padding:20px 0;margin-bottom:23px}.eyebrow{letter-spacing:1px;color:#247f96;font-weight:700;font-size:12px}.subtitle,small{color:#64788b}.stamp{display:inline-block;padding:3px 10px;background:#eff5f8;border-radius:5px;font-size:11px;margin-bottom:8px}.confidential{color:#8f4b22;background:#fff5e7}.stats{display:flex;gap:12px;margin:18px 0}.stat{flex:1;background:#eff6f8;border-right:3px solid #247f96;padding:12px}.stat b{display:block;font:700 24px Tajawal,Arial}.report-section{break-before:page}.report-section.first{break-before:auto}.section-title{border-bottom:2px solid #d9e7ec;padding-bottom:9px;margin-bottom:15px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;margin:12px 0 22px}thead{display:table-header-group}th{background:#eaf3f6;color:#28576b;font-weight:700;text-align:right}td,th{padding:8px;border-bottom:1px solid #dce5eb;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}tbody tr:nth-child(even){background:#f7fafb}.code{direction:ltr;unicode-bidi:isolate;font-family:monospace;word-break:break-all}.notice{border:1px solid #dce5eb;background:#f8fafb;padding:12px;border-radius:8px;margin:12px 0}article.question{border:1px solid #dce5eb;border-right:4px solid #247f96;border-radius:9px;padding:16px;margin:14px 0;break-inside:avoid}article.question h2{font-size:17px;line-height:1.9;margin-top:8px;color:#203650}.question-meta{display:flex;justify-content:space-between;gap:10px;color:#64788b;font-size:11px}.number{color:#247f96;font-weight:700}.options{display:grid;grid-template-columns:1fr 1fr;gap:7px}.options div{border:1px solid #e2e9ef;padding:7px 10px;border-radius:6px}.question-image{display:block;max-width:100%;max-height:230px;object-fit:contain;margin:12px auto}.formula{display:inline-block;direction:ltr;unicode-bidi:isolate;max-width:100%}.warning{color:#974621}.key{break-before:page}.answer{break-inside:avoid;padding:12px;border-bottom:1px solid #dce5eb}.answer strong{color:#247f96}.signature{display:flex;justify-content:space-between;border:1px solid #dce5eb;padding:12px;margin:18px 0}.end{margin-top:20px;border-top:1px solid #dce5eb;padding-top:10px;color:#64788b;font-size:10px}@page{size:A4;margin:16mm 15mm 18mm;@bottom-center{content:counter(page) ' / ' counter(pages);font:10px Arial;color:#64788b;direction:ltr}} @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><header><p class="eyebrow">${escapeHTML(school)}</p><span class="stamp ${confidential ? 'confidential' : ''}">${confidential ? 'نسخة خاصة بالمعلم' : 'نسخة تعليمية'}</span><h1>${escapeHTML(title)}</h1><p class="subtitle">${escapeHTML(subtitle)}</p></header>${content}<p class="end">${escapeHTML(school)} · ${escapeHTML(new Date().toLocaleDateString('ar-JO'))} · الشريقي للامتحانات</p></body></html>`;
}
