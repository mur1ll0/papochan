'use client';

import React, { useState } from 'react';
import {
  Phone,
  ShieldCheck,
  Edit2,
  Trash2,
  UserPlus,
  Check,
  X,
  Search,
} from 'lucide-react';
import { TrustedContact } from '@/core/crypto/storage';
import { useI18n } from '@/i18n/context';

export interface ContactsListProps {
  contacts: TrustedContact[];
  onCall: (contact: TrustedContact) => void;
  onDelete: (id: string) => void;
  onUpdateAlias: (id: string, newAlias: string) => void;
}

export function ContactsList({
  contacts,
  onCall,
  onDelete,
  onUpdateAlias,
}: ContactsListProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const filteredContacts = contacts.filter(
    (c) =>
      c.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.deviceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startEdit = (c: TrustedContact) => {
    setEditingId(c.id);
    setEditingText(c.alias);
  };

  const saveEdit = (id: string) => {
    if (editingText.trim()) {
      onUpdateAlias(id, editingText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="w-full space-y-5">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('contacts.search')}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-papo-coral font-medium"
        />
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <div className="p-10 rounded-2xl bg-slate-950/60 border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            <UserPlus className="w-7 h-7 text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-slate-100 mb-1.5">
            {t('contacts.empty')}
          </h4>
          <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
            {t('contacts.emptyHelp')}
          </p>
        </div>
      )}

      {/* Contacts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-md"
          >
            {/* Top Info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 truncate">
                <div className="w-12 h-12 rounded-2xl bg-papo-coral/15 border border-papo-coral/35 flex items-center justify-center text-papo-coral font-black text-base shrink-0 shadow-sm">
                  {contact.alias.slice(0, 2).toUpperCase()}
                </div>

                <div className="truncate">
                  {editingId === contact.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="bg-slate-950 border border-papo-coral rounded-lg px-2.5 py-1 text-sm text-white font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(contact.id)}
                        className="p-1.5 text-papo-coral hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.save')}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.cancel')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-100 truncate">
                        {contact.alias}
                      </h4>
                      <button
                        onClick={() => startEdit(contact)}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
                        title={t('contacts.btn.editAlias')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-300 font-medium mt-0.5">
                    <span className="font-semibold text-slate-200">{contact.deviceName}</span>
                    <span>•</span>
                    <span className="text-slate-400">{contact.username}</span>
                  </div>
                </div>
              </div>

              {/* Delete Action */}
              <button
                onClick={() => onDelete(contact.id)}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition-colors"
                title={t('contacts.btn.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom: Security Status & Call Button */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-sm">
              <div className="flex items-center gap-1.5 text-xs text-stealth-emerald font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t('vault.status.secured')}</span>
              </div>

              <button
                onClick={() => onCall(contact)}
                className="px-4 py-2 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-bold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span>{t('contacts.btn.call')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
