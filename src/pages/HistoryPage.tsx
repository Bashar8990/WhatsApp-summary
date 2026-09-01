import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { deleteAllAnalyses, deleteAnalysis, getAllAnalyses } from '../services/storage/indexedDB';
import type { SavedAnalysis } from '../types';
import { formatDateArabic } from '../utils/export';
import type { ToastApi } from '../hooks/useToast';

type Props = {
  onOpen: (a: SavedAnalysis) => void;
  onBack: () => void;
  toasts: ToastApi;
};

export function HistoryPage({ onOpen, onBack, toasts }: Props) {
  const [items, setItems] = useState<SavedAnalysis[]>([]);
  const [query, setQuery] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await getAllAnalyses();
    const filtered = query.trim()
      ? all.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
      : all;
    setItems(filtered);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    await deleteAnalysis(id);
    setConfirmDeleteOne(null);
    toasts.success('تم حذف العنصر');
    void load();
  };

  const handleDeleteAll = async () => {
    await deleteAllAnalyses();
    setConfirmDeleteAll(false);
    toasts.success('تم حذف جميع التحليلات');
    void load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">السجل المحلي</h2>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← رجوع
        </Button>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        🔒 البيانات محفوظة على جهازك فقط داخل متصفحك.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالعنوان..."
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <Button variant="outline" size="sm" onClick={() => void load()}>
          بحث
        </Button>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteAll(true)}>
            حذف الكل
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-slate-400">لا توجد تحليلات محفوظة بعد.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{a.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateArabic(a.createdAt)} · {a.messageCount} رسالة ·{' '}
                    {a.processingMode === 'local-ai' ? 'ذكاء اصطناعي' : 'تحليل سريع'}
                    {a.userName ? ` · ${a.userName}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onOpen(a)}>
                    فتح
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOne(a.id)}>
                    حذف
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={confirmDeleteAll}
        title="حذف جميع التحليلات؟"
        danger
        confirmLabel="حذف الكل"
        onConfirm={() => void handleDeleteAll()}
        onCancel={() => setConfirmDeleteAll(false)}
      >
        سيتم حذف جميع التحليلات المحفوظة نهائيًا من جهازك. لا يمكن التراجع.
      </Modal>
      <Modal
        open={confirmDeleteOne !== null}
        title="حذف هذا التحليل؟"
        danger
        confirmLabel="حذف"
        onConfirm={() => confirmDeleteOne && void handleDelete(confirmDeleteOne)}
        onCancel={() => setConfirmDeleteOne(null)}
      >
        سيتم حذف هذا التحليل نهائيًا.
      </Modal>
    </div>
  );
}
