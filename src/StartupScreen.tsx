import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { gsap } from './animato';
import './startup.css';
const Artwork = lazy(() => import('./StartupArtwork'));
class ArtworkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <span className="startup-fallback">Zunis</span>
    ) : (
      this.props.children
    );
  }
}
export default function StartupScreen({
  loading = false,
  elapsed = 0,
  onDone,
}: {
  loading?: boolean;
  elapsed?: number;
  onDone?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    close = useRef(() => {}),
    done = useRef(onDone),
    [quiet, setQuiet] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    [status, setStatus] = useState('نجهّز مساحة المدرسة…');
  done.current = onDone;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      change = () => setQuiet(media.matches);
    media.addEventListener('change', change);
    const update = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (typeof message === 'string') setStatus(message);
    };
    window.addEventListener('school-startup-status', update);
    return () => {
      media.removeEventListener('change', change);
      window.removeEventListener('school-startup-status', update);
    };
  }, []);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    let finished = false,
      disposed = false;
    const finish = () => {
      if (finished || disposed) return;
      finished = true;
      done.current?.();
    };
    let animateClose = () => {};
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.startup-art', { opacity: 0, y: quiet ? 0 : 8, duration: quiet ? 0.1 : 0.6 }, 0)
        .from(
          '.startup-caption',
          { opacity: 0, y: quiet ? 0 : 10, duration: quiet ? 0.1 : 0.55 },
          0.75,
        )
        .from(
          '.startup-note, .startup-enter',
          { opacity: 0, y: quiet ? 0 : 6, duration: quiet ? 0.1 : 0.4, stagger: quiet ? 0 : 0.05 },
          1.1,
        )
        .fromTo(
          '.startup-rule span',
          { scaleX: 0 },
          { scaleX: 1, duration: quiet ? 0.1 : 2.9, ease: 'power2.inOut' },
          0.3,
        );
      animateClose = () => {
        if (finished || disposed) return;
        tl.kill();
        gsap.killTweensOf(root.current);
        gsap.to(root.current, {
          opacity: 0,
          y: quiet ? 0 : -8,
          duration: quiet ? 0.1 : 0.32,
          ease: 'power2.inOut',
          onComplete: finish,
        });
      };
      if (!loading)
        tl.to(
          root.current,
          {
            opacity: 0,
            y: quiet ? 0 : -8,
            duration: quiet ? 0.1 : 0.4,
            ease: 'power2.inOut',
            onComplete: finish,
          },
          3.45,
        );
      if (!loading && elapsed > 0) tl.seek(Math.min(elapsed, 3.8));
    }, root);

    ctx.add('closeWelcome', animateClose);
    close.current = () => ctx.closeWelcome();
    if (!loading) root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const fallback = loading ? undefined : setTimeout(finish, Math.max(100, 4300 - elapsed * 1000));
    return () => {
      disposed = true;
      clearTimeout(fallback);
      close.current = () => {};
      ctx.revert();
      if (!loading) previous?.focus();
    };
    // The media preference changes artwork playback; it must not restart the welcome duration.
  }, [loading]);

  const content = (
    <div
      className={`startup-screen ${loading ? 'startup-loading' : 'zunis-splash'}`}
      ref={root}
      role={loading ? 'status' : 'dialog'}
      aria-label={loading ? 'جارٍ تشغيل التطبيق' : 'مرحبًا بك في Zunis'}
      aria-modal={loading ? undefined : true}
      onKeyDown={(e) => {
        if (loading) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          close.current();
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          root.current?.querySelector<HTMLButtonElement>('button')?.focus();
        }
      }}
      dir="rtl"
    >
      <div className="startup-hairline" aria-hidden="true" />
      <div className="startup-center">
        <div className="startup-art">
          <ArtworkBoundary>
            <Suspense fallback={<span className="startup-fallback">Zunis</span>}>
              <Artwork quiet={quiet} elapsed={elapsed} />
            </Suspense>
          </ArtworkBoundary>
        </div>
        <p className="startup-caption">{loading ? status : 'حماية مساحة المدرسة'}</p>
        <p className="startup-note">
          {loading ? 'امتحانات · مدرسة محمد الشريقي' : 'المعلّم والطالب، في مساحة واحدة.'}
        </p>
        <div className="startup-rule" aria-hidden="true">
          <span />
        </div>
        {!loading && (
          <button className="startup-enter" onClick={() => close.current()}>
            الدخول إلى التطبيق ←
          </button>
        )}
      </div>
      <span className="startup-signature">Zunis · Animato · LANED</span>
    </div>
  );
  return loading ? content : createPortal(content, document.body);
}
