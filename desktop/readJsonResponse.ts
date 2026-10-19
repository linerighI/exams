import type { IncomingMessage } from 'node:http';

// Decode across chunks: a TLS packet can end in the middle of an Arabic character.
export async function readJsonResponse(response: IncomingMessage, maxBytes = 100 * 1024 * 1024) {
  response.setEncoding('utf8');
  let text = '', bytes = 0;
  for await (const chunk of response) {
    bytes += Buffer.byteLength(chunk, 'utf8');
    if (bytes > maxBytes) throw Error('الاستجابة كبيرة جدًا');
    text += chunk;
  }
  let result: any;
  try { result = JSON.parse(text); }
  catch { throw Error('استجابة الخادم غير صالحة'); }
  if ((response.statusCode || 500) >= 400)
    throw Error(result.error || 'تعذر الاتصال بالخادم');
  return result;
}
