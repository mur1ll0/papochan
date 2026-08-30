import {
  encryptPayload,
  decryptPayload,
  encryptFileChunk,
  decryptFileChunk,
  computeFileDigest,
  EncryptedPacket,
  EncryptedFileChunk,
} from '../crypto/cipher';

export type PacketKind = 'text' | 'typing' | 'file-chunk' | 'handshake';

export interface ChatTextMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderDeviceId: string;
  text: string;
  timestamp: number;
}

export interface TypingIndicator {
  senderId: string;
  senderName: string;
  isTyping: boolean;
}

export interface FileTransferMeta {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  senderId: string;
  senderName: string;
  progress: number; // 0 to 100
  blobUrl?: string;
  fileDigest: string;
  verified: boolean;
}

export interface DataChannelEvents {
  onMessage: (msg: ChatTextMessage) => void;
  onTyping: (indicator: TypingIndicator) => void;
  onFileProgress: (meta: FileTransferMeta) => void;
  onFileComplete: (meta: FileTransferMeta, blob: Blob) => void;
  onStatusChange: (isOpen: boolean) => void;
  onError: (error: Error) => void;
}

const CHUNK_SIZE = 16384; // 16 KB chunks for optimal WebRTC buffer throughput

export class E2EEDataChannel {
  private channel: RTCDataChannel;
  private sessionKey: CryptoKey | null = null;
  private events: Partial<DataChannelEvents> = {};
  private localSenderId: string;
  private localSenderName: string;
  private incomingFiles = new Map<
    string,
    {
      chunks: ArrayBuffer[];
      receivedCount: number;
      totalChunks: number;
      meta: FileTransferMeta;
    }
  >();

  constructor(
    channel: RTCDataChannel,
    localSenderId: string,
    localSenderName: string,
    sessionKey?: CryptoKey
  ) {
    this.channel = channel;
    this.localSenderId = localSenderId;
    this.localSenderName = localSenderName;
    if (sessionKey) this.sessionKey = sessionKey;

    this.setupChannelListeners();
  }

  public setSessionKey(key: CryptoKey): void {
    this.sessionKey = key;
  }

  public setEventListeners(events: Partial<DataChannelEvents>): void {
    this.events = { ...this.events, ...events };
  }

  public get isOpen(): boolean {
    return this.channel.readyState === 'open';
  }

  private setupChannelListeners(): void {
    this.channel.binaryType = 'arraybuffer';

    this.channel.onopen = () => {
      console.log('[E2EEDataChannel] Channel opened for peer:', this.localSenderId, 'label:', this.channel.label);
      this.events.onStatusChange?.(true);
    };

    this.channel.onclose = () => {
      console.log('[E2EEDataChannel] Channel closed for peer:', this.localSenderId);
      this.events.onStatusChange?.(false);
    };

    this.channel.onerror = (evt) => {
      console.error('[E2EEDataChannel] Channel error:', evt);
      this.events.onError?.(new Error('DataChannel error occurred'));
    };

    this.channel.onmessage = async (event) => {
      try {
        if (!this.sessionKey) {
          console.warn('[E2EEDataChannel] Session key not ready yet. Dropping message.');
          return;
        }

        const rawData = event.data;
        if (typeof rawData === 'string') {
          const packet = JSON.parse(rawData) as { kind: PacketKind; envelope: any };

          if (packet.kind === 'text') {
            const decryptedMsg = await decryptPayload<ChatTextMessage>(
              packet.envelope as EncryptedPacket,
              this.sessionKey
            );
            console.log('[E2EEDataChannel] Successfully received & decrypted text message:', decryptedMsg);
            this.events.onMessage?.(decryptedMsg);
          } else if (packet.kind === 'typing') {
            const indicator = await decryptPayload<TypingIndicator>(
              packet.envelope as EncryptedPacket,
              this.sessionKey
            );
            this.events.onTyping?.(indicator);
          } else if (packet.kind === 'file-chunk') {
            await this.handleIncomingFileChunk(packet.envelope as EncryptedFileChunk);
          }
        }
      } catch (err: any) {
        console.error('[E2EEDataChannel] Error processing message:', err);
        this.events.onError?.(err);
      }
    };
  }

