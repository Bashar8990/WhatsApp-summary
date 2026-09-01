import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import type { AnalysisResult, SummaryLength } from '../types';
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

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary', label: 'الملخص' },
  { key: 'tasksForMe', label: 'المطلوب مني' },
  { key: 'allTasks', label: 'جميع المهام' },
  { key: 'dates', label: 'المواعيد' },
  { key: 'decisions', label: 'القرارات' },
  { key: 'people', label: 'الأشخاص' },
];

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
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState(result.summary);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← رجوع
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            نسخ الكل
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAsTxt(result, `ملخص_${messageCount}رسالة`)}>
            تصدير TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAsJson(result, `ملخص_${messageCount}رسالة`)}>
            تصدير JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={onSave}>
            حفظ النتيجة
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            مسح
          </Button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {result.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label} ({countFor(t.key)})
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">الملخص</h3>
            <Button variant="ghost" size="sm" onClick={() => handleCopySection(summary, 'الملخص')}>
              نسخ
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
                {regenerating ? 'جاري إعادة التوليد...' : 'إعادة توليد الملخص'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'tasksForMe' && (
        <Card>
          <SectionHeader title="المطلوب مني" count={result.tasksForMe.length} onCopy={() => handleCopySection(result.tasksForMe.map((t) => t.task).join('\n'), 'المطلوب مني')} />
          <EmptyOr count={result.tasksForMe.length}>
            <ul className="space-y-3">
              {result.tasksForMe.map((t) => (
                <li key={t.id} className={`rounded-xl border p-3 ${doneTasks.has(t.id) ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={doneTasks.has(t.id)}
                      onChange={() => toggleDone(t.id)}
                      aria-label="تم الإنجاز"
                      className="mt-1 h-5 w-5"
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${doneTasks.has(t.id) ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{t.task}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {t.assignedTo && <span>المُكلّف: {t.assignedTo}</span>}
                        {t.deadlineOriginal && <span>الموعد: {t.deadlineOriginal}</span>}
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
      )}

      {tab === 'allTasks' && (
        <Card>
          <SectionHeader title="جميع المهام" count={result.allTasks.length} onCopy={() => handleCopySection(result.allTasks.map((t) => t.task).join('\n'), 'المهام')} />
          <EmptyOr count={result.allTasks.length}>
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
      )}

      {tab === 'dates' && (
        <Card>
          <SectionHeader title="المواعيد" count={result.dates.length} onCopy={() => handleCopySection(result.dates.map((d) => `${d.event} (${d.originalDate})`).join('\n'), 'المواعيد')} />
          <EmptyOr count={result.dates.length}>
            <ul className="space-y-2">
              {result.dates.map((d) => (
                <li key={d.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{d.event}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>التاريخ: {d.originalDate}</span>
                    {d.relatedPerson && <span>— {d.relatedPerson}</span>}
                    <ConfidenceBadge level={d.confidence} />
                  </div>
                </li>
              ))}
            </ul>
          </EmptyOr>
        </Card>
      )}

      {tab === 'decisions' && (
        <Card>
          <SectionHeader title="القرارات" count={result.decisions.length} onCopy={() => handleCopySection(result.decisions.map((d) => d.decision).join('\n'), 'القرارات')} />
          <EmptyOr count={result.decisions.length}>
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
      )}

      {tab === 'people' && (
        <Card>
          <SectionHeader title="الأشخاص" count={result.people.length} onCopy={() => handleCopySection(result.people.map((p) => `${p.name} (${p.messageCount ?? 0})`).join('\n'), 'الأشخاص')} />
          <EmptyOr count={result.people.length}>
            <ul className="space-y-2">
              {result.people.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                    {p.messageCount !== null && (
                      <span className="text-xs text-slate-500">{p.messageCount} رسالة</span>
                    )}
                  </div>
                  {p.role && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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
              ))}
            </ul>
          </EmptyOr>
        </Card>
      )}
    </div>
  );
}

function SectionHeader({ title, count, onCopy }: { title: string; count: number; onCopy: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-bold">{title} ({count})</h3>
      <Button variant="ghost" size="sm" onClick={onCopy}>
        نسخ
      </Button>
    </div>
  );
}

function EmptyOr({ count, children }: { count: number; children: React.ReactNode }) {
  if (count === 0) {
    return <p className="py-6 text-center text-slate-400 dark:text-slate-500">لا توجد نتائج في هذا القسم.</p>;
  }
  return <>{children}</>;
}
