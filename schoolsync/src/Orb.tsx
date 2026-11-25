/**
 * Functional Blue Orb host with visibility-aware animation and concentric DayPulse ring.
 */
import { useEffect, useRef, useState } from 'react';
import BlueOrb from '../../src/BlueOrb';
import type { Language } from './i18n';

export type OrbTone = 'blue' | 'red' | 'green';

/** Interactive glowing Blue Orb wrapping the animated WebGL/Canvas BlueOrb shader. */
export function Orb({
  size = 82,
  className = '',
  tone = 'blue',
  speed = 0.55,
}: {
  size?: number;
  className?: string;
  tone?: OrbTone;
  speed?: number;
}) {
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
      <BlueOrb size={size / 82} animationSpeedBase={speed} tone={tone} />
    </span>
  );
}

/** Concentric Blue Orb button displaying live school-day progress. */
export function DayPulse({
  progress,
  onClick,
  tone = 'blue',
  speed = 0.55,
  size = 64,
  lang = 'ar',
  compact = false,
}: {
  progress: number;
  onClick: () => void;
  tone?: OrbTone;
  speed?: number;
  size?: number;
  lang?: Language;
  compact?: boolean;
}) {
  const stageSize = Math.round(size * 1.3);
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <button
      type="button"
      className={`day-pulse ${compact ? 'is-compact' : ''}`}
      onClick={onClick}
      aria-label={lang === 'ar' ? 'فتح رفيق اليوم' : 'Open day companion'}
    >
      <span className="pulse-stage" style={{ width: stageSize, height: stageSize }}>
        <svg viewBox="0 0 160 160" className="pulse-track" aria-hidden="true">
          <circle cx="80" cy="80" r="73" />
          <circle
            className="pulse-value"
            cx="80"
            cy="80"
            r="73"
            pathLength="100"
            strokeDasharray={`${clamped} 100`}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <Orb size={size} tone={tone} speed={speed} />
      </span>
      <span className="pulse-caption">
        <i />
        {Math.round(clamped)}%
      </span>
    </button>
  );
}
