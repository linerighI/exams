/**
 * Dedicated GSAP 3 choreography utilities for SchoolSync & SARE 3D Studio:
 * GPU-composited entrances, staggered lists, RTL/LTR sliding segmented indicators,
 * vertical rail indicator tracking, and crisp tactile spring micro-interactions.
 */
import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import gsap from 'gsap';

/** Animate a container in on mount or dependency change using gsap.context() cleanup. */
export function useGsapEntrance(
  ref: RefObject<HTMLElement | null>,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars,
  deps: DependencyList = [],
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, fromVars, { clearProps: 'transform', ...toVars });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Stagger child elements smoothly whenever key dependencies update. */
export function useGsapStagger(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  deps: DependencyList = [],
  vars?: { y?: number; x?: number; scale?: number; duration?: number; stagger?: number; ease?: string },
) {
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const targets = root.querySelectorAll(selector);
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: vars?.y ?? 10, x: vars?.x ?? 0, scale: vars?.scale ?? 0.94 },
        {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          duration: vars?.duration ?? 0.3,
          stagger: vars?.stagger ?? 0.024,
          ease: vars?.ease ?? 'power3.out',
          clearProps: 'transform',
        },
      );
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Glide a physical left-anchored segmented pill under the active button.
 * Uses getBoundingClientRect() so RTL (Arabic) and LTR compute identical pixel positions.
 */
export function useSlidingPill(
  trackRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: DependencyList = [],
) {
  const initialized = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) return;
    const active = track.querySelector<HTMLElement>(activeSelector);
    if (!active) return;

    const place = (animate: boolean) => {
      const tr = track.getBoundingClientRect();
      const ac = active.getBoundingClientRect();
      if (ac.width <= 0) return;
      const target = { x: ac.left - tr.left, width: ac.width, opacity: 1 };
      if (!animate) gsap.set(pill, target);
      else gsap.to(pill, { ...target, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
    };

    place(initialized.current);
    initialized.current = true;
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => { initialized.current = false; }, []);
}

/** Glide a vertical Apple Blue indicator pill along the SARE icon tool rail. */
export function useVerticalSlideIndicator(
  railRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: DependencyList = [],
) {
  const initialized = useRef(false);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const pill = pillRef.current;
    if (!rail || !pill) return;
    const active = rail.querySelector<HTMLElement>(activeSelector);
    if (!active) return;
    const rr = rail.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    if (ar.height <= 0) return;
    const target = { y: ar.top - rr.top, height: ar.height, opacity: 1 };
    if (!initialized.current) gsap.set(pill, target);
    else gsap.to(pill, { ...target, duration: 0.26, ease: 'power3.out', overwrite: 'auto' });
    initialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Quick Apple-like elastic pop feedback on click (steppers, color wells, floor pills). */
export function gsapPop(el: HTMLElement | null) {
  if (!el) return;
  gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.28, ease: 'back.out(2.2)', clearProps: 'transform' });
}

/** 90-degree spring spin animation (e.g. prop rotation icon). */
export function gsapSpin(el: HTMLElement | null) {
  if (!el) return;
  gsap.to(el, { rotation: '+=90', duration: 0.34, ease: 'back.out(1.7)', overwrite: 'auto' });
}
