/**
 * SchoolSync UI — WinUI 3 React Control Primitives.
 * Provides Fluent Buttons, CommandBar, Slide-Over Acrylic Side Drawer,
 * Smooth Collapsible Expander, and Status InfoBar for decluttered screens.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  X,
  XCircle,
} from 'lucide-react';

export type WinButtonVariant = 'standard' | 'accent' | 'subtle';

export interface WinButtonProps {
  children: ReactNode;
  variant?: WinButtonVariant;
  badge?: number | string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

/** Tactile WinUI 3 button with bottom hairline bevel and active spring scale. */
export function WinButton({
  children,
  variant = 'standard',
  badge,
  disabled,
  type = 'button',
  onClick,
  className = '',
  ariaLabel,
}: WinButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`wui-btn variant-${variant} ${className}`.trim()}
    >
      {children}
      {badge !== undefined && Number(badge) > 0 && (
        <span className="wui-btn-badge">{badge}</span>
      )}
    </button>
  );
}

export interface WinCommandBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

/** Fluent top CommandBar grouping concise page context and drawer/tool triggers. */
export function WinCommandBar({
  title,
  subtitle,
  actions,
  className = '',
}: WinCommandBarProps) {
  return (
    <div className={`wui-command-bar t-pop ${className}`.trim()}>
      <div className="wui-command-meta">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {actions && <div className="wui-command-actions">{actions}</div>}
    </div>
  );
}

export interface WinSideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** WinUI 3 Acrylic slide-over drawer keeping secondary options off the main canvas. */
export function WinSideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: WinSideDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="wui-drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="wui-side-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="wui-drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <WinButton variant="subtle" onClick={onClose} ariaLabel="إغلاق اللوحة">
            <X size={18} />
          </WinButton>
        </div>
        <div className="wui-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export interface WinExpanderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/** WinUI 3 collapsible Expander keeping heavy lists/forms tidy on demand. */
export function WinExpander({
  title,
  subtitle,
  badge,
  icon,
  defaultOpen = false,
  children,
  className = '',
}: WinExpanderProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`wui-expander ${open ? 'is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="wui-expander-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="wui-expander-left">
          {icon && <span className="wui-expander-icon" aria-hidden="true">{icon}</span>}
          <span className="wui-expander-copy">
            <strong>{title}</strong>
            {subtitle && <small>{subtitle}</small>}
          </span>
        </span>
        <span className="wui-expander-right">
          {badge !== undefined && <span className="wui-expander-pill">{badge}</span>}
          <ChevronDown size={18} className="wui-expander-chevron" />
        </span>
      </button>
      <div className="wui-expander-collapse">
        <div className="wui-expander-inner">
          <div className="wui-expander-content">{children}</div>
        </div>
      </div>
    </section>
  );
}

export type InfoTone = 'info' | 'ok' | 'warn' | 'danger';

export interface WinInfoBarProps {
  tone?: InfoTone;
  title: string;
  message?: string;
  action?: ReactNode;
}

/** Compact Fluent InfoBar banner for clear non-cluttering status notices. */
export function WinInfoBar({ tone = 'info', title, message, action }: WinInfoBarProps) {
  const Icon =
    tone === 'ok'
      ? CheckCircle2
      : tone === 'warn'
        ? AlertTriangle
        : tone === 'danger'
          ? XCircle
          : Info;

  return (
    <div className={`wui-infobar tone-${tone} t-pop`} role="status">
      <div className="wui-infobar-main">
        <Icon size={18} />
        <div className="wui-infobar-copy">
          <strong>{title}</strong>
          {message && <span>{message}</span>}
        </div>
      </div>
      {action}
    </div>
  );
}
