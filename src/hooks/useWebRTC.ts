'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MeshManager,
  RemotePeerNode,
  CoPresenceUser,
} from '@/core/webrtc/MeshManager';
import { UniversalSignaler } from '@/core/signaling/UniversalSignaler';
import { SignalingClient, DeviceMetadata, KnockRequest } from '@/core/signaling/SignalingClient';
import { MediaEngine } from '@/core/webrtc/MediaEngine';
import { resolveIceServers } from '@/core/webrtc/iceServers';
import {
  ChatTextMessage,
  TypingIndicator,
  FileTransferMeta,
} from '@/core/webrtc/DataChannel';
import { SerializedIdentity } from '@/core/crypto/storage';
import { decodeBase64 } from 'tweetnacl-util';

export type AdmissionStatus = 'idle' | 'checking' | 'knocking' | 'approved' | 'rejected';

/**
 * How long a guest waits for peer discovery before concluding the room really is
 * empty and letting itself in. Nobody is present to approve an empty room, but
 * the wait has to outlast discovery so a real occupant is never missed.
 */
const EMPTY_ROOM_GRACE_MS = 5000;

export interface UseWebRTCOptions {
  roomCode: string;
  identity: SerializedIdentity | null;
  mediaEngine: MediaEngine | null;
  autoJoin?: boolean;
  isHost?: boolean;
}

