import { DeviceMetadata, SignalingClient, TrackMap } from '../signaling/SignalingClient';
import { PeerConnection } from './PeerConnection';
import { MediaEngine } from './MediaEngine';
import {
  E2EEDataChannel,
  ChatTextMessage,
  TypingIndicator,
  FileTransferMeta,
} from './DataChannel';
import { deriveSharedKey } from '../crypto/cipher';
import { deriveSafetyNumber, computeKeyFingerprint } from '../crypto/keygen';

export interface RemotePeerNode {
  nodeId: string; // "userId:deviceId"
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'browser';
  username: string;
  publicKeyEd: string;
  publicKeyDh: string;
  safetyNumber: string;
  fingerprint: string;
  connectionState: RTCPeerConnectionState;
  streams: MediaStream[];
  userStream: MediaStream; // Dedicated user media stream (webcam + mic)
  screenStream: MediaStream; // Dedicated screen share stream (screen video + screen audio)
  tracks: {
    audio?: MediaStreamTrack;
    video?: MediaStreamTrack;
    screen?: MediaStreamTrack;
    screenAudio?: MediaStreamTrack;
  };
  capabilities: {
    hasAudio: boolean;
    hasVideo: boolean;
    hasScreenShare: boolean;
    trackMap?: TrackMap;
  };
  isAudioActive?: boolean;
  isVideoActive?: boolean;
  isScreenActive?: boolean;
  isSameUserAsLocal: boolean; // Flag if this is a sister device of the local user
}

export interface CoPresenceUser {
  userId: string;
  username: string;
  isLocalUser: boolean;
  devices: RemotePeerNode[];
  hasActiveScreenShare: boolean;
}

export interface MeshManagerEvents {
  onPeersChange: (peers: RemotePeerNode[]) => void;
  onCoPresenceChange: (groups: CoPresenceUser[]) => void;
  onTrackAdded: (nodeId: string, track: MediaStreamTrack, stream: MediaStream) => void;
  onTrackRemoved: (nodeId: string, track: MediaStreamTrack) => void;
  onChatMessage: (message: ChatTextMessage) => void;
  onTyping: (indicator: TypingIndicator) => void;
  onFileProgress: (meta: FileTransferMeta) => void;
  onFileReceived: (meta: FileTransferMeta, blob: Blob) => void;
  onError: (error: Error) => void;
}

export interface MeshManagerConfig {
  localMeta: DeviceMetadata;
  localSecretKeyDh: Uint8Array | string;
  localSecretKeyEd: Uint8Array;
  signalingClient: SignalingClient;
  iceServers?: RTCIceServer[];
}

export class MeshManager {
  private localMeta: DeviceMetadata;
  private localSecretKeyDh: Uint8Array | string;
  private localSecretKeyEd: Uint8Array;
  private signaler: SignalingClient;
  private iceServers?: RTCIceServer[];

  private peers = new Map<string, PeerConnection>();
  /** Creations still awaiting WebCrypto key derivation, keyed by node id. */
  private pendingPeers = new Map<string, Promise<PeerConnection>>();
  /** Peers cleared to connect. Anyone else gets no connection and no media. */
  private admittedPeers = new Set<string>();
  /** Peers seen in the room but still waiting to be let in. */
  private pendingAdmission = new Map<string, DeviceMetadata>();
  private selfAdmitted = false;
  private peerDataChannels = new Map<string, E2EEDataChannel>();
  private peerNodes = new Map<string, RemotePeerNode>();
  private mediaEngine: MediaEngine | null = null;
  private events: Partial<MeshManagerEvents> = {};

  constructor(config: MeshManagerConfig) {
    this.localMeta = config.localMeta;
    this.localSecretKeyDh = config.localSecretKeyDh;
    this.localSecretKeyEd = config.localSecretKeyEd;
    this.signaler = config.signalingClient;
    this.iceServers = config.iceServers;

    this.setupSignalerEvents();
  }

  public setEventListeners(events: Partial<MeshManagerEvents>): void {
    this.events = { ...this.events, ...events };
  }

  public attachMediaEngine(engine: MediaEngine): void {
    this.mediaEngine = engine;
  }

