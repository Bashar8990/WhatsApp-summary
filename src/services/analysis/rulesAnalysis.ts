import type {
  AnalysisResult,
  ConfidenceLevel,
  DateItem,
  DecisionItem,
  PersonItem,
  TaskItem,
  WhatsAppMessage,
} from '../../types';

// إزالة التشكيل والشدّة والتطويل لتسهيل المطابقة
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
function normalizeArabic(text: string): string {
  return text.replace(DIACRITICS, '').toLowerCase();
}

const DATE_KEYWORDS = [
  'اليوم',
  'غدًا',
  'غدا',
  'بكرة',
  'بكره',
  'بعد غد',
  'بعدغد',
  'الأحد',
  'الاحن',
  'الاثنين',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الاربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
  'الساعة',
  'صباحًا',
  'صباحا',
  'مساءً',
  'مساء',
  'الظهر',
  'العصر',
  'المغرب',
  'العشاء',
  'موعد',
  'اجتماع',
  'تسليم',
  'نهاية الأسبوع',
  'الأسبوع القادم',
  'الشهر القادم',
  'الأسبوع القادم',
  'الشهر القادم',
  'القادم',
];

const TASK_KEYWORDS = [
  'أرسل',
  'ارسل',
  'جهز',
  'حضر',
  'راجع',
  'تواصل',
  'اتصل',
  'تابع',
  'حدّث',
  'حدث',
  'عدّل',
  'عدل',
  'ارفع',
  'سلّم',
  'سلم',
  'لا تنس',
  'لا تنسى',
  'مطلوب',
  'عليك',
  'ممكن ترسل',
  'نحتاج منك',
  'يجب',
  'تکلف',
  'تكلف',
  'منك',
  'خلّص',
  'خلص',
  'أنجز',
  'انجز',
];

const DECISION_KEYWORDS = [
  'تم الاتفاق',
  'اتفقت',
  'اتفقنا',
  'تقرر',
  'تم الاعتماد',
  'نعتمد',
  'خلاص',
  'القرار',
  'تم الإلغاء',
  'تم الالغاء',
  'نؤجل',
  'نلغي',
  'نبدأ',
  'نبداء',
  'نختار',
  'تمت الموافقة',
  'وافقنا',
  'قررنا',
  'تم التأكيد',
];

function containsAny(text: string, keywords: string[]): boolean {
  const norm = normalizeArabic(text);
  return keywords.some((k) => norm.includes(normalizeArabic(k)));
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function confidenceForKeywords(text: string, keywords: string[]): ConfidenceLevel {
  const norm = normalizeArabic(text);
  let count = 0;
  for (const k of keywords) {
    if (norm.includes(normalizeArabic(k))) count++;
  }
  if (count >= 2) return 'high';
  if (count === 1) return 'medium';
  return 'low';
}

function extractPeople(messages: WhatsAppMessage[]): PersonItem[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.isSystemMessage || !m.sender) continue;
    counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  }
  const people: PersonItem[] = [];
  for (const [name, count] of counts) {
    people.push({
      id: genId('person'),
      name,
      role: null,
      responsibilities: [],
      messageCount: count,
    });
  }
  // ترتيب تنازلي حسب عدد الرسائل
  people.sort((a, b) => (b.messageCount ?? 0) - (a.messageCount ?? 0));
  return people;
}

function extractDates(messages: WhatsAppMessage[]): DateItem[] {
  const items: DateItem[] = [];
  for (const m of messages) {
    if (m.isSystemMessage) continue;
    if (!containsAny(m.content, DATE_KEYWORDS)) continue;
    const confidence = confidenceForKeywords(m.content, DATE_KEYWORDS);
    items.push({
      id: genId('date'),
      event: m.content.slice(0, 200),
      originalDate: m.rawDate ?? m.content,
      normalizedDate: m.timestamp,
      relatedPerson: m.sender,
      sourceMessage: m.content.slice(0, 300),
      confidence,
    });
  }
  return items;
}

