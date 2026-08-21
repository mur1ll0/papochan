'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MeshManager,
  RemotePeerNode,
  CoPresenceUser,
} from '@/core/webrtc/MeshManager';
import { AblySignaler } from '@/core/signaling/AblySignaler';
import { DeviceMetadata } from '@/core/signaling/SignalingClient';
import { MediaEngine } from '@/core/webrtc/MediaEngine';
import {
  ChatTextMessage,
  TypingIndicator,
  FileTransferMeta,
} from '@/core/webrtc/DataChannel';
import { SerializedIdentity } from '@/core/crypto/storage';
import { decodeBase64 } from 'tweetnacl-util';
import { getApiEndpoint } from '@/lib/api';

export interface UseWebRTCOptions {
  roomCode: string;
  identity: SerializedIdentity | null;
  mediaEngine: MediaEngine | null;
  autoJoin?: boolean;
}

export function useWebRTC({
  roomCode,
  identity,
  mediaEngine,
  autoJoin = true,
}: UseWebRTCOptions) {
  const [signalingState, setSignalingState] = useState<
    'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  >('idle');
  const [peers, setPeers] = useState<RemotePeerNode[]>([]);
  const [coPresenceGroups, setCoPresenceGroups] = useState<CoPresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatTextMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [fileTransfers, setFileTransfers] = useState<Map<string, FileTransferMeta>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const meshManagerRef = useRef<MeshManager | null>(null);
  const signalerRef = useRef<AblySignaler | null>(null);

  // Initialize and Join Room
  const join = useCallback(async () => {
    if (!roomCode || !identity) return;

    try {
      setSignalingState('connecting');
      setError(null);

      const localMeta: DeviceMetadata = {
        deviceId: identity.deviceId,
        deviceName: identity.deviceName,
        deviceType: identity.deviceType,
        userId: identity.userId,
        username: identity.username,
        publicKeyEd: identity.publicKeyEd,
        publicKeyDh: identity.publicKeyDh,
        capabilities: {
          hasAudio: mediaEngine ? !mediaEngine.isAudioMuted : false,
          hasVideo: mediaEngine ? !mediaEngine.isVideoMuted : false,
          hasScreenShare: mediaEngine ? mediaEngine.isScreenSharing : false,
        },
      };

      const secretKeyEd = decodeBase64(identity.privateKeyEd);
      const secretKeyDh = decodeBase64(identity.privateKeyDh);

      // Initialize Signaler
      const signaler = new AblySignaler(getApiEndpoint('/api/signaling-token'));
      signalerRef.current = signaler;

      // Custom ICE servers if configured in env
      const stunServersStr = process.env.NEXT_PUBLIC_STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
      const iceServers: RTCIceServer[] = stunServersStr
        .split(',')
        .map((url) => ({ urls: url.trim() }));

      // Initialize Mesh Manager
      const mesh = new MeshManager({
        localMeta,
        localSecretKeyDh: secretKeyDh,
        localSecretKeyEd: secretKeyEd,
        signalingClient: signaler,
        iceServers,
      });
      meshManagerRef.current = mesh;

      if (mediaEngine) {
        mesh.attachMediaEngine(mediaEngine);
      }

      // Event Bindings
      mesh.setEventListeners({
        onPeersChange: (updatedPeers) => {
          setPeers([...updatedPeers]);
        },
        onCoPresenceChange: (groups) => {
          setCoPresenceGroups([...groups]);
        },
        onChatMessage: (msg) => {
          setMessages((prev) => [...prev, msg]);
        },
        onTyping: (indicator) => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            if (indicator.isTyping) {
              next.set(indicator.senderId, indicator);
            } else {
              next.delete(indicator.senderId);
            }
            return next;
          });
        },
        onFileProgress: (meta) => {
          setFileTransfers((prev) => {
            const next = new Map(prev);
            next.set(meta.fileId, meta);
            return next;
          });
        },
        onFileReceived: (meta) => {
          setFileTransfers((prev) => {
            const next = new Map(prev);
            next.set(meta.fileId, meta);
            return next;
          });
        },
        onError: (err) => {
          console.error('[useWebRTC] Mesh error:', err);
          setError(err.message);
        },
      });

      // Connect Signaler
      await signaler.connect(roomCode, localMeta, secretKeyEd);
      setSignalingState('connected');

      // Sync local tracks
      if (mediaEngine) {
        await mesh.syncLocalTracks();
      }
    } catch (err: any) {
      console.error('[useWebRTC] Failed to join room:', err);
      setSignalingState('failed');
      setError(err.message || 'Failed to connect to signaling');
    }
  }, [roomCode, identity, mediaEngine]);

  const leave = useCallback(async () => {
    try {
      if (signalerRef.current) {
        await signalerRef.current.disconnect();
        signalerRef.current = null;
      }
      if (meshManagerRef.current) {
        meshManagerRef.current.destroy();
        meshManagerRef.current = null;
      }
    } catch (err) {
      console.warn('[useWebRTC] Error leaving room:', err);
    } finally {
      setPeers([]);
      setCoPresenceGroups([]);
      setSignalingState('disconnected');
    }
  }, []);

  // Sync tracks whenever mediaEngine state alters
  const syncTracks = useCallback(async () => {
    if (meshManagerRef.current) {
      await meshManagerRef.current.syncLocalTracks();
    }
  }, []);

  // Chat Actions
  const sendMessage = useCallback(async (text: string) => {
    if (!meshManagerRef.current || !text.trim()) return null;
    const msg = await meshManagerRef.current.broadcastTextMessage(text.trim());
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (meshManagerRef.current) {
      await meshManagerRef.current.broadcastTyping(isTyping);
    }
  }, []);

  const sendFile = useCallback(async (file: File) => {
    if (!meshManagerRef.current) return null;
    const fileId = await meshManagerRef.current.broadcastFile(file, (progress) => {
      setFileTransfers((prev) => {
        const next = new Map(prev);
        const current = next.get(fileId);
        if (current) {
          next.set(fileId, { ...current, progress });
        }
        return next;
      });
    });

    const localMeta: FileTransferMeta = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      senderId: 'local',
      senderName: identity?.username || 'You',
      progress: 100,
      blobUrl: URL.createObjectURL(file),
      fileDigest: '',
      verified: true,
    };

    setFileTransfers((prev) => {
      const next = new Map(prev);
      next.set(fileId, localMeta);
      return next;
    });

    return fileId;
  }, [identity]);

  const clearChatMemory = useCallback(() => {
    setMessages([]);
    setFileTransfers(new Map());
  }, []);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && roomCode && identity) {
      join();
    }

    return () => {
      leave();
    };
  }, [autoJoin, roomCode, identity]);

  return {
    signalingState,
    peers,
    coPresenceGroups,
    messages,
    typingUsers: Array.from(typingUsers.values()),
    fileTransfers: Array.from(fileTransfers.values()),
    error,
    join,
    leave,
    syncTracks,
    sendMessage,
    setTyping,
    sendFile,
    clearChatMemory,
  };
}
