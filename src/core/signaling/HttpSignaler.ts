import {
  SignalingClient,
  SignalingEvents,
  DeviceMetadata,
  SignalEnvelope,
  SignalMessageType,
} from './SignalingClient';
import { signPayload, verifySignature } from '../crypto/keygen';
import { getApiEndpoint } from '@/lib/api';

export class HttpSignaler extends SignalingClient {
  private roomCode: string = '';
  private localMeta: DeviceMetadata | null = null;
  private secretKeyEd: Uint8Array | null = null;
  private events: Partial<SignalingEvents> = {};
  private knownPeers = new Map<string, DeviceMetadata>();

  private pollInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPollTimestamp: number = 0;
  private isConnected: boolean = false;
  private isHost: boolean = false;

  constructor(isHost: boolean = false) {
    super();
    this.isHost = isHost;
  }

  public setEventListeners(events: Partial<SignalingEvents>): void {
    this.events = { ...this.events, ...events };
  }

  public async connect(
    roomCode: string,
    localMeta: DeviceMetadata,
    secretKeyEd: Uint8Array
  ): Promise<void> {
    this.roomCode = roomCode.toUpperCase();
    this.localMeta = localMeta;
    this.secretKeyEd = secretKeyEd;
    this.lastPollTimestamp = Date.now() - 5000;

    this.events.onConnectionStateChange?.('connecting');

    try {
      // 1. Initial Heartbeat / Room Registration
      const heartbeatRes = await fetch(getApiEndpoint('/api/signaling'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          action: 'heartbeat',
          meta: this.localMeta,
          isHost: this.isHost,
        }),
      });

      if (!heartbeatRes.ok) {
        throw new Error(`Signaling registration failed (${heartbeatRes.status})`);
      }

      const heartbeatData = await heartbeatRes.json().catch(() => ({}));
      if (heartbeatData.isHost || (heartbeatData.peersCount !== undefined && heartbeatData.peersCount <= 1)) {
        this.isHost = true;
        this.events.onHostAssigned?.(true);
      }

      this.isConnected = true;
      this.events.onConnectionStateChange?.('connected');

      // 2. Start fast message polling (every 400ms)
      this.pollInterval = setInterval(() => {
        this.pollMessages();
      }, 400);

      // 3. Start presence heartbeat (every 5 seconds)
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 5000);

      // Initial immediate poll
      await this.pollMessages();
    } catch (err: any) {
      console.error('[HttpSignaler] Connection failed:', err);
      this.events.onConnectionStateChange?.('failed');
      this.events.onError?.(err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.pollInterval = null;
    this.heartbeatInterval = null;

    if (this.localMeta && this.roomCode) {
      try {
        await fetch(getApiEndpoint('/api/signaling'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: this.roomCode,
            action: 'leave',
            meta: this.localMeta,
          }),
        });
      } catch {
        // ignore
      }
    }

    this.knownPeers.clear();
    this.events.onConnectionStateChange?.('disconnected');
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

  public async sendStateUpdate(capabilities: DeviceMetadata['capabilities']): Promise<void> {
    if (this.localMeta) {
      this.localMeta.capabilities = capabilities;
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

  private async sendHeartbeat(): Promise<void> {
    if (!this.isConnected || !this.localMeta) return;
    try {
      await fetch(getApiEndpoint('/api/signaling'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          action: 'heartbeat',
          meta: this.localMeta,
          isHost: this.isHost,
        }),
      });
    } catch {
      // ignore transient network glitch
    }
  }

  private async pollMessages(): Promise<void> {
    if (!this.isConnected || !this.localMeta) return;
    const clientId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;

    try {
      const url = getApiEndpoint(
        `/api/signaling?roomCode=${encodeURIComponent(this.roomCode)}&clientId=${encodeURIComponent(clientId)}&since=${this.lastPollTimestamp}`
      );

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.serverTime) {
        this.lastPollTimestamp = Math.max(this.lastPollTimestamp, data.serverTime - 500);
      }

      if (data.hostId && data.hostId === clientId && !this.isHost) {
        this.isHost = true;
        this.events.onHostAssigned?.(true);
      }

      // Sync active peers
      if (Array.isArray(data.peers)) {
        const currentPeerIds = new Set<string>();
        data.peers.forEach((peerMeta: DeviceMetadata) => {
          const peerId = `${peerMeta.userId}:${peerMeta.deviceId}`;
          currentPeerIds.add(peerId);
          if (!this.knownPeers.has(peerId)) {
            this.knownPeers.set(peerId, peerMeta);
            this.events.onPeerJoined?.(peerMeta);
          }
        });

        // Detect departed peers
        for (const [peerId] of this.knownPeers.entries()) {
          if (!currentPeerIds.has(peerId)) {
            this.knownPeers.delete(peerId);
            this.events.onPeerLeft?.(peerId);
          }
        }
      }

      // Process incoming envelopes
      if (Array.isArray(data.messages)) {
        for (const envelope of data.messages) {
          this.handleIncomingSignal(envelope);
        }
      }
    } catch (err) {
      console.warn('[HttpSignaler] Poll error:', err);
    }
  }

  private async publishEnvelope<T>(
    type: SignalMessageType,
    payload: T,
    targetId?: string
  ): Promise<void> {
    if (!this.localMeta || !this.secretKeyEd) return;

    const senderId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;
    const timestamp = Date.now();

    const signaturePayload = `${type}|${senderId}|${targetId || '*'}|${this.roomCode}|${timestamp}|${JSON.stringify(payload)}`;
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

    try {
      await fetch(getApiEndpoint('/api/signaling'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          envelope,
        }),
      });
    } catch (err) {
      console.error('[HttpSignaler] Publish error:', err);
    }
  }

  private handleIncomingSignal(envelope: SignalEnvelope): void {
    if (!this.localMeta) return;

    const myClientId = `${this.localMeta.userId}:${this.localMeta.deviceId}`;
    if (envelope.senderId === myClientId) return;
    if (envelope.targetId && envelope.targetId !== myClientId) return;

    const verificationString = `${envelope.type}|${envelope.senderId}|${envelope.targetId || '*'}|${envelope.roomCode}|${envelope.timestamp}|${JSON.stringify(envelope.payload)}`;
    const isValid = verifySignature(
      verificationString,
      envelope.signature,
      envelope.publicKeyEd
    );

    if (!isValid) {
      console.error('[HttpSignaler] Discarding forged/invalid signal from:', envelope.senderId);
      return;
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
}