function extractTasks(
  messages: WhatsAppMessage[],
  currentUserName: string,
): { tasksForMe: TaskItem[]; allTasks: TaskItem[] } {
  const allTasks: TaskItem[] = [];
  const tasksForMe: TaskItem[] = [];
  const normalizedUser = currentUserName.trim().toLowerCase();

  for (const m of messages) {
    if (m.isSystemMessage) continue;
    if (!containsAny(m.content, TASK_KEYWORDS)) continue;
    const confidence = confidenceForKeywords(m.content, TASK_KEYWORDS);
    // نُطبّع النص مرة واحدة لكل المقارنات (اتساقًا مع containsAny/confidenceForKeywords)
    const normalizedContent = normalizeArabic(m.content);
    // تحديد ما إذا كانت موجهة للمستخدم الحالي
    const mentionsUser =
      normalizedUser.length > 0 &&
      normalizedContent.includes(normalizeArabic(currentUserName));
    const fromOtherToUser =
      normalizedUser.length > 0 &&
      m.sender !== null &&
      m.sender.toLowerCase() !== normalizedUser &&
      (mentionsUser ||
        normalizedContent.includes(normalizeArabic('منك')) ||
        normalizedContent.includes(normalizeArabic('عليك')) ||
        normalizedContent.includes(normalizeArabic('ممكن ترسل')) ||
        normalizedContent.includes(normalizeArabic('نحتاج منك')));
    const isForCurrentUser =
      normalizedUser.length > 0 &&
      (mentionsUser || fromOtherToUser);

    const task: TaskItem = {
      id: genId('task'),
      task: m.content.slice(0, 250),
      assignedTo: m.sender,
      isForCurrentUser,
      deadlineOriginal: containsAny(m.content, DATE_KEYWORDS)
        ? m.content.slice(0, 80)
        : null,
      normalizedDeadline: null,
      sourceMessage: m.content.slice(0, 300),
      confidence,
    };
    allTasks.push(task);
    if (isForCurrentUser) tasksForMe.push(task);
  }
  return { tasksForMe, allTasks };
}

function extractDecisions(messages: WhatsAppMessage[]): DecisionItem[] {
  const items: DecisionItem[] = [];
  for (const m of messages) {
    if (m.isSystemMessage) continue;
    if (!containsAny(m.content, DECISION_KEYWORDS)) continue;
    const confidence = confidenceForKeywords(m.content, DECISION_KEYWORDS);
    items.push({
      id: genId('decision'),
      decision: m.content.slice(0, 250),
      madeBy: m.sender,
      sourceMessage: m.content.slice(0, 300),
      confidence,
    });
  }
  return items;
}

function buildSummary(
  messages: WhatsAppMessage[],
  people: PersonItem[],
  dates: DateItem[],
  tasks: TaskItem[],
  decisions: DecisionItem[],
): string {
  const humanMessages = messages.filter((m) => !m.isSystemMessage);
  const total = humanMessages.length;

  // النطاق الزمني
  const firstDate = humanMessages[0]?.timestamp ?? null;
  const lastDate = humanMessages[humanMessages.length - 1]?.timestamp ?? null;
  let dateRange = '';
  if (firstDate && lastDate) {
    try {
      const f = new Date(firstDate).toLocaleDateString('ar-EG');
      const l = new Date(lastDate).toLocaleDateString('ar-EG');
      dateRange = f === l ? ` في ${f}` : ` بين ${f} و ${l}`;
    } catch {
      dateRange = '';
    }
  }

  const parts: string[] = [];

  // 1) مقدمة موجزة
  const topSenders = people.slice(0, 3);
  const sendersText = topSenders.map((p) => p.name).join(' و');
  parts.push(
    `محادثة بين ${sendersText || 'مشاركين'}${dateRange}، تتضمن ${total} رسالة.`,
  );

  // 2) المواضيع الرئيسية — استخراج أبرز الكلمات المفتاحية
  const topics = extractTopics(humanMessages);
  if (topics.length > 0) {
    parts.push(`المواضيع الرئيسية: ${topics.join('، ')}.`);
  }

  // 3) القرارات
  if (decisions.length > 0) {
    const top = decisions.slice(0, 3);
    const decisionsText = top
      .map((d) => d.decision.length > 80 ? d.decision.slice(0, 80) + '…' : d.decision)
      .join('؛ ');
    parts.push(
      `القرارات: ${decisionsText}${decisions.length > 3 ? ` (${decisions.length} قرار إجمالًا)` : ''}.`,
    );
  }

  // 4) المهام
  if (tasks.length > 0) {
    const top = tasks.slice(0, 3);
    const tasksText = top
      .map((t) => t.task.length > 80 ? t.task.slice(0, 80) + '…' : t.task)
      .join('؛ ');
    parts.push(
      `المهام: ${tasksText}${tasks.length > 3 ? ` (${tasks.length} مهمة إجمالًا)` : ''}.`,
    );
  }

  // 5) المواعيد
  if (dates.length > 0) {
    const top = dates.slice(0, 3);
    const datesText = top
      .map((d) => d.event.length > 60 ? d.event.slice(0, 60) + '…' : d.event)
      .join('؛ ');
    parts.push(
      `المواعيد المرتبطة: ${datesText}${dates.length > 3 ? ` (${dates.length} موعد إجمالًا)` : ''}.`,
    );
  }

  // 6) خاتمة
  parts.push(
    'هذا ملخص برمجي يعتمد على مطابقة الكلمات المفتاحية. للحصول على ملخص أعمق وأكثر دقة، استخدم التحليل الذكي المحلي.',
  );

  return parts.join(' ');
}

