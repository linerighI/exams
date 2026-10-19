import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import './appMotion.css';
export function BrandTrace() {
  return (
    <svg className="integrity-trace" viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r="63" transform="rotate(-90 70 70)" />
      <circle cx="70" cy="70" r="69" strokeDasharray="2 10" />
    </svg>
  );
}
export function useBrandMotion(ref: RefObject<HTMLElement | null>, scene: unknown = '') {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const el = ref.current!;
        const timeline = gsap.timeline();
        const ring = el.querySelector<SVGCircleElement>('.integrity-trace circle');
        if (ring) {
          const length = ring.getTotalLength();
          timeline.fromTo(
            ring,
            { strokeDasharray: length, strokeDashoffset: length },
            { strokeDashoffset: 0, duration: 1.25, ease: 'power2.inOut' },
            0,
          );
        }
        const mark = el.querySelector(
          '.integrity-emblem > svg:not(.integrity-trace), .zunis-emblem > svg:not(.integrity-trace)',
        );
        if (mark)
          timeline.from(
            mark,
            {
              scale: 0.82,
              opacity: 0,
              duration: 0.6,
              ease: 'back.out(1.4)',
              clearProps: 'opacity,transform',
            },
            0.15,
          );
        const words = el.querySelectorAll('.integrity-brand,h1,p,small,.gsap-exam-readiness');
        if (words.length)
          timeline.from(
            words,
            {
              y: 13,
              opacity: 0,
              duration: 0.55,
              stagger: 0.11,
              ease: 'power3.out',
              clearProps: 'opacity,transform',
            },
            0.25,
          );
        if (el.classList.contains('exam-integrity-intro'))
          timeline.to(el, { opacity: 0, duration: 0.25 }, 2.7);
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, scene]);
}
