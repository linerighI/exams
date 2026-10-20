import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import './appMotion.css';
export function ZunisAtmosphere() {
  return (
    <div className="zunis-atmosphere" aria-hidden="true">
      <div className="zunis-cinema-grid" />
      <div className="zunis-lightline" />
      <div className="zunis-sweep" />
      <span className="zunis-corner top-right" />
      <span className="zunis-corner bottom-left" />
    </div>
  );
}
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
        const line = el.querySelector('.zunis-lightline');
        const sweep = el.querySelector('.zunis-sweep');
        const grid = el.querySelector('.zunis-cinema-grid');
        const corners = el.querySelectorAll('.zunis-corner');
        if (line)
          timeline.from(line, { scaleX: 0, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0);
        if (grid)
          timeline.from(grid, { opacity: 0, scale: 1.06, duration: 1.1, ease: 'power2.out' }, 0);
        if (sweep)
          timeline
            .fromTo(
              sweep,
              { yPercent: -100, opacity: 0 },
              {
                yPercent: 110,
                opacity: 0.55,
                duration: 1.7,
                ease: 'power1.inOut',
              },
              0.05,
            )
            .to(sweep, { opacity: 0, duration: 0.25 }, 1.55);
        if (corners.length)
          timeline.from(corners, { scale: 0.85, opacity: 0, duration: 0.7, stagger: 0.08 }, 0.1);
        const letters = el.querySelectorAll('.zunis-letter');
        if (letters.length)
          timeline.from(
            letters,
            {
              yPercent: 70,
              rotationX: -55,
              opacity: 0,
              duration: 0.65,
              stagger: 0.045,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            },
            0.3,
          );
        const progress = el.querySelector('.integrity-progress > span');
        if (progress)
          timeline.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: 2.7, ease: 'none' }, 0);
        if (el.classList.contains('exam-integrity-intro'))
          timeline.to(el, { opacity: 0, duration: 0.25 }, 2.7);
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, scene]);
}
