interface WindowWithWebAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const BPM = 120;
const STEP_SECONDS = 60 / BPM / 2;
const LOOKAHEAD_SECONDS = 0.22;
const SCHEDULE_INTERVAL_MS = 80;

const LEAD_PATTERN = [
  'E4', null, 'G4', null, 'A4', null, 'B4', null,
  'A4', null, 'G4', null, 'E4', null, 'D4', null,
  'E4', null, 'G4', null, 'A4', null, 'C5', null,
  'B4', null, 'A4', 'G4', 'E4', null, null, null,
];

const BASS_PATTERN = [
  'E2', null, null, 'E2', 'E2', null, 'D2', null,
  'C2', null, null, 'C2', 'D2', null, null, null,
  'E2', null, null, 'E2', 'G2', null, 'A2', null,
  'B1', null, 'B1', null, 'D2', null, null, null,
];

const NOTE_FREQUENCIES: Record<string, number> = {
  B1: 61.74,
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  G2: 98,
  A2: 110,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
};

export class BattleMusic {
  private context?: AudioContext;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private schedulerId?: number;
  private nextStepTime = 0;
  private stepIndex = 0;

  start(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    void context.resume();

    if (!this.schedulerId) {
      this.nextStepTime = context.currentTime + 0.04;
      this.stepIndex = 0;
      this.schedulerId = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
      this.schedule();
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    const audioWindow = window as WindowWithWebAudio;
    const AudioContextCtor = AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return undefined;
    }

    const context = new AudioContextCtor();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();

    master.gain.value = 0.18;
    master.connect(compressor);
    compressor.connect(context.destination);

    this.context = context;
    this.master = master;
    this.noiseBuffer = this.createNoiseBuffer(context);

    return context;
  }

  private schedule(): void {
    if (!this.context || !this.master) {
      return;
    }

    while (this.nextStepTime < this.context.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleStep(this.stepIndex, this.nextStepTime);
      this.nextStepTime += STEP_SECONDS;
      this.stepIndex = (this.stepIndex + 1) % LEAD_PATTERN.length;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const lead = LEAD_PATTERN[step];
    const bass = BASS_PATTERN[step];

    if (bass) {
      this.playTone(NOTE_FREQUENCIES[bass], 'sawtooth', time, STEP_SECONDS * 0.72, 0.14, 620);
    }

    if (lead) {
      this.playTone(NOTE_FREQUENCIES[lead], 'square', time + 0.015, STEP_SECONDS * 0.58, 0.075, 1600);
    }

    if (step % 8 === 0 || step === 22) {
      this.playKick(time);
    }

    if (step % 8 === 4 || step === 28) {
      this.playSnare(time);
    }

    if (step % 2 === 0) {
      this.playHat(time + 0.02);
    }
  }

  private playTone(
    frequency: number,
    type: OscillatorType,
    time: number,
    duration: number,
    volume: number,
    cutoff: number,
  ): void {
    if (!this.context || !this.master) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.04);
  }

  private playKick(time: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.13);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
  }

  private playSnare(time: number): void {
    this.playNoise(time, 0.11, 0.12, 'bandpass', 1800);
    this.playTone(180, 'triangle', time, 0.09, 0.045, 900);
  }

  private playHat(time: number): void {
    this.playNoise(time, 0.04, 0.045, 'highpass', 5200);
  }

  private playNoise(
    time: number,
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    frequency: number,
  ): void {
    if (!this.context || !this.master || !this.noiseBuffer) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = context.sampleRate * 1.2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }
}
