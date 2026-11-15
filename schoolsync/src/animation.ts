/**
 * Scoped GSAP motion hooks for screen reveals, press feedback, toggle springs, and Orb breathing.
 */
import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

export { gsap };

export const quietMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useReveal(root: RefObject<HTMLElement | null>, identity: unknown) {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (quietMotion()) return;
      const nodes = root.current?.querySelectorAll('[data-reveal]');
      if (nodes?.length) {
        // Animate only the first screenful so long 30+ student lists feel instant on mobile.
        const targets = Array.from(nodes).slice(0, 8);
        gsap.fromTo(
          targets,
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.22,
            stagger: 0.02,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          },
        );
      }
    }, root);
    return () => ctx.revert();
  }, [identity]);
}

export function usePressFeedback(root: RefObject<HTMLElement | null>, identity?: unknown) {
  useEffect(() => {
    const element = root.current;
    // On coarse touch devices, CSS :active provides instant zero-JS press feedback without scroll interference.
    if (!element || window.matchMedia('(pointer: coarse)').matches) return;
    const ctx = gsap.context(() => {}, element);
    let active: HTMLButtonElement | null = null;
    const release = () => {
      if (active) {
        const target = active;
        ctx.add(() =>
          gsap.to(target, {
            scale: 1,
            duration: 0.36,
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
      if (!button || button.matches('.student-pass,.portal-option,.att-toggle')) return;
      active = button;
      ctx.add(() =>
        gsap.to(button, { scale: 0.97, duration: 0.12, ease: 'power2.out', overwrite: 'auto' }),
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

/** Tactile spring micro-bounce when toggling student attendance status. */
export function pulseToggle(el: HTMLElement | null) {
  if (!el || quietMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0.88 },
    { scale: 1, duration: 0.35, ease: 'back.out(2.2)', clearProps: 'transform', overwrite: 'auto' },
  );
}

/** Subtle horizontal spring shake for invalid inputs or error banners. */
export function animateErrorShake(el: HTMLElement | null) {
  if (!el || quietMotion()) return;
  gsap.fromTo(
    el,
    { x: -6 },
    {
      x: 0,
      duration: 0.42,
      ease: 'elastic.out(1.2, 0.4)',
      clearProps: 'transform',
      overwrite: 'auto',
    },
  );
}
