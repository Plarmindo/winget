import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useConfirmStore } from '../stores/confirmStore';

export const ConfirmDialog: React.FC = () => {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const options = useConfirmStore((s) => s.options);
  const resolveConfirm = useConfirmStore((s) => s.resolveConfirm);

  // Escape cancels the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, resolveConfirm]);

  if (!isOpen || !options) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => resolveConfirm(false)}
      role="alertdialog"
      aria-modal="true"
      aria-label={options.title || 'Confirmation'}
    >
      <div
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--app-border)]">
          <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--app-text)]">
            {options.danger && <AlertTriangle size={20} className="text-red-500" />}
            {options.title || 'Please confirm'}
          </h2>
          <button
            onClick={() => resolveConfirm(false)}
            className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
            aria-label="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-[var(--app-text-muted)] whitespace-pre-wrap">{options.message}</p>
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-[var(--app-border)]">
          <button
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-bg)] transition-colors"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={() => resolveConfirm(true)}
            autoFocus
            className={`px-6 py-2 rounded-lg font-medium text-white transition-all ${
              options.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-[var(--app-primary)] hover:opacity-90'
            }`}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
