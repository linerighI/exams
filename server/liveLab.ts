import { z } from 'zod';
import type { Store } from './store';
import type { Session } from '../src/types';
type Device = {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  section: string;
  token: string;
  platform: string;
  page: string;
  attemptId?: string;
  lastSeen: number;
  camera: string;
  requested: boolean;
  requestVersion: number;
  frame?: string;
  frameAt: number;
};
const clientId = z.string().regex(/^[a-zA-Z0-9-]{8,80}$/);
const fail = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function registerLiveLab(
  app: any,
  store: Store,
  auth: (req: any, role?: string) => Session,
  validToken: (token: string) => boolean,
  allowedGrade: (grade: string, section: string) => boolean = () => true,
) {
  const rooms = new Map<string, { devices: Map<string, Device>; watching: number }>();
  const room = () => {
    const key = store.tenantId();
    if (!rooms.has(key)) rooms.set(key, { devices: new Map(), watching: 0 });
    return rooms.get(key)!;
  };
  const active = (device: Device) => {
    if (!allowedGrade(device.grade, device.section)) return undefined;
    const attempt = device.attemptId && store.get('attempts', device.attemptId);
    return attempt &&
      attempt.studentId === device.studentId &&
      !attempt.submittedAt &&
      attempt.deadline > Date.now()
      ? attempt
      : undefined;
  };
  const permitted = (device: Device) => {
    const attempt = active(device);
    return (
      !!attempt &&
      !attempt.cameraExempt &&
      !store.getSetting(`camera:${attempt.examId}:${device.studentId}`)
    );
  };
  const online = (device: Device) =>
    Date.now() - device.lastSeen < 15000 && validToken(device.token);
  const streaming = (device: Device) =>
    device.requested && room().watching > Date.now() && online(device) && permitted(device);
  const prune = () => {
    const value = room();
    for (const [key, device] of value.devices) {
      if (
        Date.now() - device.lastSeen > 5 * 60000 ||
        !validToken(device.token) ||
        !allowedGrade(device.grade, device.section)
      )
        value.devices.delete(key);
      else if (!streaming(device)) {
        device.frame = undefined;
        if (value.watching <= Date.now() || !permitted(device)) device.requested = false;
      }
    }
  };
  const own = (req: any, id: string) => {
    const session = auth(req, 'student'),
      device = room().devices.get(id);
    if (!device || device.studentId !== session.student?.id || device.token !== session.token)
      throw fail('الجهاز غير موجود', 404);
    return device;
  };
  app.post('/api/lab/heartbeat', async (req: any) => {
    const session = auth(req, 'student');
    if (!allowedGrade(session.student!.grade, session.student!.section))
      throw fail('هذا الصف غير مسند إلى المعلم', 403);
    prune();
    const input = z
      .object({
        clientId,
        platform: z.string().max(100),
        page: z.string().max(50),
        attemptId: z.string().max(100).optional(),
        camera: z.enum(['idle', 'live', 'denied', 'error', 'paused']).default('idle'),
      })
      .parse(req.body);
    const value = room(),
      old = value.devices.get(input.clientId);
    if (old && old.studentId !== session.student!.id) throw fail('معرّف الجهاز مستخدم', 409);
    if (!old && value.devices.size >= 200) throw fail('بلغت الغرفة حد الأجهزة', 429);
    const attempt = input.attemptId && store.get('attempts', input.attemptId);
    if (attempt && attempt.studentId !== session.student!.id)
      throw fail('المحاولة ليست لهذا الطالب', 403);
    const device: Device = {
      id: input.clientId,
      studentId: session.student!.id,
      name: session.student!.name,
      grade: session.student!.grade,
      section: session.student!.section,
      token: session.token,
      platform: input.platform,
      page: input.page,
      attemptId: attempt && !attempt.submittedAt ? attempt.id : undefined,
      lastSeen: Date.now(),
      camera: input.camera,
      requested: old?.requested || false,
      requestVersion: old?.requestVersion || 0,
      frame: old?.frame,
      frameAt: old?.frameAt || 0,
    };
    value.devices.set(device.id, device);
    if (!streaming(device)) device.frame = undefined;
    return {
      cameraRequested: streaming(device),
      requestVersion: device.requestVersion,
      cameraAllowed: permitted(device),
      intervalMs: 1000,
    };
  });
  app.get('/api/lab', async (req: any) => {
    auth(req, 'teacher');
    prune();
    return {
      serverNow: Date.now(),
      devices: [...room().devices.values()].map((device) => {
        const attempt = active(device),
          exam = attempt && store.get('exams', attempt.examId);
        return {
          id: device.id,
          studentId: device.studentId,
          name: device.name,
          grade: device.grade,
          section: device.section,
          platform: device.platform,
          page: device.page,
          lastSeen: device.lastSeen,
          online: online(device),
          camera: device.camera,
          cameraAllowed: permitted(device),
          cameraRequested: streaming(device),
          frameAt: device.frameAt,
          attemptId: attempt?.id,
          examId: exam?.id,
          examTitle: exam?.title,
          answered: attempt ? Object.keys(attempt.answers).length : 0,
          total: attempt?.questionCount || exam?.delivery?.count || exam?.questions.length || 0,
          deadline: attempt?.deadline,
          status: attempt?.status,
        };
      }),
    };
  });
  app.post('/api/lab/watch', async (req: any) => {
    auth(req, 'teacher');
    const { active: watching } = z.object({ active: z.boolean() }).parse(req.body);
    room().watching = watching ? Date.now() + 20000 : 0;
    if (!watching)
      for (const device of room().devices.values()) {
        device.requested = false;
        device.frame = undefined;
      }
    return { ok: true };
  });
  app.post('/api/lab/cameras', async (req: any) => {
    auth(req, 'teacher');
    prune();
    const input = z
      .object({ deviceIds: z.array(clientId).max(200).optional(), start: z.boolean() })
      .parse(req.body);
    if (input.start && room().watching < Date.now()) throw fail('افتح غرفة المتابعة أولًا');
    let count = 0;
    for (const device of room().devices.values())
      if (!input.deviceIds || input.deviceIds.includes(device.id)) {
        if (!input.start || (online(device) && permitted(device))) {
          device.requested = input.start;
          if (input.start) device.requestVersion++;
          if (!input.start) device.frame = undefined;
          count++;
        }
      }
    return { count };
  });
  app.post('/api/lab/devices/:id/frame', { bodyLimit: 180000 }, async (req: any) => {
    const device = own(req, req.params.id);
    if (!streaming(device)) throw fail('البث غير مطلوب أو انتهى الامتحان', 403);
    if (Date.now() - device.frameAt < 750) throw fail('انتظر الإطار التالي', 429);
    const { image } = z
      .object({
        image: z
          .string()
          .max(165000)
          .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
      })
      .parse(req.body);
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    if (bytes.length > 120000 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
      throw fail('إطار كاميرا غير صالح');
    device.frame = image;
    device.frameAt = Date.now();
    device.camera = 'live';
    return { ok: true };
  });
  app.post('/api/lab/devices/:id/pause', async (req: any) => {
    const device = own(req, req.params.id);
    device.frame = undefined;
    device.requested = false;
    device.camera = 'paused';
    return { ok: true };
  });
  app.get('/api/lab/frames', async (req: any, reply: any) => {
    reply.header('Cache-Control', 'no-store');
    auth(req, 'teacher');
    prune();
    return {
      frames: [...room().devices.values()]
        .filter((device) => streaming(device) && device.frame && Date.now() - device.frameAt < 6000)
        .map((device) => ({ id: device.id, image: device.frame, at: device.frameAt })),
    };
  });
  app.addHook('onClose', () => rooms.clear());
}
