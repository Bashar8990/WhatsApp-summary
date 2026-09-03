import type { ReactNode } from 'react';

/**
 * حالة تحميل هيكلية (Skeleton) — تُظهر بنية المحتوى قبل تحميله الفعلي.
 * تمنع «القفزة» المفاجئة عند فتح نتيجة محفوظة.
 */

type SkeletonProps = {
  /** عدد الأسطر الهيكلية */
  lines?: number;
  /** عرض السطر (Tailwind class) — افتراضي w-full */
  className?: string;
  /** ارتفاع السطر (Tailwind class) — افتراضي h-4 */
  lineClassName?: string;
  /** عرض السطر الأخير أقصر (محاكاة النص الطبيعي) */
  lastShort?: boolean;
};

export function Skeleton({ lines = 3, className = '', lineClassName = 'h-4', lastShort = true }: SkeletonProps) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const width = lastShort && isLast ? 'w-2/3' : 'w-full';
        return (
          <div
            key={i}
            className={`${lineClassName} ${width} animate-pulse rounded bg-slate-200 dark:bg-slate-700`}
          />
        );
      })}
    </div>
  );
}

/** هيكل صفحة نتائج كاملة (تبويبات + بطاقة محتوى) */
export function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* هيكل شريط الأدوات */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      {/* هيكل التبويبات */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      {/* هيكل بطاقة المحتوى */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <Skeleton lines={6} />
      </div>
    </div>
  );
}

/** هيكل عنصر قائمة (للمهام/المواعيد/القرارات) */
export function ListItemSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

/** غلاف يعرض skeleton أثناء التحميل ثم المحتوى */
export function LoadingOr({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  if (loading) return <>{skeleton}</>;
  return <>{children}</>;
}
