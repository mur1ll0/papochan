'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowRight,
  Plus,
  Radio,
  RefreshCw,
  Edit3,
  Layers,
  BookUser,
  Check,
  X,
  Laptop,
} from 'lucide-react';
import { useCrypto } from '@/hooks/useCrypto';
import { useDirectCalls } from '@/hooks/useDirectCalls';
import { useI18n } from '@/i18n/context';
import { ContactsList } from '@/components/contacts/ContactsList';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { OutgoingCallModal } from '@/components/call/OutgoingCallModal';
import { ChameleonLogo } from '@/components/brand/ChameleonLogo';
import { LanguageSwitcher } from '@/components/brand/LanguageSwitcher';
import { generateRoomCode } from '@/lib/utils';
import { getApiEndpoint } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { identity, isLoading, updateProfile } = useCrypto();
  const directCalls = useDirectCalls(identity);

  const [activeTab, setActiveTab] = useState<'rooms' | 'contacts'>('rooms');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempDeviceName, setTempDeviceName] = useState('');

  const handleCreateRoom = async () => {
    setIsCreating(true);
    const code = generateRoomCode();
    try {
      await fetch(getApiEndpoint('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code }),
      });
    } catch (err) {
      console.warn('[HomePage] Fallback to direct room route:', err);
    } finally {
      router.push(`/room/${code}`);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode) {
      router.push(`/room/${cleanCode}`);
    }
  };

  const startEditDevice = () => {
    if (identity) {
      setTempUsername(identity.username);
      setTempDeviceName(identity.deviceName);
      setIsEditingDevice(true);
    }
  };

  const saveDeviceProfile = async () => {
    if (tempUsername.trim() && tempDeviceName.trim()) {
      await updateProfile(tempUsername.trim(), tempDeviceName.trim());
      setIsEditingDevice(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-papo-coral selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-papo-coral/15 border border-papo-coral/40 flex items-center justify-center text-papo-coral shadow-md">
              <ChameleonLogo size={28} color="#FFFFFF" accentColor="#FF6B4A" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white flex items-center font-sans">
                Papo<span className="text-papo-coral">Chan</span>
              </span>
              <span className="text-[11px] text-slate-400 block -mt-1 font-medium hidden sm:block">
                {t('app.tagline')}
              </span>
            </div>
          </div>

          {/* Header Controls: Direct Call Badge & Language Selector */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-stealth-emerald animate-pulse" />
              <span>{t('app.badge.directCalls')}</span>
            </div>

            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Hero & Actions (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Hero Section with Large Mascot Logo & Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-900 border-2 border-papo-coral/40 flex items-center justify-center p-3 shadow-xl shrink-0">
                <ChameleonLogo size={72} color="#FFFFFF" accentColor="#FF6B4A" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-stealth-emerald text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-stealth-emerald" />
                  <span>{t('app.badge.e2ee')}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight font-sans">
                  {t('home.hero.title')}{' '}
                  <span className="text-papo-coral underline decoration-chan-turquoise decoration-wavy decoration-2">
                    {t('home.hero.titleHighlight')}
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                  {t('home.hero.subtitle')}
                </p>
              </div>
            </div>

            {/* Navigation Tabs (Instant Rooms vs Saved Contacts) */}
            <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('rooms')}
                className={cn(
                  'flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer',
                  activeTab === 'rooms'
                    ? 'bg-papo-coral text-white shadow-lg shadow-papo-coral/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                )}
              >
                <Radio className="w-4 h-4" />
                <span>{t('home.tab.rooms')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contacts')}
                className={cn(
                  'flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative',
                  activeTab === 'contacts'
                    ? 'bg-chan-turquoise text-slate-950 shadow-lg shadow-chan-turquoise/25 font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                )}
              >
                <BookUser className="w-4 h-4" />
                <span>{t('home.tab.contacts')}</span>
                {directCalls.contacts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-950 text-chan-turquoise text-[10px] font-extrabold">
                    {directCalls.contacts.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: Instant Rooms Creation & Joining */}
            {activeTab === 'rooms' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Create Room Button with High Contrast Papo Coral */}
                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl bg-papo-coral hover:bg-papo-hover text-white font-black text-sm sm:text-base shadow-xl shadow-papo-coral/30 transition-all duration-150 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                    <span>{isCreating ? t('home.btn.creatingRoom') : t('home.btn.createRoom')}</span>
                  </button>

                  {/* Join Room Form */}
                  <form onSubmit={handleJoinRoom} className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder={t('home.input.roomCode')}
                      className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl px-4 py-3 text-sm font-mono font-bold tracking-wider text-slate-100 placeholder-slate-500 focus:outline-none focus:border-chan-turquoise"
                    />
                    <button
                      type="submit"
                      disabled={!joinCode.trim()}
                      className="px-5 rounded-2xl bg-chan-turquoise hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center"
                      title={t('home.btn.join')}
                    >
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </form>
                </div>

                {/* Multi-Device Feature Highlight Card */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-3.5 text-xs text-slate-300">
                  <div className="p-2 rounded-xl bg-chan-turquoise/10 border border-chan-turquoise/30 text-chan-turquoise shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white font-bold block text-sm mb-0.5">
                      {t('home.feature.coPresence.title')}
                    </strong>
                    {t('home.feature.coPresence.desc')}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Trusted Contacts / Saved Devices List */}
            {activeTab === 'contacts' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
                <ContactsList
                  contacts={directCalls.contacts}
                  onCall={directCalls.callContact}
                  onDelete={directCalls.deleteContact}
                  onUpdateAlias={directCalls.updateAlias}
                />
              </div>
            )}
          </div>

          {/* Right Column: Clean Device Profile & Rename (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-papo-coral" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {t('vault.title')}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-stealth-emerald/15 border border-stealth-emerald/40 text-stealth-emerald flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-stealth-emerald" />
                {t('vault.status.secured')}
              </span>
            </div>

            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-papo-coral" />
                <span>{t('common.loading')}</span>
              </div>
            ) : identity ? (
              <div className="space-y-4">
                {isEditingDevice ? (
                  /* Inline Device Rename Form */
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-700 space-y-3 animate-fadeIn">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {t('vault.username.label')}
                      </label>
                      <input
                        type="text"
                        value={tempUsername}
                        onChange={(e) => setTempUsername(e.target.value)}
                        placeholder={t('vault.userPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-papo-coral"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {t('vault.deviceName.label')}
                      </label>
                      <input
                        type="text"
                        value={tempDeviceName}
                        onChange={(e) => setTempDeviceName(e.target.value)}
                        placeholder={t('vault.devicePlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-papo-coral"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveDeviceProfile}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        <span>{t('vault.btn.save')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDevice(false)}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>{t('vault.btn.cancel')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Clean Device Card */
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">
                        {identity.username}
                      </span>
                      <span className="text-white font-extrabold text-base block mt-0.5">
                        {identity.deviceName}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {identity.deviceType === 'mobile' ? 'Dispositivo Móvel' : 'Computador / Desktop'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={startEditDevice}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold transition-all cursor-pointer hover:scale-105 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4 text-papo-coral" />
                      <span>{t('vault.btn.edit')}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Real-time Ringing Overlays */}
      <IncomingCallModal
        call={directCalls.incomingCall}
        onAccept={directCalls.acceptIncomingCall}
        onReject={directCalls.rejectIncomingCall}
      />

      <OutgoingCallModal
        call={directCalls.outgoingCall}
        onCancel={directCalls.cancelOutgoingCall}
      />

      {/* Clean Modern Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-400">
        <span className="font-bold text-slate-200">PapoChan</span> • {t('app.tagline')}
      </footer>
    </main>
  );
}
