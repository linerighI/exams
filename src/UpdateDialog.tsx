import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { runGenieEffect, type GenieEffectControls } from '@adi1816/genie-effect';
import '@adi1816/genie-effect/styles.css';
import { X, Download } from 'lucide-react';
import { useQuietMotion } from './appMotion';
import './updates.css';

export default function UpdateDialog({
  children,
  origin,
  onClose,
  locked = false,
}: {
  children: ReactNode;
  origin: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  locked?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    panel = useRef<HTMLElement>(null);
  const animation = useRef<GenieEffectControls | null>(null);
  const [closing, setClosing] = useState(false);
  const quiet = useQuietMotion();
  useLayoutEffect(() => {
    const el = dialog.current!,
      source = panel.current!,
      previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const box = source.getBoundingClientRect(),
      dock = origin.current?.getBoundingClientRect();
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline();
      timeline.fromTo(
        source,
        quiet
          ? { opacity: 0 }
          : {
              opacity: 0,
              scaleX: 0.18,
              scaleY: 0.06,
              x: dock ? dock.left + dock.width / 2 - box.left - box.width / 2 : 0,
              y: dock ? dock.top + dock.height / 2 - box.top - box.height / 2 : 35,
              borderRadius: 60,
            },
        {
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
          borderRadius: 26,
          duration: quiet ? 0.12 : 0.65,
          ease: 'expo.out',
          clearProps: 'transform,opacity,borderRadius',
        },
      );
      if (!quiet)
        timeline.from(
          source.querySelectorAll('.update-window-heading > *, .app-update-panel > *'),
          { opacity: 0, y: 12, duration: 0.28, stagger: 0.025, clearProps: 'opacity,transform' },
          0.22,
        );
    }, source);
    return () => {
      animation.current?.cancel();
      ctx.revert();
      el.close();
      previous?.focus();
    };
  }, []);
  const close = () => {
    if (locked || closing) return;
    setClosing(true);
    const source = panel.current!,
      el = dialog.current!;
    if (quiet) {
      gsap.to(source, { opacity: 0, duration: 0.12, onComplete: onClose });
      return;
    }
    source.setAttribute('inert', '');
    animation.current = runGenieEffect(
      source,
      origin.current || { left: innerWidth - 64, top: 24, width: 40, height: 40 },
      {
        duration: 650,
        layerParent: el,
        className: 'update-genie-layer',
        restoreSourceOnComplete: false,
        onComplete: onClose,
      },
    );
  };
  return createPortal(
    <dialog
      ref={dialog}
      className={`update-dialog ${closing ? 'is-closing' : ''}`}
      aria-labelledby="update-window-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <section className="update-window" ref={panel}>
        <header className="update-window-heading">
          <span className="update-window-icon">
            <Download size={24} />
          </span>
          <div>
            <small>الشريقي للامتحانات</small>
            <h2 id="update-window-title">تحديث التطبيق</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="إغلاق نافذة التحديث"
            disabled={locked || closing}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </dialog>,
    document.body,
  );
}
