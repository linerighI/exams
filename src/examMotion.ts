import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';

type Feedback = {
  questionId: string;
  answerKey: string;
  answered: number;
  tone: 'blue' | 'green' | 'red';
  reviewed: boolean;
  saveState: string;
  urgent: boolean;
};

// These are short, state-driven cues. The timer tick and typing do not start timelines.
export function useExamFeedback(ref: RefObject<HTMLElement | null>, state: Feedback) {
  const previous = useRef(state);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = state;
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const select = gsap.utils.selector(ref.current!);
        if (old.questionId === state.questionId && old.answerKey !== state.answerKey) {
          const chosen = select('.student-options > button.selected .option-letter');
          if (chosen.length)
            gsap.fromTo(
              chosen,
              { scale: 0.82 },
              {
                scale: 1,
                duration: 0.4,
                ease: 'back.out(1.6)',
                clearProps: 'transform',
              },
            );
        }
        if (old.answered !== state.answered) {
          const fill = select('.progress-track > div');
          if (fill.length && state.answered)
            gsap.fromTo(
              fill,
              {
                scaleX: old.answered / state.answered,
                transformOrigin: 'right center',
              },
              {
                scaleX: 1,
                duration: 0.55,
                ease: 'power3.out',
                clearProps: 'transform,transformOrigin',
              },
            );
          gsap.fromTo(
            select('.question-map button.current'),
            { scale: 0.88 },
            {
              scale: 1,
              duration: 0.4,
              ease: 'back.out(1.5)',
              clearProps: 'transform',
            },
          );
        }
        if (old.tone !== state.tone) {
          gsap.fromTo(
            select('.exam-status-wave'),
            { scale: 0.72, opacity: 0.5 },
            {
              scale: 1.3,
              opacity: 0,
              duration: 0.85,
              ease: 'power2.out',
              clearProps: 'transform',
            },
          );
          gsap.fromTo(
            select('.exam-indicator-orb'),
            { scale: 0.9 },
            {
              scale: 1,
              duration: 0.65,
              ease: 'back.out(1.4)',
              clearProps: 'transform',
            },
          );
          gsap.fromTo(
            select('.exam-status-indicator > strong'),
            { y: 4, opacity: 0.4 },
            {
              y: 0,
              opacity: 1,
              duration: 0.4,
              clearProps: 'transform,opacity',
            },
          );
        }
        if (old.questionId === state.questionId && old.reviewed !== state.reviewed) {
          gsap.fromTo(
            select('.student-review-toggle svg'),
            { rotation: -20, scale: 0.8 },
            {
              rotation: 0,
              scale: 1,
              duration: 0.45,
              ease: 'back.out(1.6)',
              clearProps: 'transform',
            },
          );
        }
        if (old.saveState !== state.saveState && state.saveState === 'synced') {
          gsap.fromTo(
            select('.save-status svg'),
            { y: -4, opacity: 0.4 },
            {
              y: 0,
              opacity: 1,
              duration: 0.4,
              clearProps: 'transform,opacity',
            },
          );
        }
        if (!old.urgent && state.urgent) {
          gsap.fromTo(
            select('.timer svg'),
            { rotation: -12 },
            {
              rotation: 0,
              duration: 0.5,
              ease: 'back.out(2)',
              clearProps: 'transform',
            },
          );
        }
      },
      ref.current,
    );
    return () => media.revert();
  }, [
    ref,
    state.questionId,
    state.answerKey,
    state.answered,
    state.tone,
    state.reviewed,
    state.saveState,
    state.urgent,
  ]);
}

export function useExamConfirmationMotion(ref: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        gsap
          .timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
          .from(ref.current, { opacity: 0, y: 16, scale: 0.97, duration: 0.35 })
          .from(
            ref.current!.querySelectorAll('h2,p,.button-row'),
            { opacity: 0, y: 8, stagger: 0.055, duration: 0.3 },
            0.1,
          );
      },
      ref.current,
    );
    return () => media.revert();
  }, [ref, open]);
}
