import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from './animato';
import MorphMark from './MorphMark';
import { useQuietMotion } from './appMotion';
import './appMotion.css';
export default function SaveReceipt({
  revision,
  children,
}: {
  revision: number;
  children: string;
}) {
  const [visible, setVisible] = useState(false),
    ref = useRef<HTMLDivElement>(null);
  const quiet = useQuietMotion();
  useEffect(() => {
    if (!revision) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(timer);
  }, [revision]);
  useLayoutEffect(() => {
    if (!visible || !ref.current || quiet) return;
    const context = gsap.context(() => {
      gsap.from(ref.current, {
        opacity: 0,
        y: 7,
        duration: 0.35,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
      });
      gsap.to(ref.current, { opacity: 0, y: -3, duration: 0.2, delay: 2.95, ease: 'power2.in' });
    });
    return () => context.revert();
  }, [visible, revision, quiet]);
  return visible ? (
    <div ref={ref} className="save-receipt" role="status">
      <MorphMark shape="check" size={18} />
      <span>{children}</span>
    </div>
  ) : null;
}
