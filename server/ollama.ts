import { Agent } from 'undici';
// Local model prefill can exceed fetch's default five-minute header timeout.
const generationAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0, connectTimeout: 5000 });
export const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

export function chooseInstalledModel(selected: string, models: string[]) {
  if (models.includes(selected)) return selected;
  if (models.includes(`${selected}:latest`)) return `${selected}:latest`;
  // Repair the old, uninstalled default without changing an explicit custom choice.
  if (['qwen3:1.7b', 'qwen3:4b'].includes(selected))
    return models.find((name) => /^qwen3(?:\.5)?:/.test(name)) || selected;
  return selected;
}

export async function ollamaRequest(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  onChunk?: (characters: number) => void,
) {
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:11434/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal || AbortSignal.timeout(5000),
      ...(path === 'chat' || path === 'pull' ? { dispatcher: generationAgent } : {}),
    } as RequestInit);
    if (!response.ok) {
      const result: any = await response.json();
      throwModelError(String(result.error || `HTTP ${response.status}`).slice(0, 600));
    }
    if (response.headers.get('content-type')?.includes('ndjson')) {
      if (!response.body) throw Error('لم يرسل النموذج ردًا');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '',
        content = '',
        final: any;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const value = JSON.parse(line);
        if (value.error) throwModelError(String(value.error));
        content += value.message?.content || '';
        if (content.length > 100000) throw Error('رد النموذج أطول من الحد المسموح');
        onChunk?.(content.length);
        if (value.done) final = value;
      };
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 100000) throw Error('رد النموذج غير صالح');
          let newline;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            consume(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
          }
        }
        buffer += decoder.decode();
        consume(buffer);
        if (!final) throw Error('انقطع رد النموذج قبل اكتماله. أعد المحاولة');
        return { ...final, message: { ...final.message, content } };
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
    const result: any = await response.json();
    if (result.error) throwModelError(String(result.error));
    return result;
  } catch (error: any) {
    if (signal?.aborted) {
      if (signal.reason?.name !== 'TimeoutError') throw signal.reason;
      throw Error('استغرق النموذج وقتًا طويلًا. جرّب نموذجًا أصغر أو عدد أسئلة أقل');
    }
    const code = error.cause?.code || error.code;
    if (['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(code))
      throw Error('انتهت مهلة انتظار النموذج أثناء التوليد. جرّب عدد أسئلة أقل أو نموذجًا أصغر');
    if (
      ['ECONNREFUSED', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ||
      error.message === 'fetch failed'
    )
      throw Error('تعذر الاتصال بـ Ollama على جهاز المعلم. شغّل البرنامج ثم حدّث الحالة');
    if (['UND_ERR_SOCKET', 'ECONNRESET'].includes(code))
      throw Error('انقطع الاتصال بالنموذج أثناء التوليد. تحقق من ذاكرة الجهاز ثم أعد المحاولة');
    throw error;
  }
}

function throwModelError(detail: string): never {
  if (/not found|does not exist|pull model/i.test(detail))
    throw Error(
      `النموذج غير مثبت. اختر نموذجًا من قائمة النماذج المثبتة أو نزّله أولًا. تفاصيل Ollama: ${detail}`,
    );
  if (/memory|out of.*vram|allocation/i.test(detail))
    throw Error(
      `ذاكرة الجهاز غير كافية لتشغيل النموذج. أغلق البرامج الثقيلة أو اختر نموذجًا أصغر. تفاصيل Ollama: ${detail}`,
    );
  throw Error(`تعذر تشغيل النموذج. تفاصيل Ollama: ${detail}`);
}

export async function modelStatus(selected: string) {
  try {
    const data = await ollamaRequest('tags');
    const models: string[] = (data.models || [])
      .filter((m: any) => !m.capabilities || m.capabilities.includes('completion'))
      .map((m: any) => m.name)
      .filter((name: any) => typeof name === 'string');
    const model = chooseInstalledModel(selected, models);
    return { available: true, models, model, ready: models.includes(model) };
  } catch (error) {
    return {
      available: false,
      models: [] as string[],
      model: selected,
      ready: false,
      error: (error as Error).message,
    };
  }
}

// Use the same fast-mode policy for chat and prompt editing as for exam tools.
export async function assistantModelStatus(config: { model: string; localSpeed?: string }) {
  const status = await modelStatus(config.model);
  if (config.localSpeed === 'fast' && status.models.includes('qwen3:1.7b'))
    return { ...status, model: 'qwen3:1.7b', ready: true };
  return status;
}
