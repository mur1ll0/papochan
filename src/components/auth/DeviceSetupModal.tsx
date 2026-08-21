'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Smartphone,
  Monitor,
  Globe,
  CheckCircle,
  ArrowRight,
  Volume2,
  Sparkles,
  Activity,
} from 'lucide-react';
import { SerializedIdentity } from '@/core/crypto/storage';
import { MediaDevicesList } from '@/core/webrtc/MediaEngine';
import { AudioDiagnosticsMetrics } from '@/core/webrtc/AudioDiagnostics';
import { NoiseSuppressionMode } from '@/core/webrtc/NoiseSuppressionEngine';
import { AudioDiagnosticsAlert } from '@/components/call/AudioDiagnosticsAlert';
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
}: DeviceSetupModalProps) {
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
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-2">
          <Shield className="w-3.5 h-3.5" />
          <span>ZERO-KNOWLEDGE LOBBY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Ready to join room <span className="font-mono text-cipher-cyan">{roomCode}</span>?
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure your camera, microphone, and AI noise suppression settings.
        </p>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Video Preview and Mute Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-tactical-950 border border-tactical-800 shadow-2xl flex items-center justify-center">
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
                <div className="w-16 h-16 rounded-2xl bg-tactical-850 border border-tactical-700 flex items-center justify-center text-xl font-mono font-bold text-slate-300 mb-2">
                  {username.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-slate-300">Camera is off</p>
              </div>
            )}

            {/* Mic Meter Bar Overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tactical-950/80 backdrop-blur-md border border-tactical-800 pointer-events-auto">
                <Mic className={cn('w-4 h-4', isAudioMuted ? 'text-rose-400' : 'text-emerald-400')} />
                <div className="w-24 bg-tactical-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-100',
                      isAudioMuted ? 'bg-rose-500 w-0' : 'bg-emerald-400'
                    )}
                    style={{ width: isAudioMuted ? '0%' : `${Math.min(100, audioLevel * 1.2)}%` }}
                  />
                </div>
                {audioDiagnostics && !isAudioMuted && (
                  <span className="text-[10px] font-mono text-slate-400">
                    {audioDiagnostics.rmsDb} dB
                  </span>
                )}
              </div>

              {/* Hardware Toggles */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={onToggleAudio}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all cursor-pointer',
                    isAudioMuted
                      ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                      : 'bg-tactical-900 border-tactical-700 text-slate-200 hover:text-white'
                  )}
                  title={isAudioMuted ? 'Unmute' : 'Mute'}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleVideo()}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all cursor-pointer',
                    isVideoMuted
                      ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                      : 'bg-tactical-900 border-tactical-700 text-slate-200 hover:text-white'
                  )}
                  title={isVideoMuted ? 'Turn on video' : 'Turn off video'}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Acoustic Quality / Noise Alert */}
          <AudioDiagnosticsAlert
            metrics={audioDiagnostics}
            isAudioMuted={isAudioMuted}
          />

          {/* Device Selection Dropdowns (3 cols: Mic, Cam, Speaker) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[11px] flex items-center gap-1">
                <Mic className="w-3 h-3 text-emerald-400" />
                <span>Microphone</span>
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => onSwitchDevice('audio', e.target.value)}
                className="w-full bg-tactical-900 border border-tactical-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 truncate"
              >
                {devices.audioInputs.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[11px] flex items-center gap-1">
                <Video className="w-3 h-3 text-cyan-400" />
                <span>Camera</span>
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => onSwitchDevice('video', e.target.value)}
                className="w-full bg-tactical-900 border border-tactical-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 truncate"
              >
                {devices.videoInputs.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[11px] flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-blue-400" />
                <span>Speaker Output</span>
              </label>
              <select
                value={selectedAudioOutput}
                onChange={(e) => onSwitchDevice('output', e.target.value)}
                className="w-full bg-tactical-900 border border-tactical-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 truncate"
              >
                {devices.audioOutputs.length > 0 ? (
                  devices.audioOutputs.map((d, index) => (
                    <option key={d.deviceId || index} value={d.deviceId}>
                      {d.label || `Speaker ${index + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default System Output</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Device Identity & Audio Settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 p-5 rounded-2xl bg-tactical-900 border border-tactical-800 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Device Co-Presence Identity
          </h3>

          {/* User Name Input */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-tactical-950 border border-tactical-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Device Label Input */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">
              Device Instance Label
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. MacBook Pro, iPhone 15"
              className="w-full bg-tactical-950 border border-tactical-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* AI Noise Suppression Configurator */}
          <div className="p-3 rounded-xl bg-tactical-950 border border-tactical-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cipher-cyan" />
                <span>Supressão de Ruído por IA</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                100% On-Device
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('off')}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'off'
                    ? 'bg-tactical-800 border-slate-400 text-white font-semibold'
                    : 'bg-tactical-900 border-tactical-800 text-slate-400 hover:text-slate-200'
                )}
              >
                Desligado
              </button>

              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('standard')}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'standard'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-semibold'
                    : 'bg-tactical-900 border-tactical-800 text-slate-400 hover:text-slate-200'
                )}
              >
                Padrão
              </button>

              <button
                type="button"
                onClick={() => onSetNoiseSuppressionMode?.('ai-neural')}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center',
                  noiseSuppressionMode === 'ai-neural'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                    : 'bg-tactical-900 border-tactical-800 text-slate-400 hover:text-slate-200'
                )}
              >
                IA Neural
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              {noiseSuppressionMode === 'ai-neural'
                ? 'Filtro espectral neural eliminando ruído de teclado, ventilador e ambiente.'
                : noiseSuppressionMode === 'standard'
                ? 'Filtro passa-alta 85Hz e controle dinâmico suave.'
                : 'Áudio cru sem nenhum filtro.'}
            </p>
          </div>

          {/* Security Summary Cards */}
          <div className="space-y-2 pt-1 border-t border-tactical-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Hardware-generated Ed25519 & X25519 keys</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero-knowledge P2P signaling routing</span>
            </div>
          </div>

          {/* Join Call Button */}
          <button
            onClick={handleJoinClick}
            className="w-full mt-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span>Enter Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
