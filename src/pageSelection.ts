export function pageRange(available: number[], from: number, to: number) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from > to ||
    !available.includes(from) ||
    !available.includes(to)
  )
    throw Error('أدخل نطاقًا صحيحًا ضمن صفحات الملف، بحيث تكون صفحة البداية قبل صفحة النهاية');
  return available.filter((page) => page >= from && page <= to);
}

export function selectPages(current: number[], range: number[], mode: 'only' | 'add' | 'exclude') {
  return [
    ...new Set(
      mode === 'only'
        ? range
        : mode === 'add'
          ? [...current, ...range]
          : current.filter((p) => !range.includes(p)),
    ),
  ].sort((a, b) => a - b);
}
