import { useId, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';

type Item = [string, string, ComponentType<{ size: number }>];
export default function SidebarNavigation({
  items,
  page,
  disabled,
  select,
}: {
  items: Item[];
  page: string;
  disabled: boolean;
  select: (key: string) => void;
}) {
  const id = useId();
  const [hint, setHint] = useState<{
    label: string;
    key: string;
    right: number;
    top: number;
  } | null>(null);
  const show = (element: HTMLButtonElement, key: string, label: string) => {
    const rect = element.getBoundingClientRect();
    setHint({
      key,
      label,
      right: innerWidth - rect.left + 12,
      top: Math.max(12, Math.min(innerHeight - 50, rect.top + rect.height / 2 - 18)),
    });
  };
  const hide = (key: string) => setHint((current) => (current?.key === key ? null : current));
  return (
    <>
      <nav
        aria-label="التنقل الرئيسي"
        onScroll={() => setHint(null)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setHint(null);
        }}
      >
        {items.map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            disabled={disabled}
            aria-label={label}
            aria-current={page === key ? 'page' : undefined}
            aria-describedby={hint?.key === key ? id : undefined}
            className={page === key ? 'active' : ''}
            onPointerEnter={(event) => show(event.currentTarget, key, label)}
            onPointerLeave={() => hide(key)}
            onFocus={(event) => show(event.currentTarget, key, label)}
            onBlur={() => hide(key)}
            onClick={() => {
              setHint(null);
              select(key);
            }}
          >
            <Icon size={20} />
          </button>
        ))}
      </nav>
      {hint &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="navigation-tooltip"
            style={{ right: hint.right, top: hint.top }}
          >
            {hint.label}
          </span>,
          document.body,
        )}
    </>
  );
}
