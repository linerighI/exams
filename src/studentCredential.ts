export const normalizedStudentCredential = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/\s/g, '');
export const credentialSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
export async function cachedStudentHash(value: string, salt: string) {
  if (!/^[a-f0-9]{32}$/.test(salt)) throw Error('Invalid cached credential');
  const encoder = new TextEncoder(),
    key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(normalizedStudentCredential(value)),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
  const bytes = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 150000, hash: 'SHA-256' },
    key,
    256,
  );
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
}
