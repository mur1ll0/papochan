'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  VideoOff,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Expand,
  Shrink,
  ArrowLeftRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MultiDeviceBadge } from './MultiDeviceBadge';
import { cn } from '@/lib/utils';

export interface VideoTileProps {
  stream?: MediaStream | null;
  username: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'browser';
  isLocal?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenShare?: boolean;
  hasScreenAudio?: boolean;
  isScreenAudioMuted?: boolean;
  audioLevel?: number; // 0 - 100
  safetyNumber?: string;
  onMaximize?: () => void;
  onSwap?: () => void;
  onToggleScreenAudio?: () => void;
  isMaximized?: boolean;
  isSpotlight?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  username,
  deviceName,
  deviceType,
  isLocal = false,
  isAudioMuted = false,
  isVideoMuted = false,
  isScreenShare = false,
  hasScreenAudio = false,
  isScreenAudioMuted = false,
  audioLevel = 0,
  safetyNumber,
  onMaximize,
  onSwap,
  onToggleScreenAudio,
  isMaximized = false,
  isSpotlight = false,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const isSpeaking = audioLevel > 15 && !isAudioMuted;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative group rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex items-center justify-center select-none shadow-xl',
        isSpeaking
          ? 'border-stealth-emerald shadow-lg shadow-stealth-emerald/10'
          : 'border-slate-800 hover:border-slate-700',
        isScreenShare ? 'bg-black border-chan-turquoise/40' : '',
        className
      )}
    >
      {/* Video Element */}
      {stream && (!isVideoMuted || isScreenShare) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Avoid local feedback echo
          className={cn(
            'w-full h-full transition-all duration-200',
            fitMode === 'cover' ? 'object-cover' : 'object-contain',
            !isScreenShare && isLocal ? '-scale-x-100' : ''
          )}
        />
      ) : (
        /* Video Off Placeholder Avatar */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-950">
          <div className="relative">
            <div
              className={cn(
                'w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black tracking-wider transition-all duration-300 border',
                isSpeaking
                  ? 'bg-stealth-emerald/20 border-stealth-emerald text-stealth-emerald scale-105 shadow-lg shadow-stealth-emerald/20'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              )}
            >
              {username.slice(0, 2).toUpperCase()}
            </div>
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stealth-emerald opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-stealth-emerald"></span>
              </span>
            )}
          </div>
          <span className="mt-3 text-sm font-bold text-white">{username}</span>
          <span className="text-xs text-slate-400 mt-0.5">{deviceName}</span>
        </div>
      )}

      {/* Top Header Overlay: Device Info & E2EE badge */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <MultiDeviceBadge
            deviceName={deviceName}
            deviceType={deviceType}
            isScreenShare={isScreenShare}
            hasAudio={!isAudioMuted}
            hasVideo={!isVideoMuted}
          />
        </div>

        {/* E2EE Shield & Screen Audio Status */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {isScreenShare && hasScreenAudio && (
            <button
              onClick={onToggleScreenAudio}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer',
                isScreenAudioMuted
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                  : 'bg-stealth-emerald/20 border-stealth-emerald text-stealth-emerald'
              )}
              title={isScreenAudioMuted ? 'Desmutar som da tela' : 'Mutar som da tela'}
            >
              {isScreenAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isScreenAudioMuted ? 'Mudo' : 'Som da Tela'}</span>
            </button>
          )}

          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-stealth-emerald/30 text-stealth-emerald text-[11px] font-medium"
            title={safetyNumber ? `E2EE (Segurança: ${safetyNumber})` : 'Zero-Knowledge E2EE DTLS-SRTP'}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">E2EE</span>
          </div>
        </div>
      </div>

      {/* Bottom Info Bar: Username & Status Icons */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 pointer-events-auto">
          <span className="text-xs font-bold text-white truncate max-w-[140px]">
            {username} {isLocal && '(Você)'}
          </span>
          {isScreenShare && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-chan-turquoise text-slate-950">
              TELA 60FPS
            </span>
          )}
        </div>

        {/* Tile Control Actions (Visible on Hover or Touch) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Fit / Fill Toggle */}
          <button
            onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
            className="p-1.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={fitMode === 'contain' ? 'Preencher Espaço (Cover)' : 'Ajustar à Tela (Fit)'}
          >
            {fitMode === 'contain' ? <Expand className="w-3.5 h-3.5" /> : <Shrink className="w-3.5 h-3.5" />}
          </button>

          {/* Swap Position Button */}
          {onSwap && (
            <button
              onClick={onSwap}
              className="p-1.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-papo-coral text-slate-300 hover:text-papo-coral transition-all cursor-pointer"
              title="Trocar Posição (Inverter Palco)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Audio Indicator */}
          <div
            className={cn(
              'p-1.5 rounded-xl backdrop-blur-md border transition-colors',
              isAudioMuted
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-400'
                : 'bg-slate-950/90 border-slate-800 text-slate-300'
            )}
          >
            {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-stealth-emerald" />}
          </div>

          {/* Video Indicator */}
          {isVideoMuted && !isScreenShare && (
            <div className="p-1.5 rounded-xl backdrop-blur-md bg-rose-950/80 border border-rose-500/40 text-rose-400">
              <VideoOff className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Maximize / Focus Toggle */}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className={cn(
                'p-1.5 rounded-xl border transition-all cursor-pointer',
                isMaximized || isSpotlight
                  ? 'bg-papo-coral text-white border-papo-coral shadow-md'
                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white'
              )}
              title={isMaximized || isSpotlight ? 'Restaurar Grade' : 'Focar em Tela Cheia'}
            >
              {isMaximized || isSpotlight ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
