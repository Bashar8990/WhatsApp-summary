import { MODEL_CONFIG } from '../../config/model';
import type { AnalysisResult, ModelLoadProgress, WhatsAppMessage } from '../../types';
import { analyzeWithRules } from '../analysis/rulesAnalysis';
import {
  mergeAnalysisResults,
  splitConversationIntoChunks,
  chunkToText,
} from '../analysis/chunking';
import { parseAndValidateAnalysis } from '../analysis/jsonValidation';

type ProgressCallback = (p: ModelLoadProgress) => void;

// نوع WebLLM Engine (محمل ديناميكيًا)
type ChatMessage = { role: string; content: string };

interface WebLLMEngine {
  chat: (messages: ChatMessage[]) => Promise<string>;
  resetChat: () => Promise<void>;
  unload: () => Promise<void>;
}

let enginePromise: Promise<WebLLMEngine> | null = null;
let currentEngine: WebLLMEngine | null = null;

async function loadWebLLM(): Promise<typeof import('@mlc-ai/web-llm')> {
  return await import('@mlc-ai/web-llm');
}

export async function loadModel(
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<WebLLMEngine> {
  if (currentEngine) return currentEngine;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    const webllm = await loadWebLLM();
    const engine = await webllm.CreateMLCEngine(MODEL_CONFIG.modelId, {
      initProgressCallback: (info) => {
        if (signal?.aborted) {
          void engine.unload();
          throw new DOMException('تم إلغاء تحميل النموذج', 'AbortError');
        }
        onProgress({
          progress: Math.round((info.progress ?? 0) * 100),
          stage: info.text || 'جاري التحميل...',
          loadedMB: null,
          totalMB: MODEL_CONFIG.estimatedSizeMB,
        });
      },
    });
    currentEngine = engine as unknown as WebLLMEngine;
    return currentEngine;
  })();

  try {
    return await enginePromise;
  } catch (err) {
    enginePromise = null;
    currentEngine = null;
    throw err;
  }
}

export function isModelLoaded(): boolean {
  return currentEngine !== null;
}

export async function unloadModel(): Promise<void> {
  if (currentEngine) {
    try {
      await currentEngine.unload();
    } catch {
      /* ignore */
    }
    currentEngine = null;
    enginePromise = null;
  }
}

function buildPrompt(
  conversationText: string,
  currentUserName: string,
  summaryLength: 'short' | 'medium' | 'detailed' = 'medium',
): string {
  const lengthHint =
    summaryLength === 'short'
      ? 'ملخص قصير جدًا في 2-3 أسطر'
      : summaryLength === 'detailed'
        ? 'ملخص مفصل يغطي النقاط الرئيسية'
        : 'ملخص متوسط الحجم';

  return `أنت نظام متخصص في تحليل محادثات واتساب العربية.

حلل المحادثة دون اختراع أي معلومات غير موجودة.

المستخدم الحالي اسمه:
${currentUserName || 'غير محدد'}

استخرج:

1. ملخصًا موجزًا للمحادثة (${lengthHint}).
2. المهام المطلوبة من المستخدم الحالي فقط.
3. جميع المهام العامة المذكورة.
4. المواعيد والتواريخ.
5. القرارات النهائية.
6. الأشخاص وأدوارهم أو مسؤولياتهم.

قواعد مهمة:

- لا تعتبر الاقتراح قرارًا نهائيًا.
- لا تعتبر السؤال تكليفًا مؤكدًا.
- لا تختلق موعدًا غير موجود.
- احتفظ بصيغة الموعد الأصلية.
- ميّز بين المعلومة المؤكدة والمحتملة.
- إذا لم توجد نتيجة لقسم معين، أعد مصفوفة فارغة.
- لا تضف أي شرح خارج JSON.
- لا تستخدم Markdown.
- أعد JSON صالحًا فقط بالبنية التالية:

{
  "summary": "نص الملخص",
  "tasksForMe": [{"task":"...","assignedTo":"...","isForCurrentUser":true,"deadlineOriginal":null,"sourceMessage":"...","confidence":"high"}],
  "allTasks": [{"task":"...","assignedTo":"...","isForCurrentUser":false,"deadlineOriginal":null,"sourceMessage":"...","confidence":"medium"}],
  "dates": [{"event":"...","originalDate":"...","relatedPerson":"...","sourceMessage":"...","confidence":"medium"}],
  "decisions": [{"decision":"...","madeBy":"...","sourceMessage":"...","confidence":"high"}],
  "people": [{"name":"...","role":"...","responsibilities":["..."],"messageCount":0}],
  "warnings": []
}

المحادثة:
${conversationText}`;
}

