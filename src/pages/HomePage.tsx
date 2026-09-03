import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { estimateMessageCount } from '../services/parser/whatsappParser';
import type { AnalysisType, DeviceCompatibility, ProcessingMode } from '../types';
import type { ToastApi } from '../hooks/useToast';

type Props = {
  userName: string;
  onUserNameChange: (v: string) => void;
  onAnalyze: (text: string, analysisType: AnalysisType, summaryLength: 'short' | 'medium' | 'detailed') => void;
  busy: boolean;
  processingMode: ProcessingMode;
  toasts: ToastApi;
  compat: DeviceCompatibility;
};

const ANALYSIS_TYPES: { value: AnalysisType; label: string }[] = [
  { value: 'full', label: 'تحليل كامل' },
  { value: 'summary', label: 'ملخص فقط' },
  { value: 'tasks-for-me', label: 'المطلوب مني' },
  { value: 'dates', label: 'المواعيد' },
  { value: 'decisions', label: 'القرارات' },
  { value: 'people', label: 'الأشخاص' },
];

const SUMMARY_LENGTHS: { value: 'short' | 'medium' | 'detailed'; label: string }[] = [
  { value: 'short', label: 'قصير' },
  { value: 'medium', label: 'متوسط' },
  { value: 'detailed', label: 'مفصل' },
];

export function HomePage({
  userName,
  onUserNameChange,
  onAnalyze,
  busy,
  processingMode,
  toasts,
  compat,
}: Props) {
  const [text, setText] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('full');
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const fileRef = useRef<HTMLInputElement>(null);

  const charCount = text.length;
  const approxMessages = estimateMessageCount(text);
  const isEmpty = text.trim().length === 0;

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText((prev) => (prev ? prev + '\n' + clip : clip));
        toasts.success('تم اللصق من الحافظة');
      } else {
        toasts.warning('الحافظة فارغة');
      }
    } catch {
      toasts.error('تعذّر الوصول إلى الحافظة. الصق يدويًا باستخدام Ctrl+V.');
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toasts.error('الرجاء اختيار ملف بصيغة TXT');
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      toasts.success(`تم تحميل الملف (${content.length} حرف)`);
    } catch {
      toasts.error('تعذّر قراءة الملف');
    }
  };

  const handleClear = () => {
    setText('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = () => {
    if (isEmpty) {
      toasts.error('لا يمكن بدء التحليل بنص فارغ');
      return;
    }
    if (text.trim().length < 20) {
      toasts.warning('المحادثة قصيرة جدًا، قد لا تكون النتائج مفيدة');
    }
    onAnalyze(text, analysisType, summaryLength);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-50">ملخص الواتساب</h1>
        <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">
          الصق محادثتك واستخرج المهام والمواعيد والقرارات والملخص، محليًا داخل جهازك.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Icon name="lock" size={16} title="خصوصية" />
          محادثتك لا تغادر جهازك
        </div>
      </header>

      {/* بطاقة توافق المتصفح — تُظهر للمستخدم ما إذا كان التحليل الذكي متاحًا */}
      {!compat.webgpu && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">التحليل الذكي المحلي غير متاح على هذا المتصفح</p>
            <p className="mt-1 text-xs">{compat.label}</p>
            <p className="mt-1 text-xs">
              يمكنك استخدام <strong>التحليل السريع</strong> (برمجي) بدون الحاجة لـ WebGPU — يعمل على كل المتصفحات.
            </p>
          </div>
        </div>
      )}
      {compat.webgpu && compat.status === 'slow' && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">قد يكون التحليل الذكي بطيئًا على هذا الجهاز</p>
            <p className="mt-1 text-xs">{compat.label}</p>
          </div>
        </div>
      )}

      <Card className="space-y-4">
        <div>
          <label htmlFor="userName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            ما اسمك كما يظهر في المحادثة؟
          </label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            placeholder="مثال: أحمد"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="chat" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              الصق محادثة واتساب هنا
            </label>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {charCount} حرف · ~{approxMessages} رسالة
            </span>
          </div>
          <textarea
            id="chat"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'01/09/2026, 10:30 - أحمد: السلام عليكم\n01/09/2026, 10:31 - خالد: وعليكم السلام'}
            rows={10}
            dir="rtl"
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePaste} disabled={busy} type="button">
            لصق من الحافظة
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            type="button"
          >
            تحميل ملف TXT
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={busy || isEmpty} type="button">
            مسح النص
          </Button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            نوع التحليل
          </label>
          <div className="flex flex-wrap gap-2">
            {ANALYSIS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAnalysisType(t.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  analysisType === t.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            طول الملخص
          </label>
          <div className="flex gap-2">
            {SUMMARY_LENGTHS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSummaryLength(s.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  summaryLength === s.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={busy || isEmpty}
            aria-label="حلّل المحادثة"
          >
            {busy ? 'جاري التحليل...' : 'حلّل المحادثة'}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            وضع التحليل الحالي: {processingMode === 'auto' ? 'تلقائي' : processingMode === 'local-ai' ? 'ذكاء اصطناعي محلي' : 'تحليل سريع'}
          </p>
        </div>
      </Card>
    </div>
  );
}
