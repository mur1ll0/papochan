'use client';

import React from 'react';
import { PhoneOff, Radio } from 'lucide-react';
import { OutgoingCallInfo } from '@/hooks/useDirectCalls';
import { useI18n } from '@/i18n/context';

export interface OutgoingCallModalProps {
  call: OutgoingCallInfo | null;
  onCancel: () => void;
}

export function OutgoingCallModal({ call, onCancel }: OutgoingCallModalProps) {
  const { t } = useI18n();
  if (!call) return null;

  const isRejected = call.status === 'rejected';
  const isTimeout = call.status === 'timeout';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center animate-fadeIn">
        {/* Pulsing Avatar */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-chan-turquoise/10 border-2 border-chan-turquoise flex items-center justify-center text-3xl font-extrabold text-chan-turquoise shadow-lg">
            {call.contact.alias.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chan-turquoise opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-chan-turquoise items-center justify-center text-slate-950">
              <Radio className="w-3.5 h-3.5" />
            </span>
          </span>
        </div>

        {/* Status */}
        <span className="text-xs font-semibold text-chan-turquoise uppercase tracking-wider mb-1">
          {isRejected
            ? t('call.outgoing.rejected')
            : isTimeout
            ? t('call.outgoing.noAnswer')
            : t('call.outgoing.title')}
        </span>

        {/* Contact Alias */}
        <h2 className="text-2xl font-black text-white tracking-tight mb-1">
          {call.contact.alias}
        </h2>

        <span className="text-xs text-slate-400 mb-6">
          {call.contact.deviceName}
        </span>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105"
        >
          <PhoneOff className="w-4 h-4 text-rose-400" />
          <span>{isRejected || isTimeout ? t('common.close') : t('call.outgoing.cancel')}</span>
        </button>
      </div>
    </div>
  );
}
