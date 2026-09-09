'use client';

import React, { useEffect, useState } from 'react';
import { X, UserPlus, PhoneCall, Check, Loader2, Monitor, Smartphone, Laptop } from 'lucide-react';
import { RemotePeerNode } from '@/core/webrtc/MeshManager';
import { SerializedIdentity, TrustedContact } from '@/core/crypto/storage';
import { cn } from '@/lib/utils';

export interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  localIdentity: SerializedIdentity;
  peers: RemotePeerNode[];
  contacts: TrustedContact[];
  /** Contact currently ringing, so the row can show it. */
  ringingContactId?: string | null;
  onSavePeer: (peer: RemotePeerNode) => void;
  onInviteContact: (contact: TrustedContact) => void;
}

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'mobile') return <Smartphone className={className} />;
  if (type === 'desktop') return <Laptop className={className} />;
  return <Monitor className={className} />;
}

export function ParticipantsPanel({
  isOpen,
  onClose,
  localIdentity,
  peers,
  contacts,
  ringingContactId,
  onSavePeer,
  onInviteContact,
}: ParticipantsPanelProps) {
  const [savedDeviceIds, setSavedDeviceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSavedDeviceIds(new Set(contacts.map((c) => c.deviceId)));
  }, [contacts]);

  if (!isOpen) return null;

  // A contact already sitting in the call cannot be invited into it again.
  const presentDeviceIds = new Set([
    localIdentity.deviceId,
    ...peers.map((p) => p.deviceId),
  ]);
  const invitableContacts = contacts.filter((c) => !presentDeviceIds.has(c.deviceId));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <aside className="fixed z-50 right-0 top-0 h-full w-full sm:w-96 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col">
        <header className="h-16 shrink-0 px-5 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-100">
            Participantes ({peers.length + 1})
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* In the call */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Na chamada
            </h3>

            <ul className="space-y-2">
              <li className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <DeviceIcon type={localIdentity.deviceType} className="w-4 h-4 text-chan-turquoise shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {localIdentity.username} <span className="text-slate-500 font-normal">(você)</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">{localIdentity.deviceName}</p>
                </div>
              </li>

              {peers.map((peer) => {
                const isSaved = savedDeviceIds.has(peer.deviceId);
                return (
                  <li
                    key={peer.nodeId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800"
                  >
                    <DeviceIcon type={peer.deviceType} className="w-4 h-4 text-papo-coral shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 truncate">{peer.username}</p>
                      <p className="text-xs text-slate-500 truncate">{peer.deviceName}</p>
                    </div>

                    {isSaved ? (
                      <span
                        className="flex items-center gap-1 text-[11px] font-bold text-stealth-emerald shrink-0"
                        title="Já está nos seus contatos"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Salvo
                      </span>
                    ) : (
                      <button
                        onClick={() => onSavePeer(peer)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-chan-turquoise/15 border border-chan-turquoise/40 text-chan-turquoise hover:bg-chan-turquoise/25 transition-colors cursor-pointer shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Salvar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Invite from the vault */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Chamar para esta sala
            </h3>

            {invitableContacts.length === 0 ? (
              <p className="text-xs text-slate-500 leading-relaxed p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                {contacts.length === 0
                  ? 'Nenhum contato salvo ainda. Salve alguém desta chamada para poder chamá-lo depois.'
                  : 'Todos os seus contatos já estão nesta chamada.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {invitableContacts.map((contact) => {
                  const isRinging = ringingContactId === contact.id;
                  return (
                    <li
                      key={contact.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800"
                    >
                      <DeviceIcon type="browser" className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-100 truncate">{contact.alias}</p>
                        <p className="text-xs text-slate-500 truncate">{contact.deviceName}</p>
                      </div>

                      <button
                        onClick={() => onInviteContact(contact)}
                        disabled={isRinging}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors shrink-0',
                          isRinging
                            ? 'bg-slate-900 border-slate-700 text-slate-400 cursor-default'
                            : 'bg-papo-coral/15 border-papo-coral/40 text-papo-coral hover:bg-papo-coral/25 cursor-pointer'
                        )}
                      >
                        {isRinging ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Chamando
                          </>
                        ) : (
                          <>
                            <PhoneCall className="w-3.5 h-3.5" />
                            Chamar
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              O contato recebe a chamada tocando no aparelho dele. Ao atender, entra direto — sem
              precisar de aprovação, porque você mesmo o chamou.
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
