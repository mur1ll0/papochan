'use client';

import React from 'react';
import {
  AlertTriangle,
  VolumeX,
  Volume2,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { AudioDiagnosticsMetrics } from '@/core/webrtc/AudioDiagnostics';
import { cn } from '@/lib/utils';

export interface AudioDiagnosticsAlertProps {
  metrics: AudioDiagnosticsMetrics | null;
  isAudioMuted: boolean;
  className?: string;
}

export function AudioDiagnosticsAlert({
  metrics,
  isAudioMuted,
  className,
}: AudioDiagnosticsAlertProps) {
  if (isAudioMuted || !metrics || !metrics.alertMessage) {
    return null;
  }

  const getAlertColor = () => {
    switch (metrics.status) {
      case 'clipping':
        return 'bg-rose-950/90 border-rose-500/50 text-rose-300 shadow-rose-500/10';
      case 'high-noise':
        return 'bg-amber-950/90 border-amber-500/50 text-amber-300 shadow-amber-500/10';
      case 'low-volume':
        return 'bg-orange-950/90 border-orange-500/50 text-orange-300 shadow-orange-500/10';
      default:
        return 'bg-tactical-900/90 border-tactical-700 text-slate-300';
    }
  };

  const getAlertIcon = () => {
    switch (metrics.status) {
      case 'clipping':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />;
      case 'high-noise':
        return <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />;
      case 'low-volume':
        return <VolumeX className="w-4 h-4 text-orange-400 shrink-0" />;
      default:
        return <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-mono backdrop-blur-xl border shadow-lg transition-all animate-fadeIn',
        getAlertColor(),
        className
      )}
    >
      {getAlertIcon()}
      <div className="flex-1 truncate">
        <span className="font-semibold block">{metrics.alertMessage}</span>
        <div className="flex items-center gap-3 text-[10px] opacity-75 mt-0.5">
          <span>Sinal: {metrics.rmsDb} dBFS</span>
          <span>Ruído: {metrics.noiseFloorDb} dBFS</span>
          <span>SNR: {metrics.snrDb} dB</span>
        </div>
      </div>
    </div>
  );
}
