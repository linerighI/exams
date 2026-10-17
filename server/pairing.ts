import { createHmac, randomBytes, scryptSync } from 'node:crypto';

const domain = 'alshereqi-certificate-pairing-v1';
export const normalizePairingCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, '');
export const normalizeFingerprint = (value: string) => value.replaceAll(':', '').toUpperCase();
export function newPairingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...randomBytes(12)].map(byte => alphabet[byte & 31]).join('').match(/.{4}/g)!.join('-');
}
export function pairingKey(code: string, fingerprint: string) {
  return scryptSync(normalizePairingCode(code), `${domain}:${normalizeFingerprint(fingerprint)}`, 32);
}
export function pairingProof(key: Buffer, nonce: string, fingerprint: string) {
  return createHmac('sha256', key).update(`${domain}\n${normalizeFingerprint(fingerprint)}\n${nonce}`).digest('hex');
}
