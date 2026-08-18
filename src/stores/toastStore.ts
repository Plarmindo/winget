import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = ++nextToastId;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Auto-dismiss; errors linger a bit longer so the user can read them.
    setTimeout(() => get().dismissToast(id), type === 'error' ? 6000 : 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Show a toast from any context (event handlers, hooks, services). */
export const showToast = (message: string, type: ToastType = 'info'): void => {
  useToastStore.getState().showToast(message, type);
};
