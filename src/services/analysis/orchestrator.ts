import type { AnalysisResult, ProcessingMode, WhatsAppMessage } from '../../types';
import { analyzeWithRulesAsync } from './rulesWorkerClient';
import { analyzeWithAI, isModelLoaded, type AnalyzeProgress } from '../ai/webllmService';
import { getDeviceCompatibility } from '../ai/deviceCheck';

export type OrchestrateOptions = {
  messages: WhatsAppMessage[];
  currentUserName: string;
  mode: ProcessingMode;
  summaryLength: 'short' | 'medium' | 'detailed';
  onProgress: (p: AnalyzeProgress) => void;
  signal?: AbortSignal;
};

export async function orchestrateAnalysis(opts: OrchestrateOptions): Promise<AnalysisResult> {
  const { messages, currentUserName, mode, summaryLength, onProgress, signal } = opts;
  const compat = getDeviceCompatibility();

  const wantAI = mode === 'local-ai' || (mode === 'auto' && compat.webgpu);
  const canAI = compat.webgpu || isModelLoaded();

  if (wantAI && canAI) {
    try {
      return await analyzeWithAI(messages, currentUserName, onProgress, summaryLength, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // احتياط للتحليل البرمجي (في worker للمحادثات الكبيرة)
      onProgress({ progress: 90, stage: 'تحليل برمجي سريع (احتياطي)...' });
      const fallback = await analyzeWithRulesAsync(messages, currentUserName, signal);
      fallback.warnings.push(
        'تعذّر تشغيل التحليل الذكي، تم استخدام التحليل البرمجي السريع بدلًا من ذلك.',
      );
      onProgress({ progress: 100, stage: 'اكتمل' });
      return fallback;
    }
  }

  // المسار البرمجي الرئيسي — في worker للمحادثات الكبيرة لتفادي تجميد الواجهة
  onProgress({ progress: 50, stage: 'تحليل برمجي سريع...' });
  const result = await analyzeWithRulesAsync(messages, currentUserName, signal);
  onProgress({ progress: 100, stage: 'اكتمل' });
  return result;
}
