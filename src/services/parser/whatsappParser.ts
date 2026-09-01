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

// كشف رسائل النظام الشائعة
const SYSTEM_KEYWORDS = [
  'أضاف',
  'أزال',
  'غيّر',
  'غير',
  'انضم',
  'غادر',
  'تم إنشاء',
  'تم تغيير',
  'تشفير',
  'الرسائل مشفّرة',
  'صورة',
  'فيديو',
  'ملف',
  'مقطع صوتي',
  'مستند',
  'بطاقة جهة اتصال',
  'تم حذف',
  'لم يتم تنزيل',
  'تم تخطي',
  'image omitted',
  'video omitted',
  'audio omitted',
  'document omitted',
  'added',
  'removed',
  'changed',
  'joined',
  'left',
  'created',
  'security code',
  'messages are end-to-end encrypted',
  'تم إنشاء مجموعة',
  'غير اسم المجموعة',
  'أضافك',
  'انضمام',
  'مغادرة',
];

function isSystemContent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SYSTEM_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

function normalizeTimestamp(dateRaw: string, timeRaw: string): string | null {
  try {
    const dateParts = dateRaw.split(/[/\\.-]/).map((p) => p.trim());
    if (dateParts.length !== 3) return null;
    let [a, b, year] = dateParts;
    let day: number;
    let month: number;
    day = parseInt(a, 10);
    month = parseInt(b, 10);
    if (year.length === 2) year = `20${year}`;
    const yr = parseInt(year, 10);
    if (isNaN(day) || isNaN(month) || isNaN(yr)) return null;
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

export function parseWhatsAppChat(input: string): ParseResult {
  idCounter = 0;
  const warnings: string[] = [];
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const messages: WhatsAppMessage[] = [];
  let unparsedLines = 0;
  let current: WhatsAppMessage | null = null;

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
      current = {
        id: nextId(),
        sender,
        timestamp: normalizeTimestamp(dateRaw, timeRaw),
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
      current = {
        id: nextId(),
        sender: null,
        timestamp: normalizeTimestamp(dateRaw, timeRaw),
        rawDate: `${dateRaw}, ${timeRaw}`,
        content,
        isSystemMessage: true,
      };
      continue;
    }

    // 3) نمط النسخ المباشر: "اسم: نص" بدون تواريخ
    if (!withTimestamps) {
      const senderMatch = line.match(SENDER_ONLY_PATTERN);
      if (senderMatch) {
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

  return { messages, unparsedLines, warnings };
}

export function estimateMessageCount(text: string): number {
  const tsMatches = text.match(new RegExp(`(?:\\[)?${DATE_PART}[,\\s]`, 'g'));
  if (tsMatches && tsMatches.length > 0) return tsMatches.length;
  // تقدير بعدد الأسطر غير الفارغة إن لم توجد تواريخ
  const nonEmpty = text.split('\n').filter((l) => l.trim().length > 0).length;
  return nonEmpty;
}
