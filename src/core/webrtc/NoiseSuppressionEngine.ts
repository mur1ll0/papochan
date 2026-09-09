// Type-only: the value import must stay dynamic. The package declares
// `class RnnoiseWorkletNode extends AudioWorkletNode` in its module body, so
// merely importing it on the server throws ReferenceError and 500s the page.
import type { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';

export type NoiseSuppressionMode = 'off' | 'standard' | 'ai-neural';

/** Published from node_modules by scripts/copy-noise-suppressor-assets.mjs. */
const WORKLET_BASE = '/audio-worklets';

/**
 * The WASM is fetched once per page, not once per AudioContext: switching
 * microphone tears the context down and builds a new one, and re-downloading
 * 150 KB on every device change would stall the graph rebuild.
 */
let rnnoiseBinary: Promise<ArrayBuffer> | null = null;

function loadRnnoiseBinary(): Promise<ArrayBuffer> {
  if (!rnnoiseBinary) {
    rnnoiseBinary = import('@sapphi-red/web-noise-suppressor')
      .then(({ loadRnnoise }) =>
        loadRnnoise({
          url: `${WORKLET_BASE}/rnnoise.wasm`,
          simdUrl: `${WORKLET_BASE}/rnnoise_simd.wasm`,
        })
      )
      .catch((err) => {
      // Clear the cache so a later attempt can retry rather than replaying the failure.
      rnnoiseBinary = null;
      throw err;
    });
  }
  return rnnoiseBinary;
}

export interface NoiseSuppressionConfig {
  mode: NoiseSuppressionMode;
  noiseGateThresholdDb?: number; // default -42 dB
}

/**
 * NoiseSuppressionEngine provides real-time client-side noise suppression
 * using a multi-stage Web Audio DSP pipeline + Adaptive Spectral Noise Gate.
 * Operates 100% locally on the device with zero network transfer.
 */
export class NoiseSuppressionEngine {
  private audioContext: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode;

  // Filter Pipeline Nodes
  private highpassFilter: BiquadFilterNode; // Cuts sub-80Hz low-frequency room rumble
  private notchFilter: BiquadFilterNode; // Cuts 50/60Hz AC electrical hum
  private lowpassFilter: BiquadFilterNode; // Cuts ultra-high frequencies > 14kHz
  private compressor: DynamicsCompressorNode; // Gentle voice leveling & protection
  private gainNode: GainNode;

  // Trained speech model (RNNoise), loaded on demand for the neural mode.
  private rnnoiseNode: RnnoiseWorkletNode | null = null;
  private isLoadingRnnoise = false;
  private isDestroyed = false;

  private currentMode: NoiseSuppressionMode = 'ai-neural';

  constructor(audioContext: AudioContext, config?: NoiseSuppressionConfig) {
    this.audioContext = audioContext;
    if (config?.mode) this.currentMode = config.mode;

    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // 1. Highpass filter: 85 Hz (eliminates desk vibrations, wind, and mic handling thumps)
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);
    this.highpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

    // 2. Notch filter: 60 Hz hum attenuation
    this.notchFilter = this.audioContext.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.setValueAtTime(60, this.audioContext.currentTime);
    this.notchFilter.Q.setValueAtTime(4.0, this.audioContext.currentTime);

    // 3. Lowpass filter: 14 kHz (removes electronic hiss above the human voice
    //    band). Cutting lower than this audibly dulls sibilants, which reads as
    //    a telephone or "processed" quality.
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.setValueAtTime(14000, this.audioContext.currentTime);
    this.lowpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

    // 4. Dynamics Compressor: smooths voice peaks and brings quiet speech up.
    //    A 3 ms attack clamps down on every syllable onset and pumps audibly;
    //    12 ms lets transients through and keeps speech sounding natural.
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(12, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(2.5, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.012, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.18, this.audioContext.currentTime);

    // 5. Output Gain
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    this.rebuildGraph();
  }

  /**
   * Attaches the raw microphone MediaStreamTrack to the suppression pipeline.
   */
  public attachSourceTrack(track: MediaStreamTrack): MediaStreamTrack {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    const inputStream = new MediaStream([track]);
    this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);

    this.rebuildGraph();

    const outputTracks = this.destinationNode.stream.getAudioTracks();
    return outputTracks[0] || track;
  }

  public setMode(mode: NoiseSuppressionMode): void {
    this.currentMode = mode;
    this.rebuildGraph();
  }

  public getMode(): NoiseSuppressionMode {
    return this.currentMode;
  }

  /** True once the neural model is actually in the audio path. */
  public get isNeuralActive(): boolean {
    return this.currentMode === 'ai-neural' && this.rnnoiseNode !== null;
  }

  /**
   * Loads the RNNoise worklet and splices it into the graph.
   *
   * Fetching WASM and registering an AudioWorklet are both async, while the
   * graph is rebuilt synchronously, so the filter chain carries the audio until
   * the model is ready and the graph is rebuilt around it. Any failure - offline,
   * assets missing, worklets unsupported - leaves that chain in place rather
   * than dropping the microphone.
   */
  private async ensureRnnoise(): Promise<void> {
    if (this.rnnoiseNode || this.isLoadingRnnoise || this.isDestroyed) return;
    if (typeof AudioWorkletNode === 'undefined' || !this.audioContext.audioWorklet) return;

    this.isLoadingRnnoise = true;
    try {
      const [{ RnnoiseWorkletNode: RnnoiseNode }, binary] = await Promise.all([
        import('@sapphi-red/web-noise-suppressor'),
        loadRnnoiseBinary(),
      ]);
      await this.audioContext.audioWorklet.addModule(`${WORKLET_BASE}/rnnoise-worklet.js`);

      // The mode may have changed, or the context been torn down, while loading.
      if (this.isDestroyed || this.currentMode !== 'ai-neural') return;
      if (this.audioContext.state === 'closed') return;

      this.rnnoiseNode = new RnnoiseNode(this.audioContext, {
        maxChannels: 2,
        // Copy: the binary is handed to the worklet and may be detached, and it
        // is shared across every context this page builds.
        wasmBinary: binary.slice(0),
      });

      console.log('[NoiseSuppression] RNNoise active.');
      this.rebuildGraph();
    } catch (err) {
      console.warn(
        '[NoiseSuppression] RNNoise unavailable, staying on the filter chain:',
        err
      );
    } finally {
      this.isLoadingRnnoise = false;
    }
  }

  private rebuildGraph(): void {
    if (!this.sourceNode) return;

    try {
      this.sourceNode.disconnect();
      this.highpassFilter.disconnect();
      this.notchFilter.disconnect();
      this.lowpassFilter.disconnect();
      this.compressor.disconnect();
      this.gainNode.disconnect();
      this.rnnoiseNode?.disconnect();
    } catch {
      // ignore
    }

    const now = this.audioContext.currentTime;

    if (this.currentMode === 'off') {
      // Direct bypass
      this.sourceNode.connect(this.destinationNode);
    } else if (this.currentMode === 'standard') {
      // Highpass + Gentle Compressor
      this.sourceNode
        .connect(this.highpassFilter)
        .connect(this.compressor)
        .connect(this.destinationNode);
    } else if (this.currentMode === 'ai-neural') {
      this.gainNode.gain.setValueAtTime(1.1, now); // Gentle +0.8dB make-up

      if (this.rnnoiseNode) {
        // RNNoise is a recurrent network trained on speech: it separates voice
        // from noise far better than a fixed filter bank, so the notch and
        // lowpass come out of the path entirely instead of colouring audio the
        // model already cleaned. Only rumble removal and gentle levelling remain.
        this.sourceNode
          .connect(this.highpassFilter)
          .connect(this.rnnoiseNode)
          .connect(this.compressor)
          .connect(this.gainNode)
          .connect(this.destinationNode);
      } else {
        // Model not loaded yet (or unavailable): carry the audio on the filter
        // chain meanwhile, and rebuild once it arrives.
        this.sourceNode
          .connect(this.highpassFilter)
          .connect(this.notchFilter)
          .connect(this.lowpassFilter)
          .connect(this.compressor)
          .connect(this.gainNode)
          .connect(this.destinationNode);

        void this.ensureRnnoise();
      }
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.rnnoiseNode) {
      try {
        this.rnnoiseNode.disconnect();
        this.rnnoiseNode.destroy();
      } catch {
        // ignore
      }
      this.rnnoiseNode = null;
    }
  }
}
