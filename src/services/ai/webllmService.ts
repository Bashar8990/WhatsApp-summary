import { getModelConfig } from '../../config/model';
import type { AnalysisResult, ModelLoadProgress, WhatsAppMessage } from '../../types';
import { analyzeWithRules } from '../analysis/rulesAnalysis';
import {
  mergeAnalysisResults,
  splitConversationIntoChunksByTokens,
  chunkToText,
  estimateTokens,
} from '../analysis/chunking';
import { parseAndValidateAnalysis } from '../analysis/jsonValidation';

type ProgressCallback = (p: ModelLoadProgress) => void;

// نوع WebLLM Engine (محمل ديناميكيًا)
type ChatMessage = { role: string; content: string };

// يعكس واجهة ChatCompletion في @mlc-ai/web-llm
interface ChatCompletionChoice {
  message: { content: string | null; role: string };
  finish_reason: string;
}
interface ChatCompletion {
  choices: ChatCompletionChoice[];
}
interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean | null;
}

interface WebLLMEngine {
  chat: {
    completions: {
      create: (request: ChatCompletionRequest) => Promise<ChatCompletion>;
    };
  };
  resetChat: () => Promise<void>;
  unload: () => Promise<void>;
}

/**
 * دالة مساعدة تُجري طلب chat completion وترجع نص الرد فقط.
 * تمرّر temperature و max_tokens من إعدادات النموذج المحمّل حاليًا.
 */
async function chatCompletion(
  engine: WebLLMEngine,
  messages: ChatMessage[],
): Promise<string> {
  const cfg = getModelConfig(loadedModelId ?? undefined);
  const response = await engine.chat.completions.create({
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    stream: false,
  });
  return response.choices[0]?.message?.content ?? '';
}

let enginePromise: Promise<WebLLMEngine> | null = null;
let currentEngine: WebLLMEngine | null = null;
// مرجع للمحرك أثناء التحميل (قبل أن يُسنَد إلى currentEngine)
// يُستخدم لإلغاء تحميل النموذج أثناء التحميل دون الاعتماد على TDZ.
let loadingEngine: WebLLMEngine | null = null;
// معرّف النموذج المحمّل حاليًا (لمقارنته عند طلب تحميل نموذج مختلف)
let loadedModelId: string | null = null;

async function loadWebLLM(): Promise<typeof import('@mlc-ai/web-llm')> {
  return await import('@mlc-ai/web-llm');
}

export async function loadModel(
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  modelId?: string,
): Promise<WebLLMEngine> {
  const cfg = getModelConfig(modelId);
  // إن كان النموذج المطلوب مختلفًا عن المحمّل، ألغِ تحميل الحالي أولًا
  if (currentEngine && loadedModelId !== cfg.modelId) {
    await unloadModel();
  }
  if (currentEngine && loadedModelId === cfg.modelId) return currentEngine;
  if (enginePromise && loadedModelId === cfg.modelId) return enginePromise;

  enginePromise = (async () => {
    const webllm = await loadWebLLM();
    // نُنشئ MLCEngine مباشرةً (فوري، لا يحمّل نموذجًا بعد) ليتاح إلغاؤه أثناء التحميل.
    // CreateMLCEngine يُرجِع Promise<MLCEngine> فلا يمكن الوصول للمحرك قبل اكتمال التحميل،
    // بينما new MLCEngine() يُرجِع المحرك فورًا ويمكن استدعاء unload() عليه أثناء reload().
    const engine = new webllm.MLCEngine({
      initProgressCallback: (info) => {
        if (signal?.aborted) {
          // إلغاء تحميل المحرك أثناء التحميل (engine متاح فورًا)
          void engine.unload().catch(() => {});
          throw new DOMException('تم إلغاء تحميل النموذج', 'AbortError');
        }
        onProgress({
          progress: Math.round((info.progress ?? 0) * 100),
          stage: info.text || 'جاري التحميل...',
          loadedMB: null,
          totalMB: cfg.estimatedSizeMB,
        });
      },
    });
    // نُسنِد المرجع فورًا (قبل reload) ليتاح إلغاؤه عبر unloadModel أثناء التحميل
    loadingEngine = engine as unknown as WebLLMEngine;
    // تحميل النموذج فعليًا
    await engine.reload(cfg.modelId);
    currentEngine = engine as unknown as WebLLMEngine;
    loadedModelId = cfg.modelId;
    loadingEngine = null;
    return currentEngine;
  })();

  try {
    return await enginePromise;
  } catch (err) {
    enginePromise = null;
    currentEngine = null;
    loadingEngine = null;
    throw err;
  }
}

