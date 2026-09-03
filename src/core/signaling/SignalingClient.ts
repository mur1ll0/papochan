export type DeviceType = 'desktop' | 'mobile' | 'browser';

export interface TrackMap {
  userAudioTrackId?: string;
  userVideoTrackId?: string;
  screenVideoTrackId?: string;
  screenAudioTrackId?: string;
  userStreamId?: string;
  screenStreamId?: string;
}

export interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  userId: string;
  username: string;
  publicKeyEd: string;
  publicKeyDh: string;
  capabilities: {
    hasAudio: boolean;
    hasVideo: boolean;
    hasScreenShare: boolean;
    trackMap?: TrackMap;
  };
}

export type SignalMessageType =
  | 'presence-announce'
  | 'presence-query'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'renegotiate'
  | 'device-state-update'
  | 'leave'
  | 'knock'
  | 'knock-approved'
  | 'knock-rejected'
  | 'knock-cancel'
  | 'chat';

export interface SignalEnvelope<T = any> {
  type: SignalMessageType;
  senderId: string; // Formatted as "userId:deviceId"
  targetId?: string; // Optional: target "userId:deviceId" for direct 1:1 messages (offer/answer/ice/knock-approved)
  roomCode: string;
  payload: T;
  timestamp: number;
  publicKeyEd: string;
  signature: string; // Ed25519 detached signature
}

export interface KnockRequest {
  senderId: string;
  meta: DeviceMetadata;
  timestamp: number;
}

export interface SignalingEvents {
  onPeerJoined: (peer: DeviceMetadata) => void;
  onPeerLeft: (peerId: string) => void;
  onOffer: (senderId: string, sdp: RTCSessionDescriptionInit, senderMeta: DeviceMetadata) => void;
  onAnswer: (senderId: string, sdp: RTCSessionDescriptionInit) => void;
  onCandidate: (senderId: string, candidate: RTCIceCandidateInit) => void;
  onRenegotiate: (senderId: string) => void;
  onDeviceStateUpdate: (senderId: string, capabilities: DeviceMetadata['capabilities']) => void;
  onKnock: (request: KnockRequest) => void;
  onKnockApproved: (approverId: string) => void;
  /** Someone in the room admitted `admittedId`; every member needs to know. */
  onPeerAdmitted?: (admittedId: string, approverId: string) => void;
  onKnockRejected: (rejectorId: string) => void;
  onKnockCancelled?: (senderId: string) => void;
  onChatMessage?: (msg: any) => void;
  onHostAssigned?: (isHost: boolean) => void;
  onError: (error: Error) => void;
  onConnectionStateChange: (state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void;
}

export abstract class SignalingClient {
  abstract connect(roomCode: string, localMeta: DeviceMetadata, secretKeyEd: Uint8Array): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void>;
  abstract sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void>;
  abstract sendCandidate(targetId: string, candidate: RTCIceCandidateInit): Promise<void>;
  abstract sendRenegotiate(targetId: string): Promise<void>;
  abstract sendPresenceAnnounce(): Promise<void>;
  abstract sendStateUpdate(capabilities: DeviceMetadata['capabilities']): Promise<void>;
  abstract sendKnock(): Promise<void>;
  abstract sendKnockApproved(targetId: string): Promise<void>;
  abstract sendKnockRejected(targetId: string): Promise<void>;
  abstract sendKnockCancel(): Promise<void>;
  abstract sendChatMessage(msg: any): Promise<void>;
  /** Peers currently known to be in the room, excluding this client. */
  abstract getKnownPeersCount(): number;
  abstract setEventListeners(events: Partial<SignalingEvents>): void;
}
