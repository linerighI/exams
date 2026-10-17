import type { Settings } from '../src/types';
import { openaiGenerate } from './openai';
import { geminiGenerate } from './gemini';
import { assistantModelStatus, ollamaRequest } from './ollama';
export async function providerStatus(config: Settings, key: string) {
  if (config.aiProvider === 'openai' || config.aiProvider === 'gemini')
    return {
      provider: config.aiProvider,
      model: providerModel(config),
      ready: !!key,
      available: !!key,
      models: [providerModel(config)],
      error: key ? undefined : 'أدخل مفتاح API من الإعدادات',
    };
  return { provider: 'ollama', ...(await assistantModelStatus(config)) };
}
export async function providerChat(
  config: Settings,
  key: string,
  _route: string,
  body: any,
  signal: AbortSignal,
): Promise<any> {
  if (config.aiProvider !== 'openai' && config.aiProvider !== 'gemini')
    return ollamaRequest(_route, body, signal);
  const result = await providerGenerate(
    config,
    key,
    body.messages
      .filter((m: any) => m.role === 'system')
      .map((m: any) => m.content)
      .join('\n'),
    body.messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => m.content)
      .join('\n'),
    body.format,
    signal,
  );
  return {
    ...result,
    prompt_eval_count: result.usage?.input_tokens || result.usage?.promptTokenCount,
    eval_count: result.usage?.output_tokens || result.usage?.candidatesTokenCount,
  };
}
export const providerModel = (config: Settings) =>
  config.aiProvider === 'openai'
    ? config.openaiModel || 'gpt-4.1-mini'
    : config.aiProvider === 'gemini'
      ? config.geminiModel || 'gemini-3.8-flash'
      : config.model;
export async function providerGenerate(
  config: Settings,
  key: string,
  system: string,
  prompt: string,
  schema: unknown,
  signal: AbortSignal,
  media: { mimeType: string; data: string }[] = [],
) {
  const model = providerModel(config);
  if (config.aiProvider === 'openai')
    return openaiGenerate(model, key, system, prompt, schema, signal, media);
  if (config.aiProvider === 'gemini')
    return geminiGenerate(model, key, system, prompt, schema, signal, media);
  return ollamaRequest(
    'chat',
    {
      model,
      think: false,
      stream: true,
      format: schema,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: prompt,
          ...(media.length ? { images: media.map((m) => m.data) } : {}),
        },
      ],
      options: { temperature: 0.2, num_ctx: 8192, num_predict: 6000, num_thread: 4 },
    },
    signal,
  );
}
