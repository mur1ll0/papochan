'use client';

import React, { useState } from 'react';
import {
  Download,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { useI18n } from '@/i18n/context';
import { ChameleonLogo } from '@/components/brand/ChameleonLogo';
import { DownloadModal } from '@/components/download/DownloadModal';
import { PLATFORMS_CONFIG } from '@/lib/platform';

export function AppUpdateModal() {
  const { t } = useI18n();
  const {
    isNative,
    platform,
    currentVersion,
    latestVersion,
    downloadUrl,
    releaseNotes,
    needsUpdate,
    isMandatory,
    isDismissed,
    dismissUpdate,
  } = useAppVersion();

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // If not running in native app, or no update needed, or dismissed (when non-mandatory)
  if (!isNative || !needsUpdate || isDismissed) {
    return null;
  }

  const platConfig = platform ? PLATFORMS_CONFIG[platform] : PLATFORMS_CONFIG.windows;
  const finalDownloadUrl = downloadUrl || platConfig.defaultDownloadUrl;

  const handleUpdateClick = () => {
    if (finalDownloadUrl) {
      window.open(finalDownloadUrl, '_blank');
    }
    // Also open the installation guide modal for reference
    setIsGuideOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
        <div
          className="bg-slate-900 border-2 border-papo-coral/60 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-papo-coral/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header with Icon & Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-papo-coral/20 border border-papo-coral/40 text-papo-coral shrink-0 shadow-lg shadow-papo-coral/20">
                {isMandatory ? (
                  <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
                ) : (
                  <Sparkles className="w-8 h-8 stroke-[2.5]" />
                )}
              </div>
              <div>
                <span
                  className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    isMandatory
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-chan-turquoise/20 text-chan-turquoise border-chan-turquoise/40'
                  }`}
                >
                  {isMandatory ? 'Obrigatório' : 'Nova Versão'}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                  {isMandatory
                    ? t('updater.modal.mandatoryTitle')
                    : t('updater.modal.title')}
                </h3>
              </div>
            </div>

            {!isMandatory && (
              <button
                type="button"
                onClick={dismissUpdate}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={t('updater.modal.btnLater')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Description and Versions */}
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              {isMandatory
                ? t('updater.modal.mandatoryDesc')
                    .replace('{current}', currentVersion)
                    .replace('{version}', latestVersion)
                : t('updater.modal.desc').replace('{version}', latestVersion)}
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="text-slate-400">
                Instalada: <span className="text-white font-bold">{currentVersion}</span>
              </div>
              <div className="text-papo-coral font-bold flex items-center gap-1.5">
                <span>Disponível: {latestVersion}</span>
                <span className="w-2 h-2 rounded-full bg-papo-coral animate-ping" />
              </div>
            </div>

            {releaseNotes && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="font-bold text-chan-turquoise uppercase text-[10px] tracking-wider block">
                  Novidades desta versão:
                </span>
                <p className="leading-relaxed font-sans">{releaseNotes}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleUpdateClick}
              className="flex-1 py-3.5 px-5 rounded-2xl bg-papo-coral hover:bg-papo-hover text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-papo-coral/30 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>{t('updater.modal.btnUpdate')}</span>
            </button>

            {!isMandatory && (
              <button
                type="button"
                onClick={dismissUpdate}
                className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                {t('updater.modal.btnLater')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Guide modal if triggered */}
      {isGuideOpen && (
        <DownloadModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          initialPlatform={platform || 'windows'}
        />
      )}
    </>
  );
}
