import { Icon } from './Icon';

/**
 * مؤشر فقدان الاتصال — يُظهر شريطًا علويًا عند انقطاع الإنترنت.
 * يطمئن المستخدم أن التطبيق يعمل محليًا (PWA).
 */
export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
    >
      <Icon name="warning" size={16} />
      <span>أنت غير متصل بالإنترنت — التطبيق يعمل محليًا، وكل بياناتك على جهازك.</span>
    </div>
  );
}
