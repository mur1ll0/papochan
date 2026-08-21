'use client';

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  ShieldCheck,
  Settings,
  Volume2,
  VolumeX,
  Sparkles,
  Globe,
} from 'lucide-react';
import { MediaDevicesList } from '@/core/webrtc/MediaEngine';
import { NoiseSuppressionMode } from '@/core/webrtc/NoiseSuppressionEngine';
import { ScreenShareModal } from './ScreenShareModal';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

export interface ControlBarProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  hasScreenAudio?: boolean;
  isScreenAudioMuted?: boolean;
  isChatOpen: boolean;
  unreadCount?: number;
  peerCount: number;
  devices: MediaDevicesList;
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  selectedAudioOutput?: string;
  noiseSuppressionMode?: NoiseSuppressionMode;
  onToggleAudio: () => void;
  onToggleVideo: () => void | Promise<any>;
  onToggleScreenShare: (includeAudio?: boolean, frameRate?: number) => void | Promise<any>;
  onToggleScreenAudio?: () => void;
  onToggleChat: () => void;
  onOpenSecurity: () => void;
  onLeaveCall: () => void;
  onSwitchDevice: (kind: 'audio' | 'video' | 'output', deviceId: string) => void;
  onSetNoiseSuppressionMode?: (mode: NoiseSuppressionMode) => void;
}