const STRICT_RETRY_PROMPT_PREFIX = `تعليمات إضافية صارمة: أعد JSON صالحًا فقط بدون أي نص قبله أو بعده، بدون markdown، بدون شرح. البنية المطلوبة بالضبط كما في الطلب السابق.\n\n`;

async function analyzeChunkWithModel(
  engine: WebLLMEngine,
  chunkText: string,
  currentUserName: string,
  summaryLength: 'short' | 'medium' | 'detailed',
): Promise<AnalysisResult | null> {
  const prompt = buildPrompt(chunkText, currentUserName, summaryLength);
  await engine.resetChat();
  const response = await engine.chat([
    { role: 'system', content: 'أنت مساعد متخصص في تحليل محادثات واتساب. تُرجع JSON فقط.' },
    { role: 'user', content: prompt },
  ]);
  let parsed = parseAndValidateAnalysis(response);
  if (!parsed) {
    // إعادة محاولة واحدة بصيغة أكثر صرامة
    await engine.resetChat();
    const retry = await engine.chat([
      { role: 'system', content: 'أنت مساعد متخصص. تُرجع JSON صالحًا فقط.' },
      { role: 'user', content: STRICT_RETRY_PROMPT_PREFIX + prompt },
    ]);
    parsed = parseAndValidateAnalysis(retry);
  }
  return parsed;
}

export type AnalyzeProgress = {
  progress: number;
  stage: string;
};

export async function analyzeWithAI(
  messages: WhatsAppMessage[],
  currentUserName: string,
  onProgress: (p: AnalyzeProgress) => void,
  summaryLength: 'short' | 'medium' | 'detailed' = 'medium',
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const engine = currentEngine ?? (await loadModel(() => {}, signal));
  const chunks = splitConversationIntoChunks(messages);
  const results: AnalysisResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new DOMException('تم إلغاء التحليل', 'AbortError');
    onProgress({
      progress: Math.round(((i + 1) / chunks.length) * 100),
      stage: `تحليل الجزء ${i + 1} من ${chunks.length}...`,
    });
    const chunkText = chunkToText(chunks[i]);
    const result = await analyzeChunkWithModel(engine, chunkText, currentUserName, summaryLength);
    if (result) {
      results.push(result);
    } else {
      // استخدام التحليل البرمجي لهذا الجزء كاحتياط
      results.push(analyzeWithRules(chunks[i], currentUserName));
    }
  }

  if (results.length === 0) {
    const fallback = analyzeWithRules(messages, currentUserName);
    fallback.warnings.push('تعذّر تحليل النموذج للنتيجة، تم استخدام التحليل البرمجي.');
    return fallback;
  }

  const merged = mergeAnalysisResults(results);
  merged.processingMode = 'local-ai';
  if (merged.summary.trim().length === 0) {
    merged.summary = analyzeWithRules(messages, currentUserName).summary;
  }
  return merged;
}

export async function regenerateSummary(
  messages: WhatsAppMessage[],
  currentUserName: string,
  summaryLength: 'short' | 'medium' | 'detailed',
): Promise<string> {
  if (!currentEngine) {
    return analyzeWithRules(messages, currentUserName).summary;
  }
  const engine = currentEngine;
  const text = chunkToText(messages.slice(0, 80));
  const prompt = `أعد كتابة ملخص المحادثة التالية (${summaryLength === 'short' ? 'قصير جدًا' : summaryLength === 'detailed' ? 'مفصل' : 'متوسط'}). أعد النص فقط بدون JSON.\n\nالمستخدم: ${currentUserName}\n\nالمحادثة:\n${text}`;
  await engine.resetChat();
  return await engine.chat([
    { role: 'system', content: 'أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.' },
    { role: 'user', content: prompt },
  ]);
}
