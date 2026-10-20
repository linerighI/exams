import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scrypt as scryptCallback,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as gzipCallback, gunzip as gunzipCallback } from 'node:zlib';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  statSync,
} from 'node:fs';
import { join, resolve, isAbsolute, dirname } from 'node:path';
import Database from 'better-sqlite3';
import { copyFile, rename, writeFile } from 'node:fs/promises';
import type { DatabaseFile } from './databaseWorkbook';
import type { SecretProtection } from './secrets';
const gzip = promisify(gzipCallback),
  gunzip = promisify(gunzipCallback);
const keyFor = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key))),
  );
const filePattern =
  /^(school\.sqlite|teachers\.sqlite|api-key-protection|teachers\/[a-f0-9]{32}\/school\.sqlite)$/;
const idPattern = /^\d{13}-[a-f0-9]{12}$/;
function memoryDatabase(bytes:Buffer){
 // SQLite serialization includes committed WAL pages. Deserializing in memory
 // needs rollback-journal header flags; retain the untouched bytes in the archive.
 const copy=Buffer.from(bytes);
 if(copy.length<100||copy.subarray(0,16).toString()!=='SQLite format 3\0')throw Error('ملف SQLite غير صالح');
 copy[18]=1;copy[19]=1;return new Database(copy);
}
export function validateDatabaseFiles(files: DatabaseFile[]) {
  if (
    !files.some((f) => f.path === 'school.sqlite') ||
    !files.some((f) => f.path === 'teachers.sqlite')
  )
    throw Error('النسخة لا تشمل قواعد بيانات المدرسة');
  const seen = new Set<string>();
  for (const file of files) {
    if (!filePattern.test(file.path) || seen.has(file.path))
      throw Error('مسار غير صالح داخل النسخة');
    seen.add(file.path);
    if (file.path.endsWith('.sqlite')) {
      const db = memoryDatabase(file.bytes);
      try {
        if (db.pragma('integrity_check', { simple: true }) !== 'ok')
          throw Error('قاعدة بيانات غير سليمة');
        const table = file.path === 'teachers.sqlite' ? 'teachers' : 'settings';
        if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
          throw Error('بنية قاعدة البيانات غير صالحة');
      } finally {
        db.close();
      }
    }
  }
  const registry = memoryDatabase(files.find((f) => f.path === 'teachers.sqlite')!.bytes);
  try {
    for (const row of registry.prepare('SELECT id FROM teachers').all() as any[]) {
      const path = row.id === 'master' ? 'school.sqlite' : `teachers/${row.id}/school.sqlite`;
      if (!seen.has(path)) throw Error('قاعدة بيانات أحد المعلمين مفقودة');
    }
  } finally {
    registry.close();
  }
}
export async function encryptBackup(files: DatabaseFile[], password: string) {
  if (password.length < 12 || password.length > 256)
    throw Error('استخدم عبارة نسخ احتياطي من 12 حرفًا على الأقل');
  const salt = randomBytes(16),
    iv = randomBytes(12),
    key = await keyFor(password, salt);
  try {
    const payload = await gzip(
      Buffer.from(
        JSON.stringify({
          version: 1,
          files: files.map((f) => ({
            path: f.path,
            data: f.bytes.toString('base64'),
            sha256: createHash('sha256').update(f.bytes).digest('hex'),
          })),
        }),
      ),
    );
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('Alshereqi backup v1'));
    const bytes = Buffer.concat([cipher.update(payload), cipher.final()]);
    return Buffer.from(
      JSON.stringify({
        format: 'Alshereqi encrypted backup',
        version: 1,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: bytes.toString('base64'),
      }),
    );
  } finally {
    key.fill(0);
  }
}
export async function decryptBackup(bytes: Buffer, password: string): Promise<DatabaseFile[]> {
  if (bytes.length > 512 * 1024 * 1024) throw Error('ملف النسخة أكبر من الحد المسموح');
  let envelope: any;
  try {
    envelope = JSON.parse(bytes.toString());
  } catch {
    throw Error('ملف النسخة غير صالح');
  }
  if (envelope.version !== 1 || envelope.format !== 'Alshereqi encrypted backup')
    throw Error('نوع النسخة غير مدعوم');
  const salt = Buffer.from(envelope.salt || '', 'base64'),
    iv = Buffer.from(envelope.iv || '', 'base64'),
    tag = Buffer.from(envelope.tag || '', 'base64');
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
    throw Error('ملف النسخة غير صالح');
  const key = await keyFor(password, salt);
  let files: DatabaseFile[];
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from('Alshereqi backup v1'));
    decipher.setAuthTag(tag);
    const payload = JSON.parse(
      (
        await gunzip(
          Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]),
          { maxOutputLength: 512 * 1024 * 1024 },
        )
      ).toString(),
    );
    if (payload.version !== 1 || !Array.isArray(payload.files) || payload.files.length > 1000)
      throw Error();
    files = payload.files.map((f: any) => {
      const bytes = Buffer.from(f.data, 'base64');
      if (createHash('sha256').update(bytes).digest('hex') !== f.sha256) throw Error();
      return { path: f.path, bytes };
    });
  } catch {
    throw Error('عبارة النسخ غير صحيحة أو الملف تالف');
  } finally {
    key.fill(0);
  }
  validateDatabaseFiles(files!);
  return files!;
}
// Applied before any SQLite handles are opened. The original files remain recoverable.
export function applyPendingRestore(directory: string) {
  const pending = join(directory, 'pending-school-restore.json');
  if (!existsSync(pending)) return false;
  const payload = JSON.parse(readFileSync(pending, 'utf8'));
  if (!idPattern.test(payload.id)) throw Error('طلب الاستعادة غير صالح');
  const files: DatabaseFile[] = payload.files.map((f: any) => ({
    path: f.path,
    bytes: Buffer.from(f.data, 'base64'),
  }));
  validateDatabaseFiles(files);
  const safety = join(directory, 'before-restore', payload.id);
  mkdirSync(safety, { recursive: true });
  const protectionFile = files.find(f => f.path === 'api-key-protection');
  const originalProtection = join(safety, 'api-key-protection');
  const previousProtection = existsSync(originalProtection) ? originalProtection : join(directory, 'api-key-protection');
  const protectionChanged = protectionFile && (!existsSync(previousProtection) || !readFileSync(previousProtection).equals(protectionFile.bytes));
  for (const file of files) {
    const target = join(directory, file.path);
    mkdirSync(dirname(target), { recursive: true });
    const original = join(safety, file.path);
    mkdirSync(dirname(original), { recursive: true });
    if (existsSync(target) && !existsSync(original)) copyFileSync(target, original);
    for (const suffix of file.path.endsWith('.sqlite') ? ['-wal', '-shm'] : []) {
      const sidecar = target + suffix;
      if (existsSync(sidecar)) {
        if (!existsSync(original + suffix)) copyFileSync(sidecar, original + suffix);
        unlinkSync(sidecar);
      }
    }
    const temporary = target + '.restore-new';
    writeFileSync(temporary, file.bytes);
    renameSync(temporary, target);
  }
  if (protectionChanged && existsSync(join(directory, 'backup-settings.json'))) {
    const settingsPath = join(directory, 'backup-settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    delete settings.sealedPassword;
    settings.enabled = false;
    settings.lastError = 'أُعيدت بيانات جهاز آخر. أدخل عبارة النسخ مجددًا لتفعيل النسخ التلقائي.';
    writeFileSync(settingsPath, JSON.stringify(settings));
  }
  // A crash before this point replays the same validated restore on next startup.
  unlinkSync(pending);
  return true;
}
export type BackupConfig = {
  enabled: boolean;
  mode: 'changes' | 'daily';
  time: string;
  folder: string;
  sealedPassword?: string;
  lastSuccess?: number;
  lastCloudCopy?: number;
  lastCloudId?: string;
  lastError?: string;
  lastRunDay?: string;
};
export function createSnapshotBackups(options: {
  directory: string;
  protection: SecretProtection;
  snapshot: () => DatabaseFile[];
  canRun: () => void;
  now?: () => number;
}) {
  const now = options.now || Date.now,
    local = join(options.directory, 'backups'),
    configPath = join(options.directory, 'backup-settings.json');
  let config: BackupConfig = { enabled: false, mode: 'changes', time: '16:00', folder: '' };
  if (existsSync(configPath)) {
    try { config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf8')) }; }
    catch { config.lastError = 'تعذرت قراءة إعدادات النسخ؛ أعد ضبطها. النسخ السابقة محفوظة.'; }
  }
  let dirtySince = config.enabled ? now() : 0,
    busy = false,
    cachedPassword = '',
    generation = 0;
  const save = () => {
    const temp = configPath + '.new';
    writeFileSync(temp, JSON.stringify(config));
    renameSync(temp, configPath);
  };
  const password = () =>
    cachedPassword || (cachedPassword = options.protection.open(config.sealedPassword!));
  const publicConfig = () => {
    const { sealedPassword, ...safe } = config;
    return {
      ...safe,
      hasPassword: !!sealedPassword,
      busy,
      localFolder: local,
      cloudStatus: config.folder ? 'folder-copy-only' : 'not-configured',
    };
  };
  const configure = (value: Partial<BackupConfig> & { password?: string }) => {
    if (busy) throw Error('انتظر اكتمال النسخ قبل تغيير إعداداته');
    if (
      (value.mode && !['changes', 'daily'].includes(value.mode)) ||
      (value.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
    )
      throw Error('موعد النسخ غير صالح');
    if (
      value.folder &&
      (!isAbsolute(value.folder) ||
        !existsSync(value.folder) ||
        !statSync(value.folder).isDirectory())
    )
      throw Error('اختر مجلد المزامنة الموجود على هذا الجهاز');
    if (value.folder && resolve(value.folder) === resolve(local))
      throw Error('اختر مجلدًا ثانيًا للنسخة السحابية');
    if (value.password !== undefined && value.password !== '') {
      if (value.password.length < 12 || value.password.length > 256)
        throw Error('عبارة النسخ يجب أن تكون 12 حرفًا على الأقل');
      config.sealedPassword = options.protection.seal(value.password);
      cachedPassword = value.password;
    }
    if (value.enabled && !config.sealedPassword) throw Error('أنشئ عبارة النسخ أولًا');
    for (const key of ['enabled', 'mode', 'time', 'folder'] as const)
      if (value[key] !== undefined) (config as any)[key] = value[key];
    if (value.enabled && !dirtySince) dirtySince = now();
    save();
    return publicConfig();
  };
  const history = () => {
    const records = new Map<string, any>();
    for (const [location, folder] of [
      ['local', local],
      ['cloud', config.folder],
    ] as const) {
      if (!folder || !existsSync(folder)) continue;
      try {
        for (const name of readdirSync(folder)) {
          const match = /^school-(\d{13}-[a-f0-9]{12})\.ashb$/.exec(name);
          if (!match) continue;
          const id = match[1],
            old = records.get(id) || {
              id,
              createdAt: Number(id.slice(0, 13)),
              local: false,
              cloud: false,
            };
          old[location] = true;
          old.bytes = statSync(join(folder, name)).size;
          records.set(id, old);
        }
      } catch {
        /* Local history remains available if the sync drive is offline. */
      }
    }
    return [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
  };
  const run = async () => {
    if (busy) throw Error('النسخ قيد التنفيذ');
    if (!config.sealedPassword) throw Error('حدد عبارة النسخ في الإعدادات');
    options.canRun();
    busy = true;
    config.lastError = '';
    try {
      const snapshot = options.snapshot(),
        capturedGeneration = generation;
      const bytes = await encryptBackup(snapshot, password());
      const id = `${now()}-${randomBytes(6).toString('hex')}`,
        name = `school-${id}.ashb`;
      mkdirSync(local, { recursive: true });
      await writeFile(join(local, name + '.partial'), bytes, { flag: 'wx' });
      await rename(join(local, name + '.partial'), join(local, name));
      config.lastSuccess = now();
      if (generation === capturedGeneration) dirtySince = 0;
      if (config.folder) {
        try {
          await writeFile(join(config.folder, name + '.partial'), bytes, { flag: 'wx' });
          await rename(join(config.folder, name + '.partial'), join(config.folder, name));
          config.lastCloudCopy = now();
          config.lastCloudId = id;
        } catch {
          config.lastError =
            'حُفظت النسخة محليًا، وتعذّر نسخها لمجلد المزامنة. أعد المزامنة بعد عودة المجلد.';
        }
      }
      save();
      return { id, ...publicConfig() };
    } catch (error) {
      config.lastError = (error as Error).message;
      save();
      throw error;
    } finally {
      busy = false;
    }
  };
  const stageRestore = async (id: string, phrase?: string) => {
    if (!idPattern.test(id)) throw Error('معرّف النسخة غير صالح');
    if (busy) throw Error('انتظر اكتمال النسخ');
    options.canRun();
    const name = `school-${id}.ashb`,
      source = [join(local, name), ...(config.folder ? [join(config.folder, name)] : [])].find(
        existsSync,
      );
    if (!source) throw Error('النسخة غير متاحة؛ تأكد من تنزيلها من برنامج المزامنة');
    busy = true;
    try {
      const files = await decryptBackup(readFileSync(source), phrase || password());
      options.canRun();
      const path = join(options.directory, 'pending-school-restore.json'),
        temp = path + '.new';
      writeFileSync(
        temp,
        JSON.stringify({
          id,
          files: files.map((f) => ({ path: f.path, data: f.bytes.toString('base64') })),
        }),
      );
      renameSync(temp, path);
      return { restartRequired: true };
    } finally {
      busy = false;
    }
  };
  const syncCloud = async () => {
    if (busy) return publicConfig();
    if (!config.folder) throw Error('اختر مجلد المزامنة أولًا');
    options.canRun();
    busy = true;
    try {
      for (const entry of history()
        .filter((e) => e.local && !e.cloud)
        .slice(0, 5)) {
        const name = `school-${entry.id}.ashb`,
          temporary = join(config.folder, name + '.partial');
        await copyFile(join(local, name), temporary);
        await rename(temporary, join(config.folder, name));
        config.lastCloudCopy = now();
        config.lastCloudId = entry.id;
      }
      config.lastError = '';
      save();
      return publicConfig();
    } catch {
      config.lastError = 'تعذرت الكتابة في مجلد المزامنة؛ النسخ المحلية محفوظة.';
      save();
      throw Error(config.lastError);
    } finally {
      busy = false;
    }
  };
  const tick = async () => {
    if (!config.enabled || busy) return;
    if (config.folder) {
      try {
        await syncCloud();
      } catch {}
    }
    const current = new Date(now()),
      day = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
    const clock = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
    if (
      config.mode === 'daily'
        ? (clock < config.time && (!config.lastSuccess || now() - config.lastSuccess < 86400000)) ||
          config.lastRunDay === day
        : !dirtySince || now() - dirtySince < 300000
    )
      return;
    try {
      await run();
      if (config.mode === 'daily') {
        config.lastRunDay = day;
        save();
      }
    } catch {
      /* Keep changes pending and retry on a later timer. */
    }
  };
  return {
    configure,
    config: publicConfig,
    history,
    run,
    stageRestore,
    syncCloud,
    tick,
    markChanged: () => {
      generation++;
      dirtySince ||= now();
    },
  };
}
