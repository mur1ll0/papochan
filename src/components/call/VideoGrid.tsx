'use client';

import React, { useState } from 'react';
import { VideoTile } from './VideoTile';
import { RemotePeerNode } from '@/core/webrtc/MeshManager';
import { SerializedIdentity } from '@/core/crypto/storage';
import { cn } from '@/lib/utils';
import {
  Maximize2,
  LayoutGrid,
  Columns2,
  PictureInPicture2,
  Tv,
  ArrowLeftRight,
  Move,
} from 'lucide-react';

export type LayoutMode = 'spotlight' | 'split' | 'pip' | 'grid';
export type PipCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface VideoGridProps {
  localIdentity: SerializedIdentity;
  localUserStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isLocalAudioMuted: boolean;
  isLocalVideoMuted: boolean;
  isLocalScreenSharing: boolean;
  hasLocalScreenAudio?: boolean;
  isLocalScreenAudioMuted?: boolean;
  onToggleScreenAudio?: () => void;
  localAudioLevel: number;
  peers: RemotePeerNode[];
  className?: string;
}

export function VideoGrid({
  localIdentity,
  localUserStream,
  localScreenStream,
  isLocalAudioMuted,
  isLocalVideoMuted,
  isLocalScreenSharing,
  hasLocalScreenAudio = false,
  isLocalScreenAudioMuted = false,
  onToggleScreenAudio,
  localAudioLevel,
  peers,
  className,
}: VideoGridProps) {
  // Identify active screen shares
  const remoteScreenPeers = peers.filter(
    (p) =>
      p.isScreenActive ||
      !!p.tracks.screen ||
      !!p.capabilities.hasScreenShare ||
      (p.screenStream && p.screenStream.getVideoTracks().some((t) => t.readyState === 'live'))
  );
  const hasAnyScreenShare = isLocalScreenSharing || remoteScreenPeers.length > 0;

  // Layout mode state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    hasAnyScreenShare ? 'spotlight' : 'grid'
  );
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [pipCorner, setPipCorner] = useState<PipCorner>('bottom-right');

  // Auto-switch to spotlight if a new screen share starts and user was in grid
  const activeSpotlight =
    spotlightId ||
    (isLocalScreenSharing
      ? 'local-screen'
      : remoteScreenPeers.length > 0
      ? `remote-screen-${remoteScreenPeers[0].nodeId}`
      : 'local-cam');

  // Total active video/screen items
  const totalStreams =
    1 + (isLocalScreenSharing ? 1 : 0) + peers.length + remoteScreenPeers.length;

  // Pip corner position classes
  const getPipPositionClass = (corner: PipCorner) => {
    switch (corner) {
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-14 right-4';
      case 'top-left':
        return 'top-14 left-4';
    }
  };

  const cyclePipCorner = () => {
    const corners: PipCorner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
    const nextIdx = (corners.indexOf(pipCorner) + 1) % corners.length;
    setPipCorner(corners[nextIdx]);
  };

  // Helper to render a specific stream tile by ID
  const renderTileById = (
    id: string,
    options: {
      isMaximized?: boolean;
      isSpotlight?: boolean;
      onMaximize?: () => void;
      onSwap?: () => void;
      className?: string;
    } = {}
  ) => {
    if (id === 'local-screen') {
      return (
        <VideoTile
          key="local-screen"
          stream={localScreenStream}
          username={localIdentity.username}
          deviceName={`${localIdentity.deviceName} (Tela)`}
          deviceType={localIdentity.deviceType}
          isLocal
          isScreenShare
          hasScreenAudio={hasLocalScreenAudio}
          isScreenAudioMuted={isLocalScreenAudioMuted}
          onToggleScreenAudio={onToggleScreenAudio}
          isMaximized={options.isMaximized}
          isSpotlight={options.isSpotlight}
          onMaximize={options.onMaximize}
          onSwap={options.onSwap}
          className={options.className || 'w-full h-full'}
        />
      );
    }

    if (id === 'local-cam') {
      return (
        <VideoTile
          key="local-cam"
          stream={localUserStream}
          username={localIdentity.username}
          deviceName={localIdentity.deviceName}
          deviceType={localIdentity.deviceType}
          isLocal
          isAudioMuted={isLocalAudioMuted}
          isVideoMuted={isLocalVideoMuted}
          audioLevel={localAudioLevel}
          isMaximized={options.isMaximized}
          isSpotlight={options.isSpotlight}
          onMaximize={options.onMaximize}
          onSwap={options.onSwap}
          className={options.className || 'w-full h-full'}
        />
      );
    }

    if (id.startsWith('remote-screen-')) {
      const targetNodeId = id.replace('remote-screen-', '');
      const targetPeer = peers.find((p) => p.nodeId === targetNodeId);
      if (!targetPeer) return null;
      const screenStream =
        (targetPeer.screenStream && targetPeer.screenStream.getTracks().length > 0 ? targetPeer.screenStream : null) ||
        targetPeer.streams.find((s) =>
          s.getVideoTracks().some(
            (t) =>
              t === targetPeer.tracks.screen ||
              t.id === targetPeer.capabilities?.trackMap?.screenVideoTrackId
          )
        ) ||
        targetPeer.screenStream ||
        targetPeer.streams[0];

      return (
        <VideoTile
          key={id}
          stream={screenStream}
          username={targetPeer.username}
          deviceName={`${targetPeer.deviceName} (Tela)`}
          deviceType={targetPeer.deviceType}
          isScreenShare
          hasScreenAudio={
            !!targetPeer.tracks.screenAudio ||
            !!targetPeer.capabilities?.trackMap?.screenAudioTrackId
          }
          safetyNumber={targetPeer.safetyNumber}
          isMaximized={options.isMaximized}
          isSpotlight={options.isSpotlight}
          onMaximize={options.onMaximize}
          onSwap={options.onSwap}
          className={options.className || 'w-full h-full'}
        />
      );
    }

    if (id.startsWith('peer-')) {
      const targetNodeId = id.replace('peer-', '');
      const targetPeer = peers.find((p) => p.nodeId === targetNodeId);
      if (!targetPeer) return null;
      return (
        <VideoTile
          key={id}
          stream={targetPeer.userStream || targetPeer.streams[0]}
          username={targetPeer.username}
          deviceName={targetPeer.deviceName}
          deviceType={targetPeer.deviceType}
          isAudioMuted={!targetPeer.isAudioActive}
          isVideoMuted={!targetPeer.isVideoActive}
          safetyNumber={targetPeer.safetyNumber}
          isMaximized={options.isMaximized}
          isSpotlight={options.isSpotlight}
          onMaximize={options.onMaximize}
          onSwap={options.onSwap}
          className={options.className || 'w-full h-full'}
        />
      );
    }

    return null;
  };

  // Collect all available stream IDs
  const allStreamIds: string[] = [];
  if (isLocalScreenSharing) allStreamIds.push('local-screen');
  allStreamIds.push('local-cam');
  peers.forEach((p) => {
    allStreamIds.push(`peer-${p.nodeId}`);
    if (
      p.isScreenActive ||
      p.tracks.screen ||
      p.capabilities.hasScreenShare ||
      (p.screenStream && p.screenStream.getVideoTracks().some((t) => t.readyState === 'live'))
    ) {
      allStreamIds.push(`remote-screen-${p.nodeId}`);
    }
  });

  // Secondary stream IDs (excluding current active spotlight)
  const secondaryStreamIds = allStreamIds.filter((id) => id !== activeSpotlight);

  return (
    <div className={cn('relative w-full h-full flex flex-col p-3 md:p-4 overflow-hidden select-none', className)}>
      {/* Top Floating Layout Mode Switcher Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl">
        <button
          onClick={() => setLayoutMode('spotlight')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            layoutMode === 'spotlight'
              ? 'bg-papo-coral text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
          title="Modo Foco / Destaque Principal"
        >
          <Tv className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Foco</span>
        </button>

        <button
          onClick={() => setLayoutMode('split')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            layoutMode === 'split'
              ? 'bg-chan-turquoise text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
          title="Modo Lado a Lado (50/50)"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lado a Lado</span>
        </button>

        <button
          onClick={() => setLayoutMode('pip')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            layoutMode === 'pip'
              ? 'bg-stealth-emerald text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
          title="Modo Sobreposto (Picture-in-Picture)"
        >
          <PictureInPicture2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sobreposto</span>
        </button>

        <button
          onClick={() => setLayoutMode('grid')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            layoutMode === 'grid'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
          title="Modo Grade Livre"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Grade</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SPOTLIGHT MODE (Main Stage + Sidebar)                      */}
      {/* ------------------------------------------------------------- */}
      {layoutMode === 'spotlight' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 pt-10">
          {/* Main Focused Stage */}
          <div className="flex-1 min-h-0 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
            {renderTileById(activeSpotlight, {
              isSpotlight: true,
              onMaximize: () => setLayoutMode('grid'),
              onSwap: () => {
                if (secondaryStreamIds.length > 0) {
                  setSpotlightId(secondaryStreamIds[0]);
                }
              },
            })}
          </div>

          {/* Filmstrip / Secondary Tiles Sidebar */}
          {secondaryStreamIds.length > 0 && (
            <div className="w-full lg:w-72 h-36 lg:h-full flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto shrink-0 pb-1">
              {secondaryStreamIds.map((id) => (
                <div
                  key={id}
                  onClick={() => setSpotlightId(id)}
                  className="w-48 lg:w-full h-full lg:h-44 shrink-0 cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  {renderTileById(id, {
                    onMaximize: () => setSpotlightId(id),
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SPLIT MODE (Side-by-Side 50/50)                            */}
      {/* ------------------------------------------------------------- */}
      {layoutMode === 'split' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 pt-10">
          {/* Left / Top Stream */}
          <div className="w-full h-full min-h-0">
            {renderTileById(activeSpotlight, {
              onSwap: () => {
                if (secondaryStreamIds.length > 0) {
                  setSpotlightId(secondaryStreamIds[0]);
                }
              },
              onMaximize: () => setLayoutMode('spotlight'),
            })}
          </div>

          {/* Right / Bottom Stream */}
          <div className="w-full h-full min-h-0">
            {secondaryStreamIds.length > 0 ? (
              renderTileById(secondaryStreamIds[0], {
                onSwap: () => setSpotlightId(secondaryStreamIds[0]),
                onMaximize: () => {
                  setSpotlightId(secondaryStreamIds[0]);
                  setLayoutMode('spotlight');
                },
              })
            ) : (
              <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-500 text-xs font-semibold">
                Nenhuma outra fonte de vídeo ativa
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. PIP (PICTURE-IN-PICTURE) OVERLAY MODE                      */}
      {/* ------------------------------------------------------------- */}
      {layoutMode === 'pip' && (
        <div className="flex-1 relative w-full h-full min-h-0 pt-10">
          {/* Full-width Background Stream (e.g. Screen Share) */}
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            {renderTileById(activeSpotlight, {
              isSpotlight: true,
              onMaximize: () => setLayoutMode('grid'),
            })}
          </div>

          {/* Floating Camera Overlay */}
          {secondaryStreamIds.length > 0 && (
            <div
              className={cn(
                'absolute z-30 w-52 sm:w-64 h-36 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-papo-coral/60 transition-all duration-300 group',
                getPipPositionClass(pipCorner)
              )}
            >
              {renderTileById(secondaryStreamIds[0], {
                onSwap: () => setSpotlightId(secondaryStreamIds[0]),
                onMaximize: () => {
                  setSpotlightId(secondaryStreamIds[0]);
                  setLayoutMode('spotlight');
                },
              })}

              {/* Move PiP Corner Action Button */}
              <button
                onClick={cyclePipCorner}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 text-white border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                title="Mover câmera para outro canto"
              >
                <Move className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. EQUAL GRID MODE                                            */}
      {/* ------------------------------------------------------------- */}
      {layoutMode === 'grid' && (
        <div
          className={cn(
            'flex-1 grid gap-3 md:gap-4 auto-rows-fr items-center justify-center min-h-0 pt-10',
            totalStreams === 1 && 'grid-cols-1 max-w-4xl mx-auto',
            totalStreams === 2 && 'grid-cols-1 md:grid-cols-2',
            totalStreams >= 3 && totalStreams <= 4 && 'grid-cols-1 sm:grid-cols-2',
            totalStreams > 4 && 'grid-cols-2 sm:grid-cols-3'
          )}
        >
          {allStreamIds.map((id) => (
            <div key={id} className="w-full h-full min-h-[200px]">
              {renderTileById(id, {
                onMaximize: () => {
                  setSpotlightId(id);
                  setLayoutMode('spotlight');
                },
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
