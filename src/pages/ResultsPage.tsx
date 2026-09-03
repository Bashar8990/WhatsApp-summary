import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyState } from '../components/EmptyState';
import { Icon, type IconName } from '../components/Icon';
import type { AnalysisResult, DateItem, SummaryLength } from '../types';
import { copyToClipboard, exportAsJson, exportAsTxt, formatResultAsText } from '../utils/export';
import type { ToastApi } from '../hooks/useToast';

type TabKey = 'summary' | 'tasksForMe' | 'allTasks' | 'dates' | 'decisions' | 'people';

type Props = {
  result: AnalysisResult;
  messageCount: number;
  onBack: () => void;
  toasts: ToastApi;
  canRegenerate: boolean;
  onRegenerate: (length: SummaryLength) => Promise<string>;
  onSave: () => void;
  onClear: () => void;
};

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'الملخص', icon: 'clipboard' },
  { key: 'tasksForMe', label: 'المطلوب مني', icon: 'check' },
  { key: 'allTasks', label: 'جميع المهام', icon: 'clipboard' },
  { key: 'dates', label: 'المواعيد', icon: 'info' },
  { key: 'decisions', label: 'القرارات', icon: 'shield' },
  { key: 'people', label: 'الأشخاص', icon: 'chat' },
];

// مفتاح sessionStorage لحفظ المهام المنجزة (تبقى بعد مغادرة الصفحة)
const DONE_TASKS_KEY = 'done-tasks';

