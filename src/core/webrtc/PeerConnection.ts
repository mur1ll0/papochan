import { DeviceMetadata } from '../signaling/SignalingClient';
import { buildIceServers, sanitizeIceServers } from './iceServers';

export interface PeerConnectionOptions {
  localId: string;
  remoteId: string;
  remoteMeta: DeviceMetadata;
  iceServers?: RTCIceServer[];
  onTrack: (track: MediaStreamTrack, stream: MediaStream, peerId: string) => void;
  onTrackRemoved?: (track: MediaStreamTrack, peerId: string) => void;
  onDataChannel: (channel: RTCDataChannel, peerId: string) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit, targetId: string) => void;
  onNegotiationNeeded: (targetId: string) => Promise<void> | void;
  onConnectionStateChange: (state: RTCPeerConnectionState, peerId: string) => void;
}

/** @deprecated Use `buildIceServers()` from ./iceServers instead. */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = buildIceServers();

/**
 * PeerConnection encapsulates RTCPeerConnection implementing the standard
 * W3C Perfect Negotiation state machine pattern to seamlessly handle renegotiation,
 * multi-track streams (camera + screen share), glare, and collision avoidance.
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
  private isClosed = false;

  constructor(private options: PeerConnectionOptions) {
    this.localId = options.localId;
    this.remoteId = options.remoteId;
    this.remoteMeta = options.remoteMeta;

    // Determine polite vs impolite peer deterministically by comparing IDs
    this.isPolite = this.localId.localeCompare(this.remoteId) > 0;

    const iceServers = sanitizeIceServers(options.iceServers);

    this.pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    // 1. Perfect Negotiation: negotiation needed
    this.pc.onnegotiationneeded = async () => {
      if (this.isClosed) return;
      try {
        // Owns the flag for the whole create-offer + publish round trip, so a
        // remote offer arriving mid-flight is correctly seen as a collision.
        this.makingOffer = true;
        await this.options.onNegotiationNeeded(this.remoteId);
      } catch (err) {
        console.error(`[PeerConnection:${this.remoteId}] Error during negotiationneeded:`, err);
      } finally {
        this.makingOffer = false;
      }
    };

    // 2. ICE Candidates
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && !this.isClosed) {
        this.options.onIceCandidate(candidate.toJSON(), this.remoteId);
      }
    };

    // 3. Remote Tracks
    this.pc.ontrack = (event) => {
      const track = event.track;
      const stream = event.streams[0] || this.remoteStream;

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
      console.log(`[PeerConnection:${this.remoteId}] ondatachannel event received:`, event.channel.label, 'readyState:', event.channel.readyState);
      this.dataChannel = event.channel;
      this.options.onDataChannel(event.channel, this.remoteId);
    };

    // 5. Connection State
    this.pc.onconnectionstatechange = () => {
      if (this.isClosed) return;
      const state = this.pc.connectionState;
      console.log(`[PeerConnection:${this.remoteId}] connectionState -> ${state}`);
      this.options.onConnectionStateChange(state, this.remoteId);

      if (state === 'connected') {
        this.logSelectedCandidatePair();
      }

      if (state === 'failed') {
        console.warn(`[PeerConnection:${this.remoteId}] ICE/DTLS failed. Initiating ICE restart.`);
        try {
          this.pc.restartIce();
        } catch (e) {
          console.warn(`[PeerConnection:${this.remoteId}] restartIce failed:`, e);
        }
      }
    };

    // 6. ICE Connection State
    this.pc.oniceconnectionstatechange = () => {
      if (this.isClosed) return;
      if (this.pc.iceConnectionState === 'failed') {
        try {
          this.pc.restartIce();
        } catch {
          // ignore
        }
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
   * Adds a local track associated with a specific stream.
   */
  public addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    const senders = this.pc.getSenders();

    // Check if this exact track is already being sent
    const existingExactSender = senders.find((s) => s.track === track || s.track?.id === track.id);
    if (existingExactSender) {
      return existingExactSender;
    }

    return this.pc.addTrack(track, stream);
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
   * Synchronizes active local media streams (user media + screen share) with RTCRtpSenders.
   */
  public async syncLocalTracks(
    userStream: MediaStream | null,
    screenStream: MediaStream | null
  ): Promise<void> {
    if (this.isClosed) return;

    const activeUserTracks: MediaStreamTrack[] = userStream
      ? userStream.getTracks().filter((t) => t.readyState === 'live')
      : [];
    const activeScreenTracks: MediaStreamTrack[] = screenStream
      ? screenStream.getTracks().filter((t) => t.readyState === 'live')
      : [];

    const isScreenTrack = (track: MediaStreamTrack | null): boolean =>
      !!track && activeScreenTracks.some((t) => t === track || t.id === track.id);

    // 1. User Stream Audio / Video Tracks
    for (const track of activeUserTracks) {
      const senders = this.pc.getSenders();
      if (senders.some((s) => s.track === track || s.track?.id === track.id)) {
        continue;
      }

      // Reuse the sender already carrying a user track of the same kind (device
      // switch) rather than opening a second transceiver for it.
      const reusableSender = senders.find(
        (s) => s.track && s.track.kind === track.kind && !isScreenTrack(s.track)
      );

      if (reusableSender && typeof reusableSender.replaceTrack === 'function') {
        try {
          // Awaited on purpose: the removal pass below reads sender.track, and
          // would tear down the very sender we just handed a new track to.
          await reusableSender.replaceTrack(track);
          continue;
        } catch (err) {
          console.warn('[PeerConnection] replaceTrack failed, adding track:', err);
        }
      }

      try {
        if (userStream) {
          this.pc.addTrack(track, userStream);
        }
      } catch (err) {
        console.warn('[PeerConnection] Failed to add user track:', err);
      }
    }

    // 2. Screen Stream Tracks (Screen Video + Screen Audio)
    for (const track of activeScreenTracks) {
      const alreadySending = this.pc
        .getSenders()
        .some((s) => s.track === track || s.track?.id === track.id);
      if (!alreadySending && screenStream) {
        try {
          this.pc.addTrack(track, screenStream);
        } catch (err) {
          console.warn('[PeerConnection] Failed to add screen track:', err);
        }
      }
    }

    // 3. Remove stopped senders, or senders whose track left every local stream.
    //    Read fresh: the passes above mutated the sender list.
    this.pc.getSenders().forEach((sender) => {
      const track = sender.track;

      if (!track || track.readyState === 'ended') {
        try {
          this.pc.removeTrack(sender);
        } catch {}
        return;
      }

      const isUserTrack = activeUserTracks.some((t) => t === track || t.id === track.id);
      if (!isUserTrack && !isScreenTrack(track)) {
        try {
          this.pc.removeTrack(sender);
        } catch {}
      }
    });
  }

  /**
   * Creates an SDP Offer (handling perfect negotiation collision rules).
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    // When called from onnegotiationneeded the flag is already owned upstream and
    // must survive until the offer is published; only a direct call clears it.
    const ownsFlag = !this.makingOffer;
    if (ownsFlag) this.makingOffer = true;
    try {
      await this.pc.setLocalDescription();
      return this.pc.localDescription!;
    } finally {
      if (ownsFlag) this.makingOffer = false;
    }
  }

  /**
   * Handles incoming SDP Offer from remote peer following W3C Perfect Negotiation.
   */
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (this.isClosed) return null;

    const offerCollision =
      this.makingOffer ||
      this.pc.signalingState !== 'stable' ||
      this.isSettingRemoteAnswerPending;

    this.ignoreOffer = !this.isPolite && offerCollision;

    if (this.ignoreOffer) {
      console.warn(`[PeerConnection:${this.remoteId}] Impolite peer ignoring offer collision.`);
      return null;
    }

    if (offerCollision && this.isPolite) {
      // Polite peer rolls back local offer to accept incoming remote offer
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
    if (this.isClosed) return;

    // A stale or duplicated answer applied outside `have-local-offer` throws
    // InvalidStateError and aborts the negotiation for good.
    if (this.pc.signalingState !== 'have-local-offer') {
      console.warn(
        `[PeerConnection:${this.remoteId}] Ignoring answer in signalingState "${this.pc.signalingState}".`
      );
      return;
    }

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
    if (this.isClosed) return;
    try {
      if (!this.pc.remoteDescription) {
        // Queue candidate until remote description is set
        this.queuedIceCandidates.push(candidateInit);
        return;
      }

      await this.pc.addIceCandidate(candidateInit);
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
          await this.pc.addIceCandidate(cand);
        } catch (err) {
          if (!this.ignoreOffer) {
            console.warn(`[PeerConnection:${this.remoteId}] Failed to apply queued candidate:`, err);
          }
        }
      }
    }
  }

  /**
   * Reports which candidate pair won, so a call relayed through TURN (or one
   * that only ever succeeds on the same LAN) is visible in the console.
   */
  private async logSelectedCandidatePair(): Promise<void> {
    try {
      const stats = (await this.pc.getStats()) as unknown as Map<string, any>;
      stats.forEach((report: any) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          const local = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          console.log(
            `[PeerConnection:${this.remoteId}] ICE pair: ${local?.candidateType}/${local?.protocol}` +
              ` <-> ${remote?.candidateType}/${remote?.protocol}`
          );
        }
      });
    } catch {
      // stats are best-effort diagnostics only
    }
  }

  public getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  public close(): void {
    this.isClosed = true;
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
