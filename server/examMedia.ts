import { z } from 'zod';
import { appearanceReadable } from '../src/examAppearance';
import { createHash } from 'node:crypto';
import type { Store } from './store';
export const appearanceSchema = z
  .object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    cardStyle: z.enum(['soft', 'outlined']),
    fontSize: z.enum(['normal', 'large']),
    welcome: z.string().trim().max(220),
    referenceImage: z
      .string()
      .max(3_000_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
    imageCaption: z.string().trim().max(120).optional(),
  })
  .refine(appearanceReadable, 'اختر ألوانًا أوضح للنص؛ جرّب إحدى اللوحات الجاهزة');
const audioData = z
  .string()
  .max(2_900_000)
  .refine((value) => {
    const m = /^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
    if (!m) return false;
    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return false;
    if (['wav', 'x-wav'].includes(m[1]))
      return (
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE'
      );
    if (m[1] === 'ogg') return bytes.subarray(0, 4).toString() === 'OggS';
    if (m[1] === 'webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    return (
      bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  }, 'ملف صوتي غير صالح أو أكبر من 2 ميغابايت');
export const audioSchema = z.union([
  z.object({ name: z.string().max(150), data: audioData }),
  z.object({ name: z.string().max(150), id: z.string().regex(/^[a-f0-9]{32}$/) }),
]);
export function saveExamMedia<T extends { audio?: any; questions: any[] }>(
  exam: T,
  store: Store,
): T {
  const save = (audio: any) => {
    if (!audio) return undefined;
    if (audio.data) {
      const id = createHash('sha256').update(audio.data).digest('hex').slice(0, 32);
      store.put('assets', { id, mediaKind: 'exam-audio', data: audio.data, name: audio.name });
      return { id, name: audio.name };
    }
    const found = store.get('assets', audio.id);
    if (found?.mediaKind !== 'exam-audio')
      throw Object.assign(Error('الملف الصوتي غير موجود في حسابك'), { statusCode: 400 });
    return { id: audio.id, name: audio.name };
  };
  return {
    ...exam,
    audio: save(exam.audio),
    questions: exam.questions.map((q) => ({ ...q, audio: save(q.audio) })),
  };
}
export function hydrateAudio(audio: any, store: Store) {
  if (!audio || audio.data) return audio;
  const asset = store.get('assets', audio.id);
  return asset?.mediaKind === 'exam-audio' ? { ...audio, data: asset.data } : undefined;
}
