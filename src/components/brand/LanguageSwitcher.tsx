'use client';

import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { Locale } from '@/i18n/translations';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'en', label: 'English (US)', flag: '🇺🇸' },
  ];

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
        title="Alterar Idioma / Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-papo-coral" />
        <span className="font-semibold">{locale === 'pt-BR' ? 'PT-BR' : 'EN'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 py-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 animate-fadeIn text-left">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
              Idioma / Language
            </div>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLocale(lang.code);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer',
                  locale === lang.code
                    ? 'bg-slate-800 text-papo-coral font-bold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {locale === lang.code && <Check className="w-3.5 h-3.5 text-papo-coral" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
