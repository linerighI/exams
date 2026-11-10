import { useEffect, useRef, useState } from 'react';
import BlueOrb from '../../src/BlueOrb';
import { tr } from './translations';

/** The original exams orb, with visibility-aware animation on mobile. */
export function Orb({ size = 82, className = '' }: { size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let visible = true;
    const sync = () => setPaused(!visible || document.hidden);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      sync();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return (
    <span
      ref={ref}
      className={`orb-host ${className}`}
      data-paused={paused}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <BlueOrb size={size / 82} animationSpeedBase={0.55} />
    </span>
  );
}

export function DayPulse({ progress, onClick }: { progress: number; onClick: () => void }) {
  return (
    <button className="day-pulse" onClick={onClick} aria-label={tr('Open day companion')}>
      <svg viewBox="0 0 160 160" className="pulse-track" aria-hidden="true">
        <circle cx="80" cy="80" r="73" />
        <circle
          className="pulse-value"
          cx="80"
          cy="80"
          r="73"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <Orb size={109} />
      <span className="pulse-caption">
        <i />
        {Math.round(progress)}
        {tr('% of today')}
      </span>
    </button>
  );
}
