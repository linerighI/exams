import { lazy, Suspense, useLayoutEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ArrowUpLeft } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { gsap } from './animato';
import { useLiveRoomStatus } from './liveRoomState';
import { openLiveLab } from './LiveLab';
import './liveRoomDock.css';
const Signal = lazy(() => import('./LiveRoomSignal'));
type DragHandlers = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>;
export default function LiveRoomDock({
  position,
  dragHandlers,
  consumeDrag,
  onOpen,
}: {
  position: { x: number; y: number };
  dragHandlers: DragHandlers;
  consumeDrag: () => boolean;
  onOpen: () => void;
}) {
  const status = useLiveRoomStatus(),
    ref = useRef<HTMLButtonElement>(null),
    edge = useRef<HTMLDivElement>(null),
    quiet = useReducedMotion();
  const available = status.active > 0 || status.online > 0;
  useLayoutEffect(() => {
    if (!available || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        opacity: 0,
        x: quiet ? 0 : -25,
        scaleX: quiet ? 1 : 0.75,
        transformOrigin: 'left center',
        duration: quiet ? 0.1 : 0.48,
        ease: 'power3.out',
        clearProps: 'opacity,transform,transformOrigin',
      });
    }, ref);
    return () => ctx.revert();
  }, [available, quiet]);
  const updateGlow = useRef<(active: boolean) => void>(() => {});
  useLayoutEffect(() => {
    if (!edge.current) return;
    let pulse: gsap.core.Timeline | undefined;
    const ctx = gsap.context(() => {}, edge);
    ctx.add('updateGlow', (active: boolean) => {
      pulse?.kill();
      pulse = gsap.timeline();
      pulse.to(edge.current, {
        opacity: active ? (quiet ? 0.45 : 0.65) : 0,
        duration: quiet ? 0.1 : 0.35,
      });
      if (active && !quiet)
        pulse.to(edge.current, {
          opacity: 0.35,
          duration: 2.8,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      pulse.paused(document.hidden);
    });
    updateGlow.current = (active) => ctx.updateGlow(active);
    const visibility = () => pulse?.paused(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      updateGlow.current = () => {};
      document.removeEventListener('visibilitychange', visibility);
      pulse?.kill();
      ctx.revert();
    };
  }, [quiet]);
  useLayoutEffect(
    () => updateGlow.current(status.active > 0 && !status.open),
    [status.active > 0, status.open, quiet],
  );
  const right = innerWidth - position.x - 74,
    left = position.x,
    goRight = right >= 168 || right >= left,
    width = Math.max(76, Math.min(168, goRight ? right : left));
  return (
    <>
      {createPortal(
        <div
          ref={edge}
          className="live-room-edge"
          data-active={status.active > 0 && !status.open}
          aria-hidden="true"
        />,
        document.body,
      )}
      {available && (
        <button
          ref={ref}
          className={`orb-room-chip ${status.open ? 'is-room-open' : ''}`}
          style={{
            left: goRight ? position.x + 62 : Math.max(8, position.x - width + 12),
            top: position.y + 9,
            width,
            paddingLeft: goRight ? 20 : 10,
            paddingRight: goRight ? 10 : 20,
          }}
          {...dragHandlers}
          aria-label="فتح المراقبة المباشرة"
          aria-expanded={status.open}
          title="غرفة الامتحان · اسحب للتحريك · Alt + الأسهم من الكرة"
          onClick={() => {
            if (consumeDrag()) return;
            onOpen();
            openLiveLab();
          }}
        >
          <span className="orb-room-chip-label">
            <strong>
              <i />
              غرفة الامتحان
            </strong>
            <small>
              {status.online} متصل · {status.active} محاولات
            </small>
          </span>
          <span className="orb-room-chip-signal" aria-hidden="true">
            {quiet ? (
              <Activity size={18} />
            ) : (
              <Suspense fallback={<Activity size={18} />}>
                <Signal />
              </Suspense>
            )}
          </span>
          <ArrowUpLeft size={13} />
        </button>
      )}
    </>
  );
}
