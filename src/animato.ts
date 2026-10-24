import { useEffect } from 'react';
import type { RefObject } from 'react';
import { gsap } from 'gsap';
// Shared engine for existing application motion and the service transitions.
export { gsap };
export function useAnimato(root: RefObject<HTMLElement | null>, key?: string) {
  useEffect(() => {
    if (!root.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        gsap.fromTo(
          root.current!.querySelectorAll('[data-animato]'),
          { y: 12, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.42,
            stagger: 0.055,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          },
        );
      },
      root.current,
    );
    return () => media.revert();
  }, [key]);
}
