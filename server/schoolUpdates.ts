import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  updateManifestSchema,
  updateReportSchema,
  type SchoolUpdate,
  type UpdateManifest,
} from '../src/schoolUpdate';
import type { Session } from '../src/types';

const fail = (message: string, statusCode = 400) => Object.assign(Error(message), { statusCode });
export function registerSchoolUpdates(
  app: any,
  options: {
    auth: (req: any, role?: string) => Session;
    owners: (session: Session) => string[];
    active: (session: Session) => boolean;
    source?: () => Promise<UpdateManifest & { file: string }>;
  },
) {
  const campaigns = new Map<string, SchoolUpdate & { file: string }>();
  const reports = new Map<string, any>();
  const leases = new Map<string, number>();
  const studentKey = (s: Session) => `${s.teacherId || 'master'}:${s.student!.id}`;
  const visible = (s: Session) =>
    options
      .owners(s)
      .map((owner) => campaigns.get(owner))
      .filter(Boolean)
      .sort((a, b) => b!.createdAt - a!.createdAt)[0];
  const publicCampaign = (c: (SchoolUpdate & { file: string }) | undefined) => {
    if (!c) return null;
    const { file, ...manifest } = c;
    return manifest;
  };
  app.get('/api/school-updates', async (req: any) => {
    const s = options.auth(req, 'teacher'),
      owner = s.teacherId || 'master';
    const campaign = campaigns.get(owner);
    return {
      campaign: publicCampaign(campaign),
      supported: !!options.source,
      devices: [...reports.values()].filter(
        (r) =>
          r.owner === owner && r.campaignId === campaign?.id && Date.now() - r.seenAt < 86400000,
      ),
    };
  });
  app.post('/api/school-updates/publish', async (req: any) => {
    const s = options.auth(req, 'teacher');
    if (!options.source) throw fail('أرسل التحديث من نسخة Windows على الجهاز الرئيسي');
    const source = await options.source();
    const manifest = updateManifestSchema.parse(source);
    const campaign = {
      ...manifest,
      id: randomBytes(16).toString('hex'),
      createdAt: Date.now(),
      file: source.file,
    };
    campaigns.set(s.teacherId || 'master', campaign);
    return publicCampaign(campaign);
  });
  app.delete('/api/school-updates', async (req: any) => {
    const s = options.auth(req, 'teacher');
    campaigns.delete(s.teacherId || 'master');
    return { ok: true };
  });
  app.get('/api/school-updates/student', async (req: any) => {
    const s = options.auth(req, 'student');
    return { campaign: publicCampaign(visible(s)), active: options.active(s) };
  });
  app.post('/api/school-updates/student/status', async (req: any) => {
    const s = options.auth(req, 'student'),
      input = updateReportSchema.parse(req.body),
      campaign = visible(s);
    if (!campaign || campaign.id !== input.campaignId)
      throw fail('أُلغي إرسال التحديث أو تغيّر. أعد الاتصال.', 409);
    if (input.status === 'installing') {
      if (options.active(s)) throw fail('يُؤجّل التثبيت حتى تسليم الامتحان', 409);
      leases.set(studentKey(s), Date.now() + 120000);
    } else if (input.status === 'current' || input.status === 'error') leases.delete(studentKey(s));
    const owner = [...campaigns.entries()].find(([, c]) => c.id === campaign.id)![0];
    if (reports.size > 6000)
      for (const [key, r] of reports) if (Date.now() - r.seenAt > 86400000) reports.delete(key);
    reports.set(`${owner}:${studentKey(s)}:${input.clientId}`, {
      ...input,
      owner,
      name: s.student!.name,
      studentId: s.student!.id,
      seenAt: Date.now(),
    });
    return { ok: true };
  });
  app.get('/api/school-updates/:id/file', async (req: any, reply: any) => {
    const s = options.auth(req, 'student'),
      campaign = visible(s);
    if (!campaign || campaign.id !== req.params.id) throw fail('التحديث غير متاح لهذا الطالب', 404);
    const range = req.headers.range;
    let offset = 0;
    if (range) {
      const match = /^bytes=(\d+)-$/.exec(range);
      if (!match || !Number.isSafeInteger(+match[1]) || +match[1] >= campaign.size)
        throw fail('نطاق غير صالح', 416);
      offset = +match[1];
      reply
        .code(206)
        .header('Content-Range', `bytes ${offset}-${campaign.size - 1}/${campaign.size}`);
    }
    reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', campaign.size - offset)
      .header('Cache-Control', 'no-store')
      .header('Accept-Ranges', 'bytes');
    return reply.send(createReadStream(campaign.file, { start: offset }));
  });
  return {
    assertCanStart(s: Session) {
      if ((leases.get(studentKey(s)) || 0) > Date.now())
        throw fail('جهازك يثبّت تحديثًا أرسله المعلم؛ انتظر إعادة فتح التطبيق.', 409);
    },
  };
}
