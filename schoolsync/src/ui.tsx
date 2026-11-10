import { tr } from './translations';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X, ArrowUpRight, Sprout, GraduationCap } from 'lucide-react';
import { gsap } from 'gsap';
import { quietMotion } from './animation';
export const ErrorContext = createContext('');
export function Motion({ children, identity }: { children: ReactNode; identity: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(identity);
  const held = useRef(children);
  if (shown === identity) held.current = children;
  useLayoutEffect(() => {
    if (shown === identity) {
      gsap.set(root.current, { clearProps: 'transform,opacity' });
      return;
    }
    if (quietMotion()) {
      setShown(identity);
      return;
    }
    const tween = gsap.to(root.current, {
      opacity: 0,
      y: -5,
      duration: 0.13,
      ease: 'power2.in',
      onComplete: () => setShown(identity),
    });
    return () => {
      tween.kill();
    };
  }, [identity, shown]);
  return (
    <div ref={root}>
      <Scene key={shown}>{shown === identity ? children : held.current}</Scene>
    </div>
  );
}
function Scene({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (quietMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        root.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.22, clearProps: 'opacity' },
        0,
      );
      const nodes = root.current?.querySelectorAll('[data-reveal]');
      if (nodes?.length)
        tl.fromTo(
          nodes,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.045, clearProps: 'transform,opacity' },
          0.02,
        );
    }, root);
    return () => ctx.revert();
  }, []);
  return <div ref={root}>{children}</div>;
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <GraduationCap size={22} />
      </span>
      school<span>sync</span>
      <i />
    </span>
  );
}
export function Section({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <Sprout size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const error = useContext(ErrorContext);
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    gsap.to(ref.current, {
      y: 18,
      opacity: 0,
      duration: 0.19,
      ease: 'power2.in',
      onComplete: onClose,
    });
  };
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        d,
        { y: 30, scale: 0.98, opacity: 0 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      );
    });
    const cancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    d.addEventListener('cancel', cancel);
    return () => {
      gsap.killTweensOf(d);
      media.revert();
      d.removeEventListener('cancel', cancel);
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          close();
      }}
    >
      <div className="sheet-handle" />
      <div className="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label={tr('Close')} onClick={close}>
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="error-banner sheet-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
export function BooksArt() {
  return (
    <svg className="books-art" viewBox="0 0 180 145" aria-hidden="true">
      <ellipse cx="94" cy="127" rx="66" ry="10" fill="#253c2d" opacity=".09" />
      <g transform="rotate(-9 90 90)">
        <rect x="36" y="91" width="112" height="24" rx="5" fill="#b7a1d7" />
        <path d="M43 96h101v13H43a6 6 0 0 1 0-13" fill="#fffaf1" />
        <rect x="30" y="69" width="112" height="24" rx="5" fill="#6b9aeb" />
        <path d="M37 74h101v13H37a6 6 0 0 1 0-13" fill="#fffaf1" />
        <rect x="41" y="47" width="112" height="24" rx="5" fill="#fbac8b" />
        <path d="M48 52h101v13H48a6 6 0 0 1 0-13" fill="#fffaf1" />
        <path d="M120 47v21l8-6 8 6V47" fill="#dd694c" />
      </g>
      <path d="m143 23 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#547d37" />
      <path d="m35 29 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#709b4c" />
    </svg>
  );
}
export const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('');
