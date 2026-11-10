import { useLayoutEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { gsap, quietMotion } from './animation';
import { tr } from './translations';
export function Navigation({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; icon: LucideIcon }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const element = root.current!;
    const ctx = gsap.context(() => {}, element);
    const place = () =>
      ctx.add(() => {
        const button = element.querySelector<HTMLButtonElement>('[aria-current="page"]');
        if (!button) {
          gsap.set(marker.current, { opacity: 0 });
          return;
        }
        gsap.set(marker.current, { width: button.offsetWidth, height: button.offsetHeight });
        const vars = { x: button.offsetLeft, y: button.offsetTop, opacity: 1 };
        if (!placed.current || quietMotion()) gsap.set(marker.current, vars);
        else
          gsap.to(marker.current, { ...vars, duration: 0.48, ease: 'expo.out', overwrite: 'auto' });
        placed.current = true;
      });
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (marker.current) gsap.killTweensOf(marker.current);
    };
  }, [value, items.map((x) => x.label).join('|')]);
  return (
    <nav ref={root} className="bottom-nav" aria-label={tr('Main navigation')}>
      <span ref={marker} className="nav-selector" aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          className={value === item.id ? 'active' : ''}
          aria-current={value === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <item.icon size={21} strokeWidth={value === item.id ? 2 : 1.7} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