  /**
   * Sends an end-to-end encrypted text message across the data channel.
   */
  public async sendTextMessage(text: string): Promise<ChatTextMessage> {
    if (!this.isOpen || !this.sessionKey) {
      throw new Error(`Data channel not open (state: ${this.channel.readyState}) or encryption key unavailable`);
    }

    const msg: ChatTextMessage = {
      id: crypto.randomUUID(),
      senderId: this.localSenderId,
      senderName: this.localSenderName,
      senderDeviceId: this.localSenderId.split(':')[1] || 'device',
      text,
      timestamp: Date.now(),
    };

    const encrypted = await encryptPayload(msg, this.sessionKey, this.localSenderId);
    const packet = JSON.stringify({ kind: 'text', envelope: encrypted });

    console.log('[E2EEDataChannel] Sending encrypted message packet over data channel...');
    this.channel.send(packet);
    return msg;
  }

  /**
   * Sends a typing indicator.
   */
  public async sendTyping(isTyping: boolean): Promise<void> {
    if (!this.isOpen || !this.sessionKey) return;

    const indicator: TypingIndicator = {
      senderId: this.localSenderId,
      senderName: this.localSenderName,
      isTyping,
    };

    const encrypted = await encryptPayload(indicator, this.sessionKey, this.localSenderId);
    const packet = JSON.stringify({ kind: 'typing', envelope: encrypted });

    this.channel.send(packet);
  }

  /**
   * Streams a file in encrypted 16KB chunks with SHA-256 digest verification.
   */
  public async sendFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (!this.isOpen || !this.sessionKey) {
      throw new Error('Data channel not open or encryption key unavailable');
    }

    const fileBuffer = await file.arrayBuffer();
    const fileDigest = await computeFileDigest(fileBuffer);
    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(fileBuffer.byteLength / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.byteLength);
      const slice = fileBuffer.slice(start, end);

      const encryptedChunk = await encryptFileChunk(
        slice,
        fileId,
        chunkIndex,
        totalChunks,
        file.name,
        file.size,
        file.type || 'application/octet-stream',
        fileDigest,
        this.sessionKey
      );

      const packet = JSON.stringify({ kind: 'file-chunk', envelope: encryptedChunk });

      // Throttle if buffer is full
      while (this.channel.bufferedAmount > 512 * 1024) {
        await new Promise((r) => setTimeout(r, 20));
      }

      this.channel.send(packet);

      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      onProgress?.(progress);
    }

    return fileId;
  }

  private async handleIncomingFileChunk(chunk: EncryptedFileChunk): Promise<void> {
    if (!this.sessionKey) return;

    let fileRecord = this.incomingFiles.get(chunk.fileId);
    if (!fileRecord) {
      fileRecord = {
        chunks: new Array(chunk.totalChunks),
        receivedCount: 0,
        totalChunks: chunk.totalChunks,
        meta: {
          fileId: chunk.fileId,
          fileName: chunk.fileName,
          fileSize: chunk.fileSize,
          mimeType: chunk.mimeType,
          senderId: this.localSenderId,
          senderName: 'Remote Peer',
          progress: 0,
          fileDigest: chunk.fileDigest,
          verified: false,
        },
      };
      this.incomingFiles.set(chunk.fileId, fileRecord);
    }

    const decryptedChunkBuffer = await decryptFileChunk(chunk, this.sessionKey);
    fileRecord.chunks[chunk.chunkIndex] = decryptedChunkBuffer;
    fileRecord.receivedCount++;

    const progress = Math.round((fileRecord.receivedCount / fileRecord.totalChunks) * 100);
    fileRecord.meta.progress = progress;
    this.events.onFileProgress?.(fileRecord.meta);

    // When all chunks are received, assemble, verify hash, and trigger completion
    if (fileRecord.receivedCount === fileRecord.totalChunks) {
      const fullBlob = new Blob(fileRecord.chunks, { type: chunk.mimeType });
      const fullArrayBuffer = await fullBlob.arrayBuffer();
      const calculatedDigest = await computeFileDigest(fullArrayBuffer);

      fileRecord.meta.verified = calculatedDigest === chunk.fileDigest;
      fileRecord.meta.blobUrl = URL.createObjectURL(fullBlob);

      this.events.onFileComplete?.(fileRecord.meta, fullBlob);
      this.incomingFiles.delete(chunk.fileId);
    }
  }

  public close(): void {
    try {
      this.channel.close();
    } catch {
      // ignore
    }
  }
}
