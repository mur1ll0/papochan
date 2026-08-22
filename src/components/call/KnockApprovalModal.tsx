'use client';

import React from 'react';
import {
  UserPlus,
  Check,
  X,
  Smartphone,
  Monitor,
  Globe,
  Shield,
} from 'lucide-react';
import { DeviceMetadata } from '@/core/signaling/SignalingClient';
import { useI18n } from '@/i18n/context';

export interface KnockApprovalModalProps {
  pendingKnocks: Array<{
    senderId: string;
    meta: DeviceMetadata;
    timestamp: number;
  }>;
  onApprove: (senderId: string) => void;
  onReject: (senderId: string) => void;
}

export function KnockApprovalModal({
  pendingKnocks,
  onApprove,
  onReject,
}: KnockApprovalModalProps) {
  const { t } = useI18n();

  if (!pendingKnocks || pendingKnocks.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-auto animate-slideDown select-none">
      {pendingKnocks.map((knock) => {
        const { senderId, meta } = knock;
        const deviceType = meta.deviceType || 'browser';
        const pubKeyFingerprint = meta.publicKeyEd
          ? meta.publicKeyEd.slice(0, 8)
          : '';

        return (
          <div
            key={senderId}
            className="bg-slate-900/95 border-2 border-chan-turquoise/50 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl shadow-chan-turquoise/10 flex flex-col gap-3.5 transition-all"
          >
            {/* Top Bar: Alert Title & Timestamp */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-chan-turquoise text-xs font-bold font-mono tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-chan-turquoise animate-ping" />
                <UserPlus className="w-4 h-4" />
                <span>{t('knockModal.title')}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {new Date(knock.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            {/* Middle: User & Device Details */}
            <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-200 shrink-0">
                {deviceType === 'mobile' ? (
                  <Smartphone className="w-5 h-5 text-papo-coral" />
                ) : deviceType === 'desktop' ? (
                  <Monitor className="w-5 h-5 text-chan-turquoise" />
                ) : (
                  <Globe className="w-5 h-5 text-slate-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {meta.username}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {meta.deviceName}
                </div>
              </div>

              {pubKeyFingerprint && (
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-stealth-emerald/90 bg-stealth-emerald/10 border border-stealth-emerald/30 px-2 py-0.5 rounded-md shrink-0">
                  <Shield className="w-3 h-3" />
                  <span>{pubKeyFingerprint}</span>
                </div>
              )}
            </div>

            {/* Prompt Subtitle */}
            <p className="text-xs text-slate-300">
              {t('knockModal.subtitle')}
            </p>

            {/* Action Buttons: Allow vs Reject */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onReject(senderId)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-papo-coral/50 text-slate-400 hover:text-papo-coral text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>{t('knockModal.reject')}</span>
              </button>

              <button
                type="button"
                onClick={() => onApprove(senderId)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-stealth-emerald/20 hover:bg-stealth-emerald/30 border border-stealth-emerald/50 text-stealth-emerald hover:text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm shadow-stealth-emerald/20 active:scale-95 hover:scale-[1.02]"
              >
                <Check className="w-4 h-4" />
                <span>{t('knockModal.allow')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
