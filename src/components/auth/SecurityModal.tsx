'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  Lock,
  Key,
  Smartphone,
  Monitor,
  Globe,
  Radio,
  UserPlus,
} from 'lucide-react';
import { SerializedIdentity, saveTrustedContact } from '@/core/crypto/storage';
import { RemotePeerNode } from '@/core/webrtc/MeshManager';
import { SaveContactModal } from '@/components/contacts/SaveContactModal';

export interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  localIdentity: SerializedIdentity;
  peers: RemotePeerNode[];
}

export function SecurityModal({
  isOpen,
  onClose,
  localIdentity,
  peers,
}: SecurityModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savingPeer, setSavingPeer] = useState<RemotePeerNode | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveContact = async (contact: any) => {
    await saveTrustedContact(contact);
    setSavedSuccessId(contact.id);
    setTimeout(() => setSavedSuccessId(null), 3000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-2xl bg-tactical-950 border border-tactical-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="p-5 border-b border-tactical-800 flex items-center justify-between bg-tactical-900/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  End-to-End Cryptographic Verification
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Zero-Knowledge Proof & Peer Safety Numbers
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-tactical-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Local Device Identity Section */}
            <div className="p-4 rounded-xl bg-tactical-900 border border-tactical-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Your Device Identity Keys
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                  Non-Extractable Vault
                </span>
              </div>

              {/* Device Name and ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-tactical-950 p-2.5 rounded-lg border border-tactical-800">
                  <span className="text-slate-500 block text-[10px]">DEVICE / TYPE</span>
                  <span className="text-slate-200 font-medium">
                    {localIdentity.deviceName} ({localIdentity.deviceType})
                  </span>
                </div>
                <div className="bg-tactical-950 p-2.5 rounded-lg border border-tactical-800">
                  <span className="text-slate-500 block text-[10px]">DEVICE ID</span>
                  <span className="text-slate-300 truncate block">
                    {localIdentity.deviceId.slice(0, 16)}...
                  </span>
                </div>
              </div>

              {/* Public Key Details */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded bg-tactical-950 border border-tactical-850">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Ed25519 PUBLIC SIGNING KEY</span>
                    <span className="text-cipher-cyan text-[11px] truncate max-w-[260px] sm:max-w-[400px] block">
                      {localIdentity.publicKeyEd}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localIdentity.publicKeyEd, 'ed-local')}
                    className="p-1.5 text-slate-400 hover:text-slate-200"
                  >
                    {copiedKey === 'ed-local' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-tactical-950 border border-tactical-850">
                  <div>
                    <span className="text-slate-500 text-[10px] block">X25519 PUBLIC DIFFIE-HELLMAN KEY</span>
                    <span className="text-cipher-cyan text-[11px] truncate max-w-[260px] sm:max-w-[400px] block">
                      {localIdentity.publicKeyDh}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localIdentity.publicKeyDh, 'dh-local')}
                    className="p-1.5 text-slate-400 hover:text-slate-200"
                  >
                    {copiedKey === 'dh-local' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remote Connected Peer Verification */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Active Mesh Participants ({peers.length})
              </h3>

              {peers.length === 0 ? (
                <div className="p-6 rounded-xl bg-tactical-900 border border-tactical-800 text-center text-slate-400 text-xs font-mono">
                  No other peers in the cryptographic mesh yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {peers.map((peer) => (
                    <div
                      key={peer.nodeId}
                      className="p-4 rounded-xl bg-tactical-900 border border-tactical-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {peer.deviceType === 'mobile' ? (
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Monitor className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-sm font-semibold text-slate-200">{peer.username}</span>
                          <span className="text-xs text-slate-400 font-mono">({peer.deviceName})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                          {peer.connectionState.toUpperCase()}
                        </span>
                      </div>

                      {/* Safety Number Display */}
                      <div className="p-3 rounded-lg bg-tactical-950 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-emerald-400 block font-semibold">
                            VERIFICATION SAFETY NUMBER:
                          </span>
                          <span className="text-base sm:text-lg font-mono font-bold tracking-widest text-slate-100">
                            {peer.safetyNumber || 'DERIVING...'}
                          </span>
                        </div>

                        <button
                          onClick={() => copyToClipboard(peer.safetyNumber, peer.nodeId)}
                          className="p-2 rounded-lg bg-tactical-900 border border-tactical-700 text-slate-300 hover:text-white"
                          title="Copy Safety Number"
                        >
                          {copiedKey === peer.nodeId ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Save Contact Action */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          <span>DTLS 1.2 / AES-256-GCM</span>
                        </div>

                        <button
                          onClick={() => setSavingPeer(peer)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {savedSuccessId === `${peer.userId}:${peer.deviceId}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Salvo nos Contatos!</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Salvar como Contato</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-tactical-800 bg-tactical-900/60 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-tactical-800 hover:bg-tactical-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Fechar Inspetor
            </button>
          </div>
        </div>
      </div>

      {/* Save Contact Sub-Modal */}
      {savingPeer && (
        <SaveContactModal
          isOpen={!!savingPeer}
          onClose={() => setSavingPeer(null)}
          peer={savingPeer}
          onSave={handleSaveContact}
        />
      )}
    </>
  );
}
