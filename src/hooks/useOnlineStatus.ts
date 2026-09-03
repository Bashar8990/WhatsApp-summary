import { useEffect, useState } from 'react';

/**
 * يتتبّع حالة الاتصال بالشبكة (online/offline).
 *
 * مفيد لتطبيق PWA يعمل دون اتصال — يُظهر للمستخدم مؤشرًا واضحًا
 * عند فقدان الاتصال، ويُخبره أن التطبيق لا يزال يعمل محليًا.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
