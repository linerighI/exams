import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { runGenieEffect, type GenieEffectControls } from '@adi1816/genie-effect';
import { useReducedMotion } from 'motion/react';
import '@adi1816/genie-effect/styles.css';

// Keep the real window mounted until the visual reaches the orb. Tools retain their state.
export default function useOrbWindowMotion<T extends HTMLElement>(
  visible: boolean,
  target: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  const running = useRef<GenieEffectControls | Animation | null>(null);
  const [minimizing, setMinimizing] = useState(false);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const source = ref.current;
    if (!visible || !source) return;
    source.style.opacity = '';
    source.style.pointerEvents = '';
    const box = source.getBoundingClientRect();
    const dock = target.current?.getBoundingClientRect();
    if (!dock) return;
    const x = dock.left + dock.width / 2 - box.left - box.width / 2;
    const y = dock.top + dock.height / 2 - box.top - box.height / 2;
    const animation = source.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            {
              opacity: 0,
              transform: `translate(${x}px, ${y}px) scale(.09, .04)`,
              borderRadius: '50%',
              offset: 0,
            },
            {
              opacity: 0.9,
              transform: `translate(${x * 0.18}px, ${y * 0.22}px) scale(.76, .88)`,
              borderRadius: '36px',
              offset: 0.55,
            },
            { opacity: 1, transform: 'translate(0, 0) scale(1.015, 1.015)', offset: 0.84 },
            { opacity: 1, transform: 'translate(0, 0) scale(1)' },
          ],
      { duration: reduced ? 100 : 560, easing: 'cubic-bezier(.22,.72,.18,1)' },
    );
    running.current = animation;
    return () => {
      running.current?.cancel();
      running.current = null;
    };
  }, [visible, reduced, target]);

  const minimize = (done: () => void) => {
    if (minimizing) return;
    running.current?.cancel();
    const source = ref.current;
    const dock = target.current;
    if (
      !source ||
      !dock ||
      reduced ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      done();
      return;
    }
    setMinimizing(true);
    source.setAttribute('inert', '');
    running.current = runGenieEffect(source, dock, {
      duration: 620,
      layerParent: source.closest<HTMLElement>('.teacher-orb-overlay') || document.body,
      className: 'orb-genie-layer',
      restoreSourceOnComplete: false,
      onComplete: () => {
        source.removeAttribute('inert');
        setMinimizing(false);
        done();
      },
      onCancel: () => {
        source.removeAttribute('inert');
        setMinimizing(false);
      },
    });
  };
  return { ref, minimize, minimizing };
}
