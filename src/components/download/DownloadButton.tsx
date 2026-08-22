'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Apple, Terminal, Laptop } from 'lucide-react';
import { PlatformType, PLATFORMS_CONFIG, detectOS, isNativeApp } from '@/lib/platform';
import { useI18n } from '@/i18n/context';
import { DownloadModal } from './DownloadModal';
import { cn } from '@/lib/utils';

interface DownloadButtonProps {
  className?: string;
}

export function DownloadButton({ className }: DownloadButtonProps) {
  const { t } = useI18n();
  const [userOS, setUserOS] = useState<PlatformType>('windows');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const os = detectOS();
      setUserOS(os === 'web' ? 'windows' : os);
      setIsNative(isNativeApp());
    }
  }, []);

  const config = PLATFORMS_CONFIG[userOS] || PLATFORMS_CONFIG.windows;

  const renderIcon = (className: string = 'w-4 h-4') => {
    switch (userOS) {
      case 'windows':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
          </svg>
        );
      case 'android':
        return <Smartphone className={className} />;
      case 'ios':
      case 'macos':
        return <Apple className={className} />;
      case 'linux':
        return <Terminal className={className} />;
      default:
        return <Download className={className} />;
    }
  };

  // If already in native app, we still allow opening the apps modal but with lighter styling
  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm',
          !isNative
            ? 'bg-papo-coral/15 hover:bg-papo-coral/25 border-papo-coral/40 text-papo-coral hover:scale-105 active:scale-95'
            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300',
          className
        )}
        title={`${t('nav.downloadFor')} ${config.shortName}`}
      >
        <span className="shrink-0">{renderIcon('w-3.5 h-3.5')}</span>
        <span>{t('nav.downloadApp')}</span>
        <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-md bg-slate-950/70 border border-slate-800 text-[10px] font-extrabold uppercase text-slate-300">
          {config.shortName}
        </span>
      </button>

      <DownloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPlatform={userOS}
      />
    </>
  );
}
