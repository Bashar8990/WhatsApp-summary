import type { WhatsAppMessage } from '../../types';

// أنماط التاريخ والوقت المدعومة في تصدير واتساب
// مثال: 01/09/2026, 10:30 - أحمد: نص
// مثال: [01/09/2026, 10:30:00] أحمد: نص
// مثال: 1/9/26, 10:30 AM - أحمد: نص
// مثال: 01-09-2026 10:30 - أحمد: نص

const DATE_SEPARATORS = '[/\\\\.-]';
const DATE_PART = `\\d{1,2}${DATE_SEPARATORS}\\d{1,2}${DATE_SEPARATORS}\\d{2,4}`;
const TIME_PART = `\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM|ص|م)?`;

// النمط الرئيسي: تاريخ، وقت - اسم: نص  أو  [تاريخ، وقت] اسم: نص
const MAIN_PATTERN = new RegExp(
  `^(?:\\[)?(${DATE_PART})[,\\s]+(${TIME_PART})(?:\\])?\\s*-?\\s*([^:]+?):\\s(.*)$`,
  'i',
);

// نمط بدون اسم مرسل (رسائل النظام أو الرسائل المرفقة)
const NO_SENDER_PATTERN = new RegExp(
  `^(?:\\[)?(${DATE_PART})[,\\s]+(${TIME_PART})(?:\\])?\\s*-\\s*(.*)$`,
  'i',
);

// نمط "اسم: نص" بدون تاريخ (عند النسخ المباشر من واتساب)
const SENDER_ONLY_PATTERN = /^([^:\n[\]]{1,50}):\s(.+)$/;

// كلمات/عبارات شائعة تُظهر نقطتين لكنها ليست أسماء مرسلين.
// تُستخدم لاستبعاد الإيجابيات الكاذبة في نمط النسخ المباشر.
const NON_SENDER_PREFIXES = new Set([
  // عناوين/تسميات
  'ملاحظة',
  'ملاحظات',
  'المرجع',
  'المراجع',
  'العنوان',
  'الموضوع',
  'السؤال',
  'الاجابة',
  'الإجابة',
  'النتيجة',
  'النتائج',
  'الخلاصة',
  'المقدمة',
  'الخاتمة',
  'التعليق',
  'التعليل',
  'الشرح',
  'التفاصيل',
  'الوصف',
  'السبب',
  'الاسباب',
  'الأسباب',
  'الفكرة',
  'الهدف',
  'الاهداف',
  'الأهداف',
  'الرقم',
  'التاريخ',
  'الوقت',
  'المكان',
  'الاسم',
  'الجوال',
  'الهاتف',
  'البريد',
  'الرابط',
  'الرأي',
  'الراي',
  // إنجليزي شائع
  'note',
  'notes',
  'reference',
  'references',
  'title',
  'subject',
  'question',
  'answer',
  'result',
  'results',
  'summary',
  'conclusion',
  'comment',
  'description',
  'details',
  'reason',
  'date',
  'time',
  'location',
  'name',
  'phone',
  'email',
  'link',
  'url',
  'todo',
  'tip',
  'warning',
  'caution',
  'example',
  'examples',
  'step',
  'steps',
  'ps',
  'p.s',
  'p.s.',
  'fyi',
  're',
  'fwd',
]);

// يتحقق إن كان النص قبل النقطتين اسم مرسِل محتمل (لا كلمة تصنيف/تسمية)
function looksLikeSender(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return false;
  // استبعاد الكلمات/العبارات الشائعة (مطابقة غير حساسة لحالة الأحرف)
  if (NON_SENDER_PREFIXES.has(trimmed.toLowerCase())) return false;
  // استبعاد ما ينتهي بنقطتين أو شرطة (تسميات مثل "ملاحظة:")
  // استبعاد الجمل الطويلة (أكثر من 5 كلمات غالبًا ليست اسمًا)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 5) return false;
  // استبعاد ما يحتوي على علامات ترقيم غير شائعة في الأسماء
  if (/[.,;!?؟]/.test(trimmed)) return false;
  return true;
}

// كشف رسائل النظام في واتساب.
// تُقسّم إلى فئات حسب دقة المطابقة لتجنب الإيجابيات الكاذبة:
//  1) وسائط محذوفة/غير منزّلة — يجب أن تظهر مع "محذوف" أو "omitted" أو "لم يتم تنزيل"
//  2) أحداث المجموعة — تُطابق من بداية النص فقط (أضاف/أزال/انضم...)
//  3) رسائل الأمان والتشفير — substring آمن (لا تظهر في رسائل عادية)
//  4) حذف/تخطّي رسالة — أنماط محددة

// وسائط محذوفة أو غير منزّلة (العربية) — الكلمة + "محذوف" أو "لم يتم تنزيل"
const MEDIA_OMITTED_AR = /^(صورة|فيديو|ملف|مستند|مقطع صوتي|بطاقة جهة اتصال|صورة متحركة|ملصق)\s+(محذوف|لم يتم تنزيل)/;

// وسائط محذوفة (الإنجليزية)
const MEDIA_OMITTED_EN = /^(image|video|audio|document|file|contact card|gif|sticker|photo)\s+omitted/i;

