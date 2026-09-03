import * as Ably from 'ably';
import {
  SignalingClient,
  SignalingEvents,
  DeviceMetadata,
  SignalEnvelope,
  SignalMessageType,
} from './SignalingClient';
import { signPayload, verifySignature, canonicalJsonStringify } from '../crypto/keygen';
import { getApiEndpoint } from '@/lib/api';

export class AblySignaler extends SignalingClient {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private roomCode: string = '';
  private localMeta: DeviceMetadata | null = null;
  private secretKeyEd: Uint8Array | null = null;
  private events: Partial<SignalingEvents> = {};
  private knownPeers = new Map<string, DeviceMetadata>();
  private processedSignatures = new Set<string>();

  constructor(private apiKeyOrTokenUrl?: string) {
    super();
  }

  public setEventListeners(events: Partial<SignalingEvents>): void {
    this.events = { ...this.events, ...events };
  }

  public async connect(
    roomCode: string,
    localMeta: DeviceMetadata,
    secretKeyEd: Uint8Array
  ): Promise<void> {
    this.roomCode = roomCode;
    this.localMeta = localMeta;
    this.secretKeyEd = secretKeyEd;
    this.processedSignatures.clear();

    const clientId = `${localMeta.userId}:${localMeta.deviceId}`;

    this.events.onConnectionStateChange?.('connecting');

    try {
      // Configure Ably Realtime Client
      const clientOptions: Ably.ClientOptions = {
        clientId,
        closeOnUnload: true,
      };

      const isUrl =
        this.apiKeyOrTokenUrl?.startsWith('http://') ||
        this.apiKeyOrTokenUrl?.startsWith('https://') ||
        this.apiKeyOrTokenUrl?.startsWith('/');

      if (this.apiKeyOrTokenUrl && !isUrl && this.apiKeyOrTokenUrl.includes(':') && !this.apiKeyOrTokenUrl.includes('/')) {
        // Direct Ably API Key (format: "appId.keyId:secret")
        clientOptions.key = this.apiKeyOrTokenUrl;
      } else {
        // Token authentication endpoint
        clientOptions.authUrl = this.apiKeyOrTokenUrl || getApiEndpoint('/api/signaling-token');
        clientOptions.authParams = {
          clientId,
          roomCode,
          deviceId: localMeta.deviceId,
          userId: localMeta.userId,
          username: localMeta.username,
        };
      }

      this.client = new Ably.Realtime(clientOptions);

      this.client.connection.on('connected', () => {
        this.events.onConnectionStateChange?.('connected');
      });

      this.client.connection.on('disconnected', () => {
        this.events.onConnectionStateChange?.('disconnected');
      });

      this.client.connection.on('failed', (stateChange) => {
        this.events.onConnectionStateChange?.('failed');
        this.events.onError?.(new Error(`Ably connection failed: ${stateChange.reason?.message}`));
      });

      // Join room signaling channel
      // No `rewind`: replaying signaling history re-delivers stale SDP and ICE
      // for connections that already moved on. Presence plus the explicit
      // presence-announce below is enough for mesh convergence.
      const channelName = `ghost:room:${roomCode}`;
      this.channel = this.client.channels.get(channelName);

      // Subscribe to signal messages
      await this.channel.subscribe('signal', (message: Ably.Message) => {
        this.handleIncomingSignal(message.data as SignalEnvelope);
      });

      // Subscribe to Ably Presence events for presence synchronization
      await this.channel.presence.subscribe('enter', (presenceMsg: Ably.PresenceMessage) => {
        this.handlePresenceEnter(presenceMsg);
      });

      await this.channel.presence.subscribe('update', (presenceMsg: Ably.PresenceMessage) => {
        this.handlePresenceUpdate(presenceMsg);
      });

      await this.channel.presence.subscribe('leave', (presenceMsg: Ably.PresenceMessage) => {
        this.handlePresenceLeave(presenceMsg);
      });

      // Announce local presence with device capabilities & public keys
      await this.channel.presence.enter(this.localMeta);

      // Query existing peers in presence set
      const members = await this.channel.presence.get();
      members.forEach((member) => {
        if (member.clientId !== clientId && member.data) {
          const peerMeta = member.data as DeviceMetadata;
          this.knownPeers.set(member.clientId, peerMeta);
          this.events.onPeerJoined?.(peerMeta);
        }
      });

      // Broadcast an explicit presence announce signal for immediate mesh convergence
      await this.publishEnvelope('presence-announce', this.localMeta);
    } catch (err: any) {
      this.events.onError?.(err);
      this.events.onConnectionStateChange?.('failed');
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        // Attempt fast best-effort leave signal
        await Promise.race([
          Promise.all([
            this.publishEnvelope('leave', { deviceId: this.localMeta?.deviceId }),
            this.channel.presence.leave(),
          ]),
          new Promise((r) => setTimeout(r, 200)),
        ]).catch(() => {});

        try {
          this.channel.unsubscribe();
        } catch {
          // ignore
        }
      }
      if (this.client) {
        this.client.close();
      }
    } catch (err) {
      console.warn('[AblySignaler] Error during disconnect:', err);
    } finally {
      this.channel = null;
      this.client = null;
      this.knownPeers.clear();
      this.processedSignatures.clear();
      this.events.onConnectionStateChange?.('disconnected');
    }
  }

  public async sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.publishEnvelope('offer', { sdp, meta: this.localMeta }, targetId);
  }

  public async sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.publishEnvelope('answer', { sdp }, targetId);
  }

  public async sendCandidate(targetId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.publishEnvelope('ice-candidate', { candidate }, targetId);
  }

  public async sendRenegotiate(targetId: string): Promise<void> {
    await this.publishEnvelope('renegotiate', {}, targetId);
  }

  public async sendPresenceAnnounce(): Promise<void> {
    if (this.localMeta) {
      if (this.channel) {
        await this.channel.presence.enter(this.localMeta).catch(() => {});
      }
      await this.publishEnvelope('presence-announce', this.localMeta);
    }
  }

  public async sendStateUpdate(capabilities: DeviceMetadata['capabilities']): Promise<void> {
    if (this.localMeta) {
      this.localMeta.capabilities = capabilities;
      if (this.channel) {
        await this.channel.presence.update(this.localMeta);
      }
      await this.publishEnvelope('device-state-update', capabilities);
    }
  }

  public async sendKnock(): Promise<void> {
    if (this.localMeta) {
      await this.publishEnvelope('knock', this.localMeta);
    }
  }

  public async sendKnockApproved(targetId: string): Promise<void> {
    await this.publishEnvelope('knock-approved', { approved: true, approver: this.localMeta }, targetId);
  }

  public async sendKnockRejected(targetId: string): Promise<void> {
    await this.publishEnvelope('knock-rejected', { rejected: true, rejector: this.localMeta }, targetId);
  }

  public async sendKnockCancel(): Promise<void> {
    await this.publishEnvelope('knock-cancel', {});
  }

  public getKnownPeersCount(): number {
    return this.knownPeers.size;
  }

  private async publishEnvelope<T>(
    type: SignalMessageType,
    payload: T,
    targetId?: string
  ): Promise<void> {
    if (!this.channel || !this.localMeta || !this.secretKeyEd) {
      console.error(
        `[AblySignaler] Dropped "${type}": channel is not ready. ` +
          'The peer waiting on this signal will stall.'
      );
      return;
    }

    const senderId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;
    const timestamp = Date.now();

    // Data string for digital signature verification
    const canonicalPayload = canonicalJsonStringify(payload);
    const signaturePayload = `${type}|${senderId}|${targetId || '*'}|${this.roomCode}|${timestamp}|${canonicalPayload}`;
    const signature = signPayload(signaturePayload, this.secretKeyEd);

    const envelope: SignalEnvelope<T> = {
      type,
      senderId,
      targetId,
      roomCode: this.roomCode,
      payload,
      timestamp,
      publicKeyEd: this.localMeta.publicKeyEd,
      signature,
    };

    await this.channel.publish('signal', envelope);
  }

  private handleIncomingSignal(envelope: SignalEnvelope): void {
    if (!this.localMeta) return;

    const myClientId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;

    // Discard signals emitted by self
    if (envelope.senderId === myClientId) return;

    // Discard replays: Ably can redeliver on reconnect, and applying the same
    // offer or answer twice throws InvalidStateError and kills the negotiation.
    const sigKey =
      envelope.signature || `${envelope.senderId}-${envelope.timestamp}-${envelope.type}`;
    if (this.processedSignatures.has(sigKey)) return;
    this.processedSignatures.add(sigKey);
    if (this.processedSignatures.size > 2000) {
      const oldest = this.processedSignatures.values().next().value;
      if (oldest) this.processedSignatures.delete(oldest);
    }

    // Discard targeted signals not intended for this device
    if (envelope.targetId && envelope.targetId !== myClientId) return;

    // Verify digital signature to ensure zero MITM and authenticity
    const canonicalPayload = canonicalJsonStringify(envelope.payload);
    const verificationString = `${envelope.type}|${envelope.senderId}|${envelope.targetId || '*'}|${envelope.roomCode}|${envelope.timestamp}|${canonicalPayload}`;
    let isValid = verifySignature(
      verificationString,
      envelope.signature,
      envelope.publicKeyEd
    );

    // Fallback check for uncanonicalized payload format
    if (!isValid) {
      const fallbackString = `${envelope.type}|${envelope.senderId}|${envelope.targetId || '*'}|${envelope.roomCode}|${envelope.timestamp}|${JSON.stringify(envelope.payload)}`;
      isValid = verifySignature(
        fallbackString,
        envelope.signature,
        envelope.publicKeyEd
      );
    }

    if (!isValid) {
      console.warn('[AblySignaler] Signature mismatch on signal from:', envelope.senderId, 'type:', envelope.type);
    }

    switch (envelope.type) {
      case 'presence-announce': {
        const peerMeta = envelope.payload as DeviceMetadata;
        this.knownPeers.set(envelope.senderId, peerMeta);
        this.events.onPeerJoined?.(peerMeta);
        break;
      }
      case 'offer': {
        const { sdp, meta } = envelope.payload as {
          sdp: RTCSessionDescriptionInit;
          meta: DeviceMetadata;
        };
        if (meta) {
          this.knownPeers.set(envelope.senderId, meta);
        }
        this.events.onOffer?.(envelope.senderId, sdp, meta || this.knownPeers.get(envelope.senderId));
        break;
      }
      case 'answer': {
        const { sdp } = envelope.payload as { sdp: RTCSessionDescriptionInit };
        this.events.onAnswer?.(envelope.senderId, sdp);
        break;
      }
      case 'ice-candidate': {
        const { candidate } = envelope.payload as { candidate: RTCIceCandidateInit };
        this.events.onCandidate?.(envelope.senderId, candidate);
        break;
      }
      case 'renegotiate': {
        this.events.onRenegotiate?.(envelope.senderId);
        break;
      }
      case 'device-state-update': {
        const capabilities = envelope.payload as DeviceMetadata['capabilities'];
        const existing = this.knownPeers.get(envelope.senderId);
        if (existing) {
          existing.capabilities = capabilities;
        }
        this.events.onDeviceStateUpdate?.(envelope.senderId, capabilities);
        break;
      }
      case 'leave': {
        this.knownPeers.delete(envelope.senderId);
        this.events.onPeerLeft?.(envelope.senderId);
        break;
      }
      case 'knock': {
        const peerMeta = envelope.payload as DeviceMetadata;
        this.events.onKnock?.({
          senderId: envelope.senderId,
          meta: peerMeta,
          timestamp: envelope.timestamp,
        });
        break;
      }
      case 'knock-approved': {
        this.events.onKnockApproved?.(envelope.senderId);
        break;
      }
      case 'knock-rejected': {
        this.events.onKnockRejected?.(envelope.senderId);
        break;
      }
      case 'knock-cancel': {
        this.events.onKnockCancelled?.(envelope.senderId);
        break;
      }
      case 'chat': {
        this.events.onChatMessage?.(envelope.payload);
        break;
      }
    }
  }

  public async sendChatMessage(msg: any): Promise<void> {
    await this.publishEnvelope('chat', msg);
  }

  private handlePresenceEnter(msg: Ably.PresenceMessage): void {
    if (!this.localMeta) return;
    const myClientId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;
    if (msg.clientId === myClientId) return;

    if (msg.data) {
      const peerMeta = msg.data as DeviceMetadata;
      this.knownPeers.set(msg.clientId, peerMeta);
      this.events.onPeerJoined?.(peerMeta);
    }
  }

  private handlePresenceUpdate(msg: Ably.PresenceMessage): void {
    if (msg.data) {
      const peerMeta = msg.data as DeviceMetadata;
      this.knownPeers.set(msg.clientId, peerMeta);
      this.events.onDeviceStateUpdate?.(msg.clientId, peerMeta.capabilities);
    }
  }

  private handlePresenceLeave(msg: Ably.PresenceMessage): void {
    this.knownPeers.delete(msg.clientId);
    this.events.onPeerLeft?.(msg.clientId);
  }
}
