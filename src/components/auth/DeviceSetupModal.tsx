'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Volume2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { SerializedIdentity } from '@/core/crypto/storage';
import { MediaDevicesList } from '@/core/webrtc/MediaEngine';
import { AudioDiagnosticsMetrics } from '@/core/webrtc/AudioDiagnostics';
import { NoiseSuppressionMode } from '@/core/webrtc/NoiseSuppressionEngine';
import { AudioDiagnosticsAlert } from '@/components/call/AudioDiagnosticsAlert';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

export interface DeviceSetupModalProps {
  roomCode: string;
  identity: SerializedIdentity;
  userStream: MediaStream | null;
  audioLevel: number;
  audioDiagnostics?: AudioDiagnosticsMetrics | null;
  noiseSuppressionMode?: NoiseSuppressionMode;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  devices: MediaDevicesList;
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  selectedAudioOutput?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void | Promise<any>;
  onSwitchDevice: (kind: 'audio' | 'video' | 'output', deviceId: string) => void;
  onSetNoiseSuppressionMode?: (mode: NoiseSuppressionMode) => void;
  onUpdateProfile: (username: string, deviceName: string) => Promise<void>;
  onJoin: () => void;
  onCancel?: () => void;
}

export function DeviceSetupModal({
  roomCode,
  identity,
  userStream,
  audioLevel,
  audioDiagnostics = null,
  noiseSuppressionMode = 'ai-neural',
  isAudioMuted,
  isVideoMuted,
  devices,
  selectedAudioDevice,
  selectedVideoDevice,
  selectedAudioOutput = '',
  onToggleAudio,
  onToggleVideo,
  onSwitchDevice,
  onSetNoiseSuppressionMode,
  onUpdateProfile,
  onJoin,
  onCancel,
}: DeviceSetupModalProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState(identity.username);
  const [deviceName, setDeviceName] = useState(identity.deviceName);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoPreviewRef.current && userStream) {
      videoPreviewRef.current.srcObject = userStream;
    }
  }, [userStream]);

  const handleJoinClick = async () => {
    if (username !== identity.username || deviceName !== identity.deviceName) {
      await onUpdateProfile(username, deviceName);
    }
    onJoin();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 flex flex-col items-center">
      {/* Top Bar with Back Button */}
      {onCancel && (
        <div className="w-full flex items-center justify-start mb-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-white text-sm font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
          >
            <ArrowLeft className="w-4 h-4 text-papo-coral" />
            <span>{t('lobby.btn.backToHome')}</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-mono font-bold mb-3">
          <Shield className="w-4 h-4" />
          <span>{t('lobby.badge.zk')}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight leading-tight">
          {t('lobby.title')} <span className="font-mono text-chan-turquoise">{roomCode}</span>?
        </h1>
        <p className="text-base sm:text-lg text-slate-300 mt-2 max-w-xl mx-auto">
          {t('lobby.subtitle')}
        </p>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Video Preview, Dropdowns and AI Noise Suppression (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
            {userStream && !isVideoMuted ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl font-mono font-bold text-slate-200 mb-3 shadow-inner">
                  {username.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-base font-bold text-slate-300">{t('lobby.cameraOff')}</p>
              </div>
            )}

            {/* Mic Meter Bar Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 pointer-events-auto shadow-lg">
                <Mic className={cn('w-4 h-4', isAudioMuted ? 'text-rose-400' : 'text-emerald-400')} />
                <div className="w-28 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-100',
                      isAudioMuted ? 'bg-rose-500 w-0' : 'bg-emerald-400'
                    )}
                    style={{ width: isAudioMuted ? '0%' : `${Math.min(100, audioLevel * 1.2)}%` }}
                  />
                </div>
                {audioDiagnostics && !isAudioMuted && (
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {audioDiagnostics.rmsDb} dB
                  </span>
                )}
              </div>

              {/* Hardware Toggles */}
              <div className="flex items-center gap-2.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={onToggleAudio}
                  className={cn(
                    'p-3 rounded-xl border transition-all cursor-pointer shadow-md',
                    isAudioMuted
                      ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white'
                  )}
                  title={isAudioMuted ? t('lobby.mic.unmute') : t('lobby.mic.mute')}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleVideo()}
                  className={cn(
                    'p-3 rounded-xl border transition-all cursor-pointer shadow-md',
                    isVideoMuted
                      ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white'
                  )}
                  title={isVideoMuted ? t('lobby.video.on') : t('lobby.video.off')}
                >
                  {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Acoustic Quality / Noise Alert */}
          <AudioDiagnosticsAlert
            metrics={audioDiagnostics}
            isAudioMuted={isAudioMuted}
          />

          {/* Device Selection Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 text-xs flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('lobby.label.mic')}</span>
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => onSwitchDevice('audio', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 truncate font-medium"
              >
                {devices.audioInputs.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `${t('lobby.label.mic')} ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 text-xs flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('lobby.label.cam')}</span>
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => onSwitchDevice('video', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 truncate font-medium"
              >
                {devices.videoInputs.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `${t('lobby.label.cam')} ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 text-xs flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('lobby.label.speaker')}</span>
              </label>
              <select
                value={selectedAudioOutput}
                onChange={(e) => onSwitchDevice('output', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 truncate font-medium"
              >
                {devices.audioOutputs.length > 0 ? (
                  devices.audioOutputs.map((d, index) => (
                    <option key={d.deviceId || index} value={d.deviceId}>
                      {d.label || `${t('lobby.label.speaker')} ${index + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">{t('lobby.speaker.default')}</option>
                )}
              </select>
            </div>
          </div>

          {/* AI Noise Suppression Configurator (Moved below audio selectors) */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-chan-turquoise" />
                <span>{t('lobby.noise.title')}</span>
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                {t('lobby.noise.badge')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('off')}
                className={cn(
                  'py-2 px-2 rounded-lg text-xs sm:text-sm font-bold border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'off'
                    ? 'bg-slate-800 border-slate-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {t('lobby.noise.off')}
              </button>

              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('standard')}
                className={cn(
                  'py-2 px-2 rounded-lg text-xs sm:text-sm font-bold border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'standard'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {t('lobby.noise.standard')}
              </button>

              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('ai-neural')}
                className={cn(
                  'py-2 px-2 rounded-lg text-xs sm:text-sm font-bold border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'ai-neural'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {t('lobby.noise.ai')}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              {noiseSuppressionMode === 'ai-neural'
                ? t('lobby.noise.desc.ai')
                : noiseSuppressionMode === 'standard'
                ? t('lobby.noise.desc.standard')
                : t('lobby.noise.desc.off')}
            </p>
          </div>
        </div>

        {/* Right Column: Device Identity & Enter Room Button (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5 p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="space-y-5">
            <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">
              {t('lobby.identity.title')}
            </h3>

            {/* User Name Input */}
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-1.5">
                {t('lobby.identity.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('vault.userPlaceholder')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm sm:text-base text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            {/* Device Label Input */}
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-1.5">
                {t('lobby.identity.deviceName')}
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={t('vault.devicePlaceholder')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm sm:text-base text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Action Button: Full-width Enter Room Button */}
          <div className="pt-2">
            <button
              onClick={handleJoinClick}
              className="w-full py-4 px-6 rounded-xl bg-papo-coral hover:bg-papo-hover text-white font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-papo-coral/25 transition-all cursor-pointer active:scale-[0.99]"
            >
              <span>{t('lobby.btn.enter')}</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