export function isModelLoaded(): boolean {
  return currentEngine !== null;
}

export async function unloadModel(): Promise<void> {
  // إن كان التحميل جاريًا، ألغِ المحرك قيد التحميل أيضًا
  const toUnload = currentEngine ?? loadingEngine;
  if (toUnload) {
    try {
      await toUnload.unload();
    } catch {
      /* ignore */
    }
  }
  currentEngine = null;
  loadingEngine = null;
  loadedModelId = null;
  // إن كان هناك تحميل جارٍ، ارفض الـ promise ليُلتقط في catch
  if (enginePromise) {
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
  const response = await chatCompletion(engine, [
    { role: 'system', content: 'أنت مساعد متخصص في تحليل محادثات واتساب. تُرجع JSON فقط.' },
    { role: 'user', content: prompt },
  ]);
  let parsed = parseAndValidateAnalysis(response);
  if (!parsed) {
    // إعادة محاولة واحدة بصيغة أكثر صرامة
    await engine.resetChat();
    const retry = await chatCompletion(engine, [
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
  // حساب ميزانية الـ tokens المتاحة لنص المحادثة:
  //   contextWindow − maxTokens (الرد) − promptOverhead (التعليمات + system message)
  const cfg = getModelConfig(loadedModelId ?? undefined);
  const promptOverhead = estimateTokens(buildPrompt('', currentUserName, summaryLength)) +
    estimateTokens('أنت مساعد متخصص في تحليل محادثات واتساب. تُرجع JSON فقط.');
  const tokenBudget = Math.max(
    256, // حد أدنى معقول لتفاديDivision بحجم 0
    cfg.contextWindow - cfg.maxTokens - promptOverhead,
  );
  const chunks = splitConversationIntoChunksByTokens(messages, tokenBudget);
  const results: AnalysisResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new DOMException('تم إلغاء التحليل', 'AbortError');
    // التقدم يمثل نسبة الأجزاء المكتملة قبل هذا الجزء، حتى لا يبلغ 100% قبل الانتهاء
    onProgress({
      progress: Math.round((i / chunks.length) * 100),
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
  // اكتملت معالجة جميع الأجزاء
  onProgress({ progress: 100, stage: 'دمج النتائج...' });

  if (results.length === 0) {
    const fallback = analyzeWithRules(messages, currentUserName);
    fallback.warnings.push('تعذّر تحليل النموذج للنتيجة، تم استخدام التحليل البرمجي.');
    return fallback;
  }

  const merged = mergeAnalysisResults(results);
  merged.processingMode = 'local-ai';

  // دمج الملخصات الجزئية في ملخص موحّد متماسك عبر النموذج
  // (mergeAnalysisResults تربطها بـ join فقط — غير متماسكة لأجزاء كثيرة)
  if (results.length > 1) {
    const partialSummaries = results
      .map((r) => r.summary)
      .filter((s) => s.trim().length > 0);
    if (partialSummaries.length > 1) {
      try {
        const unified = await mergeSummariesWithModel(
          engine,
          partialSummaries,
          currentUserName,
          summaryLength,
          signal,
        );
        if (unified && unified.trim().length > 0) {
          merged.summary = unified;
        }
      } catch (err) {
        // عند الإلغاء ارفع الخطأ، وإلا احتفظ بملخص mergeAnalysisResults (join)
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        // تجاهل — نحتفظ بالملخص المربوط كاحتياط
      }
    }
  }

  if (merged.summary.trim().length === 0) {
    merged.summary = analyzeWithRules(messages, currentUserName).summary;
  }
  return merged;
}

/**
 * يدمج ملخصات جزئية متعددة في ملخص موحّد متماسك عبر النموذج.
 * يحافظ على التسلسل الزمني والنقاط الرئيسية دون تكرار.
 * عند الفشل يرمي خطأً ليُلتقط من المُستدعي.
 */
async function mergeSummariesWithModel(
  engine: WebLLMEngine,
  partialSummaries: string[],
  currentUserName: string,
  summaryLength: 'short' | 'medium' | 'detailed',
  signal?: AbortSignal,
): Promise<string> {
  const lengthLabel =
    summaryLength === 'short' ? 'قصير' : summaryLength === 'detailed' ? 'مفصل' : 'متوسط';
  const combined = partialSummaries.map((s, i) => `الجزء ${i + 1}:\n${s}`).join('\n\n');
  const prompt = `فيما يلي ملخصات لأجزاء متتالية من محادثة واتساب واحدة. اكتب ملخصًا موحّدًا واحدًا (${lengthLabel}) يجمعها دون تكرار، مع الحفاظ على التسلسل الزمني والنقاط الرئيسية. أعد النص فقط بدون JSON.\n\nالمستخدم: ${currentUserName}\n\nالملخصات الجزئية:\n${combined}`;
  if (signal?.aborted) throw new DOMException('تم إلغاء التحليل', 'AbortError');
  await engine.resetChat();
  return await chatCompletion(engine, [
    { role: 'system', content: 'أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.' },
    { role: 'user', content: prompt },
  ]);
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
  const lengthLabel =
    summaryLength === 'short' ? 'قصير جدًا' : summaryLength === 'detailed' ? 'مفصل' : 'متوسط';
  // ميزانية الـ tokens لإعادة التوليد (prompt أبسط من التحليل الكامل)
  const cfg = getModelConfig(loadedModelId ?? undefined);
  const regenPromptOverhead = estimateTokens(
    `أعد كتابة ملخص المحادثة التالية (${lengthLabel}). أعد النص فقط بدون JSON.\n\nالمستخدم: ${currentUserName}\n\nالمحادثة:\n`,
  ) + estimateTokens('أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.');
  const tokenBudget = Math.max(
    256,
    cfg.contextWindow - cfg.maxTokens - regenPromptOverhead,
  );
  const chunks = splitConversationIntoChunksByTokens(messages, tokenBudget);

  // محادثة قصيرة: ملخص مباشر من النص كاملًا
  if (chunks.length === 1) {
    const text = chunkToText(chunks[0]);
    const prompt = `أعد كتابة ملخص المحادثة التالية (${lengthLabel}). أعد النص فقط بدون JSON.\n\nالمستخدم: ${currentUserName}\n\nالمحادثة:\n${text}`;
    await engine.resetChat();
    return await chatCompletion(engine, [
      { role: 'system', content: 'أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.' },
      { role: 'user', content: prompt },
    ]);
  }

  // محادثة طويلة: ولّد ملخصًا لكل جزء، ثم ادمجها في ملخص نهائي موحّد
  const partialSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunkToText(chunks[i]);
    const prompt = `اكتب ملخصًا موجزًا للجزء ${i + 1} من ${chunks.length} من المحادثة التالية. أعد النص فقط بدون JSON.\n\nالمستخدم: ${currentUserName}\n\nالمحادثة:\n${chunkText}`;
    await engine.resetChat();
    const partial = await chatCompletion(engine, [
      { role: 'system', content: 'أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.' },
      { role: 'user', content: prompt },
    ]);
    if (partial && partial.trim().length > 0) {
      partialSummaries.push(partial.trim());
    }
  }

  // دمج الملخصات الجزئية في ملخص نهائي بالطول المطلوب
  if (partialSummaries.length === 0) {
    return analyzeWithRules(messages, currentUserName).summary;
  }
  const combined = partialSummaries.join('\n—\n');
  const mergePrompt = `فيما يلي ملخصات لأجزاء متتالية من محادثة واتساب واحدة. اكتب ملخصًا موحّدًا واحدًا (${lengthLabel}) يجمعها دون تكرار، مع الحفاظ على التسلسل الزمني والنقاط الرئيسية. أعد النص فقط.\n\nالمستخدم: ${currentUserName}\n\nالملخصات الجزئية:\n${combined}`;
  await engine.resetChat();
  return await chatCompletion(engine, [
    { role: 'system', content: 'أنت مساعد يكتب ملخصات محادثات واتساب بالعربية.' },
    { role: 'user', content: mergePrompt },
  ]);
}
