import {
  AudioDiagnosticsAnalyzer,
  AudioDiagnosticsMetrics,
} from './AudioDiagnostics';
import {
  NoiseSuppressionEngine,
  NoiseSuppressionMode,
} from './NoiseSuppressionEngine';

export interface MediaDevicesList {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

export interface MediaEngineConfig {
  audioDeviceId?: string;
  videoDeviceId?: string;
  audioOutputId?: string;
  enableEchoCancellation?: boolean;
  enableNoiseSuppression?: boolean;
  enableAutoGainControl?: boolean;
  noiseSuppressionMode?: NoiseSuppressionMode;
}

export class MediaEngine {
  private rawUserStream: MediaStream | null = null;
  private processedUserStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private diagnosticsAnalyzer: AudioDiagnosticsAnalyzer | null = null;
  private noiseSuppressionEngine: NoiseSuppressionEngine | null = null;

  private volumeInterval: any = null;
  private onVolumeCallback?: (volume: number) => void;
  private onDiagnosticsCallback?: (metrics: AudioDiagnosticsMetrics) => void;
  private onDeviceChangeCallback?: (devices: MediaDevicesList) => void;
  private onScreenShareEndedCallback?: () => void;

  public isAudioMuted = false;
  public isVideoMuted = false;
  public isScreenSharing = false;
  public hasScreenAudio = false;
  public isScreenAudioMuted = false;
  public noiseSuppressionMode: NoiseSuppressionMode = 'ai-neural';

  constructor(private config: MediaEngineConfig = {}) {
    if (config.noiseSuppressionMode) {
      this.noiseSuppressionMode = config.noiseSuppressionMode;
    }
    this.setupDeviceChangeListener();
  }

