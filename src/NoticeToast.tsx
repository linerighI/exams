import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { gsap } from 'gsap';
import MorphMark from './MorphMark';
import { useQuietMotion } from './appMotion';
import './appMotion.css';
export default function NoticeToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const quiet = useQuietMotion();
  const shape = /تعذر|فشل|خطأ|غير صالح|راجع|أدخل|يجب/.test(message)
    ? 'alert'
    : /حُفظ|حفظت|أضيف|نُشر|نجاح|حُدّث|جاهز|تم /.test(message)
      ? 'check'
      : 'info';
  useLayoutEffect(() => {
    if (quiet) return;
    const context = gsap.context(() => {
      gsap.from(root.current, {
        y: 12,
        opacity: 0,
        duration: 0.38,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      gsap.to(root.current, { y: 5, opacity: 0, duration: 0.2, delay: 6.2, ease: 'power2.in' });
    }, root);
    return () => context.revert();
  }, [message, quiet]);
  return (
    <div className="toast motion-notice" ref={root} role="status">
      <span className="notice-mark">
        <MorphMark shape={shape} />
      </span>
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="إغلاق">
        <X size={16} />
      </button>
    </div>
  );
}
