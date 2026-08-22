'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Laptop,
  Smartphone,
  Apple,
  Terminal,
  CheckCircle2,
  Share,
  PlusSquare,
  Sparkles,
} from 'lucide-react';
import {
  PlatformType,
  PLATFORMS_CONFIG,
  detectOS,
} from '@/lib/platform';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: PlatformType;
}

export function DownloadModal({
  isOpen,
  onClose,
  initialPlatform,
}: DownloadModalProps) {
  const { t } = useI18n();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('windows');
  const [detectedUserOS, setDetectedUserOS] = useState<PlatformType>('windows');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const os = detectOS();
      const finalOS = os === 'web' ? 'windows' : os;
      setDetectedUserOS(finalOS);
      setSelectedPlatform(initialPlatform || finalOS);
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen) return null;

  const currentConfig = PLATFORMS_CONFIG[selectedPlatform] || PLATFORMS_CONFIG.windows;

  const renderPlatformIcon = (plat: PlatformType, className: string = 'w-5 h-5') => {
    switch (plat) {
      case 'windows':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
          </svg>
        );
      case 'android':
        return (
          <Smartphone className={className} />
        );
      case 'ios':
      case 'macos':
        return (
          <Apple className={className} />
        );
      case 'linux':
        return (
          <Terminal className={className} />
        );
      default:
        return <Laptop className={className} />;
    }
  };

  const handleDownloadClick = () => {
    if (selectedPlatform === 'ios') {
      // iOS PWA instructions or direct download if configured
      if (currentConfig.defaultDownloadUrl && currentConfig.defaultDownloadUrl.endsWith('.ipa')) {
        window.open(currentConfig.defaultDownloadUrl, '_blank');
      }
      return;
    }

    if (currentConfig.defaultDownloadUrl) {
      // Trigger browser download
      window.location.href = currentConfig.defaultDownloadUrl;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-papo-coral/20 border border-papo-coral/40 flex items-center justify-center text-papo-coral">
              <Download className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {t('download.modal.title')}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {t('download.modal.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Platform Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Selecione sua Plataforma:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['windows', 'android', 'ios', 'macos', 'linux'] as PlatformType[]).map((plat) => {
                const isSelected = selectedPlatform === plat;
                const isDetected = detectedUserOS === plat;
                const config = PLATFORMS_CONFIG[plat];

                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setSelectedPlatform(plat)}
                    className={cn(
                      'p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative',
                      isSelected
                        ? 'bg-papo-coral text-white border-papo-coral shadow-lg shadow-papo-coral/25'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    )}
                  >
                    {renderPlatformIcon(plat, 'w-5 h-5')}
                    <span className="text-xs font-bold">{config.shortName}</span>
                    {isDetected && (
                      <span
                        className={cn(
                          'text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full',
                          isSelected
                            ? 'bg-slate-950 text-white'
                            : 'bg-chan-turquoise/20 text-chan-turquoise border border-chan-turquoise/40'
                        )}
                      >
                        Seu SO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Platform Banner & Direct Action */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-chan-turquoise/10 border border-chan-turquoise/30 text-chan-turquoise shrink-0">
                {renderPlatformIcon(selectedPlatform, 'w-6 h-6')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    {currentConfig.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                    {currentConfig.badge}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium block mt-0.5">
                  Distribuição direta oficial PapoChan • 100% Criptografado
                </span>
              </div>
            </div>

            {selectedPlatform !== 'ios' ? (
              <button
                type="button"
                onClick={handleDownloadClick}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-papo-coral/25 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Download className="w-4 h-4 stroke-[3]" />
                <span>{t('download.btn.downloadDirect')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-chan-turquoise/10 border border-chan-turquoise/30 text-chan-turquoise text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Instalação Instantânea PWA</span>
              </div>
            )}
          </div>

          {/* Sideloading & Security Bypass Guide */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-200">
              <HelpCircle className="w-5 h-5 text-chan-turquoise" />
              <h4 className="text-sm font-extrabold tracking-wide uppercase">
                {t('download.guide.title')}
              </h4>
            </div>

            {/* Windows SmartScreen Guide */}
            {selectedPlatform === 'windows' && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>Aviso do Windows SmartScreen:</strong> Como este instalador é distribuído diretamente sem passar pela loja da Microsoft, o Windows exibirá uma mensagem de fornecedor desconhecido na primeira execução.
                  </div>
                </div>
                <ul className="space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.smartscreen.step1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.smartscreen.step2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.smartscreen.step3')}</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Android Play Protect Guide */}
            {selectedPlatform === 'android' && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5 text-blue-300">
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>Instalação do APK Direto:</strong> O Android protege o aparelho bloqueando instalações fora do Google Play por padrão.
                  </div>
                </div>
                <ul className="space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.playprotect.step1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.playprotect.step2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.playprotect.step3')}</span>
                  </li>
                </ul>
              </div>
            )}

            {/* iOS / iPhone / iPad Guide */}
            {selectedPlatform === 'ios' && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300">
                  <Share className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>Melhor método para iPhone & iPad (Sem Lojas ou Certificados):</strong> O PapoChan é um Progressive Web App (PWA) completo que funciona em tela cheia com acesso a câmera e áudio WebRTC.
                  </div>
                </div>
                <ul className="space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.ios.pwa.step1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Share className="w-4 h-4 text-chan-turquoise shrink-0 mt-0.5" />
                    <span>{t('download.guide.ios.pwa.step2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <PlusSquare className="w-4 h-4 text-papo-coral shrink-0 mt-0.5" />
                    <span>{t('download.guide.ios.pwa.step3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.ios.pwa.step4')}</span>
                  </li>
                </ul>
              </div>
            )}

            {/* macOS Gatekeeper Guide */}
            {selectedPlatform === 'macos' && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>Aviso do macOS Gatekeeper:</strong> O macOS bloqueia aplicativos baixados fora da Mac App Store por padrão.
                  </div>
                </div>
                <ul className="space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.gatekeeper.step1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.gatekeeper.step2')}</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Linux Permissions Guide */}
            {selectedPlatform === 'linux' && (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <ul className="space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.linux.step1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Terminal className="w-4 h-4 text-chan-turquoise shrink-0 mt-0.5" />
                    <span>{t('download.guide.linux.step2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-stealth-emerald shrink-0 mt-0.5" />
                    <span>{t('download.guide.linux.step3')}</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            PapoChan Zero-Knowledge Multi-Device
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
