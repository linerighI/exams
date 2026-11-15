/**
 * Low-level database crypto, ID generation, normalization, and validation helpers.
 */
const {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} = require('node:crypto');
const { z } = require('zod');

const id = () => randomUUID();
const hash = (password, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const verify = (password, stored) => {
  const [salt, key] = stored.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
};
const digest = (token) => createHash('sha256').update(token).digest('hex');
const normalizeNationalId = (value) =>
  String(value)
    .normalize('NFKC')
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
const day = (zone = 'Asia/Amman', date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const text = z.string().trim().min(1).max(4000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fail = (message, statusCode = 403) => {
  throw Object.assign(new Error(message), { statusCode });
};

module.exports = {
  id,
  hash,
  verify,
  digest,
  normalizeNationalId,
  day,
  text,
  time,
  fail,
  createHmac,
  randomBytes,
};
