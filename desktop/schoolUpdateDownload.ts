import { request } from 'node:https';
import { X509Certificate } from 'node:crypto';
import { Readable } from 'node:stream';

// Only a fixed route on the already paired teacher is accepted, never a URL
// supplied by a remote update message. Pin TLS before sending authorization.
export function downloadSchoolUpdate(options: {
  host: string;
  port: number;
  fingerprint: string;
  token: string;
  id: string;
  offset: number;
  signal: AbortSignal;
}): Promise<Response> {
  if (!/^[a-f0-9]{32}$/.test(options.id)) throw Error('معرّف تحديث غير صالح');
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: options.host,
        port: options.port,
        path: `/api/school-updates/${options.id}/file`,
        method: 'GET',
        rejectUnauthorized: false,
        agent: false,
        signal: options.signal,
        headers: {
          Authorization: `Bearer ${options.token}`,
          ...(options.offset ? { Range: `bytes=${options.offset}-` } : {}),
        },
      },
      (res) => {
        if (![200, 206].includes(res.statusCode || 0)) {
          res.resume();
          reject(Error(`تعذر تنزيل التحديث من المعلم (${res.statusCode})`));
          return;
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(res.headers))
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(',') : value);
        resolve(
          new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, {
            status: res.statusCode,
            headers,
          }),
        );
      },
    );
    req.on('socket', (socket: any) =>
      socket.once('secureConnect', () => {
        const cert = socket.getPeerCertificate();
        const normalize = (s: string) => s.replaceAll(':', '').toUpperCase();
        if (
          !cert.raw ||
          normalize(new X509Certificate(cert.raw).fingerprint256) !== normalize(options.fingerprint)
        )
          return req.destroy(Error('بصمة جهاز المعلم تغيّرت؛ أعد الاقتران'));
        req.end();
      }),
    );
    req.on('error', reject);
    req.setTimeout(30000, () =>
      req.destroy(Error('انقطع تنزيل التحديث من المعلم؛ سيُستأنف لاحقًا')),
    );
  });
}
