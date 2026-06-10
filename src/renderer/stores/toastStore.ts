import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  removing?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

// Track per-toast timers so we can clear them on manual dismiss
const timers = new Map<string, ReturnType<typeof setTimeout>>();

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${++nextId}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Auto-remove after 3 seconds with fade-out phase
    const timer = setTimeout(() => {
      // Start fade-out
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, removing: true } : t,
        ),
      }));
      // Actually remove after animation completes (300ms)
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
        timers.delete(id);
      }, 300);
    }, 3000);

    timers.set(id, timer);
  },

  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    // Start fade-out
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, removing: true } : t,
      ),
    }));
    // Actually remove after animation
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 300);
  },
}));
