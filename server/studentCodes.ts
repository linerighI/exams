import { randomInt } from 'node:crypto';
export function studentCode(used: Iterable<string>) {
  const unavailable = used instanceof Set ? used : new Set(used);
  for (let i = 0; i < 100; i++) {
    const value = String(randomInt(100000, 1000000));
    if (!unavailable.has(value)) {
      unavailable.add(value);
      return value;
    }
  }
  throw Error('تعذر إنشاء رمز جديد؛ حاول مجددًا');
}
