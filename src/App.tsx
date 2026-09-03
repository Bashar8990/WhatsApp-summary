import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './components/Button';
import { Icon, type IconName } from './components/Icon';
import { LoadingScreen } from './components/LoadingScreen';
import { Logo } from './components/Logo';
import { ModelLoadDialog } from './components/ModelLoadDialog';
import { OfflineBanner } from './components/OfflineBanner';
import { ResultsSkeleton } from './components/Skeleton';
import { ToastContainer } from './components/Toast';
import { useHashRoute, type Page } from './hooks/useHashRoute';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
import {
  getAnalysis,
  saveAnalysis,
  saveCurrentSessionMessages,
  loadCurrentSessionMessages,
  clearCurrentSessionMessages,
} from './services/storage/indexedDB';
import { makeTitle } from './utils/export';
import type { AnalysisResult, AnalysisType, SavedAnalysis, SummaryLength, WhatsAppMessage } from './types';

// مفاتيح sessionStorage لحفظ النتيجة الحالية (تبقى صفحة Results بعد التحديث)
// result و messageCount صغيران نسبيًا فيُخزّنان في sessionStorage (متزامن وسريع).
// الرسائل الأصلية قد تكون ضخمة فتُخزّن في IndexedDB (يتسع لأكثر من 5MB بكثير).
const SESSION_RESULT_KEY = 'current-result';
const SESSION_MSG_COUNT_KEY = 'current-message-count';

function storeCurrentResult(result: AnalysisResult, messageCount: number, messages?: WhatsAppMessage[]) {
  try {
    sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(result));
    sessionStorage.setItem(SESSION_MSG_COUNT_KEY, String(messageCount));
  } catch {
    /* ignore — قد تتجاوز السعة */
  }
  // حفظ الرسائل الأصلية في IndexedDB (غير متزامن، لا يرمي هنا)
  if (messages) {
    void saveCurrentSessionMessages(messages).catch(() => { /* ignore */ });
  } else {
    void clearCurrentSessionMessages().catch(() => { /* ignore */ });
  }
}

function clearCurrentResult() {
  try {
    sessionStorage.removeItem(SESSION_RESULT_KEY);
    sessionStorage.removeItem(SESSION_MSG_COUNT_KEY);
  } catch {
    /* ignore */
  }
  void clearCurrentSessionMessages().catch(() => { /* ignore */ });
}

