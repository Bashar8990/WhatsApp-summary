import type { ToastApi } from '../hooks/useToast';

export function ToastContainer({ toasts, dismiss }: ToastApi) {
  const colors: Record<string, string> = {
    info: 'bg-slate-800 text-white',
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-600 text-white',
  };
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg ${colors[t.kind] ?? colors.info}`}
          role="status"
        >
          <span className="text-sm">{t.message}</span>
          <button
            className="opacity-80 hover:opacity-100"
            onClick={() => dismiss(t.id)}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
