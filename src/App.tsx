import { useCallback, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './components/Button';
import { ModelLoadDialog } from './components/ModelLoadDialog';
import { ToastContainer } from './components/Toast';
import { useSettings } from './hooks/useSettings';
import { useTheme, useToasts } from './hooks/useToast';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ResultsPage } from './pages/ResultsPage';
import { SettingsPage } from './pages/SettingsPage';
import { orchestrateAnalysis } from './services/analysis/orchestrator';
import { parseWhatsAppChat } from './services/parser/whatsappParser';
import { getDeviceCompatibility } from './services/ai/deviceCheck';
import { isModelLoaded, regenerateSummary } from './services/ai/webllmService';
import { saveAnalysis } from './services/storage/indexedDB';
import { makeTitle } from './utils/export';
import type { AnalysisResult, AnalysisType, SavedAnalysis, SummaryLength } from './types';

type Page = 'home' | 'results' | 'history' | 'settings' | 'privacy';

export default function App() {
  const { settings, update, reset, loaded } = useSettings();
  const toasts = useToasts();
  useTheme(settings.theme);

  const [page, setPage] = useState<Page>('home');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ progress: number; stage: string } | null>(null);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    text: string;
    type: AnalysisType;
    summaryLength: SummaryLength;
  } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // PWA update prompt
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      // eslint-disable-next-line no-console
      console.log('SW registered:', url);
    },
  });

  const compat = getDeviceCompatibility();

  const runAnalysis = useCallback(
    async (text: string, type: AnalysisType, summaryLength: SummaryLength) => {
      setBusy(true);
      setProgress({ progress: 0, stage: 'تحليل صيغة الرسائل...' });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const parsed = parseWhatsAppChat(text);
        if (parsed.messages.length === 0) {
          toasts.error('لم يتم التعثور على رسائل بصيغة واتساب. تحقق من الصيغة.');
          setBusy(false);
          setProgress(null);
          return;
        }
        setMessageCount(parsed.messages.length);
        for (const w of parsed.warnings) toasts.warning(w);

        const wantAI =
          settings.processingMode === 'local-ai' ||
          (settings.processingMode === 'auto' && compat.webgpu);

        if (wantAI && !isModelLoaded() && compat.webgpu) {
          // اعرض نافذة تحميل النموذج
          setPendingAnalysis({ text, type, summaryLength });
          setShowModelDialog(true);
          setBusy(false);
          setProgress(null);
          return;
        }

        const res = await orchestrateAnalysis({
          messages: parsed.messages,
          currentUserName: settings.userName,
          mode: settings.processingMode,
          summaryLength,
          onProgress: (p) => setProgress(p),
          signal: controller.signal,
        });
        setResult(filterByType(res, type));
        setPage('results');
        if (settings.autoSave) {
          await persistResult(res, parsed.messages.length, settings.userName);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          toasts.info('تم إلغاء التحليل');
        } else {
          toasts.error('حدث خطأ أثناء التحليل. حاول مجددًا أو استخدم الوضع السريع.');
        }
      } finally {
        setBusy(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [settings, compat, toasts],
  );

  const handleModelLoaded = async () => {
    setShowModelDialog(false);
    if (pendingAnalysis) {
      const { text, type, summaryLength } = pendingAnalysis;
      setPendingAnalysis(null);
      void runAnalysis(text, type, summaryLength);
    }
  };

  const handleUseFast = () => {
    setShowModelDialog(false);
    update({ processingMode: 'rules-only' });
    if (pendingAnalysis) {
      const { text, type, summaryLength } = pendingAnalysis;
      setPendingAnalysis(null);
      void runAnalysis(text, type, summaryLength);
    }
  };

  const handleSave = () => {
    if (!result) return;
    setConfirmSave(true);
  };

  const confirmSaveNow = async () => {
    if (!result) return;
    await persistResult(result, messageCount, settings.userName);
    setConfirmSave(false);
    toasts.success('تم حفظ النتيجة محليًا');
  };

  const handleClear = () => {
    setResult(null);
    setMessageCount(0);
    setPage('home');
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRegenerate = async (length: SummaryLength): Promise<string> => {
    if (!result) return '';
    if (isModelLoaded()) {
      try {
        const newSummary = await regenerateSummary(
          [{ id: 'x', sender: null, timestamp: null, rawDate: null, content: result.summary, isSystemMessage: false }],
          settings.userName,
          length,
        );
        return newSummary;
      } catch {
        return result.summary;
      }
    }
    return result.summary;
  };

  const openSaved = (a: SavedAnalysis) => {
    setResult(a.result);
    setMessageCount(a.messageCount);
    setPage('results');
  };

  if (!loaded) {
    return <div className="p-10 text-center text-slate-500">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => setPage('home')} className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
            ملخص الواتساب
          </button>
          <div className="flex gap-1 text-sm">
            <NavBtn active={page === 'home'} onClick={() => setPage('home')}>الرئيسية</NavBtn>
            <NavBtn active={page === 'history'} onClick={() => setPage('history')}>السجل</NavBtn>
            <NavBtn active={page === 'settings'} onClick={() => setPage('settings')}>الإعدادات</NavBtn>
            <NavBtn active={page === 'privacy'} onClick={() => setPage('privacy')}>الخصوصية</NavBtn>
          </div>
        </div>
      </nav>

      {progress && (
        <div className="fixed bottom-0 right-0 z-50 m-4 max-w-sm rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-1 flex justify-between text-xs">
            <span>{progress.stage}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress.progress}%` }} />
          </div>
          <div className="mt-2 text-left">
            <Button variant="ghost" size="sm" onClick={handleCancel}>إلغاء</Button>
          </div>
        </div>
      )}

      <main>
        {page === 'home' && (
          <HomePage
            userName={settings.userName}
            onUserNameChange={(v) => update({ userName: v })}
            onAnalyze={(text, type, len) => void runAnalysis(text, type, len)}
            busy={busy}
            processingMode={settings.processingMode}
            toasts={toasts}
          />
        )}
        {page === 'results' && result && (
          <ResultsPage
            result={result}
            messageCount={messageCount}
            onBack={() => setPage('home')}
            toasts={toasts}
            canRegenerate={isModelLoaded()}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            onClear={handleClear}
          />
        )}
        {page === 'history' && (
          <HistoryPage onOpen={openSaved} onBack={() => setPage('home')} toasts={toasts} />
        )}
        {page === 'settings' && (
          <SettingsPage settings={settings} update={update} reset={reset} onBack={() => setPage('home')} toasts={toasts} />
        )}
        {page === 'privacy' && <PrivacyPage onBack={() => setPage('home')} />}
      </main>

      <ModelLoadDialog
        open={showModelDialog}
        onClose={() => setShowModelDialog(false)}
        onLoaded={() => void handleModelLoaded()}
        onUseFast={handleUseFast}
        toasts={toasts}
      />

      {confirmSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmSave(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-bold">حفظ النتيجة محليًا؟</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              سيتم حفظ النتيجة على جهازك فقط. لن يُحفظ نص المحادثة الأصلي.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmSave(false)}>إلغاء</Button>
              <Button onClick={() => void confirmSaveNow()}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="fixed bottom-4 left-4 z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-sm">يتوفر تحديث جديد للتطبيق.</p>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>تحديث الآن</Button>
        </div>
      )}

      <ToastContainer {...toasts} />
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function filterByType(result: AnalysisResult, type: AnalysisType): AnalysisResult {
  switch (type) {
    case 'summary':
      return { ...result, tasksForMe: [], allTasks: [], dates: [], decisions: [], people: [] };
    case 'tasks-for-me':
      return { ...result, allTasks: [], dates: [], decisions: [], people: [] };
    case 'dates':
      return { ...result, tasksForMe: [], allTasks: [], decisions: [], people: [] };
    case 'decisions':
      return { ...result, tasksForMe: [], allTasks: [], dates: [], people: [] };
    case 'people':
      return { ...result, tasksForMe: [], allTasks: [], dates: [], decisions: [] };
    default:
      return result;
  }
}

async function persistResult(result: AnalysisResult, messageCount: number, userName: string) {
  const saved: SavedAnalysis = {
    id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: makeTitle(result.summary, messageCount),
    createdAt: Date.now(),
    userName,
    messageCount,
    processingMode: result.processingMode,
    result,
  };
  await saveAnalysis(saved);
}
