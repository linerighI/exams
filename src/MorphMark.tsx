import { useLayoutEffect, useRef } from 'react';
import { useQuietMotion } from './appMotion';
import { gsap } from './animato';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
gsap.registerPlugin(MorphSVGPlugin);
const paths = {
  plus: 'M12 5L12 19M5 12L19 12',
  check: 'M4 12L9 17L20 6',
  edit: 'M4 16L4 20L8 20L20 8L16 4ZM14 6L18 10',
  eye: 'M2 12C7 3 17 3 22 12C17 21 7 21 2 12ZM15 12A3 3 0 1 0 9 12A3 3 0 1 0 15 12Z',
  working: 'M12 3C17 3 21 7 21 12C21 17 17 21 12 21',
  info: 'M12 10L12 17M12 6L12 7',
  alert: 'M12 4L12 14M12 18L12 19',
  saved: 'M5 3L17 3L21 7L21 21L3 21L3 3ZM7 3L7 9L16 9L16 3M7 21L7 14L17 14L17 21',
};
export type MarkShape = keyof typeof paths;
export default function MorphMark({ shape, size = 20 }: { shape: MarkShape; size?: number }) {
  const root = useRef<SVGSVGElement>(null),
    path = useRef<SVGPathElement>(null);
  const initial = useRef(paths[shape]),
    quiet = useQuietMotion();
  useLayoutEffect(() => {
    const svg = root.current!,
      mark = path.current!;
    gsap.set(svg, { rotation: 0, transformOrigin: '50% 50%' });
    if (quiet) gsap.set(mark, { attr: { d: paths[shape] } });
    else {
      gsap.to(mark, {
        morphSVG: paths[shape],
        duration: 0.38,
        ease: 'power2.inOut',
        overwrite: true,
      });
      if (shape === 'working')
        gsap.to(svg, { rotation: 360, duration: 1.05, repeat: -1, ease: 'none' });
    }
    // Preserve the current path during rapid changes; this component owns it.
    return () => {
      gsap.killTweensOf(mark);
      gsap.killTweensOf(svg);
    };
  }, [shape, quiet]);
  return (
    <svg
      ref={root}
      className="morph-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-morph-state={shape}
    >
      <path ref={path} d={initial.current} />
    </svg>
  );
}
