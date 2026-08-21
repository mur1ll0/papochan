'use client';

import React from 'react';
import { Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import { IncomingCallInfo } from '@/hooks/useDirectCalls';
import { useI18n } from '@/i18n/context';

export interface IncomingCallModalProps {
  call: IncomingCallInfo | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  call,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const { t } = useI18n();
  if (!call) return null;

  const displayName = call.callerAlias || call.callerUsername;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      {/* Outer Card */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
        {/* Pulsing Avatar */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-papo-coral/10 border-2 border-papo-coral flex items-center justify-center text-3xl font-extrabold text-papo-coral shadow-lg">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-papo-coral opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-papo-coral items-center justify-center text-white">
              <Phone className="w-3 h-3" />
            </span>
          </span>
        </div>

        {/* Status Text */}
        <span className="text-xs font-semibold text-papo-coral uppercase tracking-wider mb-1">
          {t('call.incoming.title')}
        </span>

        {/* Caller Name */}
        <h2 className="text-2xl font-black text-white tracking-tight mb-1">
          {displayName}
        </h2>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mb-6">
          {displayName} {t('call.incoming.callingYou')}
        </p>

        {/* Action Buttons: Accept & Reject */}
        <div className="grid grid-cols-2 gap-3.5 w-full">
          {/* Reject */}
          <button
            onClick={onReject}
            className="py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <PhoneOff className="w-4 h-4 text-rose-400" />
            <span>{t('call.incoming.reject')}</span>
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="py-3.5 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>{t('call.incoming.accept')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
