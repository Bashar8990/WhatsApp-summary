import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

type Props = { onBack: () => void };

export function PrivacyPage({ onBack }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">الخصوصية</h2>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="arrow-right" size={16} /> رجوع
        </Button>
      </div>
      <div className="space-y-3 text-slate-700 dark:text-slate-300">
        <p className="flex items-center gap-2">
          <Icon name="lock" size={18} title="خصوصية" className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          التطبيق يحلل المحادثة داخل جهاز المستخدم بالكامل.
        </p>
        <ul className="list-disc space-y-2 pr-6">
          <li>لا توجد حسابات مستخدمين.</li>
          <li>لا يوجد خادم خلفي لمعالجة المحادثة.</li>
          <li>لا يتم إرسال نص المحادثة إلى أي مزود خارجي.</li>
          <li>قد يحتاج تنزيل نموذج الذكاء الاصطناعي إلى اتصال بالإنترنت (مرة واحدة)، لكن المحادثة نفسها لا تُرسل.</li>
          <li>النتائج المحفوظة تبقى داخل متصفحك فقط (IndexedDB).</li>
          <li>حذف بيانات المتصفح قد يحذف السجل والنموذج المحفوظ.</li>
          <li>المستخدم مسؤول عن الحصول على الإذن المناسب من المشاركين قبل تحليل محادثات الآخرين.</li>
        </ul>
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          لا يستخدم التطبيق أي خدمات تحليلات أو تتبع خارجية. لا يُسجّل نص المحادثات في console في وضع الإنتاج.
        </p>
      </div>
    </div>
  );
}
