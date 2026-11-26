/**
 * Apple Light Liquid Glass dropdown select powered by GSAP 3 spring choreography:
 * renders an elevated frosted popover with RTL/LTR rail-safe edge alignment,
 * single-line option labels, keyboard Escape dismissal, and viewport clamping.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
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
  left: number;
  top: number;
  width: number;
  openAbove: boolean;
  anchorTop: number;
  anchorBottom: number;
}

function measureMenuGeometry(btn: HTMLElement, optionCount: number): MenuGeometry {
  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isRtl =
    document.documentElement.dir === 'rtl' || getComputedStyle(btn).direction === 'rtl';
  const width = Math.max(216, Math.min(300, Math.round(rect.width)));
  const estH = Math.min(232, Math.max(46, optionCount * 34 + 14));
  const rawLeft = isRtl ? rect.right - width : rect.left;
  const left = Math.max(12, Math.min(vw - width - 72, Math.round(rawLeft)));
  const openAbove = rect.bottom + estH + 14 > vh && rect.top - estH - 12 > 12;
  const rawTop = openAbove ? rect.top - estH - 6 : rect.bottom + 6;
  const top = Math.max(12, Math.min(vh - estH - 12, Math.round(rawTop)));
  return { left, top, width, openAbove, anchorTop: rect.top, anchorBottom: rect.bottom };
}

/** Apple frosted-glass dropdown picker replacing native browser <select>. */
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
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || placeholder;

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !geom) return;
    const realH = menuRef.current.offsetHeight;
    const vh = window.innerHeight;
    if (realH > 0) {
      const targetTop = geom.openAbove
        ? Math.max(12, Math.round(geom.anchorTop - realH - 6))
        : Math.max(12, Math.min(vh - realH - 12, Math.round(geom.anchorBottom + 6)));
      if (Math.abs(targetTop - geom.top) > 2) {
        setGeom((g) => (g ? { ...g, top: targetTop } : g));
      }
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: geom.openAbove ? 6 : -6, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'back.out(1.4)', clearProps: 'transform' },
      );
    }, menuRef);
    return () => ctx.revert();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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
            <div
              ref={menuRef}
              className="sp-glass-menu-card"
              style={{
                position: 'fixed',
                top: `${geom.top}px`,
                left: `${geom.left}px`,
                width: `${geom.width}px`,
              }}
            >
              <div className="sp-glass-options" role="listbox" aria-label={ariaLabel}>
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
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