function loadDoneTasks(): Set<string> {
  try {
    const stored = sessionStorage.getItem(DONE_TASKS_KEY);
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveDoneTasks(tasks: Set<string>) {
  try {
    sessionStorage.setItem(DONE_TASKS_KEY, JSON.stringify([...tasks]));
  } catch {
    /* ignore */
  }
}

export function ResultsPage({
  result,
  messageCount,
  onBack,
  toasts,
  canRegenerate,
  onRegenerate,
  onSave,
  onClear,
}: Props) {
  const [tab, setTab] = useState<TabKey>('summary');
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [regenerating, setRegenerating] = useState(false);
  const [doneTasks, setDoneTasks] = useState<Set<string>>(() => loadDoneTasks());
  const [summary, setSummary] = useState(result.summary);
  const [menuOpen, setMenuOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // حفظ المهام المنجزة تلقائيًا عند التغيير
  useEffect(() => {
    saveDoneTasks(doneTasks);
  }, [doneTasks]);

  const toggleDone = (id: string) => {
    setDoneTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyAll = async () => {
    const ok = await copyToClipboard(formatResultAsText({ ...result, summary }));
    if (ok) toasts.success('تم نسخ كل النتائج');
    else toasts.error('تعذّر النسخ');
  };

  const handleCopySection = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toasts.success(`تم نسخ ${label}`);
    else toasts.error('تعذّر النسخ');
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const newSummary = await onRegenerate(summaryLength);
      setSummary(newSummary);
      toasts.success('تم إعادة توليد الملخص');
    } catch {
      toasts.error('تعذّر إعادة توليد الملخص');
    } finally {
      setRegenerating(false);
    }
  };

  const countFor = (key: TabKey): number => {
    switch (key) {
      case 'summary':
        return 1;
      case 'tasksForMe':
        return result.tasksForMe.length;
      case 'allTasks':
        return result.allTasks.length;
      case 'dates':
        return result.dates.length;
      case 'decisions':
        return result.decisions.length;
      case 'people':
        return result.people.length;
    }
  };

  // تنقّل التبويبات بلوحة المفاتيح (Arrow keys + Home/End) — معايير ARIA
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const currentIdx = TABS.findIndex((t) => t.key === tab);
    let nextIdx: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        nextIdx = (currentIdx - 1 + TABS.length) % TABS.length;
        break;
      case 'ArrowRight':
        nextIdx = (currentIdx + 1) % TABS.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = TABS.length - 1;
        break;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      setTab(TABS[nextIdx].key);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  // ترتيب المهام المطلوبة: المنجزة آخرًا، ثم حسب الموعد
  const sortedTasksForMe = useMemo(() => {
    return [...result.tasksForMe].sort((a, b) => {
      const aDone = doneTasks.has(a.id);
      const bDone = doneTasks.has(b.id);
      if (aDone !== bDone) return aDone ? 1 : -1;
      // المهام ذات موعد قبل المهام بلا موعد
      if (a.deadlineOriginal && !b.deadlineOriginal) return -1;
      if (!a.deadlineOriginal && b.deadlineOriginal) return 1;
      return 0;
    });
  }, [result.tasksForMe, doneTasks]);

  // ترتيب المواعيد زمنيًا (Timeline)
  const sortedDates = useMemo(() => {
    return [...result.dates].sort((a, b) => {
      // استخدم normalizedDate إن وجد، وإلا احتفظ بالترتيب الأصلي
      if (a.normalizedDate && b.normalizedDate) {
        return new Date(a.normalizedDate).getTime() - new Date(b.normalizedDate).getTime();
      }
      if (a.normalizedDate && !b.normalizedDate) return -1;
      if (!a.normalizedDate && b.normalizedDate) return 1;
      return 0;
    });
  }, [result.dates]);

  // أقصى عدد رسائل لحساب النسب في قسم الأشخاص
  const maxMessageCount = useMemo(() => {
    const counts = result.people.map((p) => p.messageCount ?? 0);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [result.people]);

  const doneCount = result.tasksForMe.filter((t) => doneTasks.has(t.id)).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="arrow-right" size={16} /> رجوع
        </Button>

        {/* أزرار أساسية ظاهرة دائمًا */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll} className="hidden sm:inline-flex">
            نسخ الكل
          </Button>
          <Button variant="secondary" size="sm" onClick={onSave} className="hidden sm:inline-flex">
            حفظ
          </Button>

          {/* قائمة تجاوز (overflow menu) للأزرار الثانوية + على الجوال */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="المزيد من الإجراءات"
            >
              <Icon name="settings" size={16} />
              <span className="hidden sm:inline">المزيد</span>
            </Button>
            {menuOpen && (
              <>
                {/* إغلاق القائمة عند النقر خارجها */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute left-0 z-50 mt-1 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <MenuItem onClick={() => { setMenuOpen(false); handleCopyAll(); }} icon="copy" label="نسخ الكل" />
                  <MenuItem onClick={() => { setMenuOpen(false); exportAsTxt(result, `ملخص_${messageCount}رسالة`); }} icon="download" label="تصدير TXT" />
                  <MenuItem onClick={() => { setMenuOpen(false); exportAsJson(result, `ملخص_${messageCount}رسالة`); }} icon="download" label="تصدير JSON" />
                  <MenuItem onClick={() => { setMenuOpen(false); onSave(); }} icon="save" label="حفظ النتيجة" />
                  <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <MenuItem onClick={() => { setMenuOpen(false); onClear(); }} icon="trash" label="مسح" danger />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {result.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* التبويبات مع دعم لوحة المفاتيح الكامل */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="أقسام النتائج" onKeyDown={onTabKeyDown}>
        {TABS.map((t, i) => {
          const active = tab === t.key;
          const count = countFor(t.key);
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'summary' && (
        <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">الملخص</h3>
              <Button variant="ghost" size="sm" onClick={() => handleCopySection(summary, 'الملخص')}>
                <Icon name="copy" size={16} /> نسخ
              </Button>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
              {summary || 'لا يوجد ملخص.'}
            </p>
            {canRegenerate && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">طول الملخص:</span>
                  {(['short', 'medium', 'detailed'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setSummaryLength(l)}
                      className={`rounded px-2 py-1 text-xs ${summaryLength === l ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                    >
                      {l === 'short' ? 'قصير' : l === 'medium' ? 'متوسط' : 'مفصل'}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                  <Icon name="refresh" size={16} />
                  {regenerating ? 'جاري إعادة التوليد...' : 'إعادة توليد الملخص'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'tasksForMe' && (
        <div role="tabpanel" id="panel-tasksForMe" aria-labelledby="tab-tasksForMe">
          <Card>
            <SectionHeader
              title="المطلوب مني"
              count={result.tasksForMe.length}
              onCopy={() => handleCopySection(result.tasksForMe.map((t) => t.task).join('\n'), 'المطلوب مني')}
            />
            {result.tasksForMe.length > 0 && doneCount > 0 && (
              <div className="mb-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Icon name="check" size={14} />
                <span>تم إنجاز {doneCount} من {result.tasksForMe.length}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${(doneCount / result.tasksForMe.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <EmptyOr count={result.tasksForMe.length} emptyIcon="check" emptyTitle="لا توجد مهام مطلوبة منك" emptyDescription="لم يُكتشف أي مهام موجهة إليك في هذه المحادثة.">
              <ul className="space-y-3">
                {sortedTasksForMe.map((t) => (
                  <li key={t.id} className={`rounded-xl border p-3 transition-colors ${doneTasks.has(t.id) ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={doneTasks.has(t.id)}
                        onChange={() => toggleDone(t.id)}
                        aria-label="تم الإنجاز"
                        className="mt-1 h-5 w-5 shrink-0 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <p className={`font-medium ${doneTasks.has(t.id) ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{t.task}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {t.assignedTo && <span>المُكلّف: {t.assignedTo}</span>}
                          {t.deadlineOriginal && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <Icon name="info" size={12} /> {t.deadlineOriginal}
                            </span>
                          )}
                          <ConfidenceBadge level={t.confidence} />
                        </div>
                        {t.sourceMessage && (
                          <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">المصدر: {t.sourceMessage}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </EmptyOr>
          </Card>
        </div>
      )}

      {tab === 'allTasks' && (
        <div role="tabpanel" id="panel-allTasks" aria-labelledby="tab-allTasks">
          <Card>
            <SectionHeader
              title="جميع المهام"
              count={result.allTasks.length}
              onCopy={() => handleCopySection(result.allTasks.map((t) => t.task).join('\n'), 'المهام')}
            />
            <EmptyOr count={result.allTasks.length} emptyIcon="clipboard" emptyTitle="لا توجد مهام" emptyDescription="لم يُكتشف أي مهام في هذه المحادثة.">
              <ul className="space-y-2">
                {result.allTasks.map((t) => (
                  <li key={t.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{t.task}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {t.assignedTo && <span>— {t.assignedTo}</span>}
                      {t.isForCurrentUser && <span className="text-emerald-600">موجّه إليك</span>}
                      <ConfidenceBadge level={t.confidence} />
                    </div>
                  </li>
                ))}
              </ul>
            </EmptyOr>
          </Card>
        </div>
      )}

      {tab === 'dates' && (
        <div role="tabpanel" id="panel-dates" aria-labelledby="tab-dates">
          <Card>
            <SectionHeader
              title="المواعيد"
              count={result.dates.length}
              onCopy={() => handleCopySection(result.dates.map((d) => `${d.event} (${d.originalDate})`).join('\n'), 'المواعيد')}
            />
            <EmptyOr count={result.dates.length} emptyIcon="info" emptyTitle="لا توجد مواعيد" emptyDescription="لم يُكتشف أي مواعيد أو تواريخ في هذه المحادثة.">
              <Timeline dates={sortedDates} />
            </EmptyOr>
          </Card>
        </div>
      )}

      {tab === 'decisions' && (
        <div role="tabpanel" id="panel-decisions" aria-labelledby="tab-decisions">
          <Card>
            <SectionHeader
              title="القرارات"
              count={result.decisions.length}
              onCopy={() => handleCopySection(result.decisions.map((d) => d.decision).join('\n'), 'القرارات')}
            />
            <EmptyOr count={result.decisions.length} emptyIcon="shield" emptyTitle="لا توجد قرارات" emptyDescription="لم يُكتشف أي قرارات نهائية في هذه المحادثة.">
              <ul className="space-y-2">
                {result.decisions.map((d) => (
                  <li key={d.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{d.decision}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {d.madeBy && <span>— {d.madeBy}</span>}
                      <ConfidenceBadge level={d.confidence} />
                    </div>
                  </li>
                ))}
              </ul>
            </EmptyOr>
          </Card>
        </div>
      )}

      {tab === 'people' && (
        <div role="tabpanel" id="panel-people" aria-labelledby="tab-people">
          <Card>
            <SectionHeader
              title="الأشخاص"
              count={result.people.length}
              onCopy={() => handleCopySection(result.people.map((p) => `${p.name} (${p.messageCount ?? 0})`).join('\n'), 'الأشخاص')}
            />
            <EmptyOr count={result.people.length} emptyIcon="chat" emptyTitle="لا يوجد أشخاص" emptyDescription="لم يُكتشف أي مشاركين في هذه المحادثة.">
              <ul className="space-y-3">
                {result.people.map((p) => {
                  const count = p.messageCount ?? 0;
                  const pct = maxMessageCount > 0 ? (count / maxMessageCount) * 100 : 0;
                  return (
                    <li key={p.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} size={44} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{count} رسالة</span>
                          </div>
                          {/* شريط نسبة الرسائل */}
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {p.role && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          الدور: {p.role}{' '}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">مستنتج</span>
                        </p>
                      )}
                      {p.responsibilities.length > 0 && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          المسؤوليات: {p.responsibilities.join('، ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </EmptyOr>
          </Card>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, icon, label, danger }: { onClick: () => void; icon: IconName; label: string; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function SectionHeader({ title, count, onCopy }: { title: string; count: number; onCopy: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-bold">{title} ({count})</h3>
      <Button variant="ghost" size="sm" onClick={onCopy}>
        <Icon name="copy" size={16} /> نسخ
      </Button>
    </div>
  );
}

function EmptyOr({
  count,
  children,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  count: number;
  children: React.ReactNode;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (count === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children}</>;
}

/** تصور Timeline زمني للمواعيد */
function Timeline({ dates }: { dates: DateItem[] }) {
  return (
    <ol className="relative space-y-4 pr-6">
      {/* الخط العمودي */}
      <span className="absolute right-2.5 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      {dates.map((d) => (
        <li key={d.id} className="relative">
          {/* النقطة على الخط */}
          <span className="absolute right-[-19px] top-3 h-3 w-3 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-900" aria-hidden="true" />
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="font-medium text-slate-800 dark:text-slate-100">{d.event}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Icon name="info" size={12} /> {d.originalDate}
              </span>
              {d.relatedPerson && <span>— {d.relatedPerson}</span>}
              <ConfidenceBadge level={d.confidence} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
