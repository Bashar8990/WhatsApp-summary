import { z } from 'zod';
import type { AnalysisResult } from '../../types';

const confidenceSchema = z.enum(['high', 'medium', 'low']);

const taskItemSchema = z.object({
  id: z.string().optional(),
  task: z.string(),
  assignedTo: z.string().nullable().optional(),
  isForCurrentUser: z.boolean().optional(),
  deadlineOriginal: z.string().nullable().optional(),
  normalizedDeadline: z.string().nullable().optional(),
  sourceMessage: z.string().nullable().optional(),
  confidence: confidenceSchema.optional(),
});

const dateItemSchema = z.object({
  id: z.string().optional(),
  event: z.string(),
  originalDate: z.string(),
  normalizedDate: z.string().nullable().optional(),
  relatedPerson: z.string().nullable().optional(),
  sourceMessage: z.string().nullable().optional(),
  confidence: confidenceSchema.optional(),
});

const decisionItemSchema = z.object({
  id: z.string().optional(),
  decision: z.string(),
  madeBy: z.string().nullable().optional(),
  sourceMessage: z.string().nullable().optional(),
  confidence: confidenceSchema.optional(),
});

const personItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  role: z.string().nullable().optional(),
  responsibilities: z.array(z.string()).optional(),
  messageCount: z.number().nullable().optional(),
});

const analysisResultSchema = z.object({
  summary: z.string().optional(),
  tasksForMe: z.array(taskItemSchema).optional(),
  allTasks: z.array(taskItemSchema).optional(),
  dates: z.array(dateItemSchema).optional(),
  decisions: z.array(decisionItemSchema).optional(),
  people: z.array(personItemSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function ensureIds<T extends { id?: string }>(
  items: T[] | undefined,
  prefix: string,
): (T & { id: string })[] {
  return (items ?? []).map((it) => ({
    ...it,
    id: it.id && it.id.length > 0 ? it.id : genId(prefix),
  }));
}

/**
 * يستخرج JSON من نص قد يحتوي على markdown fences أو نص إضافي.
 */
export function extractJsonFromText(raw: string): string | null {
  let text = raw.trim();
  // إزالة code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  // محاولة العثور على أول { وآخر }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  // محاولة العثور على مصفوفة
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    return text.slice(firstArr, lastArr + 1);
  }
  return null;
}

/**
 * يزيل تعليقات // السطرية من JSON مع احترام القيم النصية.
 * لا يحذف `//` داخل السلاسل النصية (مثل روابط `https://...`).
 */
function stripLineComments(jsonStr: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < jsonStr.length) {
    const ch = jsonStr[i];
    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }
    // خارج سلسلة نصية
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    // تعليق // سطري — احذف حتى نهاية السطر
    if (ch === '/' && jsonStr[i + 1] === '/') {
      while (i < jsonStr.length && jsonStr[i] !== '\n' && jsonStr[i] !== '\r') {
        i++;
      }
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/**
 * محاولة إصلاح أخطاء JSON الشائعة (فواصل زائدة، علامات غير مغلقة).
 */
export function tryFixJson(jsonStr: string): string {
  let s = jsonStr.trim();
  // إزالة الفواصل الزائدة قبل } أو ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // إزالة تعليقات // سطر مع احترام القيم النصية (لا تُفسد روابط https://)
  s = stripLineComments(s);
  return s;
}

/**
 * يحوّل نص JSON إلى AnalysisResult صالح، مع قيم افتراضية.
 * يعيد null عند الفشل التام.
 */
export function parseAndValidateAnalysis(raw: string): AnalysisResult | null {
  const extracted = extractJsonFromText(raw);
  if (!extracted) return null;
  const fixed = tryFixJson(extracted);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fixed);
  } catch {
    // محاولة ثانية بعد إصلاح أعمق
    try {
      const moreFixed = tryFixJson(extracted.replace(/'/g, '"'));
      parsed = JSON.parse(moreFixed);
    } catch {
      return null;
    }
  }
  const result = analysisResultSchema.safeParse(parsed);
  if (!result.success) {
    // محاولة استخراج ما يمكن من البيانات الناقصة
    if (parsed && typeof parsed === 'object') {
      return buildDefaultFromPartial(parsed as Record<string, unknown>);
    }
    return null;
  }
  return normalizeResult(result.data);
}

function normalizeResult(data: z.infer<typeof analysisResultSchema>): AnalysisResult {
  return {
    summary: data.summary ?? '',
    tasksForMe: ensureIds(data.tasksForMe, 'task').map((t) => ({
      id: t.id,
      task: t.task,
      assignedTo: t.assignedTo ?? null,
      isForCurrentUser: t.isForCurrentUser ?? false,
      deadlineOriginal: t.deadlineOriginal ?? null,
      normalizedDeadline: t.normalizedDeadline ?? null,
      sourceMessage: t.sourceMessage ?? null,
      confidence: t.confidence ?? 'medium',
    })),
    allTasks: ensureIds(data.allTasks, 'task').map((t) => ({
      id: t.id,
      task: t.task,
      assignedTo: t.assignedTo ?? null,
      isForCurrentUser: t.isForCurrentUser ?? false,
      deadlineOriginal: t.deadlineOriginal ?? null,
      normalizedDeadline: t.normalizedDeadline ?? null,
      sourceMessage: t.sourceMessage ?? null,
      confidence: t.confidence ?? 'medium',
    })),
    dates: ensureIds(data.dates, 'date').map((d) => ({
      id: d.id,
      event: d.event,
      originalDate: d.originalDate,
      normalizedDate: d.normalizedDate ?? null,
      relatedPerson: d.relatedPerson ?? null,
      sourceMessage: d.sourceMessage ?? null,
      confidence: d.confidence ?? 'medium',
    })),
    decisions: ensureIds(data.decisions, 'decision').map((d) => ({
      id: d.id,
      decision: d.decision,
      madeBy: d.madeBy ?? null,
      sourceMessage: d.sourceMessage ?? null,
      confidence: d.confidence ?? 'medium',
    })),
    people: ensureIds(data.people, 'person').map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role ?? null,
      responsibilities: p.responsibilities ?? [],
      messageCount: p.messageCount ?? null,
    })),
    warnings: data.warnings ?? [],
    processingMode: 'local-ai',
  };
}

function buildDefaultFromPartial(obj: Record<string, unknown>): AnalysisResult {
  return normalizeResult({
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    tasksForMe: Array.isArray(obj.tasksForMe) ? obj.tasksForMe : [],
    allTasks: Array.isArray(obj.allTasks) ? obj.allTasks : [],
    dates: Array.isArray(obj.dates) ? obj.dates : [],
    decisions: Array.isArray(obj.decisions) ? obj.decisions : [],
    people: Array.isArray(obj.people) ? obj.people : [],
    warnings: Array.isArray(obj.warnings) ? obj.warnings : [],
  });
}
