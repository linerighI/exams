import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { updateManifestSchema, type UpdateManifest } from '../src/schoolUpdate';

export type UpdateState = {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'current'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error';
  current: string;
  version?: string;
  notes?: string;
  size?: number;
  received?: number;
  error?: string;
  source?: 'github' | 'school';
  waiting?: boolean;
  installAt?: number;
};
const version = (s: string) => /^(?:v)?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(s);
export function newerRelease(tag: string, current: string) {
  const a = version(tag),
    b = version(current);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    if (+a[i] !== +b[i]) return +a[i] > +b[i];
  }
  return false;
}
export function trustedUpdateUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.username ||
    url.password ||
    !url.pathname.startsWith('/linerighI/exams/releases/download/')
  )
    throw Error('رابط التحديث لا ينتمي إلى مستودع التطبيق');
  return url.href;
}
async function hashFile(file: string) {
  const hash = createHash('sha256');
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest('hex');
}

export function createAppUpdater(options: {
  directory: string;
  current: string;
  emit: (state: UpdateState) => void;
  install: (file: string, hash: string) => Promise<void>;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher || fetch;
  let state: UpdateState = { status: 'idle', current: options.current };
  let selected:
    | {
        url: string;
        hash: string;
        size: number;
        version: string;
        download?: (offset: number, signal: AbortSignal) => Promise<Response>;
      }
    | undefined;
  let controller: AbortController | undefined;
  let readyFile = '';
  const patch = (next: Partial<UpdateState>) => {
    state = { ...state, ...next };
    options.emit(state);
    return state;
  };
  const get = async (url: string, init: RequestInit = {}) => {
    const response = await fetcher(url, {
      ...init,
      signal: init.signal || AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Alshereqi-Exams-Updater', ...init.headers },
    });
    if (!response.ok) throw Error(`تعذر تنزيل التحديث (${response.status})`);
    return response;
  };
  const check = async (previews = false, includeCurrent = false) => {
    if (['checking', 'downloading', 'ready', 'installing'].includes(state.status)) return state;
    patch({ status: 'checking', error: undefined });
    try {
      const releases: any = await (
        await get('https://api.github.com/repos/linerighI/exams/releases?per_page=30')
      ).json();
      if (!Array.isArray(releases)) throw Error('استجابة التحديثات غير صالحة');
      const release = releases
        .filter(
          (r: any) =>
            !r.draft &&
            (previews || !r.prerelease) &&
            (newerRelease(r.tag_name, options.current) ||
              (includeCurrent && r.tag_name.replace(/^v/, '').split('-')[0] === options.current)),
        )
        .sort((a: any, b: any) =>
          newerRelease(a.tag_name, b.tag_name) ? -1 : newerRelease(b.tag_name, a.tag_name) ? 1 : 0,
        )[0];
      if (!release) {
        selected = undefined;
        return patch({ status: 'current', version: undefined, notes: undefined, size: undefined });
      }
      const match = version(release.tag_name)!;
      const releaseVersion = `${match[1]}.${match[2]}.${match[3]}`;
      const name = `Alshereqi-Exams-WebView2-${releaseVersion}-Setup.exe`;
      const asset = release.assets?.find((a: any) => a.name === name);
      if (
        !asset ||
        !Number.isSafeInteger(asset.size) ||
        asset.size < 1 ||
        asset.size > 2 * 1024 ** 3
      )
        throw Error('لم تُرفق حزمة Windows الكاملة بهذا الإصدار بعد');
      const url = trustedUpdateUrl(asset.browser_download_url);
      let hash =
        typeof asset.digest === 'string'
          ? /^sha256:([a-f0-9]{64})$/i.exec(asset.digest)?.[1]
          : undefined;
      if (!hash) {
        const checksum = release.assets.find((a: any) => a.name === name + '.sha256');
        if (!checksum) throw Error('بصمة التحديث مفقودة؛ لن يُثبّت ملف غير موثّق');
        const text = await (await get(trustedUpdateUrl(checksum.browser_download_url))).text();
        hash = /^([a-f0-9]{64})\s/i.exec(text)?.[1];
      }
      if (!hash) throw Error('بصمة التحديث غير صالحة');
      selected = { url, hash: hash.toLowerCase(), size: asset.size, version: releaseVersion };
      return patch({
        status: 'available',
        version: releaseVersion,
        notes: String(release.body || '').slice(0, 4000),
        size: asset.size,
        received: 0,
        source: 'github',
        waiting: false,
        installAt: undefined,
      });
    } catch (e) {
      return patch({ status: 'error', error: (e as Error).message });
    }
  };
  const download = async () => {
    if (controller || state.status === 'installing') return state;
    if (!selected) throw Error('ابحث عن تحديث أولًا');
    const asset = { ...selected };
    controller = new AbortController();
    mkdirSync(options.directory, { recursive: true });
    const partial = join(options.directory, asset.hash + '.part');
    readyFile = join(options.directory, asset.hash + '.exe');
    patch({ status: 'downloading', error: undefined });
    try {
      if (
        existsSync(readyFile) &&
        statSync(readyFile).size === asset.size &&
        (await hashFile(readyFile)) === asset.hash
      )
        return patch({ status: 'ready', received: asset.size });
      if (existsSync(readyFile)) unlinkSync(readyFile);
      let offset = existsSync(partial) ? statSync(partial).size : 0;
      if (offset > asset.size) {
        unlinkSync(partial);
        offset = 0;
      }
      if (offset < asset.size) {
        const response = asset.download
          ? await asset.download(offset, controller.signal)
          : await get(asset.url, {
              signal: controller.signal,
              headers: offset ? { Range: `bytes=${offset}-` } : {},
            });
        if (
          offset &&
          (response.status !== 206 ||
            response.headers.get('content-range') !==
              `bytes ${offset}-${asset.size - 1}/${asset.size}`)
        )
          throw Error('تعذر استئناف التحديث بأمان؛ أعد المحاولة');
        if (!response.body) throw Error('ملف التحديث فارغ');
        let last = 0;
        await pipeline(
          Readable.fromWeb(response.body as any),
          async function* (source) {
            for await (const bytes of source) {
              offset += bytes.length;
              if (offset > asset.size) throw Error('حجم التحديث لا يطابق الإصدار');
              if (Date.now() - last > 400) {
                patch({ received: offset });
                last = Date.now();
              }
              yield bytes;
            }
          },
          createWriteStream(partial, { flags: offset ? 'a' : 'w' }),
          { signal: controller.signal },
        );
      }
      if (statSync(partial).size !== asset.size || (await hashFile(partial)) !== asset.hash) {
        unlinkSync(partial);
        throw Error('فشل التحقق من التحديث؛ لم يتم تشغيله');
      }
      renameSync(partial, readyFile);
      return patch({ status: 'ready', received: asset.size });
    } catch (e) {
      return patch({
        status: 'error',
        error: controller.signal.aborted
          ? 'أُلغي التنزيل. يمكنك استئنافه لاحقًا.'
          : (e as Error).message,
      });
    } finally {
      controller = undefined;
    }
  };
  return {
    state: () => state,
    check,
    download,
    acceptSchool: (
      input: UpdateManifest,
      transport: (offset: number, signal: AbortSignal) => Promise<Response>,
    ) => {
      const manifest = updateManifestSchema.parse(input);
      if (!newerRelease(manifest.version, options.current)) return patch({ status: 'current' });
      if (controller || state.status === 'installing') throw Error('انتظر اكتمال التحديث الجاري');
      selected = { ...manifest, url: '', download: transport };
      return patch({
        status: 'available',
        ...manifest,
        source: 'school',
        received: 0,
        error: undefined,
        waiting: false,
        installAt: undefined,
      });
    },
    defer: (waiting: boolean, installAt?: number) => patch({ waiting, installAt }),
    readyPackage: async () => {
      if (
        !selected ||
        state.source !== 'github' ||
        state.status !== 'ready' ||
        !existsSync(readyFile)
      )
        throw Error('نزّل تحديث GitHub وتحقق منه على الجهاز الرئيسي أولًا');
      if ((await hashFile(readyFile)) !== selected.hash)
        throw Error('ملف التحديث تغيّر؛ أعد تنزيله');
      return {
        version: selected.version,
        hash: selected.hash,
        size: selected.size,
        notes: state.notes || '',
        file: readyFile,
      };
    },
    cancel: () => {
      controller?.abort();
      return state;
    },
    install: async () => {
      if (!selected || state.status !== 'ready' || !existsSync(readyFile))
        throw Error('نزّل التحديث وتحقق منه أولًا');
      if ((await hashFile(readyFile)) !== selected.hash) {
        patch({ status: 'error', error: 'ملف التحديث تغيّر؛ أعد التنزيل' });
        throw Error('ملف التحديث تغيّر؛ أعد التنزيل');
      }
      patch({ status: 'installing' });
      try {
        await options.install(readyFile, selected.hash);
        return state;
      } catch (e) {
        patch({ status: 'ready', error: (e as Error).message });
        throw e;
      }
    },
  };
}
