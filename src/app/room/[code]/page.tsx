'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Copy,
  Check,
  Users,
  Layers,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useCrypto } from '@/hooks/useCrypto';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useI18n } from '@/i18n/context';
import { VideoGrid } from '@/components/call/VideoGrid';
import { ControlBar } from '@/components/call/ControlBar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { SecurityModal } from '@/components/auth/SecurityModal';
import { DeviceSetupModal } from '@/components/auth/DeviceSetupModal';
import { AudioDiagnosticsAlert } from '@/components/call/AudioDiagnosticsAlert';
import { ChameleonLogo } from '@/components/brand/ChameleonLogo';
import { cn } from '@/lib/utils';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const roomCode = ((params?.code as string) || '').toUpperCase();

  const { identity, isLoading: isCryptoLoading, updateProfile } = useCrypto();

  const media = useMediaDevices({
    autoStart: true,
    initialAudio: true,
    initialVideo: true,
    initialNoiseSuppression: 'ai-neural',
  });

  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const rtc = useWebRTC({
    roomCode,
    identity,
    mediaEngine: media.engine,
    autoJoin: hasJoined,
  });

  // Track unread chat messages when chat drawer is closed
  useEffect(() => {
    if (!isChatOpen && rtc.messages.length > 0) {
      const lastMsg = rtc.messages[rtc.messages.length - 1];
      if (!lastMsg.senderId.startsWith(identity?.userId || '')) {
        setUnreadChatCount((prev) => prev + 1);
      }
    }
  }, [rtc.messages, isChatOpen, identity]);

  const handleToggleChat = () => {
    if (!isChatOpen) setUnreadChatCount(0);
    setIsChatOpen(!isChatOpen);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleLeaveCall = async () => {
    try {
      media.engine?.destroy();
      await Promise.race([
        rtc.leave(),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);
    } catch (err) {
      console.warn('[RoomPage] Error leaving room:', err);
    } finally {
      router.push('/');
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const handleToggleAudio = async () => {
    media.toggleAudio();
    await rtc.syncTracks();
  };

  const handleToggleVideo = async () => {
    await media.toggleVideo();
    await rtc.syncTracks();
  };

  const handleToggleScreenShare = async (
    includeAudio: boolean = true,
    frameRate: number = 60
  ) => {
    await media.toggleScreenShare(includeAudio, frameRate);
    await rtc.syncTracks();
  };

  const handleToggleScreenAudio = async () => {
    media.toggleScreenAudio();
    await rtc.syncTracks();
  };

  // Co-Presence Sisters: Identify if another device is joined with same userId
  const sisterDevices = rtc.peers.filter((p) => p.isSameUserAsLocal);

  // Initial loading state while generating/retrieving zero-knowledge keys
  if (isCryptoLoading || !identity) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-papo-coral border-t-transparent animate-spin" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  // Pre-Call Lobby / Hardware Preview State
  if (!hasJoined) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-8">
        <DeviceSetupModal
          roomCode={roomCode}
          identity={identity}
          userStream={media.userStream}
          audioLevel={media.audioLevel}
          audioDiagnostics={media.audioDiagnostics}
          noiseSuppressionMode={media.noiseSuppressionMode}
          isAudioMuted={media.isAudioMuted}
          isVideoMuted={media.isVideoMuted}
          devices={media.devices}
          selectedAudioDevice={media.selectedAudioDevice}
          selectedVideoDevice={media.selectedVideoDevice}
          selectedAudioOutput={media.selectedAudioOutput}
          onToggleAudio={media.toggleAudio}
          onToggleVideo={handleToggleVideo}
          onSwitchDevice={media.switchDevice}
          onSetNoiseSuppressionMode={media.setNoiseSuppressionMode}
          onUpdateProfile={updateProfile}
          onJoin={() => setHasJoined(true)}
        />
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl px-4 flex items-center justify-between z-20 shrink-0">
        {/* Left: Home Button & Room Code */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveCall}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Voltar ao Início"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <ChameleonLogo size={22} color="#FFFFFF" accentColor="#FF6B4A" />
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">{t('room.header.roomCode')}</span>
            <span className="text-xs font-mono font-bold text-chan-turquoise px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
              {roomCode}
            </span>
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
              title={t('room.header.copyLink')}
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-stealth-emerald" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Multi-Device Co-Presence Banner Indicator */}
          {sisterDevices.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-chan-turquoise/10 border border-chan-turquoise/30 text-chan-turquoise text-xs font-medium animate-pulse">
              <Layers className="w-3.5 h-3.5" />
              <span>{t('room.header.sisterDevice')} ({sisterDevices.length + 1})</span>
            </div>
          )}
        </div>

        {/* Right: Security & Network Status */}
        <div className="flex items-center gap-3">
          {/* Peer Count */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
            <Users className="w-3.5 h-3.5 text-papo-coral" />
            <span>{rtc.peers.length + 1}</span>
          </div>

          {/* E2EE Shield Pill */}
          <button
            onClick={() => setIsSecurityOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stealth-emerald/10 border border-stealth-emerald/40 text-stealth-emerald text-xs font-medium hover:bg-stealth-emerald/20 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('call.control.security')}</span>
          </button>
        </div>
      </header>

      {/* Floating Audio Diagnostics Alert Banner (during call) */}
      {media.audioDiagnostics?.alertMessage && !media.isAudioMuted && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-lg w-full px-4 pointer-events-auto">
          <AudioDiagnosticsAlert
            metrics={media.audioDiagnostics}
            isAudioMuted={media.isAudioMuted}
          />
        </div>
      )}

      {/* Main Video Mesh Matrix Area */}
      <div className="flex-1 min-h-0 relative flex">
        <VideoGrid
          localIdentity={identity}
          localUserStream={media.userStream}
          localScreenStream={media.screenStream}
          isLocalAudioMuted={media.isAudioMuted}
          isLocalVideoMuted={media.isVideoMuted}
          isLocalScreenSharing={media.isScreenSharing}
          hasLocalScreenAudio={media.hasScreenAudio}
          isLocalScreenAudioMuted={media.isScreenAudioMuted}
          onToggleScreenAudio={handleToggleScreenAudio}
          localAudioLevel={media.audioLevel}
          peers={rtc.peers}
          className="flex-1"
        />

        {/* In-Memory Zero-Knowledge Chat Drawer */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={rtc.messages}
          typingUsers={rtc.typingUsers}
          fileTransfers={rtc.fileTransfers}
          localUserId={identity.userId}
          onSendMessage={rtc.sendMessage}
          onSendTyping={rtc.setTyping}
          onSendFile={rtc.sendFile}
          onClearMemory={rtc.clearChatMemory}
        />
      </div>

      {/* Floating Tactical Bottom Control Bar */}
      <ControlBar
        isAudioMuted={media.isAudioMuted}
        isVideoMuted={media.isVideoMuted}
        isScreenSharing={media.isScreenSharing}
        hasScreenAudio={media.hasScreenAudio}
        isScreenAudioMuted={media.isScreenAudioMuted}
        isChatOpen={isChatOpen}
        unreadCount={unreadChatCount}
        peerCount={rtc.peers.length}
        devices={media.devices}
        selectedAudioDevice={media.selectedAudioDevice}
        selectedVideoDevice={media.selectedVideoDevice}
        selectedAudioOutput={media.selectedAudioOutput}
        noiseSuppressionMode={media.noiseSuppressionMode}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleScreenAudio={handleToggleScreenAudio}
        onToggleChat={handleToggleChat}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        onLeaveCall={handleLeaveCall}
        onSwitchDevice={media.switchDevice}
        onSetNoiseSuppressionMode={media.setNoiseSuppressionMode}
      />

      {/* Zero-Knowledge End-to-End Cryptographic Security Modal */}
      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        localIdentity={identity}
        peers={rtc.peers}
      />
    </main>
  );
}
