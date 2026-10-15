import type { Source } from './types';
export const cleanSourceText = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/\uFFFD+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
export function pageContent(page: Source['pages'][number]) {
  const text = cleanSourceText(page.text);
  const heading = text.slice(0, 240).replace(/[^\p{L}\p{N}]/gu, '');
  let reason = '';
  if (text.replace(/[\d\s]/g,'').length < 8 && !/[=+×÷]/.test(text)) reason = 'صفحة فارغة أو بلا محتوى دراسي';
  else if (/قائمةالمحتويات|فهرسالمحتويات|جدولالمحتويات/.test(heading)) reason = 'فهرس المحتويات';
  else if (/المقدمة|مقدمةالكتاب/.test(heading.slice(0, 35))) reason = 'مقدمة الكتاب';
  else if (
    /فريقالتأليف|حقوق.*محفوظة|قررتوزارة|HarperCollins|ISBN|الناشر/.test(heading) ||
    /ISBN|حقوق الطبع|حقوق النشر/.test(text)
  )
    reason = 'غلاف أو حقوق نشر وبيانات تأليف';
  else if (/أهمية.{0,4}هذهالوحدة|ماهذهالوحدة/.test(heading) && !/مثال/.test(text))
    reason = 'تمهيد الوحدة';
  else if (
    /مشروع/.test(heading) &&
    /الموادوالأدوات|خطواتتنفيذالمشروع|فكرةالمشروع/.test(text.replace(/\s/g, ''))
  )
    reason = 'نشاط مشروع خارج أسئلة الدرس';
  return { page: page.page, included: !reason, reason, text };
}
export function lessonPages(source: Source, pages?: number[]) {
  return source.pages.filter((p) => !pages || pages.includes(p.page)).map(pageContent);
}
export function lessonExcerpt(text: string, limit = 1600) {
  const clean = cleanSourceText(text);
  const marker = 'المعادلات المستخرجة';
  const mathIndex = clean.indexOf(marker);
  const equations = mathIndex >= 0 ? clean.slice(mathIndex, mathIndex + 800) : '';
  const body = (mathIndex >= 0 ? clean.slice(0, mathIndex) : clean)
    .split('\n')
    .filter(
      (line) =>
        !/^\s*\d{1,3}\s*$/.test(line) && !/ISBN|copyright|HarperCollins|www\.|https?:/i.test(line),
    )
    .join('\n');
  return equations
    ? `${body.slice(0, Math.max(400, limit - equations.length))}\n${equations}`
    : body.slice(0, limit);
}
