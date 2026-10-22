// Keep output structure, but enforce size/range rules in the caller's Zod schema.
// Large string/array limits (including optional audio fields) can exceed Gemini's
// constrained-decoding state budget even for a one-question request.
const localConstraints = new Set([
  '$schema',
  'default',
  'examples',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
]);
export function geminiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, value]) => {
      if (localConstraints.has(key)) return [];
      if (key === 'const') return [['enum', [value]]];
      if (
        ['properties', '$defs', 'definitions'].includes(key) &&
        value &&
        typeof value === 'object'
      )
        return [
          [
            key,
            Object.fromEntries(
              Object.entries(value).map(([name, child]) => [name, geminiSchema(child)]),
            ),
          ],
        ];
      return [[key, geminiSchema(value)]];
    }),
  );
}

export async function geminiGenerate(
  model: string,
  key: string,
  system: string,
  prompt: string,
  schema: unknown,
  signal: AbortSignal,
  media: { mimeType: string; data: string }[] = [],
) {
  if (!key) throw Error('أدخل مفتاح Gemini في إعدادات المعلم أولًا');
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }, ...media.map((inlineData) => ({ inlineData }))],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 6000,
            ...(model.startsWith('gemini-2')
              ? { responseMimeType: 'application/json', responseJsonSchema: geminiSchema(schema) }
              : {
                  responseFormat: {
                    text: { mimeType: 'APPLICATION_JSON', schema: geminiSchema(schema) },
                  },
                }),
            ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      },
    );
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw Error('تعذر الاتصال بـ Gemini. تحقق من اتصال جهاز المعلم بالإنترنت');
  }
  const result: any = await response.json();
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw Error('مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام النموذج');
    if (response.status === 429)
      throw Error('وصل حساب Gemini إلى حد الاستخدام. تحقق من الحصة والفوترة ثم أعد المحاولة');
    if (response.status === 404)
      throw Error('نموذج Gemini غير متاح لهذا الحساب. غيّر اسم النموذج من الإعدادات');
    if (response.status === 400 && /API_KEY/i.test(result.error?.message || ''))
      throw Error('مفتاح Gemini غير صالح');
    if (response.status === 400) {
      const reason = String(result.error?.message || '')
        .split(key)
        .join('[محجوب]')
        .replace(/AIza[A-Za-z0-9_-]+/g, '[محجوب]')
        .replace(/\s+/g, ' ')
        .slice(0, 700);
      throw Error(
        `رفض Gemini الطلب (HTTP 400)${reason ? `: ${reason}` : '. تحقق من إعدادات النموذج'}`,
      );
    }
    throw Error(`تعذر التوليد عبر Gemini (HTTP ${response.status}). تحقق من إعدادات النموذج`);
  }
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((p: any) => !p.thought)
    .map((p: any) => p.text || '')
    .join('');
  if (!text) throw Error('لم يُرجع Gemini بيانات. تحقق من المحتوى وأعد المحاولة');
  return {
    usage: result.usageMetadata,
    message: { content: text },
    done_reason: candidate.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
  };
}