// رسالة محذوفة
const DELETED_MSG = /تم حذف هذه الرسالة|this message was deleted/i;

// رسالة لم تُنزّل / تم تخطّيها
const SKIPPED_MSG = /^(تم تخطي|لم يتم تنزيل)\s+هذه الرسالة/;

// أحداث المجموعة — تُطابق من بداية النص (العربية)
const GROUP_EVENT_AR = /^(أضاف|أزال|غيّر|غير|انضم|غادر|انضمام|مغادرة|أضافك|أنشأ|أنشأت)\b/;

// أحداث المجموعة — تُطابق من بداية النص (الإنجليزية)
const GROUP_EVENT_EN = /^(added|removed|changed|joined|left|created)\b/i;

// إنشاء/تغيير المجموعة (العربية)
const GROUP_SETUP_AR = /^(تم إنشاء|تم تغيير|غير اسم المجموعة|أنشأ مجموعة|تم إنشاء مجموعة)/;

// رسائل الأمان والتشفير — substring آمن
const SECURITY_KEYWORDS = [
  'تشفير',
  'الرسائل مشفّرة',
  'رمز الأمان',
  'security code',
  'end-to-end encrypted',
  'messages are end-to-end encrypted',
];

function isSystemContent(text: string): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  // 1) وسائط محذوفة/غير منزّلة
  if (MEDIA_OMITTED_AR.test(trimmed) || MEDIA_OMITTED_EN.test(trimmed)) return true;
  // 2) رسالة محذوفة أو مخطّاة
  if (DELETED_MSG.test(trimmed) || SKIPPED_MSG.test(trimmed)) return true;
  // 3) أحداث المجموعة (من بداية النص)
  if (GROUP_EVENT_AR.test(trimmed) || GROUP_EVENT_EN.test(trimmed)) return true;
  // 4) إنشاء/تغيير المجموعة
  if (GROUP_SETUP_AR.test(trimmed)) return true;
  // 5) رسائل الأمان والتشفير (substring آمن)
  return SECURITY_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

// يكتشف إن كان التاريخ غامضًا (كلا القيمتين الأوليين ≤ 12، فلا يمكن تحديد اليوم/الشهر بثقة)
function isAmbiguousDate(dateRaw: string): boolean {
  const parts = dateRaw.split(/[/\\.-]/).map((p) => p.trim());
  if (parts.length !== 3) return false;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  return !isNaN(a) && !isNaN(b) && a <= 12 && b <= 12 && a !== b;
}

