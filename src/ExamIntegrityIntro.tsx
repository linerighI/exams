import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import './comfort.css';
export default function ExamIntegrityIntro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.focus();
    const timer = setTimeout(onDone, 3000);
    return () => {
      clearTimeout(timer);
      previous?.focus();
    };
  }, [onDone]);
  return createPortal(
    <motion.div
      ref={root}
      tabIndex={-1}
      onKeyDown={(e) => e.preventDefault()}
      className="exam-integrity-intro"
      role="dialog"
      aria-modal="true"
      aria-label="Zunis · تذكير بالنزاهة"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
    >
      <div className="integrity-emblem">
        <ShieldCheck size={52} />
      </div>
      <span className="integrity-brand">Zunis</span>
      <h1>ابدأ بثقة. أجب بأمانة.</h1>
      <p>الغش قد يؤدي إلى إلغاء المحاولة وتطبيق إجراءات المدرسة.</p>
      <small>التزم بتعليمات المعلم واستخدم الأدوات المسموحة فقط.</small>
      <div className="integrity-progress">
        <motion.span
          initial={{ scaleX: reduced ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduced ? 0 : 3, ease: 'linear' }}
        />
      </div>
      <span>سيفتح الامتحان تلقائيًا خلال لحظات</span>
    </motion.div>,
    document.body,
  );
}