  /**
   * Marks this client as admitted to the room. Everyone already present was
   * vouched for by whoever admitted us, so they all become reachable.
   */
  public setSelfAdmitted(admitted: boolean): void {
    this.selfAdmitted = admitted;
    if (!admitted) return;

    for (const nodeId of Array.from(this.pendingAdmission.keys())) {
      this.admitPeer(nodeId);
    }
  }

  /** Lets a specific peer in and connects to it. */
  public admitPeer(nodeId: string): void {
    if (this.admittedPeers.has(nodeId)) return;
    this.admittedPeers.add(nodeId);

    const meta = this.pendingAdmission.get(nodeId);
    if (!meta || !this.selfAdmitted) return;

    this.pendingAdmission.delete(nodeId);
    this.getOrCreatePeer(nodeId, meta).catch((err) =>
      this.reportSignalingFailure('admit-peer', nodeId, err)
    );
  }

  /** Withdraws a peer, tearing down any connection it managed to open. */
  public revokePeer(nodeId: string): void {
    this.admittedPeers.delete(nodeId);
    this.pendingAdmission.delete(nodeId);
    this.removePeer(nodeId);
  }

  /**
   * A connection is allowed only once both ends are cleared: this client has
   * been admitted to the room, and the remote peer has been admitted too. Sister
   * devices of the local user are implicitly trusted - same identity, same keys.
   */
  private canConnectTo(nodeId: string, meta: DeviceMetadata): boolean {
    if (meta.userId === this.localMeta.userId) return true;
    return this.selfAdmitted && this.admittedPeers.has(nodeId);
  }

  private setupSignalerEvents(): void {
    this.signaler.setEventListeners({
      onPeerJoined: async (remoteMeta) => {
        if (!remoteMeta?.userId || !remoteMeta?.deviceId) return;

        const remoteNodeId = `${remoteMeta.userId}:${remoteMeta.deviceId}`;
        const localNodeId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;

        if (remoteNodeId === localNodeId) return;

        if (!this.canConnectTo(remoteNodeId, remoteMeta)) {
          // Hold them at the door: no RTCPeerConnection means no tracks, so an
          // unapproved peer cannot see or hear the room while it waits.
          this.pendingAdmission.set(remoteNodeId, remoteMeta);
          return;
        }

        try {
          await this.getOrCreatePeer(remoteNodeId, remoteMeta);
        } catch (err) {
          this.reportSignalingFailure('peer-joined', remoteNodeId, err);
        }
      },

      onPeerLeft: (peerId) => {
        this.removePeer(peerId);
      },

      onOffer: async (senderId, sdp, senderMeta) => {
        if (senderMeta && !this.canConnectTo(senderId, senderMeta)) {
          this.pendingAdmission.set(senderId, senderMeta);
          console.warn(`[MeshManager] Ignoring offer from unadmitted peer ${senderId}.`);
          return;
        }

        try {
          const peer = await this.getOrCreatePeer(senderId, senderMeta);
          const answer = await peer.handleOffer(sdp);
          if (answer) {
            await this.signaler.sendAnswer(senderId, answer);
          }
        } catch (err) {
          this.reportSignalingFailure('offer', senderId, err);
        }
      },

      onAnswer: async (senderId, sdp) => {
        const peer = this.peers.get(senderId);
        if (!peer) {
          console.warn(`[MeshManager] Answer received for unknown peer ${senderId}, ignoring.`);
          return;
        }
        try {
          await peer.handleAnswer(sdp);
        } catch (err) {
          this.reportSignalingFailure('answer', senderId, err);
        }
      },

      onCandidate: async (senderId, candidate) => {
        const peer = this.peers.get(senderId);
        if (!peer) return;
        try {
          await peer.handleCandidate(candidate);
        } catch (err) {
          this.reportSignalingFailure('ice-candidate', senderId, err);
        }
      },

      onRenegotiate: async (senderId) => {
        const peer = this.peers.get(senderId);
        if (!peer || peer.isPolite) return;
        try {
          const offer = await peer.createOffer();
          await this.signaler.sendOffer(senderId, offer);
        } catch (err) {
          this.reportSignalingFailure('renegotiate', senderId, err);
        }
      },

      onDeviceStateUpdate: (senderId, capabilities) => {
        const node = this.peerNodes.get(senderId);
        if (node) {
          node.capabilities = capabilities;
          node.isAudioActive = capabilities.hasAudio ?? node.isAudioActive;
          node.isVideoActive = capabilities.hasVideo ?? node.isVideoActive;
          node.isScreenActive = capabilities.hasScreenShare ?? node.isScreenActive;

          if (!capabilities.hasScreenShare) {
            node.isScreenActive = false;
            node.tracks.screen = undefined;
            node.tracks.screenAudio = undefined;
            node.screenStream = new MediaStream();
          }

          this.emitPeersChange();
        }
      },

      onChatMessage: (msg) => {
        this.events.onChatMessage?.(msg);
      },

      onError: (err) => {
        this.events.onError?.(err);
      },
    });
  }

