import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm button with the destructive (red) style. */
  danger?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  pending: ((value: boolean) => void) | null;
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  pending: null,
  confirmDialog: (options) =>
    new Promise<boolean>((resolve) => {
      // If another confirmation is already open, resolve it as cancelled first.
      const prevPending = get().pending;
      if (prevPending) prevPending(false);
      set({ isOpen: true, options, pending: resolve });
    }),
  resolveConfirm: (result) => {
    get().pending?.(result);
    set({ isOpen: false, options: null, pending: null });
  },
}));

/** Open a confirmation dialog from any context; resolves true when confirmed. */
export const confirmDialog = (options: ConfirmOptions | string): Promise<boolean> => {
  const opts = typeof options === 'string' ? { message: options } : options;
  return useConfirmStore.getState().confirmDialog(opts);
};
