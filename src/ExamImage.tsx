import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, X, Image as ImageIcon } from 'lucide-react';
import { gsap } from './animato';
import './examImage.css';
export default function ExamImage({
  src,
  label = 'صورة مرجعية للامتحان',
}: {
  src: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const thumb = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    stage = useRef<HTMLDivElement>(null),
    sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined);
  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const changeZoom = (n: number) => {
    const next = Math.min(4, Math.max(1, n));
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
  };
  useEffect(() => {
    if (!open || !stage.current) return;
    const node = stage.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [open, zoom]);
  const close = () => {
    if (!sheet.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      return;
    }
    const from = thumb.current?.getBoundingClientRect(),
      to = sheet.current.getBoundingClientRect();
    gsap.to(sheet.current, {
      x: from ? from.left + from.width / 2 - to.left - to.width / 2 : 0,
      y: from ? from.top + from.height / 2 - to.top - to.height / 2 : 20,
      scale: 0.12,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => setOpen(false),
    });
  };
  useLayoutEffect(() => {
    if (!open) return;
    const d = dialog.current!;
    const origin = document.activeElement as HTMLElement;
    d.showModal();
    reset();
    const from = thumb.current!.getBoundingClientRect(),
      to = sheet.current!.getBoundingClientRect();
    const context = gsap.context(() => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        gsap.fromTo(
          sheet.current,
          {
            x: from.left + from.width / 2 - to.left - to.width / 2,
            y: from.top + from.height / 2 - to.top - to.height / 2,
            scaleX: 0.15,
            scaleY: 0.08,
            opacity: 0,
            borderRadius: 40,
            clipPath: 'polygon(25% 0,75% 0,100% 100%,0 100%)',
          },
          {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            borderRadius: 20,
            clipPath: 'polygon(0% 0,100% 0,100% 100%,0 100%)',
            duration: 0.55,
            ease: 'power3.out',
          },
        );
    });
    return () => {
      context.revert();
      d.close();
      origin?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        ref={thumb}
        className="exam-reference-image"
        onClick={() => setOpen(true)}
      >
        <img src={src} alt="" />
        <span>
          <ImageIcon size={17} />
          {label}
          <ZoomIn size={18} />
        </span>
      </button>
      {open &&
        createPortal(
          <dialog
            className="exam-image-dialog"
            ref={dialog}
            aria-label={label}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onKeyDown={(e) => {
              if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                changeZoom(zoom + 0.25);
              }
              if (e.key === '-') {
                e.preventDefault();
                changeZoom(zoom - 0.25);
              }
              if (e.key === '0') reset();
            }}
          >
            <div ref={sheet} className="exam-image-sheet">
              <header>
                <strong>{label}</strong>
                <button type="button" onClick={close} aria-label="إغلاق الصورة">
                  <X size={21} />
                </button>
              </header>
              <div
                ref={stage}
                className="exam-image-stage"
                style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
                onPointerDown={(e) => {
                  if (zoom <= 1) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                }}
                onPointerMove={(e) => {
                  if (!drag.current) return;
                  const r = stage.current!.getBoundingClientRect(),
                    boundX = ((zoom - 1) * r.width) / 2,
                    boundY = ((zoom - 1) * r.height) / 2;
                  setOffset({
                    x: Math.max(
                      -boundX,
                      Math.min(boundX, drag.current.ox + e.clientX - drag.current.x),
                    ),
                    y: Math.max(
                      -boundY,
                      Math.min(boundY, drag.current.oy + e.clientY - drag.current.y),
                    ),
                  });
                }}
                onPointerUp={() => (drag.current = undefined)}
                onPointerCancel={() => (drag.current = undefined)}
                onLostPointerCapture={() => (drag.current = undefined)}
              >
                <img
                  draggable={false}
                  src={src}
                  alt={label}
                  style={{ transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}
                />
              </div>
              <footer>
                <span>كبّر واسحب لاستكشاف التفاصيل</span>
                <div>
                  <button
                    type="button"
                    aria-label="تصغير الصورة"
                    disabled={zoom <= 1}
                    onClick={() => changeZoom(zoom - 0.25)}
                  >
                    <ZoomOut size={19} />
                  </button>
                  <output aria-live="polite">{Math.round(zoom * 100)}%</output>
                  <button
                    type="button"
                    aria-label="تكبير الصورة"
                    disabled={zoom >= 4}
                    onClick={() => changeZoom(zoom + 0.25)}
                  >
                    <ZoomIn size={19} />
                  </button>
                  <button type="button" aria-label="إعادة ضبط الصورة" onClick={reset}>
                    <RotateCcw size={18} />
                  </button>
                </div>
              </footer>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
