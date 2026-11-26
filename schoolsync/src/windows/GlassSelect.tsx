/**
 * Apple Liquid Glass dropdown select powered by `liquid-glass-react` + GSAP 3:
 * replaces native browser <select> pickers with refractive translucent menus,
 * synchronous frame-0 anchor positioning, keyboard Escape support, and spring feedback.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import LiquidGlass from 'liquid-glass-react';
import gsap from 'gsap';
import { gsapPop } from '../spatial/editor/editorMotion';

export interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
}

interface MenuGeometry {
  centerX: number;
  centerY: number;
  width: number;
  top: number;
}

function measureMenuGeometry(btn: HTMLElement, optionCount: number): MenuGeometry {
  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(178, Math.min(300, Math.round(rect.width)));
  const estH = Math.min(232, Math.max(46, optionCount * 34 + 14));
  const left = Math.max(12, Math.min(vw - width - 12, Math.round(rect.left)));
  const openAbove = rect.bottom + estH + 14 > vh && rect.top - estH - 12 > 12;
  const rawTop = openAbove ? rect.top - estH - 6 : rect.bottom + 6;
  const top = Math.max(12, Math.min(vh - estH - 12, Math.round(rawTop)));
  return { centerX: Math.round(left + width / 2), centerY: Math.round(top + estH / 2), width, top };
}

/** Apple Liquid Glass frosted dropdown picker replacing native HTML <select>. */
export function GlassSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  placeholder = '—',
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [geom, setGeom] = useState<MenuGeometry | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || placeholder;

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const realH = listRef.current.offsetHeight + 12;
    const vh = window.innerHeight;
    setGeom((prev) => {
      if (!prev) return prev;
      const clampedTop = Math.max(12, Math.min(vh - realH - 12, prev.top));
      const nextCenterY = Math.round(clampedTop + realH / 2);
      return Math.abs(nextCenterY - prev.centerY) > 3 ? { ...prev, top: clampedTop, centerY: nextCenterY } : prev;
    });
    const ctx = gsap.context(() => {
      gsap.fromTo(
        listRef.current,
        { opacity: 0, y: -5, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out', clearProps: 'transform' },
      );
    }, listRef);
    return () => ctx.revert();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = (el: HTMLButtonElement) => {
    gsapPop(el);
    if (!open && btnRef.current) {
      setGeom(measureMenuGeometry(btnRef.current, options.length));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-glass-select={ariaLabel || 'true'}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`sp-glass-select-btn ${open ? 'is-open' : ''} ${className}`.trim()}
        onClick={(e) => handleToggle(e.currentTarget)}
      >
        <span className="sp-glass-select-val">{displayLabel}</span>
        <ChevronDown size={14} className="sp-glass-select-caret" />
      </button>

      {open &&
        geom &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="sp-glass-portal" data-glass-menu={ariaLabel || 'true'}>
            <LiquidGlass
              className="sp-glass-menu"
              displacementScale={20}
              blurAmount={0.16}
              saturation={175}
              aberrationIntensity={1.2}
              elasticity={0.04}
              cornerRadius={16}
              padding="6px"
              overLight
              mode="standard"
              style={{
                position: 'fixed',
                top: `${geom.centerY}px`,
                left: `${geom.centerX}px`,
                width: `${geom.width}px`,
                zIndex: 220,
              }}
            >
              <div ref={listRef} className="sp-glass-options" role="listbox" aria-label={ariaLabel}>
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`sp-glass-opt ${active ? 'is-active' : ''}`}
                      onClick={(e) => {
                        gsapPop(e.currentTarget);
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      {active && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </LiquidGlass>
          </div>,
          document.body,
        )}
    </>
  );
}
