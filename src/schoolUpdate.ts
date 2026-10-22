import { z } from 'zod';
export const updateManifestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  size: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 ** 3),
  notes: z.string().max(4000).default(''),
});
export const schoolUpdateSchema = updateManifestSchema.extend({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  createdAt: z.number(),
});
export type UpdateManifest = z.infer<typeof updateManifestSchema>;
export type SchoolUpdate = z.infer<typeof schoolUpdateSchema>;
export const updateReportSchema = z.object({
  campaignId: z.string().regex(/^[a-f0-9]{32}$/),
  clientId: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  current: z.string().max(80),
  status: z.enum(['queued', 'downloading', 'waiting', 'ready', 'installing', 'current', 'error']),
  progress: z.number().min(0).max(100).default(0),
  error: z.string().max(500).optional(),
});
