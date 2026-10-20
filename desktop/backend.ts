import { createRequestQueue } from './requestQueue';
import { readJsonResponse } from './readJsonResponse';
import { allowedRequestPath } from './requestPolicy';
import { safeStorage } from './backend-platform';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { request, Agent } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import WebSocket from 'ws';
import { randomBytes, X509Certificate } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import dgram from 'node:dgram';
import selfsigned from 'selfsigned';
import type { createApp } from '../server/app';
import { modelPattern, ollamaRequest } from '../server/ollama';
import { providers } from '../src/bankExchange';
import { trustedTeacherResource } from '../src/teacherResources';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import { assertCanHost, assertHostElection } from './hostPolicy';
import { createAppUpdater } from './appUpdater';
import { newPairingCode, normalizePairingCode, pairingKey, pairingProof } from '../server/pairing';
const root = resolve(process.env.SCHOOL_APP_ROOT || process.cwd());
const app = {
  isPackaged: process.env.NODE_ENV === 'production',
  getPath: (_: string) => process.env.SCHOOL_DESKTOP_DATA_DIR || resolve('.data/webview2'),
  getAppPath: () => root,
};
const send = (message: unknown) => process.stdout.write(JSON.stringify(message) + '\n');
const win = { webContents: { send: (event: string, value: unknown) => send({ event, value }) } };
const nativePending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let nativeSequence = 0;
function nativeCall(method: string, ...args: unknown[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const nativeId = ++nativeSequence;
    nativePending.set(nativeId, { resolve, reject });
    send({ nativeId, method, args });
  });
}
const shell = { openExternal: (url: string) => nativeCall('open-external', url) };
const dialog = {
  showSaveDialog: (_: unknown, options: unknown) => nativeCall('save-dialog', options),
  showOpenDialog: (_: unknown, options: unknown) => nativeCall('open-dialog', options),
  showMessageBox: (_: unknown, options: unknown) => nativeCall('confirm-dialog', options),
};
const handlers = new Map<string, (...args: any[]) => any>();
const handle = (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn);

let server: Awaited<ReturnType<typeof createApp>> | undefined;
let udp: dgram.Socket | undefined;
let target: { host: string; fingerprint: string } | undefined;
let token = '';
let role = '';
let studentSession: any;
let pairCode = '';
let hostAnnouncing = false;
let eventSocket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
const port =
  process.env.SCHOOL_TEST_MODE === '1' ? Number(process.env.SCHOOL_TEST_PORT || 4310) : 4310;
