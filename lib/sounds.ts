export type SoundKind = 'wind' | 'light' | 'hang' | 'select';
export class ChimeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  setMuted(value: boolean) {
    this.muted = value;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.7,
        this.context.currentTime,
        0.025,
      );
  }
  play(kind: SoundKind) {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      const a = this.context;
      if (!this.master) {
        this.master = a.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(a.destination);
      }
      void a.resume();
      const now = a.currentTime;
      const notes =
        kind === 'wind'
          ? [1046.5, 1568, 1318.5, 2093, 1174.7, 1568]
          : kind === 'hang'
            ? [784, 1046.5]
            : kind === 'light'
              ? [523.25, 1046.5]
              : [1318.5];
      notes.forEach((frequency, i) => {
        const start = now + i * (kind === 'wind' ? 0.27 : 0.08);
        const duration = kind === 'wind' ? 1.9 : kind === 'select' ? 0.2 : 0.5;
        [1, 2.76].forEach((partial, j) => {
          const osc = a.createOscillator(),
            gain = a.createGain();
          osc.frequency.value = frequency * partial;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(
            (kind === 'select' ? 0.015 : 0.035) / (j * 5 + 1),
            start + 0.006,
          );
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gain).connect(this.master!);
          osc.start(start);
          osc.stop(start + duration + 0.02);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
        });
      });
      if (kind === 'wind' || kind === 'light' || kind === 'hang') {
        const duration = kind === 'wind' ? 2.4 : 0.065;
        const buffer = a.createBuffer(
          1,
          Math.ceil(a.sampleRate * duration),
          a.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = a.createBufferSource(),
          filter = a.createBiquadFilter(),
          gain = a.createGain();
        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = kind === 'wind' ? 550 : 1600;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(
          kind === 'wind' ? 0.09 : 0.025,
          now + (kind === 'wind' ? 0.4 : 0.005),
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter).connect(gain).connect(this.master);
        source.start();
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      }
    } catch {
      /* The visual experience remains usable when browser audio is unavailable. */
    }
  }
  dispose() {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
