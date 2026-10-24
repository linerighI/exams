import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from './api';
import type { Attempt } from './types';
import './proctorLock.css';
export default function ProctorControl({
  attemptId,
  lock,
  name,
  onChanged,
}: {
  attemptId: string;
  lock?: Attempt['proctorLock'];
  name?: string;
  onChanged?: () => void;
}) {
  const [active, setActive] = useState(!!lock?.active),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    setActive(!!lock?.active);
  }, [lock?.active, lock?.lockedAt]);
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/attempts/' + attemptId + '/proctor-lock', 'PUT', {
        active: !active,
      });
      setActive(!!result.proctorLock?.active);
      if (menu.current) menu.current.open = false;
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const place = () => {
    const node = menu.current;
    if (!node?.open || !node.closest('.table-actions')) return;
    const summary = node.querySelector('summary')!,
      panel = node.querySelector<HTMLElement>('.proctor-control-menu')!,
      rect = summary.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.inset = 'auto';
    panel.style.left = Math.max(8, Math.min(window.innerWidth - 251, rect.right - 235)) + 'px';
    panel.style.top =
      Math.max(8, rect.bottom + 220 > window.innerHeight ? rect.top - 220 : rect.bottom + 6) + 'px';
  };
  return (
    <details
      ref={menu}
      onToggle={place}
      className={'proctor-control ' + (active ? 'is-locked' : '')}
    >
      <summary
        aria-label={'إجراءات Zunis' + (name ? ' للطالب ' + name : '')}
        title={active ? 'Zunis: الطالب محظور مؤقتًا' : 'إجراءات Zunis'}
      >
        <MoreHorizontal size={19} />
        {active && <ShieldAlert size={15} />}
      </summary>
      <div className="proctor-control-menu">
        <p>
          {active
            ? 'تحذير الغش ظاهر للطالب. يمكنك السماح له بالإجابة مجددًا.'
            : 'يظهر للطالب تحذير أحمر ويُمنع من الإجابة حتى تسمح له بالمتابعة.'}{' '}
          الوقت يستمر، والإجابات السابقة لا تُحذف.
        </p>
        <button
          type="button"
          className={active ? 'is-unlock' : ''}
          disabled={busy}
          onClick={() => void apply()}
        >
          {active ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}{' '}
          {busy
            ? 'جارٍ إرسال القرار…'
            : active
              ? 'إزالة الحظر والسماح بالمتابعة'
              : 'إظهار تحذير الغش وحظر الإجابة'}
        </button>
        <small>يصل القرار عند اتصال الطالب بالمدرسة.</small>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
