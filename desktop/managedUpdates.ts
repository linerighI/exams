import { schoolUpdateSchema, type SchoolUpdate } from '../src/schoolUpdate';
import { newerRelease, type createAppUpdater } from './appUpdater';

// A single background worker per device. Installation is leased by the server,
// which rejects it while this student has an active exam and blocks new starts.
export function createManagedUpdates(options: {
  updater: ReturnType<typeof createAppUpdater>;
  current: string;
  context: () => string | undefined;
  query: () => Promise<{ campaign: unknown; active: boolean }>;
  report: (
    campaign: SchoolUpdate,
    status: string,
    progress?: number,
    error?: string,
  ) => Promise<unknown>;
  transport: (campaign: SchoolUpdate, offset: number, signal: AbortSignal) => Promise<Response>;
  now?: () => number;
  failedCampaign?: () => string | undefined;
}) {
  let busy = false,
    owner: string | undefined,
    pending: SchoolUpdate | undefined,
    readyAt = 0,
    retryAt = 0;
  const now = options.now || Date.now;
  const reset = () => {
    if (pending && options.updater.state().status === 'downloading') options.updater.cancel();
    pending = undefined;
    readyAt = 0;
    retryAt = 0;
  };
  const tick = async () => {
    if (busy) return;
    const key = options.context();
    if (key !== owner) {
      reset();
      owner = key;
    }
    if (!key || now() < retryAt) return;
    busy = true;
    try {
      const info = await options.query();
      if (options.context() !== key) return;
      if (!info.campaign) {
        reset();
        options.updater.defer(false);
        return;
      }
      const campaign = schoolUpdateSchema.parse(info.campaign);
      if (!newerRelease(campaign.version, options.current)) {
        await options.report(campaign, 'current', 100);
        return;
      }
      if(options.failedCampaign?.()===campaign.id) {
        await options.report(campaign,'error',0,'لم يكتمل التثبيت السابق. راجع إذن Windows ثم اطلب من المعلم إعادة الإرسال.');
        return;
      }
      if (pending?.id !== campaign.id || options.updater.state().status === 'error') {
        pending = campaign;
        readyAt = 0;
        options.updater.acceptSchool(campaign, (offset, signal) => {
          if (options.context() !== key) throw Error('تغيرت جلسة الطالب');
          return options.transport(campaign, offset, signal);
        });
      }
      if (options.updater.state().status !== 'ready') {
        await options.report(campaign, 'downloading');
        const result = await options.updater.download();
        if (options.context() !== key) return;
        if (result.status !== 'ready') throw Error(result.error || 'تعذر تنزيل تحديث المدرسة');
      }
      const fresh = await options.query();
      if (
        options.context() !== key ||
        !fresh.campaign ||
        schoolUpdateSchema.parse(fresh.campaign).id !== campaign.id
      ) {
        reset();
        return;
      }
      if (fresh.active) {
        readyAt = 0;
        options.updater.defer(true);
        await options.report(campaign, 'waiting', 100);
        return;
      }
      if (!readyAt) readyAt = now() + 20000;
      options.updater.defer(false, readyAt);
      await options.report(campaign, 'ready', 100);
      if (now() < readyAt) return;
      await options.report(campaign, 'installing', 100);
      if (options.context() !== key) return;
      await options.updater.install();
    } catch (error) {
      readyAt = 0;
      retryAt = now() + 60000;
      options.updater.defer(true);
      if (pending && options.context() === key)
        await options
          .report(pending, 'error', 0, (error as Error).message.slice(0, 500))
          .catch(() => {});
    } finally {
      busy = false;
    }
  };
  return { tick, reset };
}
