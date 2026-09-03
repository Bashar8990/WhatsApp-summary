import type { AnalysisResult, WhatsAppMessage } from '../../types';

/**
 * يقسّم المحادثة إلى أجزاء حسب عدد الرسائل (وليس الأحرف فقط)،
 * مع الحفاظ على ترتيب الرسائل وعدم قطع رسالة في منتصفها،
 * وإضافة تداخل بسيط بين الأجزاء.
 */
export function splitConversationIntoChunks(
  messages: WhatsAppMessage[],
  maxMessagesPerChunk = 60,
  overlap = 4,
): WhatsAppMessage[][] {
  if (messages.length <= maxMessagesPerChunk) {
    return [messages];
  }
  const chunks: WhatsAppMessage[][] = [];
  let start = 0;
  while (start < messages.length) {
    const end = Math.min(start + maxMessagesPerChunk, messages.length);
    chunks.push(messages.slice(start, end));
    if (end >= messages.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

/**
 * تقدير محافظ لعدد الـ tokens في نص.
 * للعربية، كل token يقابل ~2-3 حرف تقريبًا (أكثر من الإنجليزية).
 * نستخدم chars/2.5 كتقدير محافظ للنصوص العربية المختلطة.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/**
 * يحسب تقدير الـ tokens لرسالة واحدة بصيغة chunkToText.
 */
function estimateMessageTokens(m: WhatsAppMessage): number {
  const date = m.rawDate ?? '';
  const sender = m.sender ?? 'النظام';
  // "${date} - ${sender}: ${content}\n"
  return estimateTokens(`${date} - ${sender}: ${m.content}\n`);
}

/**
 * يقسّم المحادثة إلى أجزاء بحسب ميزانية الـ tokens (لا عدد الرسائل)،
 * مع احترام نافذة سياق النموذج، والحفاظ على ترتيب الرسائل،
 * وإضافة تداخل بسيط بين الأجزاء (بالرسائل لا بالـ tokens).
 *
 * @param maxTokensForChunks ميزانية الـ tokens المتاحة لنص المحادثة فقط
 *   (نافذة السياق ناقص الـ response tokens ناقص prompt overhead).
 * @param overlapMessages عدد الرسائل المتداخلة بين الأجزاء.
 * @param maxMessagesPerChunk حد أقصى لعدد الرسائل في الجزء (احتياط).
 */
export function splitConversationIntoChunksByTokens(
  messages: WhatsAppMessage[],
  maxTokensForChunks: number,
  overlapMessages = 4,
  maxMessagesPerChunk = 200,
): WhatsAppMessage[][] {
  if (messages.length === 0) return [[]];

  // إن كانت المحادثة كاملة تناسب الميزانية وعدد الرسائل، أعدها كجزء واحد
  const totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  if (totalTokens <= maxTokensForChunks && messages.length <= maxMessagesPerChunk) {
    return [messages];
  }

  const chunks: WhatsAppMessage[][] = [];
  let start = 0;
  while (start < messages.length) {
    let tokenBudget = maxTokensForChunks;
    let end = start;
    let count = 0;
    // احزم رسائل ضمن الميزانية وحد الرسائل
    while (end < messages.length && count < maxMessagesPerChunk) {
      const t = estimateMessageTokens(messages[end]);
      if (tokenBudget - t < 0 && end > start) break; // لا تضف رسالة تتجاوز الميزانية (وأبقِ جزءًا واحدًا على الأقل)
      tokenBudget -= t;
      end++;
      count++;
    }
    // ضمان تقدّم: إن لم نتمكن من إضافة رسالة واحدة (رسالة أطول من الميزانية)، أضفها وحدها
    if (end === start) {
      end = start + 1;
    }
    chunks.push(messages.slice(start, end));
    if (end >= messages.length) break;
    // تداخل بالرسائل (لا يتجاوز بداية الجزء الحالي)
    start = Math.max(end - overlapMessages, start + 1);
  }
  return chunks;
}

/**
 * يحوّل جزء من الرسائل إلى نص قابل للإرسال للنموذج.
 */
export function chunkToText(messages: WhatsAppMessage[]): string {
  return messages
    .map((m) => {
      const date = m.rawDate ?? '';
      const sender = m.sender ?? 'النظام';
      return `${date} - ${sender}: ${m.content}`;
    })
    .join('\n');
}

function dedupeBySimilarity<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen: string[] = [];
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase().slice(0, 120);
    if (key.length === 0) {
      result.push(item);
      continue;
    }
    const isDup = seen.some((s) => s === key || (s.length > 20 && (s.includes(key) || key.includes(s))));
    if (!isDup) {
      seen.push(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * يدمج نتائج عدة أجزاء في نتيجة واحدة، مع إزالة التكرار.
 */
export function mergeAnalysisResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 0) {
    return {
      summary: '',
      tasksForMe: [],
      allTasks: [],
      dates: [],
      decisions: [],
      people: [],
      warnings: [],
      processingMode: 'local-ai',
    };
  }
  if (results.length === 1) return results[0];

  const summaries = results.map((r) => r.summary).filter((s) => s.trim().length > 0);
  const summary = summaries.join(' \n—\n ');

  const allTasks = dedupeBySimilarity(
    results.flatMap((r) => r.allTasks),
    (t) => t.task,
  );
  const tasksForMe = dedupeBySimilarity(
    results.flatMap((r) => r.tasksForMe),
    (t) => t.task,
  );
  const dates = dedupeBySimilarity(
    results.flatMap((r) => r.dates),
    (d) => d.event,
  );
  const decisions = dedupeBySimilarity(
    results.flatMap((r) => r.decisions),
    (d) => d.decision,
  );

  // دمج الأشخاص مع تجميع عدد الرسائل
  const peopleMap = new Map<string, { name: string; count: number; roles: Set<string>; resp: Set<string> }>();
  for (const r of results) {
    for (const p of r.people) {
      const key = p.name.trim().toLowerCase();
      const existing = peopleMap.get(key);
      if (existing) {
        existing.count += p.messageCount ?? 0;
        if (p.role) existing.roles.add(p.role);
        for (const resp of p.responsibilities) existing.resp.add(resp);
      } else {
        peopleMap.set(key, {
          name: p.name,
          count: p.messageCount ?? 0,
          roles: p.role ? new Set([p.role]) : new Set(),
          resp: new Set(p.responsibilities),
        });
      }
    }
  }
  const people = Array.from(peopleMap.values()).map((p) => ({
    id: `person_${Math.random().toString(36).slice(2, 9)}`,
    name: p.name,
    role: Array.from(p.roles).join('، ') || null,
    responsibilities: Array.from(p.resp),
    messageCount: p.count,
  }));
  people.sort((a, b) => (b.messageCount ?? 0) - (a.messageCount ?? 0));

  const warnings = Array.from(new Set(results.flatMap((r) => r.warnings)));

  return {
    summary,
    tasksForMe,
    allTasks,
    dates,
    decisions,
    people,
    warnings,
    processingMode: 'local-ai',
  };
}

export function deduplicateResults(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    allTasks: dedupeBySimilarity(result.allTasks, (t) => t.task),
    tasksForMe: dedupeBySimilarity(result.tasksForMe, (t) => t.task),
    dates: dedupeBySimilarity(result.dates, (d) => d.event),
    decisions: dedupeBySimilarity(result.decisions, (d) => d.decision),
  };
}
