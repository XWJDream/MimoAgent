import React from 'react';
import { useToastStore, type ToastType } from '../../stores/toastStore';

/* ──────── Icon per type ──────── */

const ICONS: Record<ToastType, string> = {
  success: '✓', // checkmark
  error: '✗',   // cross
  warning: '⚠', // warning sign
  info: 'ℹ',    // info i
};

const TYPE_COLORS: Record<ToastType, { bg: string; color: string }> = {
  success: { bg: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' },
  error: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' },
  warning: { bg: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)' },
};

/* ──────── Single Toast ──────── */

function ToastItem({ id, message, type, removing }: {
  id: string;
  message: string;
  type: ToastType;
  removing?: boolean;
}) {
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div
      className={removing ? 'toast-item toast-exit' : 'toast-item toast-enter'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        fontSize: 13,
        color: 'var(--text-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
        minWidth: 240,
        maxWidth: 360,
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
      onClick={() => removeToast(id)}
    >
      <span
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: TYPE_COLORS[type].bg,
          color: TYPE_COLORS[type].color,
          fontSize: 11,
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {ICONS[type]}
      </span>
      <span style={{ flex: 1, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {message}
      </span>
    </div>
  );
}

/* ──────── Container ──────── */

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        right: 20,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}

/* ──────── Hook ──────── */

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  return { toast: addToast };
}

/* ──────── CSS Animations (injected once) ──────── */

if (typeof document !== 'undefined' && !document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
@keyframes toastFadeIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toastFadeOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(8px) scale(0.96); }
}
.toast-enter {
  animation: toastFadeIn 250ms var(--ease-out) forwards;
}
.toast-exit {
  animation: toastFadeOut 250ms var(--ease-out) forwards;
}`;
  document.head.appendChild(style);
}