export function ControlBar({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  hasScreenAudio = false,
  isScreenAudioMuted = false,
  isChatOpen,
  unreadCount = 0,
  peerCount,
  devices,
  selectedAudioDevice,
  selectedVideoDevice,
  selectedAudioOutput = '',
  noiseSuppressionMode = 'ai-neural',
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleScreenAudio,
  onToggleChat,
  onOpenSecurity,
  onLeaveCall,
  onSwitchDevice,
  onSetNoiseSuppressionMode,
}: ControlBarProps) {
  const { t, locale, setLocale } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenModal, setShowScreenModal] = useState(false);

  const handleScreenButtonClick = () => {
    if (isScreenSharing) {
      onToggleScreenShare(false);
    } else {
      setShowScreenModal(true);
    }
  };

  const handleStartShareFromModal = async (includeAudio: boolean, frameRate: number) => {
    setShowScreenModal(false);
    await onToggleScreenShare(includeAudio, frameRate);
  };

  return (
    <div className="relative flex items-center justify-center py-3 px-4 z-30">
      {/* Floating Flat Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 p-2 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl">
        {/* Audio (Mic) Button */}
        <button
          onClick={onToggleAudio}
          className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer',
            isAudioMuted
              ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-400'
              : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white'
          )}
          title={isAudioMuted ? t('call.control.mic.unmute') : t('call.control.mic.mute')}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-stealth-emerald" />}
        </button>

        {/* Video (Cam) Button */}
        <button
          onClick={() => onToggleVideo()}
          className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer',
            isVideoMuted
              ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-400'
              : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white'
          )}
          title={isVideoMuted ? t('call.control.cam.on') : t('call.control.cam.off')}
        >
          {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-chan-turquoise" />}
        </button>

        {/* Screen Share Group with Audio Controls */}
        <div className="relative flex items-center gap-1">
          <button
            onClick={handleScreenButtonClick}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer',
              isScreenSharing
                ? 'bg-chan-turquoise text-slate-950 font-bold shadow-lg shadow-chan-turquoise/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white'
            )}
            title={isScreenSharing ? t('call.control.screen.stop') : t('call.control.screen.share')}
          >
            <ScreenShare className="w-5 h-5" />
          </button>

          {/* Active Screen Audio Mute Toggle Button */}
          {isScreenSharing && hasScreenAudio && (
            <button
              onClick={onToggleScreenAudio}
              className={cn(
                'flex items-center justify-center w-9 h-11 rounded-xl border transition-all cursor-pointer',
                isScreenAudioMuted
                  ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-400'
                  : 'bg-stealth-emerald/20 hover:bg-stealth-emerald/30 border-stealth-emerald/40 text-stealth-emerald'
              )}
              title={
                isScreenAudioMuted
                  ? t('call.control.screenAudio.unmute')
                  : t('call.control.screenAudio.mute')
              }
            >
              {isScreenAudioMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4 animate-bounce" />
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-800 mx-1" />

        {/* E2EE Security Inspector */}
        <button
          onClick={onOpenSecurity}
          className="flex items-center gap-1.5 px-3 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-stealth-emerald/40 text-stealth-emerald transition-all cursor-pointer"
          title={t('call.control.security')}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-bold hidden md:inline">{t('call.control.security')}</span>
        </button>

        {/* Audio, Video & Language Settings */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={t('call.control.settings')}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Settings Popover */}
          {showSettings && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-80 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-left z-50 animate-fadeIn">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-papo-coral" />
                <span>{t('settings.title')}</span>
              </h4>

              {/* Language Selector inside Settings */}
              <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-papo-coral" />
                  <span>{t('settings.language')}</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLocale('pt-BR')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                      locale === 'pt-BR'
                        ? 'bg-papo-coral text-white border-papo-coral'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    )}
                  >
                    🇧🇷 Português
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('en')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                      locale === 'en'
                        ? 'bg-papo-coral text-white border-papo-coral'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    )}
                  >
                    🇺🇸 English
                  </button>
                </div>
              </div>

              {/* AI Noise Suppression Mode Toggle */}
              <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-chan-turquoise" />
                  <span>{t('settings.noiseSuppression')}</span>
                </label>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => onSetNoiseSuppressionMode?.('off')}
                    className={cn(
                      'py-1 px-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer text-center',
                      noiseSuppressionMode === 'off'
                        ? 'bg-slate-800 border-slate-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {t('settings.noise.off')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetNoiseSuppressionMode?.('standard')}
                    className={cn(
                      'py-1 px-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer text-center',
                      noiseSuppressionMode === 'standard'
                        ? 'bg-chan-turquoise/20 border-chan-turquoise text-chan-turquoise font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {t('settings.noise.standard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetNoiseSuppressionMode?.('ai-neural')}
                    className={cn(
                      'py-1 px-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer text-center',
                      noiseSuppressionMode === 'ai-neural'
                        ? 'bg-stealth-emerald/20 border-stealth-emerald text-stealth-emerald font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {t('settings.noise.ai')}
                  </button>
                </div>
              </div>

              {/* Microphone Select */}
              <div className="mb-2.5">
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Mic className="w-3 h-3 text-stealth-emerald" />
                  <span>{t('settings.mic')}</span>
                </label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => onSwitchDevice('audio', e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-papo-coral truncate"
                >
                  {devices.audioInputs.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Microphone ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Select */}
              <div className="mb-2.5">
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Video className="w-3 h-3 text-chan-turquoise" />
                  <span>{t('settings.cam')}</span>
                </label>
                <select
                  value={selectedVideoDevice}
                  onChange={(e) => onSwitchDevice('video', e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-papo-coral truncate"
                >
                  {devices.videoInputs.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker Output Select */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-chan-turquoise" />
                  <span>{t('settings.output')}</span>
                </label>
                <select
                  value={selectedAudioOutput}
                  onChange={(e) => onSwitchDevice('output', e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-papo-coral truncate"
                >
                  {devices.audioOutputs.length > 0 ? (
                    devices.audioOutputs.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Speaker ${idx + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="">Default System Output</option>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Chat Toggle Button */}
        <button
          onClick={onToggleChat}
          className={cn(
            'relative flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer',
            isChatOpen
              ? 'bg-papo-coral/20 border border-papo-coral text-papo-coral'
              : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white'
          )}
          title={t('call.control.chat')}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-papo-coral text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Disconnect / End Call Button */}
        <button
          onClick={onLeaveCall}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer"
          title={t('call.control.leave')}
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Screen Share Setup Modal */}
      <ScreenShareModal
        isOpen={showScreenModal}
        onClose={() => setShowScreenModal(false)}
        onStartShare={handleStartShareFromModal}
      />
    </div>
  );
}
