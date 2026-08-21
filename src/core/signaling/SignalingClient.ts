export type DeviceType = 'desktop' | 'mobile' | 'browser';

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
  | 'leave';

export interface SignalEnvelope<T = any> {
  type: SignalMessageType;
  senderId: string; // Formatted as "userId:deviceId"
  targetId?: string; // Optional: target "userId:deviceId" for direct 1:1 messages (offer/answer/ice)
  roomCode: string;
  payload: T;
  timestamp: number;
  publicKeyEd: string;
  signature: string; // Ed25519 detached signature
}

export interface SignalingEvents {
  onPeerJoined: (peer: DeviceMetadata) => void;
  onPeerLeft: (peerId: string) => void;
  onOffer: (senderId: string, sdp: RTCSessionDescriptionInit, senderMeta: DeviceMetadata) => void;
  onAnswer: (senderId: string, sdp: RTCSessionDescriptionInit) => void;
  onCandidate: (senderId: string, candidate: RTCIceCandidateInit) => void;
  onRenegotiate: (senderId: string) => void;
  onDeviceStateUpdate: (senderId: string, capabilities: DeviceMetadata['capabilities']) => void;
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
  abstract sendStateUpdate(capabilities: DeviceMetadata['capabilities']): Promise<void>;
  abstract setEventListeners(events: Partial<SignalingEvents>): void;
}
