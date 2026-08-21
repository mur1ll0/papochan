import { DeviceMetadata } from '../signaling/SignalingClient';

export interface PeerConnectionOptions {
  localId: string;
  remoteId: string;
  remoteMeta: DeviceMetadata;
  iceServers?: RTCIceServer[];
  onTrack: (track: MediaStreamTrack, stream: MediaStream, peerId: string) => void;
  onTrackRemoved?: (track: MediaStreamTrack, peerId: string) => void;
  onDataChannel: (channel: RTCDataChannel, peerId: string) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit, targetId: string) => void;
  onNegotiationNeeded: (targetId: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState, peerId: string) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * PeerConnection encapsulates RTCPeerConnection implementing the Perfect Negotiation
 * state machine pattern to seamlessly handle renegotiation, glare, and collision avoidance.
 */
export class PeerConnection {
  public readonly pc: RTCPeerConnection;
  public readonly localId: string;
  public readonly remoteId: string;
  public readonly remoteMeta: DeviceMetadata;
  public readonly isPolite: boolean;

  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private queuedIceCandidates: RTCIceCandidateInit[] = [];
  private remoteStream = new MediaStream();
  private dataChannel: RTCDataChannel | null = null;

  constructor(private options: PeerConnectionOptions) {
    this.localId = options.localId;
    this.remoteId = options.remoteId;
    this.remoteMeta = options.remoteMeta;

    // Determine polite vs impolite peer deterministically by comparing IDs
    this.isPolite = this.localId.localeCompare(this.remoteId) > 0;

    const iceServers = options.iceServers?.length ? options.iceServers : DEFAULT_ICE_SERVERS;

    this.pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    // 1. Negotiation needed
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        this.options.onNegotiationNeeded(this.remoteId);
      } catch (err) {
        console.error(`[PeerConnection:${this.remoteId}] Error on negotiationneeded:`, err);
      } finally {
        this.makingOffer = false;
      }
    };

    // 2. ICE Candidates
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.options.onIceCandidate(candidate.toJSON(), this.remoteId);
      }
    };

    // 3. Remote Tracks
    this.pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] || this.remoteStream;
      if (!this.remoteStream.getTracks().includes(track)) {
        this.remoteStream.addTrack(track);
      }

      track.onended = () => {
        this.remoteStream.removeTrack(track);
        this.options.onTrackRemoved?.(track, this.remoteId);
      };

      this.options.onTrack(track, stream, this.remoteId);
    };

    // 4. Remote DataChannel
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.options.onDataChannel(event.channel, this.remoteId);
    };

    // 5. Connection State
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.options.onConnectionStateChange(state, this.remoteId);

      if (state === 'failed') {
        console.warn(`[PeerConnection:${this.remoteId}] ICE/DTLS failed. Initiating ICE restart.`);
        this.pc.restartIce();
      }
    };
  }

  /**
   * Initializes local reliable RTCDataChannel for encrypted chat and files.
   */
  public createDataChannel(label: string = 'ghost-e2ee-channel'): RTCDataChannel {
    const dc = this.pc.createDataChannel(label, {
      ordered: true,
    });
    this.dataChannel = dc;
    return dc;
  }

  /**
   * Adds local media track for this peer connection without replacing distinct streams.
   */
  public addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    const senders = this.pc.getSenders();
    
    // Check if this exact track is already being sent
    const existingExactSender = senders.find((s) => s.track === track || s.track?.id === track.id);
    if (existingExactSender) {
      return existingExactSender;
    }

    // Check if there is an empty/ended sender of the same kind that we can reuse
    const reusableSender = senders.find(
      (s) => !s.track || s.track.readyState === 'ended'
    );
    if (reusableSender) {
      reusableSender.replaceTrack(track);
      return reusableSender;
    }

    return this.pc.addTrack(track, stream);
  }

  /**
   * Replaces an existing track of same kind without renegotiation if possible.
   */
  public async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<boolean> {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
      return true;
    }
    return false;
  }

  /**
   * Removes a track sender.
   */
  public removeTrack(track: MediaStreamTrack): void {
    const sender = this.pc.getSenders().find((s) => s.track === track || s.track?.id === track.id);
    if (sender) {
      try {
        this.pc.removeTrack(sender);
      } catch (err) {
        console.warn('[PeerConnection] Error removing track sender:', err);
      }
    }
  }

  /**
   * Synchronizes active local media streams (camera + screen share) with RTCRtpSenders.
   */
  public syncLocalTracks(userStream: MediaStream | null, screenStream: MediaStream | null): void {
    const activeTracks: { track: MediaStreamTrack; stream: MediaStream }[] = [];

    if (userStream) {
      userStream.getTracks().forEach((t) => {
        if (t.readyState === 'live') {
          activeTracks.push({ track: t, stream: userStream });
        }
      });
    }

    if (screenStream) {
      screenStream.getTracks().forEach((t) => {
        if (t.readyState === 'live') {
          activeTracks.push({ track: t, stream: screenStream });
        }
      });
    }

    const currentSenders = this.pc.getSenders();

    // 1. Remove dead/stopped senders
    currentSenders.forEach((sender) => {
      if (!sender.track || sender.track.readyState === 'ended') {
        try {
          this.pc.removeTrack(sender);
        } catch {
          // ignore
        }
      } else {
        const isStillActive = activeTracks.some((at) => at.track === sender.track || at.track.id === sender.track?.id);
        if (!isStillActive) {
          try {
            this.pc.removeTrack(sender);
          } catch {
            // ignore
          }
        }
      }
    });

    // 2. Add newly active tracks
    activeTracks.forEach(({ track, stream }) => {
      this.addTrack(track, stream);
    });
  }

  /**
   * Creates an SDP Offer (handling perfect negotiation collision rules).
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.makingOffer = true;
    try {
      await this.pc.setLocalDescription();
      return this.pc.localDescription!;
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Handles incoming SDP Offer from remote peer.
   */
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);

    const offerCollision = !readyForOffer;

    if (offerCollision) {
      if (!this.isPolite) {
        // Impolite peer ignores offer collision and keeps its own offer
        this.ignoreOffer = true;
        return null;
      }
      // Polite peer rolls back local offer to accept incoming offer
      await Promise.all([
        this.pc.setLocalDescription({ type: 'rollback' }),
        this.pc.setRemoteDescription(offer),
      ]);
    } else {
      await this.pc.setRemoteDescription(offer);
    }

    // Flush queued ICE candidates
    await this.flushQueuedCandidates();

    // Create and set local answer
    await this.pc.setLocalDescription();
    return this.pc.localDescription!;
  }

  /**
   * Handles incoming SDP Answer from remote peer.
   */
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    this.isSettingRemoteAnswerPending = true;
    try {
      await this.pc.setRemoteDescription(answer);
      await this.flushQueuedCandidates();
    } finally {
      this.isSettingRemoteAnswerPending = false;
    }
  }

  /**
   * Handles incoming ICE candidate with queueing support.
   */
  public async handleCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.pc.remoteDescription) {
        // Queue candidate until remote description is set
        this.queuedIceCandidates.push(candidateInit);
        return;
      }

      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      if (!this.ignoreOffer) {
        console.error(`[PeerConnection:${this.remoteId}] Error adding ICE candidate:`, err);
      }
    }
  }

  private async flushQueuedCandidates(): Promise<void> {
    while (this.queuedIceCandidates.length > 0) {
      const cand = this.queuedIceCandidates.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn(`[PeerConnection:${this.remoteId}] Failed to apply queued candidate:`, err);
        }
      }
    }
  }

  public getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  public close(): void {
    try {
      if (this.dataChannel) {
        this.dataChannel.close();
      }
      this.pc.close();
    } catch (err) {
      console.warn(`[PeerConnection:${this.remoteId}] Error closing:`, err);
    }
  }
}