// يستخرج المواضيع الرئيسية من المحادثة عبر إيجاد الكلمات المتكررة المفيدة
function extractTopics(messages: WhatsAppMessage[]): string[] {
  // كلمات وقف شائعة لا تفيد كموضوع
  const STOP_WORDS = new Set([
    'في', 'من', 'على', 'الى', 'إلى', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان',
    'مع', 'عن', 'او', 'أو', 'ثم', 'لكن', 'ان', 'أن', 'لا', 'ما', 'هو', 'هي',
    'نعم', 'لا', 'حسن', 'حسنا', 'تمام', 'اوكي', 'ok', 'yes', 'no',
    'السلام', 'عليكم', 'ورحمة', 'الله', 'بركاته', 'شكرا', 'شكراً',
    'انا', 'أنا', 'انت', 'أنت', 'نحن', 'هم', 'هو', 'هي',
    'اليوم', 'غدا', 'غدًا', 'بكرة', 'بكره', 'الان', 'الآن', 'بعد',
    'قبل', 'كل', 'بعض', 'عند', 'لدي', 'عندي', 'عندك', 'عندك',
    'اي', 'أي', 'كيف', 'متى', 'وين', 'وينك', 'ليش', 'وش',
    'ال', 'ه', 'ي', 'ه', 'ك', 'ت', 'ون', 'ين', 'ات', 'ه', 'ة',
  ]);

  const wordCounts = new Map<string, number>();
  for (const m of messages) {
    // تقسيم إلى كلمات (عربية + إنجليزية)
    const words = m.content
      .replace(/[^\u0600-\u06FFa-zA-Z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
    for (const w of words) {
      const normalized = normalizeArabic(w);
      if (normalized.length < 4) continue;
      wordCounts.set(normalized, (wordCounts.get(normalized) ?? 0) + 1);
    }
  }

  // أخذ أكثر 5 كلمات تكرارًا (مع حد أدنى للتكرار)
  const sorted = [...wordCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return sorted;
}

export function analyzeWithRules(
  messages: WhatsAppMessage[],
  currentUserName: string,
): AnalysisResult {
  const people = extractPeople(messages);
  const dates = extractDates(messages);
  const { tasksForMe, allTasks } = extractTasks(messages, currentUserName);
  const decisions = extractDecisions(messages);
  const summary = buildSummary(messages, people, dates, allTasks, decisions);
  const warnings: string[] = [
    'هذه النتائج تقريبية وتعتمد على قواعد برمجية. قد تحتوي على إيجابيات/سلبيات كاذبة.',
  ];
  if (people.length === 0) {
    warnings.push('لم يتم العثور على أسماء مرسلين واضحة. تحقق من صيغة المحادثة.');
  }
  return {
    summary,
    tasksForMe,
    allTasks,
    dates,
    decisions,
    people,
    warnings,
    processingMode: 'rules-only',
  };
}
