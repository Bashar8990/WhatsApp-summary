import type { ConfidenceLevel } from '../types';

const LABELS: Record<ConfidenceLevel, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

const COLORS: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[level]}`}>
      ثقة: {LABELS[level]}
    </span>
  );
}
