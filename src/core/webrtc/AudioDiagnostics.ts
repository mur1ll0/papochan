export interface AudioDiagnosticsMetrics {
  rmsDb: number; // Current volume in dBFS (-60 to 0)
  peakDb: number; // Peak amplitude in dBFS (-60 to 0)
  noiseFloorDb: number; // Background ambient noise level in dBFS
  snrDb: number; // Signal to Noise Ratio in dB (Speech - NoiseFloor)
  isSpeechActive: boolean; // Voice detected
  isTooQuiet: boolean; // Speech is under -38 dBFS
  isClipping: boolean; // Signal is distorting > -0.8 dBFS
  isHighNoise: boolean; // High background noise when not speaking
  status: 'optimal' | 'low-volume' | 'clipping' | 'high-noise' | 'silent';
  alertMessage: string | null;
}

/**
 * Real-time client-side Acoustic Quality & Noise Analyzer.
 * Runs 100% locally via Web Audio API AnalyserNode without sending audio data to external servers.
 */
export class AudioDiagnosticsAnalyzer {
  private analyser: AnalyserNode;
  private timeData: Float32Array;
  private freqData: Uint8Array;
  private sampleRate: number;

  // Smoothing states
  private smoothedRms = -60;
  private noiseFloorEstimate = -50;
  private speechCount = 0;
  private silenceCount = 0;

  constructor(analyser: AnalyserNode, sampleRate: number = 48000) {
    this.analyser = analyser;
    this.sampleRate = sampleRate;
    this.timeData = new Float32Array(analyser.fftSize);
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
  }

  public analyze(): AudioDiagnosticsMetrics {
    this.analyser.getFloatTimeDomainData(this.timeData as any);
    this.analyser.getByteFrequencyData(this.freqData as any);

    // 1. Calculate RMS and Peak in time domain
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const sample = this.timeData[i];
      const absSample = Math.abs(sample);
      if (absSample > peak) peak = absSample;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / this.timeData.length);
    const rmsDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
    const peakDb = peak > 0.0001 ? 20 * Math.log10(peak) : -60;

    // Smooth RMS
    this.smoothedRms = this.smoothedRms * 0.7 + rmsDb * 0.3;

    // 2. Spectral Voice Activity Energy Estimation (300Hz - 3400Hz human speech formant bands)
    const binSize = (this.sampleRate / 2) / this.freqData.length;
    const minSpeechBin = Math.floor(300 / binSize);
    const maxSpeechBin = Math.min(this.freqData.length - 1, Math.floor(3400 / binSize));

    let speechBandEnergy = 0;
    for (let b = minSpeechBin; b <= maxSpeechBin; b++) {
      speechBandEnergy += this.freqData[b];
    }
    const avgSpeechEnergy = speechBandEnergy / (maxSpeechBin - minSpeechBin + 1);

    // Human speech indicator
    const isSpeechActive = this.smoothedRms > -44 && avgSpeechEnergy > 28;

    // 3. Adaptive Noise Floor Tracking
    if (!isSpeechActive) {
      this.silenceCount++;
      if (this.silenceCount > 5) {
        // Track background ambient noise when user is not speaking
        this.noiseFloorEstimate = this.noiseFloorEstimate * 0.9 + this.smoothedRms * 0.1;
      }
    } else {
      this.silenceCount = 0;
      this.speechCount++;
    }

    // Signal to Noise Ratio
    const snrDb = Math.max(0, this.smoothedRms - this.noiseFloorEstimate);

    // 4. Diagnostic Alerts
    const isClipping = peakDb >= -0.8;
    const isTooQuiet = isSpeechActive && this.smoothedRms < -38;
    const isHighNoise = !isSpeechActive && this.noiseFloorEstimate > -32;
    const isSilent = this.smoothedRms < -54;

    let status: AudioDiagnosticsMetrics['status'] = 'optimal';
    let alertMessage: string | null = null;

    if (isClipping) {
      status = 'clipping';
      alertMessage = 'Áudio estourando / distorcendo (reduza o ganho do microfone)';
    } else if (isHighNoise) {
      status = 'high-noise';
      alertMessage = 'Alto ruído ambiente detectado (ative a Supressão de Ruído por IA)';
    } else if (isTooQuiet) {
      status = 'low-volume';
      alertMessage = 'Microfone muito baixo (aproxime-se ou aumente o volume de entrada)';
    } else if (isSilent) {
      status = 'silent';
    }

    return {
      rmsDb: Math.round(this.smoothedRms),
      peakDb: Math.round(peakDb),
      noiseFloorDb: Math.round(this.noiseFloorEstimate),
      snrDb: Math.round(snrDb),
      isSpeechActive,
      isTooQuiet,
      isClipping,
      isHighNoise,
      status,
      alertMessage,
    };
  }
}
