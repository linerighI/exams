import { useSceneMotion, usePanelMotion } from './appMotion';
import { useLayoutEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Native dialog supplies keyboard containment, Escape and focus restoration.
export default function FocusWindow({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = 'إغلاق النافذة',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const origin = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      origin?.focus();
    };
  }, []);
  usePanelMotion(ref);
  useSceneMotion(ref, '.focus-window-heading, .focus-window-body > :first-child');
  return (
    <dialog
      ref={ref}
      className={`focus-window ${wide ? 'is-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="focus-window-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="focus-window-body">{children}</div>
    </dialog>
  );
}
