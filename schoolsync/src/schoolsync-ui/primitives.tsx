/**
 * Reusable SchoolSync UI component library (`schoolsync-ui`).
 * High-craft shared primitives with built-in GSAP + transitions.dev motion
 * so cards, KPI counters, tabs, and progress bars stay visually unified across screens.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCountUp, useSlidingPill } from './motionHooks';

export type StatTone = 'default' | 'ok' | 'warn';

export interface AnimatedStatProps {
  label: string;
  value: number;
  suffix?: string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}

/** Animated KPI counter card with icon badge and transitions.dev hover surface. */
export function AnimatedStat({
  label,
  value,
  suffix = '',
  sublabel,
  icon,
  tone = 'default',
  className = '',
}: AnimatedStatProps) {
  const numRef = useRef<HTMLDivElement>(null);
  useCountUp(numRef, value, suffix);

  return (
    <article
      className={`ss-stat-card tone-${tone} t-surface ${className}`.trim()}
      data-stagger
    >
      <div className="ss-stat-top">
        <span className="ss-stat-label">{label}</span>
        {icon && <span className="ss-stat-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div ref={numRef} className="ss-stat-value" dir="ltr">
        {Math.round(value)}{suffix}
      </div>
      {sublabel && <span className="ss-stat-sub">{sublabel}</span>}
    </article>
  );
}

export interface SegmentedTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface SegmentedTabsProps<T extends string = string> {
  items: readonly SegmentedTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
  darkIndicator?: boolean;
}

/** Accessible segmented tab bar with a GSAP ResizeObserver sliding pill highlighter. */
export function SegmentedTabs<T extends string = string>({
  items,
  activeId,
  onChange,
  ariaLabel,
  className = '',
  darkIndicator = false,
}: SegmentedTabsProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  useSlidingPill(
    trackRef,
    '[aria-selected="true"]',
    [activeId, items.length],
  );

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`ss-segmented t-pill-track ${darkIndicator ? 't-pill-track-dark' : ''} ${className}`.trim()}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className="ss-segmented-btn"
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="ss-segmented-count">({item.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface AnimatedProgressBarProps {
  percent: number;
  tone?: StatTone;
  label?: string;
  className?: string;
}

/** Smooth width-animated progress bar with reduced-motion fallback. */
export function AnimatedProgressBar({
  percent,
  tone = 'default',
  label,
  className = '',
}: AnimatedProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div
      className={`ss-progress-track ${className}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div
        className={`ss-progress-fill tone-${tone}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export interface PageHeroHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

/** Uniform animated page header for Staff and Family views. */
export function PageHeroHeader({
  kicker,
  title,
  subtitle,
  actions,
  className = '',
}: PageHeroHeaderProps) {
  return (
    <header className={`ss-page-hero t-pop ${className}`.trim()}>
      <div>
        {kicker && <p className="ss-page-kicker">{kicker}</p>}
        <h1 className="ss-page-title">{title}</h1>
        {subtitle && <p className="ss-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ss-page-actions">{actions}</div>}
    </header>
  );
}

export interface CanvasCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

/** Shared SchoolSync elevated container card with transitions.dev surface lift. */
export function CanvasCard({
  children,
  className = '',
  interactive = true,
  onClick,
}: CanvasCardProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${interactive ? 't-surface' : ''} ${className}`.trim()}
        data-stagger
      >
        {children}
      </button>
    );
  }
  return (
    <section
      className={`${interactive ? 't-surface' : ''} ${className}`.trim()}
      data-stagger
    >
      {children}
    </section>
  );
}

/** Inline GSAP animated counter span usable inside any KPI strong tag or pill. */
export function CountValue({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, suffix);
  return (
    <span ref={ref} dir="ltr">
      {Math.round(value)}{suffix}
    </span>
  );
}