function normalizeTimestamp(
  dateRaw: string,
  timeRaw: string,
  dateFormat: 'dmy' | 'mdy' = 'dmy',
): string | null {
  try {
    const dateParts = dateRaw.split(/[/\\.-]/).map((p) => p.trim());
    if (dateParts.length !== 3) return null;
    let [a, b, year] = dateParts;
    let day: number;
    let month: number;
    // a و b هما أول قيمتين في التاريخ. ترتيبهما يعتمد على dateFormat.
    // 'dmy': a=يوم، b=شهر  |  'mdy': a=شهر، b=يوم
    if (dateFormat === 'mdy') {
      month = parseInt(a, 10);
      day = parseInt(b, 10);
    } else {
      day = parseInt(a, 10);
      month = parseInt(b, 10);
    }
    if (year.length === 2) year = `20${year}`;
    const yr = parseInt(year, 10);
    if (isNaN(day) || isNaN(month) || isNaN(yr)) return null;
    // تصحيح تلقائي عند تجاوز الشهر 12 (بغض النظر عن الإعداد)
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    let time = timeRaw.trim();
    let isPM = false;
    let isAM = false;
    const amMatch = time.match(/\s*(AM|PM|ص|م)\s*$/i);
    if (amMatch) {
      const suffix = amMatch[1].toLowerCase();
      isPM = suffix === 'pm' || suffix === 'م';
      isAM = suffix === 'am' || suffix === 'ص';
      time = time.replace(/\s*(AM|PM|ص|م)\s*$/i, '').trim();
    }
    const timeParts = time.split(':').map((p) => p.trim());
    let hours = parseInt(timeParts[0] ?? '0', 10);
    const minutes = parseInt(timeParts[1] ?? '0', 10);
    const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    const d = new Date(yr, month - 1, day, hours, minutes, seconds);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg_${idCounter}`;
}

export type ParseResult = {
  messages: WhatsAppMessage[];
  unparsedLines: number;
  warnings: string[];
};

// يكتشف إن كانت المحادثة تحتوي على تواريخ (صيغة التصدير الكامل)
function hasTimestamps(input: string): boolean {
  const sample = input.slice(0, 2000);
  return new RegExp(`(?:\\[)?${DATE_PART}[,\\s]`).test(sample);
}

export type ParseOptions = {
  dateFormat?: 'dmy' | 'mdy';
};

export function parseWhatsAppChat(input: string, options?: ParseOptions): ParseResult {
  idCounter = 0;
  const warnings: string[] = [];
  const dateFormat = options?.dateFormat ?? 'dmy';
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const messages: WhatsAppMessage[] = [];
  let unparsedLines = 0;
  let current: WhatsAppMessage | null = null;
  let ambiguousDateCount = 0;

  const withTimestamps = hasTimestamps(input);

  const flushCurrent = () => {
    if (current) {
      current.content = current.content.trim();
      if (current.content.length > 0) {
        messages.push(current);
      }
      current = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u200f|\u200e/g, '').trimEnd();
    if (line.trim().length === 0) {
      if (current) current.content += '\n';
      continue;
    }

    // 1) نمط التصدير الكامل: تاريخ + وقت + مرسل + نص
    const mainMatch = line.match(MAIN_PATTERN);
    if (mainMatch) {
      flushCurrent();
      const [, dateRaw, timeRaw, senderRaw, contentRaw] = mainMatch;
      const sender = senderRaw.trim();
      const isSystem = isSystemContent(contentRaw) || isSystemContent(sender);
      if (isAmbiguousDate(dateRaw)) ambiguousDateCount++;
      current = {
        id: nextId(),
        sender,
        timestamp: normalizeTimestamp(dateRaw, timeRaw, dateFormat),
        rawDate: `${dateRaw}, ${timeRaw}`,
        content: contentRaw.trim(),
        isSystemMessage: isSystem,
      };
      continue;
    }

    // 2) نمط التصدير بدون مرسل (رسائل النظام)
    const noSenderMatch = line.match(NO_SENDER_PATTERN);
    if (noSenderMatch) {
      flushCurrent();
      const [, dateRaw, timeRaw, contentRaw] = noSenderMatch;
      const content = contentRaw.trim();
      if (isAmbiguousDate(dateRaw)) ambiguousDateCount++;
      current = {
        id: nextId(),
        sender: null,
        timestamp: normalizeTimestamp(dateRaw, timeRaw, dateFormat),
        rawDate: `${dateRaw}, ${timeRaw}`,
        content,
        isSystemMessage: true,
      };
      continue;
    }

    // 3) نمط النسخ المباشر: "اسم: نص" بدون تواريخ
    if (!withTimestamps) {
      const senderMatch = line.match(SENDER_ONLY_PATTERN);
      if (senderMatch && looksLikeSender(senderMatch[1])) {
        flushCurrent();
        const [, senderRaw, contentRaw] = senderMatch;
        const sender = senderRaw.trim();
        const isSystem = isSystemContent(contentRaw) || isSystemContent(sender);
        current = {
          id: nextId(),
          sender,
          timestamp: null,
          rawDate: null,
          content: contentRaw.trim(),
          isSystemMessage: isSystem,
        };
        continue;
      }
    }

    // 4) سطر استمرار لرسالة سابقة متعددة الأسطر
    if (current) {
      current.content += '\n' + line.trim();
      continue;
    }

    // 5) احتياط أخير: إذا لم تكن هناك تواريخ أصلًا، اعتبر كل سطر رسالة مستقلة
    if (!withTimestamps) {
      current = {
        id: nextId(),
        sender: null,
        timestamp: null,
        rawDate: null,
        content: line.trim(),
        isSystemMessage: isSystemContent(line),
      };
      flushCurrent();
      continue;
    }

    unparsedLines += 1;
  }

  flushCurrent();

  if (messages.length === 0 && unparsedLines > 0) {
    warnings.push(
      'لم يتم التعرف على صيغة محادثة واتساب. تأكد من لصق المحادثة بصيغة التصدير القياسية.',
    );
  } else if (unparsedLines > messages.length * 0.3 && withTimestamps) {
    warnings.push('بعض الأسطر لم يتم التعرف عليها وقد تكون خارج الصيغة القياسية.');
  }

  if (!withTimestamps && messages.length > 0) {
    warnings.push(
      'لم يتم العثور على تواريخ في المحادثة. تمت المعالجة بدون تواريخ — قد تكون قد نسخت النص مباشرة من واتساب. للحصول على تحليل أدق، استخدم "تصدير المحادثة" من واتساب.',
    );
  }

  // تنبيه عند وجود تواريخ غامضة (كلا القيمتين الأوليين ≤ 12)
  if (ambiguousDateCount > 0) {
    const fmtLabel = dateFormat === 'mdy' ? 'شهر/يوم/سنة (أمريكي)' : 'يوم/شهر/سنة (عالمي)';
    warnings.push(
      `وُجدت ${ambiguousDateCount} رسالة بتاريخ غامض (يوم وشهر كلاهما ≤ 12). ` +
        `تم التفسير بصيغة ${fmtLabel}. إن كانت التواريخ غير صحيحة، غيّر صيغة التاريخ في الإعدادات.`,
    );
  }

  return { messages, unparsedLines, warnings };
}

export function estimateMessageCount(text: string): number {
  const tsMatches = text.match(new RegExp(`(?:\\[)?${DATE_PART}[,\\s]`, 'g'));
  if (tsMatches && tsMatches.length > 0) return tsMatches.length;
  // تقدير بعدد الأسطر غير الفارغة إن لم توجد تواريخ
  const nonEmpty = text.split('\n').filter((l) => l.trim().length > 0).length;
  return nonEmpty;
}
