export function normalizeCropBox(value: unknown): { box?: number[]; warning?: string } {
  if (value == null) return {};
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((v) => typeof v !== 'number' || !Number.isFinite(v))
  )
    return { warning: 'تعذر تحديد مكان الرسم. حدده من صفحة المصدر.' };
  if (value.every((v) => v === 0)) return {};
  // Only normalize opposite corners expressed in the requested 0..1 coordinate system.
  // Never guess whether an out-of-range box uses pixels, percentages, or another scale.
  if (value.some((v) => v < 0 || v > 1))
    return { warning: 'إحداثيات الرسم غير صالحة. حدده من صفحة المصدر.' };
  const bounds = [
    Math.min(value[0], value[2]),
    Math.min(value[1], value[3]),
    Math.max(value[0], value[2]),
    Math.max(value[1], value[3]),
  ];
  if (bounds[2] - bounds[0] < 0.001 || bounds[3] - bounds[1] < 0.001)
    return { warning: 'مساحة الرسم فارغة. حدده من صفحة المصدر.' };
  return {
    box: bounds,
    ...(bounds.some((v, i) => v !== value[i])
      ? { warning: 'صُحّح ترتيب حدود الرسم؛ راجع الصورة قبل الاعتماد.' }
      : {}),
  };
}
