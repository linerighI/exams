import { useEffect, useState } from 'react';
import { api } from './api';
import MathText from './MathText';
export default function AssistantProposal({
  card,
  onApplied,
}: {
  card: any;
  onApplied?: (message: string) => void;
}) {
  const [status, setStatus] = useState(card.status || 'pending'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api(`/api/assistant/proposals/${card.id}`)
      .then((p) => {
        if (live) setStatus(p.status);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [card.id]);
  return (
    <div className="assistant-proposal">
      {!!card.examples?.length && (
        <details>
          <summary>معاينة من الأسئلة المحددة</summary>
          <ul>
            {card.examples.map((text: string, index: number) => (
              <li key={index}>
                <MathText text={text} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <button
        className="result-open"
        disabled={busy || status === 'applied'}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = await api(`/api/assistant/proposals/${card.id}/apply`, 'POST', {});
            setStatus(result.status);
            onApplied?.('تم تطبيق الاقتراح على بيانات المدرسة');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {status === 'applied' ? 'تم التطبيق' : busy ? 'جارٍ التطبيق…' : 'تطبيق الاقتراح'}
      </button>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
