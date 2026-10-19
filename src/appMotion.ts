import { useEffect, useLayoutEffect, useSyncExternalStore, type RefObject } from 'react';
import { gsap } from 'gsap';

let preference: MediaQueryList | undefined;
const preferenceListeners = new Set<() => void>();
const motionPreference = () =>
  (preference ||= window.matchMedia('(prefers-reduced-motion: reduce)'));
export const prefersQuietMotion = () => motionPreference().matches;
const preferenceChanged = () => preferenceListeners.forEach((listener) => listener());
const subscribePreference = (listener: () => void) => {
  const query = motionPreference();
  if (!preferenceListeners.size) query.addEventListener('change', preferenceChanged);
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
    if (!preferenceListeners.size) query.removeEventListener('change', preferenceChanged);
  };
};
export const useQuietMotion = () =>
  useSyncExternalStore(subscribePreference, prefersQuietMotion, () => true);

export function useAppInteractions() {
  useEffect(() => {
    const context = gsap.context(() => {});
    const toggle = (event: Event) => {
      const detail = event.target;
      if (!(detail instanceof HTMLDetailsElement) || !detail.open || prefersQuietMotion()) return;
      if (detail.closest('.student-session-shell,.student-exam-theme')) return;
      const children = Array.from(detail.children).filter((el) => el.tagName !== 'SUMMARY');
      context.add(() => {
        gsap.fromTo(
          children,
          { opacity: 0, y: -5 },
          {
            opacity: 1,
            y: 0,
            duration: 0.28,
            stagger: 0.025,
            ease: 'power2.out',
            clearProps: 'opacity,transform',
            overwrite: true,
          },
        );
      });
    };
    const press = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || prefersQuietMotion()) return;
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(
        '.teacher-session-shell button, .prism-login button',
      );
      if (!button || button.disabled || button.closest('.student-exam-theme')) return;
      const icon = button.querySelector(':scope > svg:not(.morph-mark)');
      if (icon)
        context.add(() => {
          gsap.fromTo(
            icon,
            { scale: 0.87 },
            {
              scale: 1,
              duration: 0.28,
              ease: 'back.out(1.8)',
              clearProps: 'transform',
              overwrite: true,
            },
          );
        });
    };
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('pointerup', press);
    return () => {
      document.removeEventListener('toggle', toggle, true);
      document.removeEventListener('pointerup', press);
      context.revert();
    };
  }, []);
}

export function usePanelMotion(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        gsap.from(ref.current, {
          opacity: 0,
          scale: 0.975,
          duration: 0.34,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        });
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref]);
}

// Scope each scene and revert it on unmount, including React Strict Mode remounts.
export function useSceneMotion(
  ref: RefObject<HTMLElement | null>,
  selector: string,
  scene: unknown = '',
) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const elements = Array.from(ref.current!.querySelectorAll<HTMLElement>(selector)).filter(
          (el) => el.getClientRects().length,
        );
        if (elements.length)
          gsap.from(elements, {
            opacity: 0,
            y: 16,
            duration: 0.58,
            stagger: 0.065,
            ease: 'power3.out',
            clearProps: 'opacity,transform',
          });
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, selector, scene]);
}

export function guideToField(target: HTMLElement) {
  target.closest('details')?.setAttribute('open', '');
  target.scrollIntoView({ block: 'center', behavior: prefersQuietMotion() ? 'instant' : 'smooth' });
  const input = target.matches('input,textarea,select,button,[contenteditable="true"]')
    ? target
    : target.querySelector<HTMLElement>(
        'input:not([type="hidden"]),textarea,select,button,[contenteditable="true"]',
      );
  (input || target).focus({ preventScroll: true });
  target.classList.add('guided-field');
  target.addEventListener('input', () => target.classList.remove('guided-field'), { once: true });
  if (!prefersQuietMotion())
    gsap.fromTo(
      target,
      { outlineOffset: '10px', outlineColor: 'rgba(40,99,176,0)' },
      {
        outlineOffset: '4px',
        outlineColor: 'rgba(40,99,176,.75)',
        duration: 0.65,
        repeat: 1,
        yoyo: true,
        onComplete: () => {
          gsap.set(target, { clearProps: 'outlineOffset,outlineColor' });
        },
      },
    );
}
