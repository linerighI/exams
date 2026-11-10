import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
export { gsap };
export const quietMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function useReveal(root: RefObject<HTMLElement | null>, identity: unknown) {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (quietMotion()) return;
      const nodes = root.current?.querySelectorAll('[data-reveal]');
      if (nodes?.length)
        gsap.fromTo(
          nodes,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.05,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
        );
    }, root);
    return () => ctx.revert();
  }, [identity]);
}
export function usePressFeedback(root: RefObject<HTMLElement | null>, identity?: unknown) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const ctx = gsap.context(() => {}, element);
    let active: HTMLButtonElement | null = null;
    const release = () => {
      if (active) {
        const target = active;
        ctx.add(() =>
          gsap.to(target, {
            scale: 1,
            duration: 0.38,
            ease: 'back.out(1.6)',
            overwrite: 'auto',
            clearProps: 'transform',
          }),
        );
        active = null;
      }
    };
    const down = (e: PointerEvent) => {
      if (quietMotion()) return;
      const button = (e.target as Element).closest<HTMLButtonElement>('button:not(:disabled)');
      if (!button || button.matches('.student-pass,.portal-option')) return;
      active = button;
      ctx.add(() =>
        gsap.to(button, { scale: 0.97, duration: 0.13, ease: 'power2.out', overwrite: 'auto' }),
      );
    };
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      ctx.revert();
    };
  }, [root, identity]);
}
