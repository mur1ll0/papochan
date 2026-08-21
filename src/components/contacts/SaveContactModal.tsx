'use client';

import React, { useState } from 'react';
import { UserPlus, X, Check } from 'lucide-react';
import { TrustedContact } from '@/core/crypto/storage';
import { useI18n } from '@/i18n/context';

export interface SaveContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: {
    userId: string;
    deviceId: string;
    deviceName: string;
    username: string;
    publicKeyEd: string;
    publicKeyDh: string;
    fingerprint?: string;
  };
  onSave: (contact: TrustedContact) => Promise<void>;
}

export function SaveContactModal({
  isOpen,
  onClose,
  peer,
  onSave,
}: SaveContactModalProps) {
  const { t } = useI18n();
  const [alias, setAlias] = useState(
    `${peer.username} (${peer.deviceName || 'Device'})`
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias.trim()) return;

    setIsSaving(true);
    try {
      const contact: TrustedContact = {
        id: `${peer.userId}:${peer.deviceId}`,
        alias: alias.trim(),
        userId: peer.userId,
        deviceId: peer.deviceId,
        deviceName: peer.deviceName,
        username: peer.username,
        publicKeyEd: peer.publicKeyEd,
        publicKeyDh: peer.publicKeyDh,
        fingerprint: peer.fingerprint || '',
        createdAt: Date.now(),
      };

      await onSave(contact);
      onClose();
    } catch (err) {
      console.error('[SaveContactModal] Failed to save contact:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-7 shadow-2xl animate-fadeIn space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {t('contacts.save.title')}
              </h3>
              <p className="text-sm text-slate-300">
                {t('contacts.save.desc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-1.5">
              {t('contacts.save.aliasLabel')}
            </label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={t('contacts.save.aliasPlaceholder')}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm sm:text-base text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              autoFocus
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-sm font-mono">
            <div className="flex justify-between text-slate-300">
              <span>{t('contacts.save.origUser')}</span>
              <span className="text-slate-100 font-bold">{peer.username}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>{t('contacts.save.device')}</span>
              <span className="text-slate-100 font-bold">{peer.deviceName}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>{t('contacts.save.cryptoId')}</span>
              <span className="text-chan-turquoise text-xs font-bold truncate max-w-[200px]">
                {peer.deviceId.slice(0, 16)}...
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm sm:text-base font-semibold transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving || !alias.trim()}
              className="flex-1 py-3 px-4 rounded-xl bg-papo-coral hover:bg-papo-hover disabled:opacity-50 text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? t('contacts.save.btnSaving') : t('contacts.save.btnSave')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
