import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  outline: 'border border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-base rounded-xl',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
