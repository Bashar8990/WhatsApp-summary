import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Card({ children, className = '', title }: Props) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {title && <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>}
      {children}
    </section>
  );
}