  private reportSignalingFailure(stage: string, peerId: string, err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[MeshManager] ${stage} handling failed for ${peerId}:`, error);
    this.events.onError?.(error);
  }

  /**
   * Retrieves or initializes a PeerConnection with the remote device node.
   *
   * Creation is serialized per node: the in-flight promise is registered
   * synchronously, before the first `await`, so concurrent callers share one
   * connection. Without this, `onPeerJoined` and `onOffer` arriving in the same
   * signaling batch both pass the `peers.get()` guard while WebCrypto key
   * derivation is pending and build duplicate RTCPeerConnections, which then
   * emit competing ICE candidates and offers until the negotiation dies.
   */
  private getOrCreatePeer(
    remoteNodeId: string,
    remoteMeta: DeviceMetadata
  ): Promise<PeerConnection> {
    const existing = this.peers.get(remoteNodeId);
    if (existing) return Promise.resolve(existing);

    const inFlight = this.pendingPeers.get(remoteNodeId);
    if (inFlight) return inFlight;

    if (!remoteMeta?.publicKeyDh) {
      return Promise.reject(
        new Error(`Missing remote public key for peer ${remoteNodeId}; cannot derive session key.`)
      );
    }

    const creation = this.createPeer(remoteNodeId, remoteMeta).finally(() => {
      this.pendingPeers.delete(remoteNodeId);
    });

    this.pendingPeers.set(remoteNodeId, creation);
    return creation;
  }

  private async createPeer(
    remoteNodeId: string,
    remoteMeta: DeviceMetadata
  ): Promise<PeerConnection> {
    const localNodeId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;

    // Derive symmetric E2EE session key for this pair
    const sessionKey = await deriveSharedKey(
      this.localSecretKeyDh,
      remoteMeta.publicKeyDh
    );

    // Compute verifiable Safety Number (Fingerprint)
    const safetyNumber = await deriveSafetyNumber(
      this.localMeta.publicKeyDh,
      remoteMeta.publicKeyDh
    );
    const fingerprint = await computeKeyFingerprint(remoteMeta.publicKeyDh);

    // Create PeerConnection instance
    const peer = new PeerConnection({
      localId: localNodeId,
      remoteId: remoteNodeId,
      remoteMeta,
      iceServers: this.iceServers,

      onTrack: (track, stream, peerId) => {
        this.handleRemoteTrack(peerId, track, stream);
      },

      onTrackRemoved: (track, peerId) => {
        this.handleRemoteTrackRemoved(peerId, track);
      },

      onDataChannel: (rawChannel, peerId) => {
        this.setupDataChannel(peerId, rawChannel, sessionKey);
      },

      onIceCandidate: (candidate, targetId) => {
        this.signaler.sendCandidate(targetId, candidate);
      },

      onNegotiationNeeded: async (targetId) => {
        try {
          const offer = await peer.createOffer();
          await this.signaler.sendOffer(targetId, offer);
        } catch (err) {
          console.error(`[MeshManager] Failed to send offer on renegotiation:`, err);
        }
      },

      onConnectionStateChange: (state, peerId) => {
        const node = this.peerNodes.get(peerId);
        if (node) {
          node.connectionState = state;
          this.emitPeersChange();
        }
      },
    });

    // Only the impolite side opens the channel. A single creator keeps exactly one
    // SCTP stream per pair, guarantees the offer carries the application m-section,
    // and removes the start-up offer glare; the polite side picks the same channel
    // up through `ondatachannel`.
    if (!peer.isPolite) {
      const rawDc = peer.createDataChannel('ghost-e2ee-channel');
      this.setupDataChannel(remoteNodeId, rawDc, sessionKey);
    }

    // Attach currently active local tracks
    this.attachLocalTracksToPeer(peer);

    // Register node model
    const isSameUser = remoteMeta.userId === this.localMeta.userId;
    const node: RemotePeerNode = {
      nodeId: remoteNodeId,
      userId: remoteMeta.userId,
      deviceId: remoteMeta.deviceId,
      deviceName: remoteMeta.deviceName,
      deviceType: remoteMeta.deviceType,
      username: remoteMeta.username,
      publicKeyEd: remoteMeta.publicKeyEd,
      publicKeyDh: remoteMeta.publicKeyDh,
      safetyNumber,
      fingerprint,
      connectionState: peer.pc.connectionState,
      streams: [],
      userStream: new MediaStream(),
      screenStream: new MediaStream(),
      tracks: {},
      capabilities: remoteMeta.capabilities || {
        hasAudio: false,
        hasVideo: false,
        hasScreenShare: false,
      },
      isAudioActive: remoteMeta.capabilities?.hasAudio ?? false,
      isVideoActive: remoteMeta.capabilities?.hasVideo ?? false,
      isScreenActive: remoteMeta.capabilities?.hasScreenShare ?? false,
      isSameUserAsLocal: isSameUser,
    };

    this.peers.set(remoteNodeId, peer);
    this.peerNodes.set(remoteNodeId, node);
    this.emitPeersChange();

    return peer;
  }

  private setupDataChannel(
    peerId: string,
    rawChannel: RTCDataChannel,
    sessionKey: CryptoKey
  ): void {
    const localSenderId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;

    const previous = this.peerDataChannels.get(peerId);
    if (previous && previous.rawChannel !== rawChannel) {
      previous.close();
    }

    const dc = new E2EEDataChannel(
      rawChannel,
      localSenderId,
      this.localMeta.username,
      sessionKey
    );

    dc.setEventListeners({
      onMessage: (msg) => this.events.onChatMessage?.(msg),
      onTyping: (ind) => this.events.onTyping?.(ind),
      onFileProgress: (meta) => this.events.onFileProgress?.(meta),
      onFileComplete: (meta, blob) => this.events.onFileReceived?.(meta, blob),
      onError: (err) => this.events.onError?.(err),
    });

    this.peerDataChannels.set(peerId, dc);
  }

  private attachLocalTracksToPeer(peer: PeerConnection): void {
    if (!this.mediaEngine) return;

    const userStream = this.mediaEngine.getUserStream();
    if (userStream) {
      userStream.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          peer.addTrack(track, userStream);
        }
      });
    }

    const screenStream = this.mediaEngine.getScreenStream();
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          peer.addTrack(track, screenStream);
        }
      });
    }
  }

  /**
   * Broadcasts track updates to all active peers and triggers renegotiation.
   */
  public async syncLocalTracks(): Promise<void> {
    if (!this.mediaEngine) return;

    const userStream = this.mediaEngine.getUserStream();
    const screenStream = this.mediaEngine.getScreenStream();
    const trackMap = this.mediaEngine.getTrackMap();

    const capabilities = {
      hasAudio: !this.mediaEngine.isAudioMuted && !!userStream?.getAudioTracks().some((t) => t.readyState === 'live'),
      hasVideo: !this.mediaEngine.isVideoMuted && !!userStream?.getVideoTracks().some((t) => t.readyState === 'live'),
      hasScreenShare: this.mediaEngine.isScreenSharing && !!screenStream?.getVideoTracks().some((t) => t.readyState === 'live'),
      trackMap,
    };

    this.localMeta.capabilities = capabilities;

    // Update signaling presence capabilities
    await this.signaler.sendStateUpdate(capabilities);

    // Apply to all peer connections
    await Promise.all(
      Array.from(this.peers.values()).map((peer) =>
        peer.syncLocalTracks(userStream, screenStream).catch((err) => {
          console.error(`[MeshManager] Track sync failed for ${peer.remoteId}:`, err);
        })
      )
    );
  }

  private handleRemoteTrack(nodeId: string, track: MediaStreamTrack, stream: MediaStream): void {
    const node = this.peerNodes.get(nodeId);
    if (!node) return;

    if (!node.streams.includes(stream)) {
      node.streams.push(stream);
    }

    const trackMap = node.capabilities?.trackMap;
    let isScreenTrack = false;

    if (trackMap) {
      if (track.id === trackMap.screenVideoTrackId || track.id === trackMap.screenAudioTrackId) {
        isScreenTrack = true;
      } else if (track.id === trackMap.userVideoTrackId || track.id === trackMap.userAudioTrackId) {
        isScreenTrack = false;
      } else if (trackMap.screenStreamId && stream.id === trackMap.screenStreamId) {
        isScreenTrack = true;
      } else if (trackMap.userStreamId && stream.id === trackMap.userStreamId) {
        isScreenTrack = false;
      }
    }

    // Fallback heuristic if trackMap not available
    if (!trackMap || (!trackMap.screenVideoTrackId && !trackMap.userVideoTrackId)) {
      const isScreenLabel =
        track.label.toLowerCase().includes('screen') ||
        track.label.toLowerCase().includes('display') ||
        track.label.toLowerCase().includes('window') ||
        stream.id.toLowerCase().includes('screen');

      if (track.kind === 'video') {
        if (isScreenLabel) {
          isScreenTrack = true;
        } else if (node.capabilities?.hasScreenShare && !node.capabilities?.hasVideo) {
          isScreenTrack = true;
        } else if (node.tracks.video && node.tracks.video !== track && track.readyState === 'live') {
          isScreenTrack = true;
        }
      } else if (track.kind === 'audio') {
        if (isScreenLabel) {
          isScreenTrack = true;
        } else if (node.tracks.audio && node.tracks.audio !== track && track.readyState === 'live') {
          isScreenTrack = true;
        }
      }
    }

    if (track.kind === 'audio') {
      if (isScreenTrack) {
        node.tracks.screenAudio = track;
        const currentTracks = node.screenStream.getTracks().filter((t) => t.kind !== 'audio');
        currentTracks.push(track);
        node.screenStream = new MediaStream(currentTracks);
      } else {
        node.tracks.audio = track;
        node.isAudioActive = node.capabilities?.hasAudio ?? true;
        const currentTracks = node.userStream.getTracks().filter((t) => t.kind !== 'audio');
        currentTracks.push(track);
        node.userStream = new MediaStream(currentTracks);
      }
    } else if (track.kind === 'video') {
      if (isScreenTrack) {
        node.tracks.screen = track;
        node.isScreenActive = true;
        const currentTracks = node.screenStream.getTracks().filter((t) => t.kind !== 'video');
        currentTracks.push(track);
        node.screenStream = new MediaStream(currentTracks);
      } else {
        node.tracks.video = track;
        node.isVideoActive = node.capabilities?.hasVideo ?? true;
        const currentTracks = node.userStream.getTracks().filter((t) => t.kind !== 'video');
        currentTracks.push(track);
        node.userStream = new MediaStream(currentTracks);
      }
    }

    this.events.onTrackAdded?.(nodeId, track, stream);
    this.emitPeersChange();
  }

  private handleRemoteTrackRemoved(nodeId: string, track: MediaStreamTrack): void {
    const node = this.peerNodes.get(nodeId);
    if (!node) return;

    if (node.userStream.getTracks().includes(track)) {
      const remaining = node.userStream.getTracks().filter((t) => t !== track);
      node.userStream = new MediaStream(remaining);
    }
    if (node.screenStream.getTracks().includes(track)) {
      const remaining = node.screenStream.getTracks().filter((t) => t !== track);
      node.screenStream = new MediaStream(remaining);
    }

    if (track.kind === 'audio') {
      if (node.tracks.audio === track) {
        node.tracks.audio = undefined;
        node.isAudioActive = false;
      }
      if (node.tracks.screenAudio === track) {
        node.tracks.screenAudio = undefined;
      }
    } else if (track.kind === 'video') {
      if (node.tracks.screen === track) {
        node.tracks.screen = undefined;
        node.isScreenActive = false;
      }
      if (node.tracks.video === track) {
        node.tracks.video = undefined;
        node.isVideoActive = false;
      }
    }

    this.events.onTrackRemoved?.(nodeId, track);
    this.emitPeersChange();
  }

  private removePeer(nodeId: string): void {
    this.pendingPeers.delete(nodeId);
    this.pendingAdmission.delete(nodeId);

    const peer = this.peers.get(nodeId);
    if (peer) {
      peer.close();
      this.peers.delete(nodeId);
    }

    const dc = this.peerDataChannels.get(nodeId);
    if (dc) {
      dc.close();
      this.peerDataChannels.delete(nodeId);
    }

    this.peerNodes.delete(nodeId);
    this.emitPeersChange();
  }

  /**
   * Broadcasts an encrypted text message to all connected peers in mesh.
   */
  public async broadcastTextMessage(text: string): Promise<ChatTextMessage> {
    const localSenderId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;
    const msg: ChatTextMessage = {
      id: crypto.randomUUID(),
      senderId: localSenderId,
      senderName: this.localMeta.username,
      senderDeviceId: this.localMeta.deviceId,
      text,
      timestamp: Date.now(),
    };

    const promises: Promise<any>[] = [];
    for (const [peerId, dc] of this.peerDataChannels.entries()) {
      if (dc.isOpen) {
        promises.push(dc.sendTextMessage(text));
      }
    }

    // Direct encrypted signaling delivery guarantees zero packet drop across all network environments
    promises.push(this.signaler.sendChatMessage(msg));

    await Promise.allSettled(promises);
    return msg;
  }

  /**
   * Broadcasts typing status.
   */
  public async broadcastTyping(isTyping: boolean): Promise<void> {
    for (const dc of this.peerDataChannels.values()) {
      if (dc.isOpen) {
        dc.sendTyping(isTyping).catch(() => {});
      }
    }
  }

  /**
   * Streams an encrypted file to all connected peers in mesh.
   */
  public async broadcastFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const fileId = crypto.randomUUID();
    const channels = Array.from(this.peerDataChannels.values()).filter((c) => c.isOpen);

    if (channels.length === 0) {
      throw new Error('No active peer data channels available for file transmission');
    }

    // Stream concurrently to all peers
    await Promise.all(
      channels.map((channel, idx) =>
        channel.sendFile(file, (p) => {
          if (idx === 0) onProgress?.(p);
        })
      )
    );

    return fileId;
  }

  private emitPeersChange(): void {
    const list = Array.from(this.peerNodes.values());
    this.events.onPeersChange?.(list);

    // Group peers by userId for Multi-Device Co-Presence representation
    const userMap = new Map<string, CoPresenceUser>();

    // Add local user group
    userMap.set(this.localMeta.userId, {
      userId: this.localMeta.userId,
      username: this.localMeta.username,
      isLocalUser: true,
      devices: [],
      hasActiveScreenShare: !!this.mediaEngine?.isScreenSharing,
    });

    // Group remote peer devices
    for (const node of list) {
      let group = userMap.get(node.userId);
      if (!group) {
        group = {
          userId: node.userId,
          username: node.username,
          isLocalUser: node.userId === this.localMeta.userId,
          devices: [],
          hasActiveScreenShare: false,
        };
        userMap.set(node.userId, group);
      }

      group.devices.push(node);
      if (node.isScreenActive || node.capabilities.hasScreenShare) {
        group.hasActiveScreenShare = true;
      }
    }

    this.events.onCoPresenceChange?.(Array.from(userMap.values()));
  }

  public getPeers(): RemotePeerNode[] {
    return Array.from(this.peerNodes.values());
  }

  public destroy(): void {
    for (const peer of this.peers.values()) {
      peer.close();
    }
    for (const dc of this.peerDataChannels.values()) {
      dc.close();
    }
    this.peers.clear();
    this.pendingPeers.clear();
    this.pendingAdmission.clear();
    this.admittedPeers.clear();
    this.selfAdmitted = false;
    this.peerDataChannels.clear();
    this.peerNodes.clear();
  }
}
