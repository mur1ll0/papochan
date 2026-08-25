'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  Clock,
  ArrowLeft,
  Smartphone,
  Monitor,
  Globe,
  Radio,
  XCircle,
} from 'lucide-react';
import { ChameleonLogo } from '@/components/brand/ChameleonLogo';
import { useI18n } from '@/i18n/context';
import { AdmissionStatus } from '@/hooks/useWebRTC';

export interface WaitingRoomOverlayProps {
  roomCode: string;
  username: string;
  deviceName: string;
  deviceType?: 'desktop' | 'mobile' | 'browser';
  admissionStatus: AdmissionStatus;
  onCancel: () => void;
}

export function WaitingRoomOverlay({
  roomCode,
  username,
  deviceName,
  deviceType = 'browser',
  admissionStatus,
  onCancel,
}: WaitingRoomOverlayProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isRejected = admissionStatus === 'rejected';

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 select-none animate-fadeIn overflow-y-auto">

      {/* Decorative Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-chan-turquoise/10 blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 rounded-full bg-papo-coral/10 blur-3xl pointer-events-none -bottom-20 -right-20" />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Animated Radar Pulse or Rejected State */}
        {!isRejected ? (
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-chan-turquoise/20 animate-ping opacity-75" />
            <div className="absolute w-32 h-32 rounded-full border border-chan-turquoise/30 animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-lg relative z-10">
              <ChameleonLogo size={44} variant="dark" />
            </div>
            <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-slate-950 border-2 border-slate-900 flex items-center justify-center text-chan-turquoise">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-papo-coral/10 border border-papo-coral/30 flex items-center justify-center shadow-lg">
              <XCircle className="w-10 h-10 text-papo-coral" />
            </div>
          </div>
        )}

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono font-semibold tracking-wider text-chan-turquoise mb-3">
          <Clock className="w-3.5 h-3.5" />
          <span>{t('waitingRoom.badge')}</span>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
          {isRejected ? t('waitingRoom.rejectedTitle') : t('waitingRoom.title')}
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
          {isRejected ? t('waitingRoom.rejectedDesc') : t('waitingRoom.subtitle')}
        </p>

        {/* Room & Device Badge */}
        <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mb-6 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase font-mono font-bold tracking-wider">
              {t('room.header.roomCode')}
            </span>
            <span className="text-xs font-mono font-bold text-chan-turquoise px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
              {roomCode}
            </span>
          </div>

          <div className="h-px bg-slate-800/60" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">{t('waitingRoom.deviceInfo')}</span>
            <div className="flex items-center gap-1.5 text-slate-200 font-bold">
              {deviceType === 'mobile' ? (
                <Smartphone className="w-3.5 h-3.5 text-papo-coral" />
              ) : deviceType === 'desktop' ? (
                <Monitor className="w-3.5 h-3.5 text-chan-turquoise" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{username} ({deviceName})</span>
            </div>
          </div>
        </div>

        {/* Cancel / Leave Action Button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-sm font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4 text-papo-coral" />
          <span>{isRejected ? t('waitingRoom.backHome') : t('waitingRoom.cancel')}</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

