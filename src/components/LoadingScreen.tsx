import { Logo } from './Logo';

/**
 * شاشة التحميل الأولية — تُعرض أثناء تحميل الإعدادات من IndexedDB.
 * بديل احترافي للنص الرمزي «جاري التحميل...».
 */
export function LoadingScreen({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900">
      <Logo size={72} />
      {/* spinner — دائرة تدور حول نفسها */}
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-600" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
