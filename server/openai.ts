// Responses API: https://developers.openai.com/api/docs/guides/structured-outputs
const nullable = (s: any): boolean =>
  s?.type === 'null' ||
  (Array.isArray(s?.type) && s.type.includes('null')) ||
  s?.anyOf?.some(nullable);
export function strictSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const output: any = {};
  for (const [key, value] of Object.entries(schema))
    if (key !== '$schema' && key !== 'default') output[key] = strictSchema(value);
  if (schema.type === 'object' && schema.properties) {
    output.additionalProperties = false;
    output.required = Object.keys(schema.properties);
    for (const key of output.required)
      if (!(schema.required || []).includes(key) && !nullable(schema.properties[key]))
        output.properties[key] = { anyOf: [output.properties[key], { type: 'null' }] };
  }
  return output;
}
function optionalNulls(value: any, schema: any): any {
  if (Array.isArray(value)) return value.map((item) => optionalNulls(item, schema?.items));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, v]) =>
          v !== null ||
          nullable(schema?.properties?.[key]) ||
          (schema?.required || []).includes(key),
      )
      .map(([key, v]) => [key, optionalNulls(v, schema?.properties?.[key])]),
  );
}
export async function openaiGenerate(
  model: string,
  key: string,
  system: string,
  prompt: string,
  schema: unknown,
  signal: AbortSignal,
  media: { mimeType: string; data: string }[] = [],
) {
  if (!key) throw Error('أدخل مفتاح OpenAI API في إعدادات المعلم أولًا');
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        store: false,
        instructions: system,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...media.map((m) => ({
                type: 'input_image',
                image_url: `data:${m.mimeType};base64,${m.data}`,
              })),
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'school_response',
            strict: true,
            schema: strictSchema(schema),
          },
        },
        max_output_tokens: 8000,
      }),
    });
  } catch {
    if (signal.aborted) throw signal.reason;
    throw Error('تعذر الاتصال بـ OpenAI. تحقق من اتصال جهاز المعلم بالإنترنت');
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw Error('مفتاح OpenAI غير صالح أو لا يملك صلاحية النموذج');
    if (response.status === 429) throw Error('وصل OpenAI إلى حد الاستخدام. تحقق من الحصة والفوترة');
    if (response.status === 404) throw Error('نموذج OpenAI غير متاح. غيّر النموذج من الإعدادات');
    throw Error(
      `تعذر الطلب عبر OpenAI (HTTP ${response.status}). تحقق من النموذج ودعم المخرجات المنظمة`,
    );
  }
  const result: any = await response.json();
  const parts = (result.output || []).flatMap((o: any) => o.content || []);
  if (parts.some((p: any) => p.type === 'refusal'))
    throw Error('تعذر تنفيذ الطلب عبر OpenAI. راجع صياغة الطلب');
  if (result.status === 'incomplete')
    throw Error('رد OpenAI غير مكتمل. قلّل حجم الطلب وأعد المحاولة');
  const content = parts
    .filter((p: any) => p.type === 'output_text')
    .map((p: any) => p.text)
    .join('');
  if (!content) throw Error('لم يرجع OpenAI محتوى قابلًا للاستخدام');
  let cleaned: string;
  try {
    cleaned = JSON.stringify(optionalNulls(JSON.parse(content), schema));
  } catch {
    throw Error('رد OpenAI غير صالح. لم يتم اعتماد محتوى');
  }
  return { message: { content: cleaned }, usage: result.usage, done_reason: 'stop' };
}
