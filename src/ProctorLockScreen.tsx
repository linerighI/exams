import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, Clock3, WifiOff } from 'lucide-react';
import { BrandTrace, ZunisAtmosphere, useBrandMotion } from './BrandMotion';
import './comfort.css';
import './proctorLock.css';
export default function ProctorLockScreen({
  remaining,
  online,
}: {
  remaining: number;
  online: boolean;
}) {
  const root = useRef<HTMLDialogElement>(null);
  useBrandMotion(root);
  useLayoutEffect(() => {
    const d = root.current!,
      origin = document.activeElement as HTMLElement;
    d.showModal();
    d.focus();
    return () => {
      d.close();
      origin?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={root}
      tabIndex={-1}
      className="exam-integrity-intro is-proctor-lock"
      aria-labelledby="proctor-lock-title"
      aria-describedby="proctor-lock-description"
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => e.preventDefault()}
    >
      <ZunisAtmosphere />
      <div className="integrity-emblem">
        <BrandTrace />
        <ShieldAlert size={52} />
      </div>
      <span className="integrity-brand" aria-label="Zunis" dir="ltr">
        {[...'Zunis'].map((letter, i) => (
          <span className="zunis-letter" aria-hidden="true" key={i}>
            {letter}
          </span>
        ))}
      </span>
      <h1 id="proctor-lock-title">تم رصد حالة غش أثناء الامتحان</h1>
      <p id="proctor-lock-description">
        أوقف المراقب الإجابة مؤقتًا. انتظر توجيهاته للسماح لك بالمتابعة.
      </p>
      <small>إجاباتك السابقة لا تُحذف. لا يمكنك إغلاق هذا التنبيه بنفسك.</small>
      <div className="proctor-lock-clock">
        <Clock3 size={18} />
        <span>الوقت مستمر</span>
        <strong dir="ltr">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </strong>
      </div>
      {!online && (
        <p className="proctor-lock-offline">
          <WifiOff size={16} />
          الاتصال منقطع. يبقى الحظر حتى يصل قرار المراقب.
        </p>
      )}
    </dialog>,
    document.body,
  );
}
