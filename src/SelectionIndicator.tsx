import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { prefersQuietMotion } from './appMotion';
import './appMotion.css';
gsap.registerPlugin(Flip);
export default function SelectionIndicator({
  root,
  selector,
  value,
}: {
  root: RefObject<HTMLElement | null>;
  selector: string;
  value: unknown;
}) {
  const marker = useRef<HTMLSpanElement>(null),
    update = useRef<() => void>(() => {});
  useEffect(() => {
    const parent = root.current,
      element = marker.current;
    if (!parent || !element) return;
    const context = gsap.context(() => {}, parent);
    let placed = false;
    let last = '';
    const place = () =>
      context.add(() => {
        const selected = parent.querySelector<HTMLElement>(selector);
        if (!selected || !selected.getClientRects().length) {
          gsap.set(element, { opacity: 0 });
          last = '';
          placed = false;
          return;
        }
        const target = selected.getBoundingClientRect(),
          container = parent.getBoundingClientRect();
        const key = [
          target.left - container.left + parent.scrollLeft,
          target.top - container.top + parent.scrollTop,
          target.width,
          target.height,
        ]
          .map((n) => n.toFixed(1))
          .join(':');
        if (key === last) return;
        last = key;
        const before = placed ? Flip.getState(element) : undefined;
        gsap.set(element, {
          clearProps: 'transform',
          left: target.left - container.left + parent.scrollLeft,
          top: target.top - container.top + parent.scrollTop,
          width: target.width,
          height: target.height,
          opacity: 1,
        });
        if (before && !prefersQuietMotion())
          Flip.from(before, { duration: 0.44, ease: 'power3.inOut', scale: true, prune: true });
        placed = true;
      });
    update.current = place;
    place();
    const observer = new ResizeObserver(() => place());
    observer.observe(parent);
    parent.querySelectorAll('button').forEach((button) => observer.observe(button));
    parent.addEventListener('scroll', place, { passive: true });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      Flip.killFlipsOf(element, true);
      last = '';
      place();
    };
    media.addEventListener('change', changed);
    return () => {
      observer.disconnect();
      parent.removeEventListener('scroll', place);
      media.removeEventListener('change', changed);
      update.current = () => {};
      context.revert();
    };
  }, [root, selector]);
  useLayoutEffect(() => {
    update.current();
  }, [value]);
  return <span ref={marker} className="selection-indicator" aria-hidden="true" />;
}
