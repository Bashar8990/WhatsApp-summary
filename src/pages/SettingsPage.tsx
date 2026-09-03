import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { MODEL_OPTIONS } from '../config/model';
import { getDeviceCompatibility, detectBrowser } from '../services/ai/deviceCheck';
import { isModelLoaded, unloadModel } from '../services/ai/webllmService';
import { deleteAllAnalyses } from '../services/storage/indexedDB';
import type { AppSettings, DateFormat } from '../hooks/useSettings';
import type { ProcessingMode } from '../types';
import type { ToastApi } from '../hooks/useToast';

type Props = {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  onBack: () => void;
  toasts: ToastApi;
};

const MODES: { value: ProcessingMode; label: string }[] = [
  { value: 'auto', label: 'تلقائي' },
  { value: 'local-ai', label: 'ذكاء اصطناعي محلي' },
  { value: 'rules-only', label: 'تحليل سريع' },
];

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'dmy', label: 'يوم/شهر/سنة', example: '01/09/2026 = 1 سبتمبر' },
  { value: 'mdy', label: 'شهر/يوم/سنة', example: '01/09/2026 = 9 يناير' },
];

export function SettingsPage({ settings, update, reset, onBack, toasts }: Props) {
  const compat = getDeviceCompatibility();
  const browser = detectBrowser();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteModel, setConfirmDeleteModel] = useState(false);
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);

  const handleDeleteModel = async () => {
    await unloadModel();
    setConfirmDeleteModel(false);
    toasts.success('تم حذف النموذج المحلي');
  };

  const handleDeleteData = async () => {
    await deleteAllAnalyses();
    setConfirmDeleteData(false);
    toasts.success('تم حذف جميع النتائج المحفوظة');
  };

  const handleReset = () => {
    reset();
    setConfirmReset(false);
    toasts.success('تمت إعادة ضبط التطبيق');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">الإعدادات</h2>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="arrow-right" size={16} /> رجوع
        </Button>
      </div>

      <div className="space-y-4">
        <Card title="البيانات">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            اسم المستخدم في المحادثات
          </label>
          <input
            type="text"
            value={settings.userName}
            onChange={(e) => update({ userName: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </Card>

        <Card title="التحليل">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            وضع التحليل
          </label>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => update({ processingMode: m.value })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  settings.processingMode === m.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => update({ autoSave: e.target.checked })}
              className="h-5 w-5"
            />
            حفظ النتائج تلقائيًا بعد كل تحليل
          </label>
        </Card>

        <Card title="صيغة التاريخ">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            واتساب يصدّر التواريخ بصيغة تعتمد على لغة جهازك. اختر الصيغة الصحيحة لتفسير التواريخ بدقة.
          </p>
          <div className="flex gap-2">
            {DATE_FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => update({ dateFormat: f.value })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  settings.dateFormat === f.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            مثال: {DATE_FORMATS.find((f) => f.value === settings.dateFormat)?.example}
          </p>
        </Card>

        <Card title="المظهر">
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  settings.theme === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {t === 'light' ? 'فاتح' : 'داكن'}
              </button>
            ))}
          </div>
        </Card>

        <Card title="النموذج والجهاز">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            اختيار النموذج
          </label>
          <div className="mb-3 space-y-2">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.modelId}
                onClick={() => update({ modelId: m.modelId })}
                className={`w-full rounded-lg p-3 text-right text-sm transition-colors ${
                  settings.modelId === m.modelId
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-xs opacity-80">{m.estimatedSizeMB} ميجابايت</span>
                </div>
                <p className={`mt-1 text-xs ${settings.modelId === m.modelId ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'}`}>
                  {m.description}
                </p>
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            ملاحظة: تغيير النموذج يتطلب إعادة تحميله. سيُحذف النموذج الحالي عند التغيير.
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">المتصفح:</dt>
              <dd className="font-medium">{browser.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">WebGPU:</dt>
              <dd className="flex items-center gap-1">
                {compat.webgpu ? (
                  <>
                    <span>متوفر</span>
                    <Icon name="check" size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </>
                ) : (
                  <>
                    <span>غير متوفر</span>
                    <Icon name="x" size={16} className="text-red-600 dark:text-red-400" />
                  </>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الذاكرة التقريبية:</dt>
              <dd>{compat.estimatedMemoryMB ? `${compat.estimatedMemoryMB} ميجابايت` : 'غير معروف'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">حالة الجهاز:</dt>
              <dd>{compat.label}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">النموذج محمّل:</dt>
              <dd>{isModelLoaded() ? 'نعم' : 'لا'}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteModel(true)} disabled={!isModelLoaded()}>
              حذف النموذج المحلي
            </Button>
          </div>
        </Card>

        <Card title="إدارة البيانات">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteData(true)}>
              حذف النتائج المحفوظة
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              إعادة ضبط التطبيق
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmReset}
        title="إعادة ضبط التطبيق؟"
        danger
        confirmLabel="إعادة الضبط"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      >
        سيتم حذف الإعدادات وإعادة التطبيق لحالته الافتراضية. لن يتم حذف النتائج المحفوظة أو النموذج.
      </Modal>
      <Modal
        open={confirmDeleteModel}
        title="حذف النموذج؟"
        danger
        confirmLabel="حذف"
        onConfirm={() => void handleDeleteModel()}
        onCancel={() => setConfirmDeleteModel(false)}
      >
        سيتم إلغاء تحميل النموذج من الذاكرة. ستحتاج لإعادة تحميله عند التحليل الذكي التالي.
      </Modal>
      <Modal
        open={confirmDeleteData}
        title="حذف كل النتائج؟"
        danger
        confirmLabel="حذف"
        onConfirm={() => void handleDeleteData()}
        onCancel={() => setConfirmDeleteData(false)}
      >
        سيتم حذف جميع التحليلات المحفوظة نهائيًا.
      </Modal>
    </div>
  );
}
