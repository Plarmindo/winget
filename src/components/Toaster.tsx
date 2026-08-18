import React from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastType } from '../stores/toastStore';

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-green-500" />,
  error: <XCircle size={16} className="text-red-500" />,
  warning: <AlertTriangle size={16} className="text-amber-500" />,
  info: <Info size={16} className="text-[var(--app-primary)]" />,
};

export const Toaster: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-[80] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <span className="shrink-0 mt-0.5">{TOAST_ICONS[toast.type]}</span>
          <p className="flex-1 text-sm text-[var(--app-text)] whitespace-pre-wrap break-words">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 p-1 -m-1 rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg)] transition-colors"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
