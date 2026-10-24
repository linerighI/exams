import { useEffect, useLayoutEffect, useSyncExternalStore, useRef, type RefObject } from 'react';
import { gsap } from './animato';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);

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
      if (detail.closest('.student-exam-theme')) return;
      const children = Array.from(detail.children).filter((el) => el.tagName !== 'SUMMARY');
      context.add(() => {
        gsap.fromTo(
          children,
          { opacity: 0, y: -5 },
          {
            opacity: 1,
            y: 0,
            duration: 0.28,
            stagger: { amount: 0.25 },
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
        '.teacher-session-shell button, .student-session-shell button, .prism-login button',
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

export function usePanelMotion(ref: RefObject<HTMLDialogElement | null>, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
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
  }, [ref, enabled]);
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

export function useExamMotion(
  ref: RefObject<HTMLElement | null>,
  state: string,
  attemptId: string,
) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const root = ref.current!;
        const timeline = gsap.timeline({
          defaults: { ease: 'power3.out', clearProps: 'opacity,transform' },
        });
        if (state === 'finished') {
          timeline
            .from(root, { opacity: 0, y: 28, scale: 0.96, duration: 0.65 })
            .from(
              root.querySelectorAll('.success-orbit, h1, p, button'),
              { opacity: 0, y: 14, stagger: 0.09, duration: 0.45 },
              '-=0.3',
            )
            .from(
              root.querySelectorAll('.success-orbit svg path'),
              { drawSVG: '0%', duration: 0.65, ease: 'power2.inOut' },
              0.3,
            );
        } else {
          const waiting = !!document.querySelector('.exam-entry[open]');
          timeline.pause();
          const heading = root.querySelectorAll('.student-exam-heading');
          const panels = root.querySelectorAll('.exam-question, .exam-navigation');
          timeline
            .from(heading, { opacity: 0, y: 14, duration: 0.55 }, 0)
            .from(panels, { opacity: 0, y: 28, scale: 0.985, stagger: 0.09, duration: 0.7 }, 0.08)
            .from(
              root.querySelectorAll(
                '.question-heading, .student-question-content, .question-controls',
              ),
              { opacity: 0, y: 16, stagger: 0.08, duration: 0.5 },
              0.26,
            )
            .from(
              root.querySelectorAll(
                '.exam-fixed-status .timer, .exam-indicator-orb, .exam-submit-button',
              ),
              { opacity: 0, y: 12, stagger: 0.06, duration: 0.45 },
              0.3,
            )
            .from(
              Array.from(
                root.querySelectorAll(
                  '.student-options > button, .question-written, .response-blanks > label, .response-rank, .response-match-grid button',
                ),
              ).slice(0, 12),
              { opacity: 0, y: 9, stagger: { amount: 0.18 }, duration: 0.4 },
              0.46,
            )
            .from(
              root.querySelectorAll('.question-map button'),
              {
                opacity: 0,
                scale: 0.7,
                stagger: { amount: 0.25 },
                duration: 0.35,
                ease: 'back.out(1.3)',
              },
              0.4,
            );
          let observer: MutationObserver | undefined;
          const play = () => {
            observer?.disconnect();
            timeline.play();
          };
          if (waiting) {
            document.addEventListener('zunis:reveal-exam', play, { once: true });
            // Also release if the intro is removed by an interrupted start.
            observer = new MutationObserver(() => {
              if (!document.querySelector('.exam-entry[open]')) play();
            });
            observer.observe(document.body, { childList: true });
            return () => {
              observer?.disconnect();
              document.removeEventListener('zunis:reveal-exam', play);
            };
          }
          play();
        }
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, state, attemptId]);
}

