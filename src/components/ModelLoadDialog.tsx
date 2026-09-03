import { useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { getModelConfig } from '../config/model';
import { loadModel } from '../services/ai/webllmService';
import type { ModelLoadProgress } from '../types';
import type { ToastApi } from '../hooks/useToast';

type Props = {
  open: boolean;
  onClose: () => void;
  onLoaded: () => void;
  onUseFast: () => void;
  toasts: ToastApi;
  modelId?: string;
};

export function ModelLoadDialog({ open, onClose, onLoaded, onUseFast, toasts, modelId }: Props) {
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cfg = getModelConfig(modelId);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setProgress({ progress: 0, stage: 'بدء التحميل...', loadedMB: 0, totalMB: cfg.estimatedSizeMB });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await loadModel(setProgress, controller.signal, modelId);
      toasts.success('تم تحميل النموذج بنجاح');
      onLoaded();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toasts.info('تم إلغاء تحميل النموذج');
      } else {
        const msg = err instanceof Error ? err.message : 'تعذّر تحميل النموذج';
        setError(`تعذّر تحميل النموذج: ${msg}. تحقق من اتصال الإنترنت والمساحة المتوفرة.`);
        toasts.error('تعذّر تحميل النموذج');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <Modal
      open={open}
      title="تحميل نموذج الذكاء الاصطناعي"
      confirmLabel={loading ? 'جاري التحميل...' : 'تحميل النموذج'}
      cancelLabel="إغلاق"
      onConfirm={() => void handleLoad()}
      onCancel={onClose}
    >
      <div className="space-y-3 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-slate-500">النموذج:</dt>
            <dd className="font-medium">{cfg.displayName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">الحجم التقريبي:</dt>
            <dd>{cfg.estimatedSizeMB} ميجابايت</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500 dark:text-slate-400">{cfg.description}</p>
        <ul className="list-disc space-y-1 pr-5 text-slate-600 dark:text-slate-300">
          <li>التحميل يحدث مرة واحدة غالبًا ويُخزّن داخل المتصفح.</li>
          <li>المحادثة لن تُرسل إلى الإنترنت.</li>
          <li>قد يستغرق التحميل بعض الوقت حسب سرعة الإنترنت.</li>
        </ul>

        {progress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs">
              <span>{progress.stage}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            {loading && (
              <div className="mt-2 text-left">
                <Button variant="ghost" size="sm" onClick={handleCancel}>إلغاء التحميل</Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <Button variant="ghost" size="sm" onClick={onUseFast} disabled={loading}>
            استخدام الوضع السريع بدلًا من ذلك
          </Button>
        </div>
      </div>
    </Modal>
  );
}
