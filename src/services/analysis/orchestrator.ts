import type { AnalysisResult, ProcessingMode, WhatsAppMessage } from '../../types';
import { analyzeWithRules } from './rulesAnalysis';
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
      // احتياط للتحليل البرمجي
      const fallback = analyzeWithRules(messages, currentUserName);
      fallback.warnings.push(
        'تعذّر تشغيل التحليل الذكي، تم استخدام التحليل البرمجي السريع بدلًا من ذلك.',
      );
      return fallback;
    }
  }

  onProgress({ progress: 100, stage: 'تحليل برمجي سريع...' });
  return analyzeWithRules(messages, currentUserName);
}