  private setupDeviceChangeListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const devices = await MediaEngine.listDevices();
        this.onDeviceChangeCallback?.(devices);
      });
    }
  }

  public onDeviceChange(callback: (devices: MediaDevicesList) => void): void {
    this.onDeviceChangeCallback = callback;
  }

  public onDiagnostics(callback: (metrics: AudioDiagnosticsMetrics) => void): void {
    this.onDiagnosticsCallback = callback;
  }

  public onScreenShareEnded(callback: () => void): void {
    this.onScreenShareEndedCallback = callback;
  }

  public setNoiseSuppressionMode(mode: NoiseSuppressionMode): void {
    this.noiseSuppressionMode = mode;
    this.noiseSuppressionEngine?.setMode(mode);
  }

  public static async listDevices(): Promise<MediaDevicesList> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        videoInputs: devices.filter((d) => d.kind === 'videoinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
      };
    } catch (err) {
      console.warn('[MediaEngine] Failed to enumerate devices:', err);
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  }

  public static async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    try {
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
      const promises: Promise<void>[] = [];

      mediaElements.forEach((el) => {
        if ('setSinkId' in el && typeof (el as any).setSinkId === 'function') {
          promises.push((el as any).setSinkId(deviceId));
        }
      });

      await Promise.all(promises);
      return true;
    } catch (err) {
      console.warn('[MediaEngine] setSinkId error or unsupported browser:', err);
      return false;
    }
  }

  public setAudioOutput(deviceId: string): Promise<boolean> {
    this.config.audioOutputId = deviceId;
    return MediaEngine.setAudioOutputDevice(deviceId);
  }

  /**
   * Initializes local user camera and microphone with audio diagnostics and AI noise suppression.
   */
  public async startUserMedia(
    audio: boolean = true,
    video: boolean = true
  ): Promise<MediaStream> {
    this.stopUserMedia();

    const audioConstraints: MediaTrackConstraints | boolean = {
      deviceId: this.config.audioDeviceId ? { exact: this.config.audioDeviceId } : undefined,
      echoCancellation: this.config.enableEchoCancellation ?? true,
      noiseSuppression: this.config.enableNoiseSuppression ?? true,
      autoGainControl: this.config.enableAutoGainControl ?? true,
      sampleRate: 48000,
      channelCount: 1,
    };

    const videoConstraints: MediaTrackConstraints | boolean = {
      deviceId: this.config.videoDeviceId ? { exact: this.config.videoDeviceId } : undefined,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    };

    try {
      this.rawUserStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      const audioTrack = this.rawUserStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = audio;
      }
      this.isAudioMuted = !audio;

      const videoTrack = this.rawUserStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = video;
      }
      this.isVideoMuted = !video;

      this.setupAudioPipeline();

      if (this.config.audioOutputId) {
        this.setAudioOutput(this.config.audioOutputId);
      }

      return this.getUserStream()!;
    } catch (err: any) {
      console.warn('[MediaEngine] Primary getUserMedia failed, attempting fallback...', err);

      try {
        this.rawUserStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        this.isAudioMuted = !audio;
        this.isVideoMuted = true;
        const audioTrack = this.rawUserStream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = audio;
        this.setupAudioPipeline();
        return this.getUserStream()!;
      } catch (fallbackErr) {
        console.error('[MediaEngine] Audio fallback also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /**
   * Captures screen sharing (full monitor, application window, or browser tab)
   * with up to 60fps and optional system/tab audio.
   */
  public async startScreenShare(
    includeAudio: boolean = true,
    frameRate: number = 60
  ): Promise<MediaStream> {
    this.stopScreenShare();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {
      throw new Error(
        'O compartilhamento de tela não está disponível neste navegador ou conexão. Certifique-se de usar um navegador Desktop (Chrome, Edge, Firefox, Brave) e acessar via http://localhost ou HTTPS.'
      );
    }

    try {
      if (includeAudio) {
        try {
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: frameRate, max: 60 } },
            audio: true,
          });
        } catch (audioErr) {
          console.warn(
            '[MediaEngine] getDisplayMedia with audio failed, retrying video only:',
            audioErr
          );
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        }
      } else {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: frameRate, max: 60 } },
          audio: false,
        });
      }
    } catch (err: any) {
      console.warn(
        '[MediaEngine] getDisplayMedia primary failed, attempting basic fallback:',
        err
      );
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
      } catch (finalErr) {
        this.isScreenSharing = false;
        throw finalErr;
      }
    }

    this.isScreenSharing = true;

    // Check if system/tab audio was granted
    const audioTracks = this.screenStream.getAudioTracks();
    this.hasScreenAudio = audioTracks.length > 0;
    this.isScreenAudioMuted = false;

    // Attach onended event to video track
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
        this.onScreenShareEndedCallback?.();
      };
    }

    if (audioTracks.length > 0) {
      audioTracks[0].onended = () => {
        this.hasScreenAudio = false;
      };
    }

    return this.screenStream;
  }

  /**
   * Toggles screen audio mute/unmute during active screen share.
   */
  public toggleScreenAudio(): boolean {
    if (!this.screenStream) return false;
    const audioTrack = this.screenStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isScreenAudioMuted = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  private setupAudioPipeline(): void {
    if (!this.rawUserStream || typeof window === 'undefined') return;

    const audioTrack = this.rawUserStream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }

      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      // 1. Analyser Node for Volume Meter & Diagnostics
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.audioSource = this.audioContext.createMediaStreamSource(
        new MediaStream([audioTrack])
      );
      this.audioSource.connect(this.analyser);

      // 2. Diagnostics Engine
      this.diagnosticsAnalyzer = new AudioDiagnosticsAnalyzer(this.analyser, this.audioContext.sampleRate);

      // 3. AI Noise Suppression Engine
      this.noiseSuppressionEngine = new NoiseSuppressionEngine(this.audioContext, {
        mode: this.noiseSuppressionMode,
      });

      const processedAudioTrack = this.noiseSuppressionEngine.attachSourceTrack(audioTrack);
      if (processedAudioTrack) {
        processedAudioTrack.enabled = audioTrack.enabled;
      }

      const tracks: MediaStreamTrack[] = [processedAudioTrack || audioTrack];
      const videoTrack = this.rawUserStream.getVideoTracks()[0];
      if (videoTrack) {
        tracks.push(videoTrack);
      }
      this.processedUserStream = new MediaStream(tracks);

      // 4. Polling loop for volume and diagnostics
      if (this.volumeInterval) clearInterval(this.volumeInterval);

      this.volumeInterval = setInterval(() => {
        if (this.isAudioMuted || !this.diagnosticsAnalyzer) {
          this.onVolumeCallback?.(0);
          return;
        }

        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }

        const metrics = this.diagnosticsAnalyzer.analyze();
        const normalizedVolume = Math.min(100, Math.max(0, Math.round(((metrics.rmsDb + 60) / 60) * 100)));

        this.onVolumeCallback?.(normalizedVolume);
        this.onDiagnosticsCallback?.(metrics);
      }, 100);
    } catch (err) {
      console.warn('[MediaEngine] Audio pipeline initialization skipped:', err);
      this.processedUserStream = this.rawUserStream;
    }
  }

  public onVolume(callback: (volume: number) => void): void {
    this.onVolumeCallback = callback;
  }

  public toggleAudio(): boolean {
    if (!this.rawUserStream) return false;
    const audioTrack = this.rawUserStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isAudioMuted = !audioTrack.enabled;

      if (this.processedUserStream) {
        const procTrack = this.processedUserStream.getAudioTracks()[0];
        if (procTrack) procTrack.enabled = audioTrack.enabled;
      }
      return audioTrack.enabled;
    }
    return false;
  }

  public async toggleVideo(): Promise<boolean> {
    if (!this.rawUserStream) {
      await this.startUserMedia(!this.isAudioMuted, true);
      return !this.isVideoMuted;
    }

    let videoTrack = this.rawUserStream.getVideoTracks()[0];

    if (!videoTrack || videoTrack.readyState === 'ended') {
      try {
        const videoConstraints: MediaTrackConstraints = {
          deviceId: this.config.videoDeviceId ? { exact: this.config.videoDeviceId } : undefined,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        };

        const freshVideoStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        const newVideoTrack = freshVideoStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (videoTrack) {
            this.rawUserStream.removeTrack(videoTrack);
            this.processedUserStream?.removeTrack(videoTrack);
          }
          this.rawUserStream.addTrack(newVideoTrack);
          this.processedUserStream?.addTrack(newVideoTrack);
          this.isVideoMuted = false;
          return true;
        }
      } catch (err) {
        console.error('[MediaEngine] Failed to acquire video track on toggle:', err);
        return false;
      }
    }

    videoTrack = this.rawUserStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isVideoMuted = !videoTrack.enabled;
      return videoTrack.enabled;
    }

    return false;
  }

  public setDeviceConfig(config: Partial<MediaEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getUserStream(): MediaStream | null {
    return this.processedUserStream || this.rawUserStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  public stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.screenStream = null;
      this.isScreenSharing = false;
      this.hasScreenAudio = false;
      this.isScreenAudioMuted = false;
    }
  }

  public stopUserMedia(): void {
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    if (this.noiseSuppressionEngine) {
      this.noiseSuppressionEngine.destroy();
      this.noiseSuppressionEngine = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.rawUserStream) {
      this.rawUserStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.rawUserStream = null;
    }
    this.processedUserStream = null;
  }

  public destroy(): void {
    this.stopUserMedia();
    this.stopScreenShare();
  }
}
