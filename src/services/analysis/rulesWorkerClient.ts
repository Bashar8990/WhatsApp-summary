import type { AnalysisResult, WhatsAppMessage } from '../../types';
import { analyzeWithRules } from '../analysis/rulesAnalysis';

/**
 * يشغّل التحليل البرمجي في Web Worker لتفادي تجميد الواجهة على المحادثات الكبيرة.
 *
 * - للمحادثات الصغيرة (أقل من WORKER_THRESHOLD رسالة) يُنفّذ على main thread مباشرةً
 *   (تجنّب overhead إنشاء worker لمهمة سريعة).
 * - للمحادثات الكبيرة يُنشئ worker، يُرسل الرسائل، وينتظر النتيجة.
 * - يدعم AbortSignal: عند الإلغاء يُنهي الـ worker فورًا.
 * - fallback: عند فشل إنشاء worker (مثلًا في بيئة اختبار jsdom أو متصفح قديم)
 *   يُنفّذ التحليل على main thread تلقائيًا.
 */

/** الحد الأدنى لعدد الرسائل لتفعيل worker (أقل من هذا يعمل على main thread) */
export const WORKER_THRESHOLD = 200;

export async function analyzeWithRulesAsync(
  messages: WhatsAppMessage[],
  currentUserName: string,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  // المحادثات الصغيرة: main thread مباشرةً (overhead worker غير مبرّر)
  if (messages.length < WORKER_THRESHOLD) {
    return analyzeWithRules(messages, currentUserName);
  }

  // المحادثات الكبيرة: جرّب worker مع fallback
  try {
    return await runInWorker(messages, currentUserName, signal);
  } catch (err) {
    // عند الإلغاء، ارفع الخطأ بدل fallback
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // عند فشل worker (بيئة بلا دعم، أو خطأ)، ارجع للـ main thread
    return analyzeWithRules(messages, currentUserName);
  }
}

function runInWorker(
  messages: WhatsAppMessage[],
  currentUserName: string,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException('تم إلغاء التحليل', 'AbortError'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    try {
      // Vite يدعم استيراد worker عبر ?worker&query
      worker = new Worker(new URL('../../workers/rulesWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (err) {
      // فشل إنشاء worker — ارفع الخطأ ليُلتقط في fallback
      reject(err);
      return;
    }

    worker.onmessage = (e: MessageEvent<{ result: AnalysisResult }>) => {
      cleanup();
      resolve(e.data.result);
    };

    worker.onerror = (e) => {
      cleanup();
      reject(new Error(`Worker error: ${e.message}`));
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    // إرسال البيانات (structured clone — لا يحتاج نقل)
    worker.postMessage({ messages, currentUserName });
  });
}
