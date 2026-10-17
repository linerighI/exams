import { useEffect, useState } from 'react';
import { api } from './api';
import type { Settings } from './types';
export const providers = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'openai', label: 'ChatGPT · OpenAI' },
  { id: 'gemini', label: 'Gemini' },
] as const;
export default function ProviderSwitch({
  disabled,
  onChange,
  notify,
}: {
  disabled?: boolean;
  onChange: () => void;
  notify: (s: string) => void;
}) {
  const [config, setConfig] = useState<Settings>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api('/api/settings')
      .then(setConfig)
      .catch(() => {});
  }, []);
  return (
    <label className="ai-provider-switch">
      <span>المساعد</span>
      <select
        aria-label="مزود الذكاء الاصطناعي"
        disabled={!config || disabled || saving}
        value={config?.aiProvider || 'ollama'}
        onChange={async (e) => {
          if (!config) return;
          setSaving(true);
          try {
            const saved = await api('/api/ai/provider', 'PUT', { provider: e.target.value });
            setConfig({ ...config, aiProvider: saved.provider });
            onChange();
          } catch (error) {
            notify((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
