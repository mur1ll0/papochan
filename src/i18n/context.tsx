'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Locale, TranslationKey, translations } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'papochan_locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt-BR');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && (saved === 'pt-BR' || saved === 'en')) {
        setLocaleState(saved);
      } else if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('pt')) {
          setLocaleState('pt-BR');
        } else {
          setLocaleState('en');
        }
      }
    } catch {
      // ignore
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] || translations['pt-BR'];
      let val: string = dict[key] || translations['pt-BR'][key] || key;

      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          val = val.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
        });
      }

      return val;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      locale: 'pt-BR' as Locale,
      setLocale: () => {},
      t: (key: TranslationKey) => translations['pt-BR'][key] || key,
    };
  }
  return context;
}