export function useStudentWorkspaceMotion(ref: RefObject<HTMLElement | null>, page: string) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      (context) => {
        const select = gsap.utils.selector(root);
        const timeline = gsap.timeline({
          defaults: { ease: 'power3.out', duration: 0.6, clearProps: 'opacity,transform' },
        });
        timeline
          .addLabel('heading')
          .from(select('.student-page-heading h1'), { y: 18, opacity: 0 }, 'heading')
          .from(
            select(
              '.student-page-heading .student-kicker, .student-page-heading p, .student-connection',
            ),
            { y: 8, opacity: 0, stagger: 0.045, duration: 0.4 },
            'heading+=0.12',
          )
          .addLabel('workspace', 0.15);
        const feature = select('.student-next-exam');
        if (feature.length) {
          timeline
            .from(feature, { y: 24, opacity: 0, duration: 0.7 }, 'workspace')
            .from(
              select('.student-next-label i'),
              { scaleX: 0, duration: 0.8, ease: 'power3.inOut' },
              'workspace+=0.06',
            )
            .from(
              select(
                '.student-feature-title, .student-feature-class, .student-feature-facts, .student-next-date, .student-next-footer',
              ),
              { y: 14, opacity: 0, stagger: 0.065, duration: 0.5 },
              'workspace+=0.12',
            );
        }
        const entries = select('.student-exam-card, .student-result-card').slice(0, 12);
        if (entries.length)
          timeline.from(entries, { y: 18, opacity: 0, stagger: 0.055 }, 'workspace+=0.12');
        const summary = select('.student-summary-item');
        if (summary.length)
          timeline.from(summary, { opacity: 0, y: 8, stagger: 0.045, duration: 0.45 }, 'workspace');
        const paper = select('.student-exam-ticket .student-paper-art');
        if (paper.length) {
          timeline.from(paper, { rotation: -9, y: 12, opacity: 0, duration: 0.7 }, 'workspace');
          timeline.from(
            select('.student-exam-ticket .student-paper-lines path'),
            {
              drawSVG: '0%',
              duration: 0.65,
              stagger: 0.065,
              ease: 'power2.inOut',
            },
            'workspace+=0.25',
          );
        }
        // Use the app's actual scrolling element, including when embedded in WebView2.
        let scroller: HTMLElement | Window = window;
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
          if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
            scroller = parent;
            break;
          }
        }
        const reveals = select('.student-other-exams, .student-agenda > section');
        reveals.forEach((element, index) => {
          gsap.from(element, {
            y: 20,
            opacity: 0,
            duration: 0.6,
            delay: Math.min(index * 0.04, 0.12),
            ease: 'power3.out',
            clearProps: 'opacity,transform',
            scrollTrigger: { trigger: element, scroller, start: 'top 96%', once: true },
          });
        });
        let frame = 0;
        let disposed = false;
        const refresh = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            if (!disposed) ScrollTrigger.refresh();
          });
        };
        const resize = new ResizeObserver(refresh);
        resize.observe(root);
        void document.fonts.ready.then(() => {
          if (!disposed) refresh();
        });
        const hover = (event: PointerEvent) => {
          if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
          const button = event.target.closest<HTMLButtonElement>(
            '.student-launch, .student-space .text-button, .student-exam-card button',
          );
          if (!button || button.disabled || button.contains(event.relatedTarget as Node)) return;
          const arrow = button.querySelector('svg:last-child');
          if (arrow)
            context.add(() => {
              gsap.fromTo(
                arrow,
                { x: 4 },
                {
                  x: -3,
                  duration: 0.4,
                  ease: 'power3.out',
                  overwrite: true,
                  clearProps: 'transform',
                },
              );
            });
        };
        const liftPaper = (event: Event) => {
          if (event instanceof PointerEvent && event.pointerType !== 'mouse') return;
          if (!(event.target instanceof Element)) return;
          const card = event.target.closest('.student-next-exam, .student-exam-card');
          if (!card) return;
          if (
            event instanceof MouseEvent &&
            event.relatedTarget instanceof Node &&
            card.contains(event.relatedTarget)
          )
            return;
          if (
            event instanceof FocusEvent &&
            event.relatedTarget instanceof Node &&
            card.contains(event.relatedTarget)
          )
            return;
          const paper = card.querySelector('.student-cover-paper');
          if (!paper) return;
          const entering = event.type === 'pointerover' || event.type === 'focusin';
          context.add(() =>
            gsap.to(paper, {
              rotation: entering ? -1 : -5,
              y: entering ? -5 : 0,
              duration: 0.5,
              ease: 'power3.out',
              overwrite: 'auto',
            }),
          );
        };
        const paperEvents = ['pointerover', 'pointerout', 'focusin', 'focusout'];
        paperEvents.forEach((type) => root.addEventListener(type, liftPaper));
        root.addEventListener('pointerover', hover);
        return () => {
          disposed = true;
          resize.disconnect();
          cancelAnimationFrame(frame);
          root.removeEventListener('pointerover', hover);
          paperEvents.forEach((type) => root.removeEventListener(type, liftPaper));
        };
      },
      root,
    );
    return () => media.revert();
  }, [ref, page]);
}

export function useQuestionMotion(ref: RefObject<HTMLElement | null>, index: number) {
  const previous = useRef(index);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = index;
    if (old === index || !ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const content = ref.current!.querySelector('.student-question-content');
        if (content) {
          gsap.from(content, {
            x: index > old ? -18 : 18,
            opacity: 0,
            duration: 0.32,
            ease: 'power3.out',
            clearProps: 'opacity,transform',
          });
          const labels = content.querySelectorAll('.student-options .option-letter');
          if (labels.length)
            gsap.from(labels, {
              y: 5,
              opacity: 0,
              stagger: 0.035,
              duration: 0.3,
              delay: 0.08,
              clearProps: 'opacity,transform',
            });
        }
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, index]);
}
