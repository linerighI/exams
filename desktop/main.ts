import { app, BrowserWindow, ipcMain, dialog, session, safeStorage, shell } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { request, Agent } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import WebSocket from 'ws';
import { randomBytes, X509Certificate } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import dgram from 'node:dgram';
import selfsigned from 'selfsigned';
import { createApp } from '../server/app';
import { modelPattern, ollamaRequest } from '../server/ollama';
import { providers } from '../src/bankExchange';
let win: BrowserWindow;
let server: Awaited<ReturnType<typeof createApp>> | undefined;
let udp: dgram.Socket | undefined;
let target: { host: string; fingerprint: string } | undefined;
let token = '';
let role = '';
let pairCode = '';
let eventSocket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
const port = !app.isPackaged ? Number(process.env.SCHOOL_TEST_PORT || 4310) : 4310;
const discoveryPort = port + 1;
if (!app.isPackaged && process.env.SCHOOL_TEST_DATA)
  app.setPath('userData', process.env.SCHOOL_TEST_DATA);
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
function secureRequest(
  host: string,
  pin: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<any> {
  return new Promise((resolve, reject) => {
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (b) => {
          text += b;
          if (text.length > 100 * 1024 * 1024) req.destroy(new Error('الاستجابة كبيرة جدًا'));
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(text);
            if ((res.statusCode || 500) >= 400)
              reject(new Error(result.error || 'تعذر الاتصال بالخادم'));
            else resolve(result);
          } catch {
            reject(new Error('استجابة الخادم غير صالحة'));
          }
        });
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
    req.setTimeout(190000, () => req.destroy(new Error('انتهت مهلة الاتصال بجهاز المعلم')));
  });
}
function persistTarget() {
  if (!target) return;
  mkdirSync(dataPath(), { recursive: true });
  const encrypted = safeStorage.isEncryptionAvailable();
  const json = JSON.stringify({ ...target, ...(encrypted ? { token, role } : {}) });
  writeFileSync(
    join(dataPath(), 'connection'),
    encrypted ? safeStorage.encryptString(json) : Buffer.from(json),
  );
  writeFileSync(join(dataPath(), 'connection-mode'), encrypted ? 'encrypted' : 'plain');
}
async function host() {
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
    pairCode = randomBytes(4).toString('hex').toUpperCase();
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
      workerDirectory: app.isPackaged
        ? join(process.resourcesPath, 'worker')
        : join(app.getAppPath(), 'worker'),
    });
    try {
      await server.app.listen({ port, host: '0.0.0.0' });
    } catch {
      await server.app.close();
      server = undefined;
      throw Error(`المنفذ ${port} مستخدم. أغلق نسخة التطبيق أو خادم التطوير الآخر ثم أعد المحاولة`);
    }
    udp = dgram.createSocket('udp4');
    udp.on('error', () => {});
    udp.on('message', (message, rinfo) => {
      if (message.toString() === 'ALSHEREQI_DISCOVER_V1') {
        const response = JSON.stringify({
          host: rinfo.address === '127.0.0.1' ? '127.0.0.1' : undefined,
          school: server!.store.getSetting('config').school,
          port,
        });
        udp!.send(response, rinfo.port, rinfo.address);
      }
    });
    udp.bind(discoveryPort);
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
        if (value.port === port && typeof value.school === 'string')
          results.set(rinfo.address, { ...value, host: rinfo.address });
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
app.whenReady().then(() => {
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
    }
  } catch {}
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(contents === win?.webContents && permission === 'media'),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission) => contents === win?.webContents && permission === 'media',
  );
  const handle = (name: string, fn: (...args: any[]) => any) =>
    ipcMain.handle(name, (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame)
        throw Error('مصدر غير مسموح');
      return fn(...args);
    });
  handle('host', host);
  handle('ollama-download-page', async () => {
    onlyTeacher();
    await shell.openExternal('https://ollama.com/download/windows');
  });
  handle('ai-provider-page', async (provider: string) => {
    onlyTeacher();
    if (!Object.hasOwn(providers, provider)) throw Error('مزود غير مسموح');
    await shell.openExternal(providers[provider as keyof typeof providers].url);
  });
  handle('bank-pdf', async (bookId: string) => {
    onlyTeacher();
    if (typeof bookId !== 'string' || !/^[a-f0-9]{32}$/.test(bookId)) throw Error('بنك غير صالح');
    const { html } = await secureRequest(
      target!.host,
      target!.fingerprint,
      `/api/books/${bookId}/document`,
      'GET',
    );
    const choice = await dialog.showSaveDialog(win, {
      defaultPath: 'question-bank.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    try {
      await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await printWindow.webContents.executeJavaScript(
        'document.fonts.ready.then(() => Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{}))))',
      );
      const bytes = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
      });
      writeFileSync(choice.filePath, bytes);
      return true;
    } finally {
      printWindow.destroy();
    }
  });
  handle('discover', discover);
  handle('pair', async (hostName: string, encoded: string) => {
    const { code, fingerprint } = JSON.parse(encoded);
    if (
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostName) ||
      !/^([A-Fa-f0-9]{2}:?){32}$/.test(fingerprint)
    )
      throw Error('أدخل عنوان IPv4 وبصمة SHA-256 الصحيحة');
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
      !/^\/api\/[a-zA-Z0-9/._-]+$/.test(path) ||
      !['GET', 'POST', 'PUT', 'DELETE'].includes(method)
    )
      throw Error('طلب غير مسموح');
    if (path === '/api/setup' && (!server || target.host !== '127.0.0.1'))
      throw Error('الإعداد الأول متاح على جهاز المعلم فقط');
    const result = await secureRequest(target.host, target.fingerprint, path, method, body);
    if (path === '/api/login') {
      token = result.token;
      role = result.role;
      persistTarget();
      connectEvents();
    }
    if (path === '/api/logout' || path === '/api/restore') {
      token = '';
      role = '';
      persistTarget();
      stopEvents();
    }
    return result;
  });
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
  handle('model-download', async (model: string) => {
    onlyTeacher();
    if (typeof model !== 'string' || !modelPattern.test(model)) throw Error('اسم النموذج غير صالح');
    return ollamaRequest('pull', { model, stream: false }, AbortSignal.timeout(3600000));
  });
  win = new BrowserWindow({
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    show: !process.env.SCHOOL_HEADLESS_TEST,
    width: 1440,
    height: 940,
    minWidth: 1000,
    minHeight: 720,
    title: 'مدرسة محمد الشريقي — الامتحانات الإلكترونية',
    backgroundColor: '#f4f8ff',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.loadFile(join(app.getAppPath(), 'dist', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  stopEvents();
  udp?.close();
  void server?.app.close();
});
