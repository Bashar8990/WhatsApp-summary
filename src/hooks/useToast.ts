import { useCallback, useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';
export type Toast = { id: number; kind: ToastKind; message: string };

let toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string, duration = 3500) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, kind, message }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return {
    toasts,
    dismiss,
    show,
    info: (m: string, d?: number) => show('info', m, d),
    success: (m: string, d?: number) => show('success', m, d),
    error: (m: string, d?: number) => show('error', m, d),
    warning: (m: string, d?: number) => show('warning', m, d),
  };
}

export type ToastApi = ReturnType<typeof useToasts>;

export function useTheme(theme: 'light' | 'dark') {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);
}
