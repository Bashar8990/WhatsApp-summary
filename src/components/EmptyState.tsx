import type { IconName } from './Icon';
import { Icon } from './Icon';

/**
 * حالة فارغة مصمّمة — أيقونة + رسالة + إجراء اختياري.
 * بديل احترافي للنص الرمادي البسيط.
 */

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon name={icon} size={28} />
      </div>
      <div>
        <p className="font-medium text-slate-600 dark:text-slate-300">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{description}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 rounded-lg bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
