import {
  SignalingClient,
  SignalingEvents,
  DeviceMetadata,
} from './SignalingClient';
import { AblySignaler } from './AblySignaler';
import { HttpSignaler } from './HttpSignaler';
import { getApiEndpoint } from '@/lib/api';

export class UniversalSignaler extends SignalingClient {
  private activeSignaler: SignalingClient;
  private events: Partial<SignalingEvents> = {};
  private isHost: boolean = false;

  constructor(isHost: boolean = false) {
    super();
    this.isHost = isHost;
    // Default to HttpSignaler initially
    this.activeSignaler = new HttpSignaler(isHost);
  }

  public setEventListeners(events: Partial<SignalingEvents>): void {
    this.events = { ...this.events, ...events };
    this.activeSignaler.setEventListeners(this.events);
  }

  public async connect(
    roomCode: string,
    localMeta: DeviceMetadata,
    secretKeyEd: Uint8Array
  ): Promise<void> {
    const clientId = `${localMeta.userId}:${localMeta.deviceId}`;

    // Step 1: Check signaling token endpoint to see if Ably is configured
    let hasAbly = false;
    try {
      const checkRes = await fetch(
        getApiEndpoint(
          `/api/signaling-token?clientId=${encodeURIComponent(clientId)}&roomCode=${encodeURIComponent(roomCode)}`
        )
      );

      if (checkRes.ok) {
        const tokenData = await checkRes.json();
        if (tokenData.hasAbly) {
          hasAbly = true;
        }
      }
    } catch {
      hasAbly = false;
    }

    if (hasAbly) {
      try {
        console.log('[UniversalSignaler] Attempting Ably Realtime WebSocket signaling...');
        const ably = new AblySignaler(getApiEndpoint('/api/signaling-token'));
        ably.setEventListeners(this.events);

        // Connect to Ably with 3-second timeout guard
        await Promise.race([
          ably.connect(roomCode, localMeta, secretKeyEd),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ably connection timeout')), 3000)
          ),
        ]);

        this.activeSignaler = ably;
        console.log('✔ [UniversalSignaler] Connected via Ably Realtime WebSocket!');
        return;
      } catch (ablyErr) {
        console.warn('[UniversalSignaler] Ably Realtime failed, falling back to Server HTTP Signaling:', ablyErr);
      }
    }

    // Step 2: Fallback to rock-solid HttpSignaler
    console.log('[UniversalSignaler] Using Resilient Server HTTP Signaling Bus');
    const http = new HttpSignaler(this.isHost);
    http.setEventListeners(this.events);
    await http.connect(roomCode, localMeta, secretKeyEd);
    this.activeSignaler = http;
  }

  public async disconnect(): Promise<void> {
    await this.activeSignaler.disconnect();
  }

  public async sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.activeSignaler.sendOffer(targetId, sdp);
  }

  public async sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.activeSignaler.sendAnswer(targetId, sdp);
  }

  public async sendCandidate(targetId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.activeSignaler.sendCandidate(targetId, candidate);
  }

  public async sendRenegotiate(targetId: string): Promise<void> {
    await this.activeSignaler.sendRenegotiate(targetId);
  }

  public async sendStateUpdate(capabilities: DeviceMetadata['capabilities']): Promise<void> {
    await this.activeSignaler.sendStateUpdate(capabilities);
  }

  public async sendKnock(): Promise<void> {
    await this.activeSignaler.sendKnock();
  }

  public async sendKnockApproved(targetId: string): Promise<void> {
    await this.activeSignaler.sendKnockApproved(targetId);
  }

  public async sendKnockRejected(targetId: string): Promise<void> {
    await this.activeSignaler.sendKnockRejected(targetId);
  }

  public async sendKnockCancel(): Promise<void> {
    await this.activeSignaler.sendKnockCancel();
  }

  public getKnownPeersCount(): number {
    return (this.activeSignaler as any).getKnownPeersCount?.() || 0;
  }
}
