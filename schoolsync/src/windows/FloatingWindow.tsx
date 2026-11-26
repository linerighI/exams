/**
 * Reusable Apple frosted-glass draggable floating window shell with docked initial
 * positioning, z-index focus stacking, and viewport clamping.
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useGsapEntrance } from '../spatial/editor/editorMotion';

export type DockSide = 'right' | 'left' | 'center';

interface FloatingWindowProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  dock?: DockSide;
  width?: number;
  zIndex: number;
  onFocus: () => void;
  onClose?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

function initialPosition(dock: DockSide, width: number): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const safeW = Math.min(width, vw - 24);
  const topY = Math.max(76, Math.min(92, vh * 0.1));
  if (dock === 'center') {
    return { x: Math.max(12, Math.round((vw - safeW) / 2)), y: Math.max(76, Math.round(vh * 0.14)) };
  }
  if (dock === 'left') {
    return { x: 24, y: topY + 12 };
  }
  return { x: Math.max(12, vw - safeW - 84), y: topY };
}

/** Frosted glass floating window that never replaces or navigates away from the 3D view. */
export function FloatingWindow({
  id,
  title,
  subtitle,
  badge,
  dock = 'right',
  width = 430,
  zIndex,
  onFocus,
  onClose,
  headerActions,
  children,
}: FloatingWindowProps) {
  const [pos, setPos] = useState(() => initialPosition(dock, width));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const winRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(
    winRef,
    { opacity: 0, y: 14, scale: 0.97 },
    { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power4.out' },
    [id],
  );

  useEffect(() => {
    const clamp = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = winRef.current?.getBoundingClientRect();
      const w = rect?.width || Math.min(width, vw - 24);
      setPos((p) => ({
        x: Math.max(12, Math.min(vw - w - 12, p.x)),
        y: Math.max(68, Math.min(vh - 120, p.y)),
      }));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [width]);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    onFocus();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };

  const onDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = winRef.current?.offsetWidth || width;
    setPos({
      x: Math.max(8, Math.min(vw - w - 8, d.origX + (e.clientX - d.startX))),
      y: Math.max(64, Math.min(vh - 80, d.origY + (e.clientY - d.startY))),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <section
      ref={winRef}
      data-window-id={id}
      className="sp-window"
      style={{ left: pos.x, top: pos.y, width: `min(${width}px, calc(100vw - 24px))`, zIndex }}
      onPointerDown={onFocus}
    >
      <header
        className="sp-window-header"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
      >
        <div className="sp-window-grabber" aria-hidden="true" />
        <div className="sp-window-title-group">
          <div>
            <div className="sp-window-title-row">
              <h3>{title}</h3>
              {badge && <span className="sp-window-badge">{badge}</span>}
            </div>
            {subtitle && <p className="sp-window-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="sp-window-controls">
          {headerActions}
          {onClose && (
            <button
              type="button"
              className="sp-win-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>
      <div className="sp-window-body">
        <div key={id} className="sp-window-content">
          {children}
        </div>
      </div>
    </section>
  );
}
