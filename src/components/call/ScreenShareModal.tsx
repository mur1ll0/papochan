'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Music,
  Tv,
  Zap,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  AppWindow,
  Globe,
  Info,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { ChameleonLogo } from '@/components/brand/ChameleonLogo';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

export type ScreenSourceType = 'monitor' | 'window' | 'tab';

export interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShare: (includeAudio: boolean, frameRate: number) => Promise<any> | void;
}

interface DetectedScreen {
  id: string;
  name: string;
  resolution: string;
  isPrimary: boolean;
}

export function ScreenShareModal({
  isOpen,
  onClose,
  onStartShare,
}: ScreenShareModalProps) {
  const { t } = useI18n();
  const [sourceType, setSourceType] = useState<ScreenSourceType>('monitor');
  const [selectedScreenIndex, setSelectedScreenIndex] = useState<number>(0);
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [frameRate, setFrameRate] = useState<number>(60);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Platform detection
  const [platform, setPlatform] = useState<'desktop_app' | 'mobile' | 'browser'>('browser');
  const [detectedScreens, setDetectedScreens] = useState<DetectedScreen[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect Platform
    const isDesktop =
      '__TAURI__' in window ||
      'electron' in window ||
      (window as any).isDesktopApp ||
      (typeof process !== 'undefined' && (process.versions as any)?.electron);

    const isMobile =
      /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
      'Capacitor' in window;

    if (isDesktop) {
      setPlatform('desktop_app');
    } else if (isMobile) {
      setPlatform('mobile');
    } else {
      setPlatform('browser');
    }

    // Detect local screens / multi-monitor setup
    const mainScreen: DetectedScreen = {
      id: 'screen_1',
      name: 'Monitor 1 (Principal)',
      resolution: `${window.screen.width} x ${window.screen.height}`,
      isPrimary: true,
    };

    const screens: DetectedScreen[] = [mainScreen];

    if (window.screen && (window.screen as any).isExtended) {
      screens.push({
        id: 'screen_2',
        name: 'Monitor 2 (Estendido)',
        resolution: 'Full HD / 4K',
        isPrimary: false,
      });
    }

    setDetectedScreens(screens);

    // Try Screen Details API if supported
    if ('getScreenDetails' in window && typeof (window as any).getScreenDetails === 'function') {
      (window as any)
        .getScreenDetails()
        .then((details: any) => {
          if (details && details.screens && details.screens.length > 0) {
            const list: DetectedScreen[] = details.screens.map((s: any, idx: number) => ({
              id: `screen_${idx + 1}`,
              name: s.label || `Monitor ${idx + 1} ${s.isPrimary ? '(Principal)' : ''}`,
              resolution: `${s.width} x ${s.height}`,
              isPrimary: !!s.isPrimary,
            }));
            setDetectedScreens(list);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsStarting(true);
      setErrorMessage(null);
      await onStartShare(includeAudio, frameRate);
      onClose();
    } catch (err: any) {
      console.warn('[ScreenShareModal] Error starting screen share:', err);
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setErrorMessage('Seleção cancelada ou permissão negada.');
      } else {
        setErrorMessage(
          err.message ||
            'Não foi possível iniciar o compartilhamento. Verifique se o navegador tem permissão para capturar a tela.'
        );
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] flex flex-col justify-between overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-chan-turquoise/15 border border-chan-turquoise/30 text-chan-turquoise">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Compartilhar Tela</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-chan-turquoise/20 text-chan-turquoise">
                  60 FPS HD
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Selecione as opções de áudio e qualidade para a transmissão
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert Message if Any */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <strong className="block font-bold">Aviso:</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Platform-Specific Preview & Source Area */}
        <div className="space-y-3">
          {/* A. MOBILE ENVIRONMENT */}
          {platform === 'mobile' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
              <Smartphone className="w-5 h-5 text-chan-turquoise shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold mb-0.5">
                  Dispositivo Móvel Detectado:
                </strong>
                No celular, a tela inteira do aparelho será compartilhada diretamente em alta qualidade.
              </div>
            </div>
          )}

          {/* B. DESKTOP NATIVE APP */}
          {platform === 'desktop_app' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Telas Disponíveis no Desktop
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detectedScreens.map((screen, idx) => (
                  <button
                    key={screen.id}
                    type="button"
                    onClick={() => setSelectedScreenIndex(idx)}
                    className={cn(
                      'p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative',
                      selectedScreenIndex === idx
                        ? 'bg-papo-coral/15 border-papo-coral text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    {selectedScreenIndex === idx && (
                      <CheckCircle2 className="w-4 h-4 text-papo-coral absolute top-3 right-3" />
                    )}
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-papo-coral" />
                      <span className="text-xs font-bold text-white">{screen.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Resolução: {screen.resolution}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* C. WEB BROWSER ENVIRONMENT */}
          {platform === 'browser' && (
            <div className="space-y-3">
              {/* Category selector */}
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSourceType('monitor')}
                  className={cn(
                    'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                    sourceType === 'monitor'
                      ? 'bg-papo-coral text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Telas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('window')}
                  className={cn(
                    'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                    sourceType === 'window'
                      ? 'bg-chan-turquoise text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <AppWindow className="w-3.5 h-3.5" />
                  <span>Janelas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('tab')}
                  className={cn(
                    'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                    sourceType === 'tab'
                  ? 'bg-stealth-emerald text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Guias</span>
                </button>
              </div>

              {/* Informative Live Preview Note for Browser */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
                <Info className="w-5 h-5 text-chan-turquoise shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold mb-0.5">
                    Seleção e Previews no Navegador:
                  </strong>
                  Ao clicar em <strong>"Iniciar Transmissão"</strong>, o navegador exibirá a janela nativa com os{' '}
                  <span className="text-chan-turquoise font-medium">previews ao vivo reais de todos os seus monitores (Monitor 1, Monitor 2...) e janelas</span>{' '}
                  para você escolher qual deseja transmitir.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Audio & Quality Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 shrink-0">
          {/* Audio Switch Card */}
          <button
            type="button"
            onClick={() => setIncludeAudio(!includeAudio)}
            className={cn(
              'p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between',
              includeAudio
                ? 'bg-stealth-emerald/10 border-stealth-emerald text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'p-2 rounded-xl border',
                  includeAudio
                    ? 'bg-stealth-emerald/20 border-stealth-emerald/40 text-stealth-emerald'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                )}
              >
                {includeAudio ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-extrabold block text-slate-100">
                  {includeAudio ? 'Áudio do Sistema Ativo' : 'Sem Áudio do Sistema'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {includeAudio ? 'Transmite som do PC/jogos' : 'Apenas microfone'}
                </span>
              </div>
            </div>

            <div
              className={cn(
                'w-5 h-5 rounded-full border flex items-center justify-center',
                includeAudio
                  ? 'bg-stealth-emerald border-stealth-emerald text-slate-950'
                  : 'border-slate-700'
              )}
            >
              {includeAudio && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* FPS Toggle Card */}
          <button
            type="button"
            onClick={() => setFrameRate(frameRate === 60 ? 30 : 60)}
            className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-chan-turquoise/15 border border-chan-turquoise/30 text-chan-turquoise">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold block text-slate-100">
                  {frameRate === 60 ? '60 FPS (Ultra Fluido)' : '30 FPS (Econômico)'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {frameRate === 60 ? 'Ideal para vídeos/jogos' : 'Ideal para texto'}
                </span>
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-chan-turquoise">
              {frameRate} FPS
            </span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isStarting}
            className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-papo-coral hover:bg-papo-hover disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-papo-coral/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Abrindo Transmissão...</span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4" />
                <span>Iniciar Transmissão</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
