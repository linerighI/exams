import { useSceneMotion, usePanelMotion } from './appMotion';
import { useLayoutEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import useOrbWindowMotion from './useOrbWindowMotion';

// Native dialog supplies keyboard containment, Escape and focus restoration.
export default function FocusWindow({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = 'إغلاق النافذة',
  dockRef,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
  dockRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const origin = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      (dockRef?.current || origin)?.focus();
    };
  }, []);
  const fallback = useRef<HTMLElement>(null);
  const docked = !!dockRef?.current;
  const windowMotion = useOrbWindowMotion(docked, dockRef || fallback, ref);
  const close = () => (docked ? windowMotion.minimize(onClose) : onClose());
  usePanelMotion(ref, !docked);
  useSceneMotion(ref, '.focus-window-heading, .focus-window-body > :first-child');
  return (
    <dialog
      ref={ref}
      className={`focus-window ${wide ? 'is-wide' : ''} ${dockRef ? 'has-orb-dock' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="focus-window-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label={closeLabel} onClick={close}>
          <X size={20} />
        </button>
      </header>
      <div className="focus-window-body">{children}</div>
    </dialog>
  );
}
