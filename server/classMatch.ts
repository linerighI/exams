function clean(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[\u200E\u200F\u061C]/g, '')
    .trim()
    .toLowerCase();
}
export function gradeKey(value: string) {
  const text = clean(value)
    .replace(/^(?:الصف|صف)\s*/, '')
    .replace(/\s+(?:الاساسي|اساسي)$/, '')
    .replace(/\s+/g, ' ');
  const names = [
    'الاول',
    'الثاني',
    'الثالث',
    'الرابع',
    'الخامس',
    'السادس',
    'السابع',
    'الثامن',
    'التاسع',
    'العاشر',
    'الحادي عشر',
    'الثاني عشر',
  ];
  const index = names.findIndex((n) => n === text || n.replace(/^ال/, '') === text);
  if (index >= 0) return String(index + 1);
  return /^\d{1,2}$/.test(text) ? String(Number(text)) : text;
}
export function sectionKey(value: string) {
  const section = clean(value).replace(/^(?:الشعبة|الشعبه|شعبة|شعبه|section)\s*[:：-]?\s*/i, '').trim();
  return ({ a: 'ا', b: 'ب', c: 'ج', d: 'د' } as Record<string, string>)[section] || section;
}
export const classId = (grade: string, section: string) =>
  JSON.stringify([gradeKey(grade), sectionKey(section)]);