const discoveryPort = port + 1;
const normalize = (s: string) => s.replaceAll(':', '').toUpperCase();
const dataPath = () => join(app.getPath('userData'), 'school');
function stopEvents() {
  clearTimeout(reconnectTimer);
  eventSocket?.removeAllListeners();
  eventSocket?.close();
  eventSocket = undefined;
}
function connectEvents() {
  stopEvents();
  if (!target || !token || role !== 'teacher') return;
  const currentTarget = target;
  const agent = new Agent({ rejectUnauthorized: false });
  agent.createConnection = ((options: any, callback: any) => {
    const socket = tlsConnect({ ...options, rejectUnauthorized: false });
    let completed = false;
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      if (
        !cert.raw ||
        normalize(new X509Certificate(cert.raw).fingerprint256) !==
          normalize(currentTarget.fingerprint)
      ) {
        completed = true;
        callback(new Error('بصمة غير صحيحة'));
        socket.destroy();
        return;
      }
      completed = true;
      callback(null, socket);
    });
    socket.once('error', (error) => {
      if (!completed) {
        completed = true;
        callback(error);
      }
    });
    return undefined;
  }) as any;
  eventSocket = new WebSocket(`wss://${currentTarget.host}:${port}/api/events?token=${token}`, {
    agent,
  });
  eventSocket.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      if (['attempts', 'exams'].includes(event.type)) win.webContents.send('server-event', event);
    } catch {}
  });
  eventSocket.on('error', () => {});
  eventSocket.on('close', () => {
    agent.destroy();
    if (role === 'teacher') reconnectTimer = setTimeout(connectEvents, 5000);
  });
}
const schoolRequests = createRequestQueue(4);
function secureRequest(
  host: string,
  pin: string,
  path: string,
  method = 'GET',
  body?: unknown,
  authorization = token,
  timeout = 190000,
): Promise<any> {
  return schoolRequests(() => new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = request(
      {
        hostname: host,
        port,
        path,
        method,
        rejectUnauthorized: false,
        agent: false,
        headers: {
          ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}),
          ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        },
      },
      (res) => {
        void readJsonResponse(res).then(resolve, reject);
      },
    );
    req.on('socket', (socket: any) =>
      socket.once('secureConnect', () => {
        const peer = socket.getPeerCertificate();
        if (
          !peer.raw ||
          normalize(new X509Certificate(peer.raw).fingerprint256) !== normalize(pin)
        ) {
          req.destroy(new Error('بصمة جهاز المعلم تغيّرت. أعد الاقتران من الإعدادات'));
          return;
        }
        req.end(bytes);
      }),
    );
    req.on('error', reject);
    req.setTimeout(timeout, () =>
      req.destroy(new Error('تعذر الوصول إلى جهاز المعلم. تحقق من شبكة المدرسة')),
    );
  }));
}
function persistTarget() {
  if (!target) return;
  mkdirSync(dataPath(), { recursive: true });
  const encrypted = safeStorage.isEncryptionAvailable();
  const json = JSON.stringify({
    ...target,
    localHost: !!server,
    ...(encrypted ? { token, role, studentSession } : {}),
  });
  writeFileSync(
    join(dataPath(), 'connection'),
    encrypted ? safeStorage.encryptString(json) : Buffer.from(json),
  );
  writeFileSync(join(dataPath(), 'connection-mode'), encrypted ? 'encrypted' : 'plain');
}
let hostStarting: Promise<any> | undefined;
function host(): Promise<any> {
  if (hostStarting) return hostStarting;
  hostStarting = startHost().finally(() => { hostStarting = undefined; });
  return hostStarting;
}
async function startHost() {
  if (!server) {
    assertCanHost({ hosting: false, role, target, discovered: [], localAddresses: [] });
    const localAddresses = Object.values(networkInterfaces()).flat().filter(n => n?.family === 'IPv4').map(n => n!.address);
    assertCanHost({ hosting: false, role, target, discovered: await discover(), localAddresses });
  }
  if (!server) {
    mkdirSync(dataPath(), { recursive: true });
    const certPath = join(dataPath(), 'tls.json');
    let pems: any;
    if (existsSync(certPath)) pems = JSON.parse(readFileSync(certPath, 'utf8'));
    else {
      pems = await selfsigned.generate([{ name: 'commonName', value: 'Alshereqi LAN' }], {
        keySize: 2048,
        algorithm: 'sha256',
        notAfterDate: new Date(Date.now() + 3650 * 86400000),
      });
      writeFileSync(certPath, JSON.stringify(pems));
    }
    const fingerprint = new X509Certificate(pems.cert).fingerprint256;
    pairCode = newPairingCode();
    // Opening the connection screen does not need the school server/AI modules.
    const { createApp } = await import('../server/app');
    server = await createApp({
      directory: dataPath(),
      secretProtection: {
        seal: (value) => {
          if (!safeStorage.isEncryptionAvailable())
            throw Error('حماية مفتاح API في Windows غير متاحة');
          return safeStorage.encryptString(value).toString('base64');
        },
        open: (value) => safeStorage.decryptString(Buffer.from(value, 'base64')),
      },
      https: { key: pems.private, cert: pems.cert },
      pairingCode: pairCode,
      pairingFingerprint: fingerprint,
      workerDirectory: app.isPackaged ? join(root, 'worker') : join(app.getAppPath(), 'worker'),
    });
    try {
      await server.app.listen({ port, host: '0.0.0.0' });
    } catch {
      await server.app.close();
      server = undefined;
      throw Error(`المنفذ ${port} مستخدم. أغلق نسخة التطبيق أو خادم التطوير الآخر ثم أعد المحاولة`);
    }
    udp = dgram.createSocket('udp4');
    hostAnnouncing = true;
    udp.on('error', () => {});
    udp.on('message', (message, rinfo) => {
      if (message.toString() === 'ALSHEREQI_DISCOVER_V1') {
        const response = JSON.stringify({
          host: rinfo.address === '127.0.0.1' ? '127.0.0.1' : undefined,
          school: server!.store.getSetting('config').school,
          port,
          pairingVersion: 1,
          deviceId: fingerprint,
          hostState: hostAnnouncing ? 'starting' : 'active',
        });
        udp!.send(response, rinfo.port, rinfo.address);
      }
    });
    try {
      await new Promise<void>((resolve, reject) => { udp!.once('error', reject); udp!.bind(discoveryPort, () => { udp!.removeListener('error', reject); resolve(); }); });
      const localAddresses = Object.values(networkInterfaces()).flat().filter(n => n?.family === 'IPv4').map(n => n!.address);
      assertHostElection(fingerprint, localAddresses, await discover());
      hostAnnouncing = false;
    } catch (error) {
      try { udp.close(); } catch { }
      udp = undefined;
      await server.app.close(); server = undefined;
      throw error;
    }
    target = { host: '127.0.0.1', fingerprint };
    token = '';
    role = '';
  }
  const cert: any = JSON.parse(readFileSync(join(dataPath(), 'tls.json'), 'utf8'));
  const fingerprint = new X509Certificate(cert.cert).fingerprint256;
  target = { host: '127.0.0.1', fingerprint };
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n!.address);
  return { addresses, port, pairCode, fingerprint };
}
function discover(): Promise<any[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const results = new Map();
    const timer = setTimeout(() => {
      socket.close();
      resolve([...results.values()]);
    }, 2000);
    socket.on('error', () => {
      clearTimeout(timer);
      socket.close();
      resolve([]);
    });
    socket.on('message', (message, rinfo) => {
      try {
        const value = JSON.parse(message.toString());
        if (value.port === port && typeof value.school === 'string') {
          // Discovery metadata only deduplicates interfaces; pairing authenticates the certificate.
          const key = typeof value.deviceId === 'string' ? value.deviceId : rinfo.address;
          const existing = results.get(key);
          if (!existing || existing.host === '127.0.0.1')
            results.set(key, { ...value, host: rinfo.address });
        }
      } catch {}
    });
    socket.bind(0, () => {
      socket.setBroadcast(true);
      socket.send('ALSHEREQI_DISCOVER_V1', discoveryPort, '255.255.255.255');
      for (const info of Object.values(networkInterfaces()).flat())
        if (info?.family === 'IPv4' && !info.internal) {
          const octets = info.address.split('.').map(Number);
          const mask = info.netmask.split('.').map(Number);
          const broadcast = octets.map((v, i) => v | (~mask[i] & 255)).join('.');
          socket.send('ALSHEREQI_DISCOVER_V1', discoveryPort, broadcast);
        }
      socket.send('ALSHEREQI_DISCOVER_V1', discoveryPort, '127.0.0.1');
    });
  });
}
const onlyTeacher = () => {
  if (!server || role !== 'teacher' || target?.host !== '127.0.0.1')
    throw Error('هذه العملية متاحة للمعلم على الجهاز الرئيسي فقط');
};
async function start() {
  console.error('Startup: restoring saved connection');
  const requireUpdateTeacher = () => { if (role !== 'teacher') throw Error('تحديث التطبيق متاح بعد تسجيل الدخول بحساب المعلم'); };
  const updater = createAppUpdater({
    directory: join(app.getPath('userData'), 'updates'),
    current: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    emit: state => win.webContents.send('server-event', { type: 'app-update', state }),
    install: async (file, hash) => {
      requireUpdateTeacher();
      if (!app.isPackaged) throw Error('تثبيت التحديث متاح في النسخة المثبتة فقط، وليس داخل مجلد تطوير المشروع.');
      if (server && !server.beginUpdateMaintenance()) throw Error('يوجد طلاب في امتحانات جارية على هذا الجهاز الرئيسي؛ انتظر انتهاء جميع المعلمين قبل التحديث.');
      try {
        if (target && token) {
          const attempts = await secureRequest(target.host, target.fingerprint, '/api/attempts', 'GET', undefined, token, 6000);
          if (attempts.some((a: any) => !a.submittedAt && a.deadline > Date.now())) throw Error('لا يمكن إغلاق التطبيق للتحديث أثناء وجود امتحانات جارية. ثبّت التحديث بعد انتهاء الطلاب.');
        }
        await nativeCall('install-update', file, hash);
      } catch (error) { server?.cancelUpdateMaintenance(); throw error; }
    },
  });
  handle('update-state', () => { requireUpdateTeacher(); return updater.state(); });
  handle('update-check', (previews = false) => { requireUpdateTeacher(); return updater.check(previews === true); });
  handle('update-download', () => { requireUpdateTeacher(); return updater.download(); });
  handle('update-cancel', () => { requireUpdateTeacher(); return updater.cancel(); });
  handle('update-install', () => { requireUpdateTeacher(); return updater.install(); });
  let restoreLocal = false;
  try {
    const file = join(dataPath(), 'connection');
    if (existsSync(file)) {
      const bytes = readFileSync(file);
      const json =
        readFileSync(join(dataPath(), 'connection-mode'), 'utf8') === 'encrypted'
          ? safeStorage.decryptString(bytes)
          : bytes.toString();
      const saved = JSON.parse(json);
      target = { host: saved.host, fingerprint: saved.fingerprint };
      token = saved.token || '';
      role = saved.role || '';
      studentSession = saved.studentSession;
      restoreLocal = !!saved.localHost && saved.host === '127.0.0.1';
    }
  } catch {}
  if (restoreLocal && role === 'student') {
    console.error('Startup: restoring this device school server for the saved student');
    const previous = { token, role, studentSession };
    role = ''; // Restore this machine's own saved host, never a remotely paired student.
    try { await host(); } catch (error) { console.error('Local host restore:', (error as Error).message); }
    token = previous.token;
    role = previous.role;
    studentSession = previous.studentSession;
  }
  handle('host', host);
  handle('student-session', () =>
    role === 'student' && studentSession ? { ...studentSession, token, role: 'student' } : null,
  );
  handle('ollama-download-page', async () => {
    onlyTeacher();
    await shell.openExternal('https://ollama.com/download/windows');
  });
  handle('ai-provider-page', async (provider: string) => {
    onlyTeacher();
    if (!Object.hasOwn(providers, provider)) throw Error('مزود غير مسموح');
    await shell.openExternal(providers[provider as keyof typeof providers].url);
  });
  handle('bank-pdf', async (bookId: string, options?: any) => {
    if (role !== 'teacher' || !token || !target) throw Error('التصدير متاح للمعلم فقط');
    if (typeof bookId !== 'string' || !/^[a-f0-9]{32}$/.test(bookId)) throw Error('بنك غير صالح');
    const query = new URLSearchParams();
    for (const key of ['audience','approvedOnly','chapter','title'])
      if (options?.[key] !== undefined) query.set(key, String(options[key]));
    if (query.toString().length > 5000) throw Error('خيارات غير صالحة');
    const { html } = await secureRequest(
      target!.host,
      target!.fingerprint,
      `/api/books/${bookId}/document?${query}`,
      'GET',
    );
    const choice = await dialog.showSaveDialog(win, {
      defaultPath: 'question-bank.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    return nativeCall('print-pdf', html, choice.filePath);
  });
  handle('report-pdf', async (options: unknown) => {
    if (role !== 'teacher' || !token || !target) throw Error('التصدير متاح للمعلم فقط');
    const {html} = await secureRequest(target.host,target.fingerprint,'/api/reports/document','POST',options);
    const choice=await dialog.showSaveDialog(win, {defaultPath:`school-report-${new Date().toISOString().slice(0,10)}.pdf`,filters:[{name:'PDF',extensions:['pdf']}]});
    if(choice.canceled || !choice.filePath)return false;
    return nativeCall('print-pdf',html,choice.filePath);
  });
  handle('discover', discover);
  handle('connection-state', async () => {
    if (!target) return { connected: false, local: false };
    try {
      const status = await secureRequest(
        target.host,
        target.fingerprint,
        '/api/status',
        'GET',
        undefined,
        '',
        3000,
      );
      return {
        connected: true,
        school: status.school,
        host: target.host,
        fingerprint: target.fingerprint,
        local: Boolean(server && target.host === '127.0.0.1'),
      };
    } catch {
      return { connected: false, host: target.host, local: false };
    }
  });
  handle('connect-teacher', async (hostName: string, code: string) => {
    if (
      typeof hostName !== 'string' ||
      isIP(hostName) !== 4 ||
      typeof code !== 'string' ||
      !/^[A-HJ-NP-Z2-9]{12}$/.test(normalizePairingCode(code))
    )
      throw Error('أدخل رمز الاتصال كما يظهر على جهاز المعلم');
    // Observe the leaf certificate without sending HTTP data or credentials. It is
    // not trusted until the shared-code proof authenticates this exact certificate.
    const fingerprint = await new Promise<string>((resolve, reject) => {
      const socket = tlsConnect({ host: hostName, port, rejectUnauthorized: false }, () => {
        try {
          resolve(new X509Certificate(socket.getPeerCertificate().raw).fingerprint256);
        } catch {
          reject(Error('تعذر التحقق من هوية جهاز المعلم'));
        } finally {
          socket.destroy();
        }
      });
      socket.on('error', () =>
        reject(Error('تعذر الوصول إلى جهاز المعلم. تحقق من الشبكة والعنوان')),
      );
      socket.setTimeout(5000, () => socket.destroy(Error('انتهت مهلة الاتصال')));
    });
    const nonce = randomBytes(32).toString('hex');
    const response = await secureRequest(
      hostName,
      fingerprint,
      '/api/pair/proof',
      'POST',
      { nonce },
      '',
      6000,
    );
    const expected = Buffer.from(
      pairingProof(pairingKey(code, fingerprint), nonce, fingerprint),
      'hex',
    );
    if (
      typeof response.proof !== 'string' ||
      !/^[a-f0-9]{64}$/.test(response.proof) ||
      !timingSafeEqual(expected, Buffer.from(response.proof, 'hex'))
    )
      throw Error('رمز الاتصال غير صحيح. اطلب الرمز الظاهر على جهاز المعلم');
    const result = await secureRequest(
      hostName,
      fingerprint,
      '/api/pair',
      'POST',
      { code },
      '',
      6000,
    );
    stopEvents();
    token = '';
    role = '';
    target = { host: hostName, fingerprint };
    persistTarget();
    return { connected: true, local: false, host: hostName, fingerprint, school: result.school };
  });
  handle('pair', async (hostName: string, encoded: string) => {
    const { code, fingerprint } = JSON.parse(encoded);
    if (
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostName) ||
      !/^([A-Fa-f0-9]{2}:?){32}$/.test(fingerprint)
    )
      throw Error('أدخل عنوان IPv4 وبصمة SHA-256 الصحيحة');
    stopEvents();
    token = '';
    role = '';
    const result = await secureRequest(hostName, fingerprint, '/api/pair', 'POST', { code });
    target = { host: hostName, fingerprint };
    persistTarget();
    return result;
  });
  handle('request', async (path: string, method = 'GET', body?: unknown) => {
    if (!target) throw Error('اختر وضع المعلم أو اربط جهاز الطالب أولًا');
    if (
      !allowedRequestPath(path, method) ||
      !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    )
      throw Error('طلب غير مسموح');
    if (path === '/api/setup' && (!server || target.host !== '127.0.0.1'))
      throw Error('الإعداد الأول متاح على جهاز المعلم فقط');
    const input = body as any;
    if (
      role === 'student' &&
      path === '/api/login' &&
      (input?.role !== 'student' ||
        (studentSession?.student?.code && input.code !== studentSession.student.code))
    )
      throw Error('سجّل خروج الطالب بكلمة مرور المعلم قبل تغيير الحساب');
    if (role === 'student' && path === '/api/logout' && studentSession?.student?.code) {
      // Refresh only this student's identity after a school-server restart.
      const fresh = await secureRequest(
        target.host,
        target.fingerprint,
        '/api/login',
        'POST',
        { role: 'student', code: studentSession.student.code },
        '',
        6000,
      );
      token = fresh.token;
    }
    const result = await secureRequest(target.host, target.fingerprint, path, method, body);
    if (path === '/api/login') {
      token = result.token;
      role = result.role;
      studentSession =
        role === 'student' ? { student: result.student, teacherId: result.teacherId } : undefined;
      await nativeCall('teacher-speech-session', role === 'teacher');
      await nativeCall('student-mode', role === 'student');
      persistTarget();
      connectEvents();
    }
    if (path === '/api/logout' || path === '/api/restore') {
      token = '';
      role = '';
      studentSession = undefined;
      await nativeCall('teacher-speech-session', false);
      await nativeCall('student-mode', false);
      persistTarget();
      stopEvents();
    }
    return result;
  });
  let speechBusy = false;
  for (const operation of ['speech-status', 'speech-transcribe', 'speech-synthesize'])
    handle(operation, async (value?: unknown, language?: unknown) => {
      if (role !== 'teacher' || !token) throw Error('الصوت متاح للمعلم فقط');
      if (operation === 'speech-status') return nativeCall(operation);
      if (
        typeof value !== 'string' ||
        !['ar', 'en'].includes(String(language)) ||
        (operation === 'speech-transcribe' &&
          (value.length > 1280000 || !/^[A-Za-z0-9+/=]+$/.test(value))) ||
        (operation === 'speech-synthesize' && (!value.trim() || value.length > 700))
      )
        throw Error('طلب صوت غير صالح');
      if (speechBusy) throw Error('انتظر اكتمال المقطع الصوتي الحالي');
      speechBusy = true;
      try {
        return await nativeCall(operation, value, language);
      } finally {
        speechBusy = false;
      }
    });
  handle('teacher-resource', async (value: unknown) => {
    if (role !== 'teacher' || !token) throw Error('هذه الأداة متاحة للمعلم فقط');
    const url = trustedTeacherResource(value);
    await shell.openExternal(url);
    return true;
  });
  handle('backup-folder',async()=>{onlyTeacher();const account=await secureRequest(target!.host,target!.fingerprint,'/api/account');if(!account.isAdmin)throw Error('هذه العملية لمدير الحسابات');return nativeCall('backup-folder');});
  handle('restart-app',async()=>{onlyTeacher();const account=await secureRequest(target!.host,target!.fingerprint,'/api/account');if(!account.isAdmin)throw Error('هذه العملية لمدير الحسابات');return nativeCall('restart-app');});
  handle('backup-save', async () => {
    onlyTeacher();
    const backup = await secureRequest(target!.host, target!.fingerprint, '/api/backup');
    const choice = await dialog.showSaveDialog(win, {
      defaultPath: `school-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'نسخة احتياطية', extensions: ['json'] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    writeFileSync(choice.filePath, JSON.stringify(backup));
    return true;
  });
  handle('backup-read', async () => {
    onlyTeacher();
    const choice = await dialog.showOpenDialog(win, {
      filters: [{ name: 'نسخة احتياطية', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (choice.canceled) return false;
    const confirm = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['إلغاء', 'استعادة'],
      defaultId: 0,
      cancelId: 0,
      message: 'ستستبدل الاستعادة بيانات المدرسة الحالية. احفظ نسخة احتياطية أولًا.',
    });
    if (confirm.response !== 1) return false;
    const backup = JSON.parse(readFileSync(choice.filePaths[0], 'utf8'));
    await secureRequest(target!.host, target!.fingerprint, '/api/restore', 'POST', backup);
    token = '';
    role = '';
    persistTarget();
    stopEvents();
    return true;
  });
  handle('export-csv', async (csv: string) => {
    onlyTeacher();
    if (typeof csv !== 'string' || csv.length > 10000000) throw Error('ملف غير صالح');
    const choice = await dialog.showSaveDialog(win, {
      defaultPath: 'results.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    writeFileSync(choice.filePath, csv);
    return true;
  });
  handle('spreadsheet-save', async (kind:string) => {
    if(role!=='teacher' || !token || !target || !['students','results','template','database'].includes(kind))throw Error('التصدير متاح للمعلم فقط');
    const result=await secureRequest(target.host,target.fingerprint,`/api/exports/${kind}`);
    const choice=await dialog.showSaveDialog(win,{defaultPath:`${kind}.xlsx`,filters:[{name:'Excel',extensions:['xlsx']}]});
    if(choice.canceled || !choice.filePath)return false;
    writeFileSync(choice.filePath,Buffer.from(result.data,'base64'));return true;
  });
  handle('model-download', async (model: string) => {
    onlyTeacher();
    if (typeof model !== 'string' || !modelPattern.test(model)) throw Error('اسم النموذج غير صالح');
    return ollamaRequest('pull', { model, stream: false }, AbortSignal.timeout(3600000));
  });

  handle('shutdown', async () => {
    stopEvents();
    udp?.close();
    await server?.app.close();
    setTimeout(() => process.exit(0), 20);
    return true;
  });
  createInterface({ input: process.stdin })
    .on('line', (line) => {
      void (async () => {
        let message: any;
        try {
          message = JSON.parse(line);
          if (message.nativeId) {
            const call = nativePending.get(message.nativeId);
            nativePending.delete(message.nativeId);
            if (message.error) call?.reject(Error(message.error));
            else call?.resolve(message.result);
            return;
          }
          if (!Number.isSafeInteger(message.id) || !Array.isArray(message.args))
            throw Error('Invalid request');
          if (
            role === 'student' &&
            !['request', 'connection-state', 'student-session', 'shutdown'].includes(message.method)
          )
            throw Error('جلسة الطالب مقفلة. يلزم تسجيل الخروج بكلمة مرور المعلم');
          const handler = handlers.get(message.method);
          if (!handler) throw Error('Unsupported desktop command');
          const result = await handler(...message.args);
          send({ id: message.id, result: result ?? null });
        } catch (error) {
          send({ id: message?.id, error: (error as Error).message });
        }
      })();
    })
    .on('close', () => process.exit(0));
  if (role === 'student') {
    console.error('Startup: restoring saved student session');
    await nativeCall('student-mode', true);
  }
  if (process.env.SCHOOL_TEST_MODE === '1') {
    const delay = Number(process.env.SCHOOL_TEST_STARTUP_DELAY_MS || 0);
    if (Number.isFinite(delay) && delay > 0 && delay <= 60000) await new Promise(resolve => setTimeout(resolve, delay));
  }
  console.error('Startup: backend ready');
  send({ event: 'ready' });
}
console.log = (...args: unknown[]) => console.error(...args);
start().catch((error) => {
  console.error(error);
  process.exit(1);
});
