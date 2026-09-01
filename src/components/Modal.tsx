import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export function Modal({
  open,
  title,
  children,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <div className="mb-5 text-slate-700 dark:text-slate-300">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
