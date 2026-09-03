import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Logo } from './Logo';
import { Icon } from './Icon';

/**
 * Error Boundary — يلتقط أي خطأ غير متوقع في شجرة المكوّنات
 * ويعرض واجهة خطأ مصمّمة بدل انهيار التطبيق بصمت.
 *
 * ميزات:
 * - واجهة خطأ احترافية (شعار + رسالة + تفاصيل قابلة للطي)
 * - زر «إعادة المحاولة» (إعادة تصيير المكوّنات)
 * - زر «إعادة التحميل» (reload الصفحة)
 * - تسجيل الخطأ في console للتصحيح
 */

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { error, showDetails } = this.state;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center dark:bg-slate-900">
        <Logo size={64} />
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <Icon name="warning" size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            حدث خطأ غير متوقع
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            نعتذر، حدث خطأ أثناء تشغيل التطبيق. يمكنك المحاولة مرة أخرى أو إعادة تحميل الصفحة.
            بياناتك المحفوظة محفوظة على جهازك ولن تتأثر.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Icon name="refresh" size={16} />
              إعادة المحاولة
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
          {error && (
            <div className="pt-2">
              <button
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="text-xs text-slate-400 underline hover:text-slate-500 dark:text-slate-500"
              >
                {showDetails ? 'إخفاء التفاصيل' : 'عرض تفاصيل الخطأ'}
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300" dir="ltr">
                  {error.name}: {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