export function useWebRTC({
  roomCode,
  identity,
  mediaEngine,
  autoJoin = true,
  isHost = false,
}: UseWebRTCOptions) {
  const [signalingState, setSignalingState] = useState<
    'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  >('idle');
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus>(
    isHost ? 'approved' : 'idle'
  );
  const [pendingKnocks, setPendingKnocks] = useState<KnockRequest[]>([]);
  const [peers, setPeers] = useState<RemotePeerNode[]>([]);
  const [coPresenceGroups, setCoPresenceGroups] = useState<CoPresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatTextMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [fileTransfers, setFileTransfers] = useState<Map<string, FileTransferMeta>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const meshManagerRef = useRef<MeshManager | null>(null);
  const signalerRef = useRef<SignalingClient | null>(null);
  const knockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emptyRoomTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearAdmissionTimers = useCallback(() => {
    if (knockIntervalRef.current) {
      clearInterval(knockIntervalRef.current);
      knockIntervalRef.current = null;
    }
    if (emptyRoomTimerRef.current) {
      clearTimeout(emptyRoomTimerRef.current);
      emptyRoomTimerRef.current = null;
    }
  }, []);

  // Initialize and Join Room
  const join = useCallback(async () => {
    if (!roomCode || !identity) return;

    try {
      setSignalingState('connecting');
      setAdmissionStatus(isHost ? 'approved' : 'checking');
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
          trackMap: mediaEngine ? mediaEngine.getTrackMap() : undefined,
        },
      };

      const secretKeyEd = decodeBase64(identity.privateKeyEd);
      const secretKeyDh = decodeBase64(identity.privateKeyDh);

      // Initialize Universal Signaler (Ably + HTTP Bus Fallback)
      const signaler = new UniversalSignaler(isHost);
      signalerRef.current = signaler;

      // STUN for host/srflx discovery plus a TURN relay: peers behind symmetric
      // NAT or CGNAT never form a direct path, and without a relay media and the
      // DataChannel fail silently while server-relayed signaling keeps working.
      // The relay credential is minted per session by /api/turn-credentials.
      const iceServers: RTCIceServer[] = await resolveIceServers(
        `${localMeta.userId}:${localMeta.deviceId}`
      );

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
          if (!msg || msg.senderId === `${localMeta.userId}:${localMeta.deviceId}`) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
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

      // Signaler events for Waiting Room / Knocking
      signaler.setEventListeners({
        onHostAssigned: (assignedAsHost) => {
          // Deliberately does NOT admit. Host election is server-derived state,
          // and on serverless it can be wrong (a cold instance sees an empty
          // room). Letting it grant entry is exactly how an uninvited peer used
          // to walk straight past the waiting room.
          console.log('[DEBUG-RTC] onHostAssigned (approval rights only):', assignedAsHost);
        },
        onKnock: (request) => {
          console.log('[DEBUG-RTC] onKnock from:', request.senderId);
          // Auto-approve if it's a sister device belonging to the exact same user
          if (request.meta.userId === localMeta.userId) {
            signaler.sendKnockApproved(request.senderId);
            return;
          }
          setPendingKnocks((prev) => {
            if (prev.some((k) => k.senderId === request.senderId)) return prev;
            return [...prev, request];
          });
        },
        onPeerAdmitted: (admittedId) => {
          // Someone in the room let this peer in; connect to them too.
          meshManagerRef.current?.admitPeer(admittedId);
        },
        onKnockApproved: async () => {
          console.log('[DEBUG-RTC] onKnockApproved');
          clearAdmissionTimers();
          setAdmissionStatus('approved');
          meshManagerRef.current?.setSelfAdmitted(true);
          if (signalerRef.current) {
            await signalerRef.current.sendPresenceAnnounce();
          }
          if (meshManagerRef.current && mediaEngine) {
            await meshManagerRef.current.syncLocalTracks();
          }
        },
        onKnockRejected: () => {
          console.log('[DEBUG-RTC] onKnockRejected');
          clearAdmissionTimers();
          setAdmissionStatus('rejected');
        },
        onKnockCancelled: (senderId) => {
          setPendingKnocks((prev) => prev.filter((k) => k.senderId !== senderId));
        },
      });

      // Connect Signaler
      await signaler.connect(roomCode, localMeta, secretKeyEd);
      setSignalingState('connected');

      // Only the room creator (?host=1) enters unannounced. Anything derived from
      // the signaling server is untrusted for this decision.
      console.log('[DEBUG-RTC] Connected signaler, room creator:', isHost);

      if (isHost) {
        setAdmissionStatus('approved');
        mesh.setSelfAdmitted(true);
        if (mediaEngine) {
          await mesh.syncLocalTracks();
        }
      } else {
        // Guest joining: enter waiting room and actively knock
        setAdmissionStatus('knocking');
        await signaler.sendKnock();

        // Periodically pulse knock every 3s until approved or rejected
        if (knockIntervalRef.current) clearInterval(knockIntervalRef.current);
        knockIntervalRef.current = setInterval(() => {
          signaler.sendKnock().catch(() => {});
        }, 3000);

        // A room with nobody in it has nobody to approve you. Wait for peer
        // discovery to settle first: presence and the peer list converge in well
        // under a second, so anyone actually present will have been seen by now.
        emptyRoomTimerRef.current = setTimeout(async () => {
          emptyRoomTimerRef.current = null;
          const knownPeers = signalerRef.current?.getKnownPeersCount?.() ?? 0;
          if (knownPeers > 0) return;

          console.log('[DEBUG-RTC] Room is empty, self-admitting as first participant.');
          clearAdmissionTimers();
          setAdmissionStatus('approved');
          meshManagerRef.current?.setSelfAdmitted(true);
          if (mediaEngine && meshManagerRef.current) {
            await meshManagerRef.current.syncLocalTracks();
          }
        }, EMPTY_ROOM_GRACE_MS);
      }
    } catch (err: any) {
      console.error('[useWebRTC] Failed to join room:', err);
      if (typeof window !== 'undefined') {
        (window as any).__LAST_RTC_ERROR__ = err?.stack || err?.message || String(err);
      }
      setSignalingState('failed');
      setAdmissionStatus('rejected');
      setError(err.message || 'Failed to connect to signaling');
    }
  }, [roomCode, identity, mediaEngine, isHost]);


  const leave = useCallback(async () => {
    try {
      clearAdmissionTimers();
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
  }, [clearAdmissionTimers]);

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

  const approveKnock = useCallback(async (senderId: string) => {
    if (signalerRef.current) {
      // Open the gate first, so the connection is already permitted by the time
      // the approved peer starts negotiating.
      meshManagerRef.current?.admitPeer(senderId);
      await signalerRef.current.sendKnockApproved(senderId);
      setPendingKnocks((prev) => prev.filter((k) => k.senderId !== senderId));
      if (meshManagerRef.current && mediaEngine) {
        await meshManagerRef.current.syncLocalTracks();
      }
    }
  }, [mediaEngine]);

  const rejectKnock = useCallback(async (senderId: string) => {
    if (signalerRef.current) {
      // Tear down anything they managed to open, then tell them no.
      meshManagerRef.current?.revokePeer(senderId);
      await signalerRef.current.sendKnockRejected(senderId);
      setPendingKnocks((prev) => prev.filter((k) => k.senderId !== senderId));
    }
  }, []);

  const cancelKnock = useCallback(async () => {
    clearAdmissionTimers();
    try {
      if (signalerRef.current) {
        await signalerRef.current.sendKnockCancel();
      }
    } catch {
      // ignore
    }
    await leave();
  }, [leave, clearAdmissionTimers]);

  const clearChatMemory = useCallback(() => {
    setMessages([]);
    setFileTransfers(new Map());
  }, []);

  const joinedRoomRef = useRef<string | null>(null);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && roomCode && identity) {
      if (joinedRoomRef.current !== roomCode) {
        joinedRoomRef.current = roomCode;
        join();
      }
    } else if (!autoJoin && joinedRoomRef.current) {
      joinedRoomRef.current = null;
      leave();
    }
  }, [autoJoin, roomCode, identity, join, leave]);

  // When mediaEngine is attached or updated while in room
  useEffect(() => {
    if (meshManagerRef.current && mediaEngine) {
      meshManagerRef.current.attachMediaEngine(mediaEngine);
      meshManagerRef.current.syncLocalTracks();
    }
  }, [mediaEngine]);

  // Leave on component unmount
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  return {
    signalingState,
    admissionStatus,
    pendingKnocks,
    peers,
    coPresenceGroups,
    messages,
    typingUsers: Array.from(typingUsers.values()),
    fileTransfers: Array.from(fileTransfers.values()),
    error,
    join,
    leave,
    approveKnock,
    rejectKnock,
    cancelKnock,
    syncTracks,
    sendMessage,
    setTyping,
    sendFile,
    clearChatMemory,
  };
}
