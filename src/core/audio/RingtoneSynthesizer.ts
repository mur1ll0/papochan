/**
 * Synthesizes outgoing dial tones and incoming call ringtones
 * using the Web Audio API without needing any external audio assets.
 */
export class RingtoneSynthesizer {
  private static audioCtx: AudioContext | null = null;
  private static interval: any = null;
  private static isPlaying: boolean = false;

  private static getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays realistic outgoing dial tone (dual tone 440Hz + 480Hz, 2s on, 3s off).
   */
  public static startOutgoingDialTone(): void {
    this.stop();
    if (typeof window === 'undefined') return;

    this.isPlaying = true;
    const playTone = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.8);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.95);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      } catch (err) {
        console.warn('[Ringtone] Audio error:', err);
      }
    };

    playTone();
    this.interval = setInterval(playTone, 4000);
  }

  /**
   * Plays rhythmic tactical incoming ringtone chime (E5 -> G#5 -> B5 melodic chime).
   */
  public static startIncomingRingtone(): void {
    this.stop();
    if (typeof window === 'undefined') return;

    this.isPlaying = true;

    const playChime = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + index * 0.12);

          const startTime = now + index * 0.12;
          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.5);
        });
      } catch (err) {
        console.warn('[Ringtone] Audio error:', err);
      }
    };

    playChime();
    this.interval = setInterval(playChime, 2500);
  }

  public static stop(): void {
    this.isPlaying = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