function loadCurrentResult(): { result: AnalysisResult; messageCount: number } | null {
  try {
    const r = sessionStorage.getItem(SESSION_RESULT_KEY);
    const m = sessionStorage.getItem(SESSION_MSG_COUNT_KEY);
    if (r && m) {
      return {
        result: JSON.parse(r) as AnalysisResult,
        messageCount: parseInt(m, 10),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function App() {
  const { settings, update, reset, loaded } = useSettings();
  const toasts = useToasts();
  useTheme(settings.theme);
  const { route, navigate } = useHashRoute();

  // استعادة النتيجة من sessionStorage عند بدء التشغيل (لإبقاء Results بعد التحديث)
  // استدعاء واحد فقط (بدل 3) لتفادي parse مكلف للمحادثات الكبيرة
  const [restored] = useState(() => loadCurrentResult());
  const [result, setResult] = useState<AnalysisResult | null>(() => restored?.result ?? null);
  const [messageCount, setMessageCount] = useState<number>(() => restored?.messageCount ?? 0);
  // الرسائل الأصلية المُحلّلة — تُحفظ في IndexedDB (لا sessionStorage) لإتاحة إعادة توليد الملخص
  // تُحمّل بشكل غير متزامن بعد التهيئة (IndexedDB غير متزامن)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // تحميل الرسائل الأصلية من IndexedDB عند بدء التشغيل
  useEffect(() => {
    if (!restored) {
      setMessagesLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const msgs = await loadCurrentSessionMessages();
        if (!cancelled) {
          setMessages(msgs ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setMessagesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [restored]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ progress: number; stage: string } | null>(null);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    text: string;
    type: AnalysisType;
    summaryLength: SummaryLength;
  } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
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
  const online = useOnlineStatus();

  // تحميل نتيجة محفوظة بالـ ID عند فتح #/results/:id (deep link)
  useEffect(() => {
    if (route.page === 'results' && route.params.id) {
      // إن كانت النتيجة الحالية لا تطابق الـ ID المطلوب، حمّلها من IndexedDB
      setLoadingSaved(true);
      void (async () => {
        const saved = await getAnalysis(route.params.id!);
        if (saved) {
          setResult(saved.result);
          setMessageCount(saved.messageCount);
          // الرسائل الأصلية غير متوفرة للنتائج المحفوظة
          setMessages([]);
          storeCurrentResult(saved.result, saved.messageCount, undefined);
        } else {
          toasts.error('لم يتم العثور على النتيجة المطلوبة');
          navigate('home');
        }
        setLoadingSaved(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.page, route.params.id]);

  const runAnalysis = useCallback(
    async (text: string, type: AnalysisType, summaryLength: SummaryLength) => {
      setBusy(true);
      setProgress({ progress: 0, stage: 'تحليل صيغة الرسائل...' });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const parsed = parseWhatsAppChat(text, { dateFormat: settings.dateFormat });
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

        // إن اختار المستخدم الذكاء الاصطناعي صراحةً لكن WebGPU غير متوفر والنموذج غير محمّل،
        // أبلغه فورًا بأن اختياره سيتجاوز، مع إتاحة المتابعة بالتحليل البرمجي.
        if (settings.processingMode === 'local-ai' && !compat.webgpu && !isModelLoaded()) {
          toasts.warning(
            'وضع الذكاء الاصطناعي المحلي غير مدعوم على هذا الجهاز (WebGPU غير متوفر). سيُستخدم التحليل البرمجي السريع.',
          );
        }

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
        const filtered = filterByType(res, type);
        setResult(filtered);
        setMessageCount(parsed.messages.length);
        setMessages(parsed.messages);
        storeCurrentResult(filtered, parsed.messages.length, parsed.messages);
        navigate('results');
        if (settings.autoSave) {
          // نحفظ النسخة المُصفّاة (المُعروضة) لضمان اتساق ما يراه المستخدم مع ما يُحفظ
          await persistResult(filtered, parsed.messages.length, settings.userName);
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
    [settings, compat, toasts, navigate],
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
    setMessages([]);
    clearCurrentResult();
    navigate('home');
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRegenerate = async (length: SummaryLength): Promise<string> => {
    if (!result) throw new Error('لا توجد نتيجة لإعادة التوليد.');
    // الرسائل تُحمّل من IndexedDB بشكل غير متزامن — انتظر حتى تكتمل
    if (!messagesLoaded) {
      throw new Error('جاري تحميل المحادثة الأصلية، حاول مرة أخرى بعد لحظات.');
    }
    // إعادة التوليد تتطلب الرسائل الأصلية (لا الملخص) لإنتاج ملخص من المحادثة نفسها
    if (messages.length === 0) {
      throw new Error('لا تتوفر المحادثة الأصلية لإعادة التوليد. افتح نتيجة من تحليل جديد.');
    }
    if (!isModelLoaded()) {
      throw new Error('النموذج غير محمّل. حمّل النموذج أولًا لإعادة التوليد.');
    }
    // regenerateSummary تُرجع الملخص الجديد، أو ترمي خطأً عند الفشل
    return await regenerateSummary(messages, settings.userName, length);
  };

  const openSaved = (a: SavedAnalysis) => {
    setResult(a.result);
    setMessageCount(a.messageCount);
    // الرسائل الأصلية غير متوفرة للنتائج المحفوظة (لا تُخزّن في IndexedDB)
    // لذا ستُعطّل إعادة التوليد لهذه النتيجة
    setMessages([]);
    storeCurrentResult(a.result, a.messageCount, undefined);
    // تنقّل مع ID لإتاحة مشاركة الرابط والرجوع
    navigate('results', { id: a.id });
  };

  if (!loaded) {
    return <LoadingScreen />;
  }

  // إن كان المسار results لكن لا توجد نتيجة، عُد للرئيسية
  const showResults = route.page === 'results' && result !== null;

  // قائمة عناصر التنقل الموحّدة (تُستخدم في الـ nav العلوي والـ bottom nav)
  const navItems: { page: Page; label: string; icon: IconName }[] = [
    { page: 'home', label: 'الرئيسية', icon: 'chat' },
    { page: 'history', label: 'السجل', icon: 'history' },
    { page: 'settings', label: 'الإعدادات', icon: 'settings' },
    { page: 'privacy', label: 'الخصوصية', icon: 'shield' },
  ];

  const toggleTheme = () => {
    update({ theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  return (
    <div className="min-h-screen">
      <OfflineBanner online={online} />
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <button onClick={() => navigate('home')} className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
            <Logo size={32} />
            <span className="hidden sm:inline">ملخص الواتساب</span>
          </button>
          {/* تنقّل نصي للشاشات المتوسطة والكبيرة */}
          <div className="hidden gap-1 text-sm sm:flex">
            {navItems.map((item) => (
              <NavBtn key={item.page} active={route.page === item.page} onClick={() => navigate(item.page)}>
                {item.label}
              </NavBtn>
            ))}
          </div>
          {/* زر تبديل الوضع الفاتح/الداكن — سريع في الـ nav */}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={settings.theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
          >
            <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} size={20} />
          </button>
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

      {/* padding سفلي للجوال لتفادي تغطية المحتوى بالـ Bottom Nav */}
      <main className="pb-20 sm:pb-0">
        {route.page === 'home' && (
          <HomePage
            userName={settings.userName}
            onUserNameChange={(v) => update({ userName: v })}
            onAnalyze={(text, type, len) => void runAnalysis(text, type, len)}
            busy={busy}
            processingMode={settings.processingMode}
            toasts={toasts}
            compat={compat}
          />
        )}
        {loadingSaved && <ResultsSkeleton />}
        {!loadingSaved && showResults && result && (
          <ResultsPage
            result={result}
            messageCount={messageCount}
            onBack={() => navigate('home')}
            toasts={toasts}
            canRegenerate={isModelLoaded() && messages.length > 0}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            onClear={handleClear}
          />
        )}
        {route.page === 'results' && !result && !loadingSaved && (
          <div className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-500">
            لا توجد نتيجة لعرضها. <button onClick={() => navigate('home')} className="text-emerald-600 underline">العودة للرئيسية</button>
          </div>
        )}
        {route.page === 'history' && (
          <HistoryPage onOpen={openSaved} onBack={() => navigate('home')} toasts={toasts} />
        )}
        {route.page === 'settings' && (
          <SettingsPage settings={settings} update={update} reset={reset} onBack={() => navigate('home')} toasts={toasts} />
        )}
        {route.page === 'privacy' && <PrivacyPage onBack={() => navigate('home')} />}
      </main>

      {/* Bottom Navigation للجوال — أنسب لتطبيق PWA بنمط mobile-first */}
      <nav className="fixed bottom-0 right-0 left-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:hidden">
        <div className="flex items-stretch justify-around">
          {navItems.map((item) => {
            const active = route.page === item.page;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
                {/* active indicator — شريط علوي emerald */}
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <ModelLoadDialog
        open={showModelDialog}
        onClose={() => setShowModelDialog(false)}
        onLoaded={() => void handleModelLoaded()}
        onUseFast={handleUseFast}
        toasts={toasts}
        modelId={settings.modelId}
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
      aria-current={active ? 'page' : undefined}
      className={`relative rounded-lg px-3 py-1.5 font-medium transition-colors ${
        active
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
      {/* active indicator — شريط سفلي emerald */}
      {active && (
        <span className="absolute -bottom-2.5 right-1/2 h-1 w-6 translate-x-1/2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
      )}
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
