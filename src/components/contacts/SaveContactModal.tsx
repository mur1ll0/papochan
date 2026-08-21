'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserPlus, X, Check, Laptop, Smartphone } from 'lucide-react';
import { TrustedContact } from '@/core/crypto/storage';

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
  const [alias, setAlias] = useState(
    `${peer.username} (${peer.deviceName || 'Dispositivo'})`
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
      <div className="bg-tactical-900 border border-tactical-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Salvar Dispositivo Confiável
              </h3>
              <p className="text-xs text-slate-400">
                Ligue diretamente no futuro sem precisar de código de sala.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-tactical-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
              Apelido do Contato (Como deseja chamá-lo?)
            </label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Ex: PC do Murillo, Notebook Trabalho"
              className="w-full bg-tactical-950 border border-tactical-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              autoFocus
            />
          </div>

          <div className="p-3 rounded-xl bg-tactical-950 border border-tactical-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Usuário Original:</span>
              <span className="text-slate-200 font-semibold">{peer.username}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Dispositivo:</span>
              <span className="text-slate-200">{peer.deviceName}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>ID Criptográfico:</span>
              <span className="text-cipher-cyan text-[11px] truncate max-w-[200px]">
                {peer.deviceId.slice(0, 16)}...
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-tactical-700 text-slate-300 hover:bg-tactical-800 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !alias.trim()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Contato</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
