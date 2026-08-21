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
    <div className="w-full space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('contacts.search')}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-papo-coral"
        />
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <UserPlus className="w-6 h-6 text-slate-500" />
          </div>
          <h4 className="text-sm font-bold text-slate-200 mb-1">
            {t('contacts.empty')}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm">
            {t('contacts.emptyHelp')}
          </p>
        </div>
      )}

      {/* Contacts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-md"
          >
            {/* Top Info */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-papo-coral/10 border border-papo-coral/30 flex items-center justify-center text-papo-coral font-bold text-sm shrink-0">
                  {contact.alias.slice(0, 2).toUpperCase()}
                </div>

                <div className="truncate">
                  {editingId === contact.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="bg-slate-950 border border-papo-coral rounded px-2 py-0.5 text-xs text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(contact.id)}
                        className="p-1 text-papo-coral hover:bg-slate-800 rounded"
                        title={t('common.save')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                        title={t('common.cancel')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-100 truncate">
                        {contact.alias}
                      </h4>
                      <button
                        onClick={() => startEdit(contact)}
                        className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                        title={t('contacts.btn.editAlias')}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{contact.deviceName}</span>
                    <span>•</span>
                    <span className="text-slate-400">{contact.username}</span>
                  </div>
                </div>
              </div>

              {/* Delete Action */}
              <button
                onClick={() => onDelete(contact.id)}
                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title={t('contacts.btn.delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom: Security Status & Call Button */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-1 text-[11px] text-stealth-emerald font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t('vault.status.secured')}</span>
              </div>

              <button
                onClick={() => onCall(contact)}
                className="px-3.5 py-1.5 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{t('contacts.btn.call')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
