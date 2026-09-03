import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting } from '../services/storage/indexedDB';
import type { ProcessingMode } from '../types';
import { DEFAULT_MODEL_ID } from '../config/model';

// صيغة ترتيب التاريخ في تصدير واتساب
// 'dmy' = يوم/شهر/سنة (الافتراضي للعربية وأوروبا)
// 'mdy' = شهر/يوم/سنة (الولايات المتحدة)
export type DateFormat = 'dmy' | 'mdy';

export type AppSettings = {
  userName: string;
  processingMode: ProcessingMode;
  autoSave: boolean;
  theme: 'light' | 'dark';
  dateFormat: DateFormat;
  modelId: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  processingMode: 'auto',
  autoSave: false,
  theme: 'light',
  dateFormat: 'dmy',
  modelId: DEFAULT_MODEL_ID,
};

const STORAGE_KEY = 'app-settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // قراءة من localStorage أولًا للسرعة، ثم من IndexedDB
      let stored: Partial<AppSettings> = {};
      try {
        const ls = localStorage.getItem(STORAGE_KEY);
        if (ls) stored = JSON.parse(ls) as Partial<AppSettings>;
      } catch {
        /* ignore */
      }
      const dbStored = await getSetting<AppSettings>(STORAGE_KEY);
      const merged = { ...DEFAULT_SETTINGS, ...stored, ...dbStored };
      if (mounted) {
        setSettings(merged);
        setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      void setSetting(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    void setSetting(STORAGE_KEY, DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset, loaded };
}
