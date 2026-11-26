/**
 * Reusable Apple Liquid Glass segmented tab control powered by GSAP sliding pill
 * indicator for smooth RTL and LTR transitions across all SchoolSync windows.
 */
import { useRef, type ReactNode } from 'react';
import { useSlidingPill } from '../spatial/editor/editorMotion';

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Apple-style sliding segmented control for floating windows and inspector panes. */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
}: SegmentedTabsProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useSlidingPill(trackRef, pillRef, 'button.is-active', [value, items.length]);

  return (
    <div ref={trackRef} className={`sp-seg-track sp-win-seg ${className}`.trim()} role="tablist">
      <span ref={pillRef} className="sp-seg-pill" aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={value === item.id ? 'is-active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
