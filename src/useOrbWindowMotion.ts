import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { gsap } from './animato';
// Animate the actual window, so native dialogs, controls and camera state stay intact.
export default function useOrbWindowMotion<T extends HTMLElement>(
  visible: boolean,
  target: RefObject<HTMLElement | null>,
  sourceRef?: RefObject<T | null>,
) {
  const own = useRef<T>(null),
    ref = sourceRef || own,
    context = useRef<gsap.Context | null>(null),
    running = useRef<gsap.core.Timeline | null>(null),
    busy = useRef(false);
  const [minimizing, setMinimizing] = useState(false);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const source = ref.current,
      dock = target.current;
    if (!visible || !source || !dock) return;
    busy.current = false;
    setMinimizing(false);
    const a = source.getBoundingClientRect(),
      b = dock.getBoundingClientRect();
    const x = b.left + b.width / 2 - a.left - a.width / 2,
      y = b.top + b.height / 2 - a.top - a.height / 2;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          running.current = null;
        },
      });
      if (reduced)
        tl.fromTo(source, { opacity: 0 }, { opacity: 1, duration: 0.12, clearProps: 'opacity' });
      else
        tl.fromTo(
          source,
          {
            opacity: 0,
            x,
            y,
            scaleX: 0.08,
            scaleY: 0.025,
            transformOrigin: '50% 50%',
            clipPath: 'polygon(35% 0%,65% 0%,100% 100%,0% 100%)',
          },
          {
            opacity: 1,
            x: x * 0.12,
            y: y * 0.16,
            scaleX: 0.82,
            scaleY: 0.88,
            duration: 0.38,
            clipPath: 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)',
          },
        ).to(source, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.25,
          ease: 'power2.out',
          clearProps: 'transform,transformOrigin,clipPath,opacity',
        });
      running.current = tl;
    }, source);
    ctx.add('minimize', (done: () => void) => {
      if (busy.current) return;
      busy.current = true;
      setMinimizing(true);
      running.current?.kill();
      source.setAttribute('inert', '');
      const a = source.getBoundingClientRect(),
        b = dock.getBoundingClientRect();
      const x = b.left + b.width / 2 - a.left - a.width / 2,
        y = b.top + b.height / 2 - a.top - a.height / 2;
      const tl = gsap.timeline({
        onComplete: () => {
          source.removeAttribute('inert');
          busy.current = false;
          setMinimizing(false);
          done();
        },
      });
      if (reduced) tl.to(source, { opacity: 0, duration: 0.1 });
      else
        tl.to(source, {
          x: x * 0.16,
          y: y * 0.2,
          scaleX: 0.88,
          scaleY: 0.92,
          clipPath: 'polygon(0% 0%,100% 0%,80% 100%,20% 100%)',
          duration: 0.18,
          ease: 'power2.in',
        }).to(source, {
          x,
          y,
          scaleX: 0.06,
          scaleY: 0.02,
          opacity: 0,
          duration: 0.38,
          ease: 'power3.in',
          clipPath: 'polygon(40% 0%,60% 0%,100% 100%,0% 100%)',
        });
      running.current = tl;
    });
    context.current = ctx;
    return () => {
      context.current = null;
      running.current?.kill();
      running.current = null;
      ctx.revert();
      source.removeAttribute('inert');
      busy.current = false;
    };
  }, [visible, reduced, target, ref]);
  const minimize = (done: () => void) => {
    if (busy.current) return;
    if (context.current) context.current.minimize(done);
    else done();
  };
  return { ref, minimize, minimizing };
}
