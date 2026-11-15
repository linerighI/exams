/**
 * Reusable GSAP motion hooks for SchoolSync UI components and pages.
 * All animations check quietMotion() and clean up cleanly via gsap.context()
 * and clearProps so CSS hover states and responsive widths stay intact.
 */
import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { gsap, quietMotion } from '../animation';

/**
 * Smoothly counts a numeric element up from 0 (or previous value) to `target`.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  target: number,
  suffix = '',
  duration = 0.55,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (quietMotion() || !Number.isFinite(target)) {
      el.textContent = `${Math.round(target || 0)}${suffix}`;
      return;
    }
    const state = { val: 0 };
    const ctx = gsap.context(() => {
      gsap.to(state, {
        val: target,
        duration,
        ease: 'power3.out',
        onUpdate: () => {
          el.textContent = `${Math.round(state.val)}${suffix}`;
        },
      });
    }, el);
    return () => ctx.revert();
  }, [ref, target, suffix, duration]);
}

/**
 * Animates a GSAP pill indicator behind whichever child matches `activeSelector`.
 * Works across RTL/LTR layouts cleanly and tracks container resizes via ResizeObserver.
 */
export function useSlidingPill(
  containerRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: readonly unknown[] = [],
  indicatorClass = 't-pill-indicator',
): void {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pill = container.querySelector<HTMLElement>(`:scope > .${indicatorClass}`);
    if (!pill) {
      pill = document.createElement('span');
      pill.className = indicatorClass;
      pill.setAttribute('aria-hidden', 'true');
      container.prepend(pill);
    }
    container.classList.add('is-pill-ready');

    const place = (animate: boolean) => {
      const target = container.querySelector<HTMLElement>(activeSelector);
      if (!target || !pill) {
        if (pill) gsap.set(pill, { opacity: 0 });
        return;
      }
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const x = tRect.left - cRect.left + container.scrollLeft;
      const y = tRect.top - cRect.top + container.scrollTop;
      const props = {
        x,
        y,
        width: tRect.width,
        height: tRect.height,
        opacity: 1,
      };
      if (!animate || quietMotion()) {
        gsap.set(pill, props);
      } else {
        gsap.to(pill, {
          ...props,
          duration: 0.34,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }
    };

    place(false);
    const raf = requestAnimationFrame(() => place(true));
    const ro = new ResizeObserver(() => place(false));
    ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, activeSelector, indicatorClass, ...deps]);
}

/**
 * Choreographs a snappy vertical wave entrance for grids, card stacks, and tables.
 * Uses only y/scale/opacity (no horizontal offset) so mobile scrollWidth never overflows.
 */
export function useStaggerGrid(
  containerRef: RefObject<HTMLElement | null>,
  itemSelector: string,
  deps: readonly unknown[] = [],
): void {
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || quietMotion()) return;
    const ctx = gsap.context(() => {
      // Animate visible first screenful only so 300+ student lists stay GPU-smooth.
      const items = gsap.utils.toArray<HTMLElement>(itemSelector, root).slice(0, 14);
      if (!items.length) return;
      gsap.from(items, {
        y: 12,
        scale: 0.982,
        opacity: 0,
        duration: 0.32,
        stagger: { each: 0.032, from: 'start' },
        ease: 'power3.out',
        force3D: true,
        clearProps: 'transform,opacity',
        overwrite: 'auto',
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, itemSelector, ...deps]);
}

/**
 * Plays a quick tactile spring pulse when an action succeeds (attendance, grade, save).
 */
export function animateSuccessFlash(el: HTMLElement | null): void {
  if (!el || quietMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0.965 },
    { scale: 1, duration: 0.32, ease: 'back.out(2.2)', clearProps: 'transform' },
  );
}
