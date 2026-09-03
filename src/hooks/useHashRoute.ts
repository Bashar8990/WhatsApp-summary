import { useCallback, useEffect, useState } from 'react';

/**
 * نظام توجيه hash-based خفيف (بدل react-router).
 *
 * لماذا hash routing؟
 * - يعمل على GitHub Pages (استضافة ثابتة بلا SPA fallback) دون 404 عند التحديث.
 * - متوافق مع PWA Service Worker (navigateFallback).
 * - روابط عميقة قابلة للمشاركة: #/history, #/settings, #/results/:id
 * - زر الرجوع/الأمام في المتصفح يعمل عبر حدث hashchange.
 *
 * بنية المسارات:
 *   #/            → home
 *   #/results     → results (النتيجة الحالية في الذاكرة)
 *   #/results/:id → results (تحميل نتيجة محفوظة بالـ ID)
 *   #/history     → history
 *   #/settings    → settings
 *   #/privacy     → privacy
 */

export type Page = 'home' | 'results' | 'history' | 'settings' | 'privacy';

export type Route = {
  page: Page;
  /** معاملات المسار (مثل ID للنتيجة المحفوظة) */
  params: { id?: string };
};

/** المسار الافتراضي عند فتح التطبيق */
const DEFAULT_ROUTE: Route = { page: 'home', params: {} };

/** يحوّل hash إلى Route منظم */
function parseHash(hash: string): Route {
  // إزالة # والـ / الأولى
  const clean = hash.replace(/^#\/?/, '').trim();
  if (clean === '') return DEFAULT_ROUTE;

  const segments = clean.split('/').filter((s) => s.length > 0);
  const [pageSeg, idSeg] = segments;

  switch (pageSeg) {
    case 'results':
      return { page: 'results', params: idSeg ? { id: idSeg } : {} };
    case 'history':
      return { page: 'history', params: {} };
    case 'settings':
      return { page: 'settings', params: {} };
    case 'privacy':
      return { page: 'privacy', params: {} };
    default:
      return DEFAULT_ROUTE;
  }
}

/** يحوّل Page + params إلى string hash */
function buildHash(page: Page, params: { id?: string } = {}): string {
  if (page === 'home') return '#/';
  if (page === 'results' && params.id) return `#/results/${params.id}`;
  return `#/${page}`;
}

export function useHashRoute(): {
  route: Route;
  navigate: (page: Page, params?: { id?: string }) => void;
} {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
      // التمرير لأعلى عند تغيير الصفحة (أفضل ممارسة)
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHashChange);
    // ضبط المسار الافتراضي عند أول تحميل إن لم يوجد hash
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/');
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((page: Page, params?: { id?: string }) => {
    const hash = buildHash(page, params);
    if (hash === window.location.hash) return; // تجنّب إدخال تكرار في السجل
    window.location.hash = hash;
  }, []);

  return { route, navigate };
}
