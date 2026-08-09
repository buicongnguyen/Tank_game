interface WindowWithWebAudio extends Window {
  AudioContext?: typeof globalThis.AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const BPM = 120;
const STEP_SECONDS = 60 / BPM / 2;
const LOOKAHEAD_SECONDS = 0.22;
const SCHEDULE_INTERVAL_MS = 80;
/** Engine synthesis does not need a new automation curve on every render frame. */
const ENGINE_UPDATE_INTERVAL_SECONDS = 0.08;
const ENGINE_LOAD_EPSILON = 0.025;

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

export type TankSfxCue =
  | 'deploy'
  | 'small-arm'
  | 'automatic'
  | 'cannon'
  | 'mortar'
  | 'rail'
  | 'energy'
  | 'flame'
  | 'drone'
  | 'shield'
  | 'rocket'
  | 'impact'
  | 'explosion'
  | 'artillery'
  | 'repair'
  | 'upgrade'
  | 'capture'
  | 'mission-clear'
  | 'mission-fail';

const SFX_THROTTLE_SECONDS: Partial<Record<TankSfxCue, number>> = {
  'small-arm': 0.035,
  automatic: 0.032,
  cannon: 0.045,
  flame: 0.055,
  shield: 0.055,
  impact: 0.08,
  explosion: 0.12,
  repair: 0.18,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class BattleMusic {
  private enabled = true;
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineOscillators?: OscillatorNode[];
  private noiseBuffer?: AudioBuffer;
  private schedulerId?: number;
  private nextStepTime = 0;
  private stepIndex = 0;
  private lastEngineLoad = -1;
  private lastEngineUpdateTime = -Infinity;
  private readonly lastSfxTimes = new Map<TankSfxCue, number>();

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }

    this.enabled = enabled;
    this.lastEngineLoad = -1;
    this.lastEngineUpdateTime = -Infinity;
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    if (enabled) {
      master.gain.setValueAtTime(0.18, context.currentTime);
      void context.resume().catch(() => undefined);
    } else {
      this.engineGain?.gain.setValueAtTime(0.0001, context.currentTime);
      master.gain.setValueAtTime(0.0001, context.currentTime);
      void context.suspend().catch(() => undefined);
    }
  }

  start(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    void context.resume();
    this.ensureEngine(context);

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
    const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return undefined;
    }

    const context = new AudioContextCtor();
    const master = context.createGain();
    const effects = context.createGain();
    const compressor = context.createDynamicsCompressor();

    master.gain.value = 0.18;
    effects.gain.value = 0.86;
    effects.connect(master);
    master.connect(compressor);
    compressor.connect(context.destination);

    this.context = context;
    this.master = master;
    this.effects = effects;
    this.noiseBuffer = this.createNoiseBuffer(context);

    return context;
  }

  playSfx(cue: TankSfxCue, intensity = 1): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    void context.resume();
    const time = context.currentTime;
    const normalized = clamp(intensity, 0.12, 1.4);
    const throttle = SFX_THROTTLE_SECONDS[cue] ?? 0.025;
    const previous = this.lastSfxTimes.get(cue) ?? -Infinity;
    if (time - previous < throttle) {
      return;
    }
    this.lastSfxTimes.set(cue, time);

    switch (cue) {
      case 'deploy':
        this.playEffectTone(196, 294, 'triangle', time, 0.14, 0.08 * normalized, 1200);
        this.playEffectTone(294, 392, 'triangle', time + 0.11, 0.16, 0.08 * normalized, 1400);
        break;
      case 'small-arm':
        this.playEffectTone(260, 105, 'square', time, 0.065, 0.1 * normalized, 1800);
        this.playEffectNoise(time, 0.045, 0.08 * normalized, 'highpass', 2400);
        break;
      case 'automatic':
        this.playEffectTone(190, 78, 'sawtooth', time, 0.075, 0.11 * normalized, 1350);
        this.playEffectNoise(time, 0.055, 0.1 * normalized, 'bandpass', 1750);
        break;
      case 'cannon':
        this.playEffectTone(86, 38, 'sawtooth', time, 0.24, 0.32 * normalized, 420);
        this.playEffectNoise(time, 0.095, 0.24 * normalized, 'lowpass', 840);
        break;
      case 'mortar':
        this.playEffectTone(115, 42, 'triangle', time, 0.3, 0.26 * normalized, 520);
        this.playEffectNoise(time, 0.16, 0.18 * normalized, 'lowpass', 940);
        break;
      case 'rail':
        this.playEffectTone(520, 92, 'sawtooth', time, 0.24, 0.2 * normalized, 2600);
        this.playEffectNoise(time, 0.07, 0.14 * normalized, 'highpass', 3900);
        break;
      case 'energy':
        this.playEffectTone(740, 2100, 'sine', time, 0.18, 0.18 * normalized, 4200);
        this.playEffectTone(370, 980, 'triangle', time + 0.025, 0.2, 0.09 * normalized, 3000);
        break;
      case 'flame':
        this.playEffectNoise(time, 0.14, 0.14 * normalized, 'bandpass', 1100);
        this.playEffectTone(120, 72, 'sawtooth', time, 0.12, 0.07 * normalized, 760);
        break;
      case 'drone':
        this.playEffectTone(150, 420, 'sawtooth', time, 0.24, 0.12 * normalized, 1800);
        this.playEffectTone(82, 120, 'square', time, 0.28, 0.06 * normalized, 960);
        break;
      case 'shield':
        this.playEffectTone(920, 1480, 'sine', time, 0.14, 0.13 * normalized, 3600);
        this.playEffectTone(460, 720, 'triangle', time, 0.19, 0.07 * normalized, 2400);
        break;
      case 'rocket':
        this.playEffectTone(170, 520, 'sawtooth', time, 0.2, 0.18 * normalized, 1800);
        this.playEffectNoise(time, 0.22, 0.16 * normalized, 'bandpass', 1600);
        break;
      case 'impact':
        this.playEffectTone(150, 72, 'triangle', time, 0.12, 0.12 * normalized, 900);
        this.playEffectNoise(time, 0.12, 0.17 * normalized, 'bandpass', 1200);
        break;
      case 'explosion':
        this.playEffectTone(68, 29, 'sine', time, 0.5, 0.35 * normalized, 340);
        this.playEffectNoise(time, 0.42, 0.28 * normalized, 'lowpass', 720);
        break;
      case 'artillery':
        this.playEffectTone(480, 140, 'square', time, 0.34, 0.16 * normalized, 1100);
        this.playEffectNoise(time + 0.05, 0.24, 0.1 * normalized, 'bandpass', 1900);
        break;
      case 'repair':
        this.playEffectTone(330, 440, 'sine', time, 0.13, 0.08 * normalized, 1600);
        this.playEffectTone(440, 660, 'sine', time + 0.1, 0.18, 0.09 * normalized, 1900);
        break;
      case 'upgrade':
        this.playEffectTone(262, 392, 'triangle', time, 0.1, 0.08 * normalized, 1800);
        this.playEffectTone(392, 587, 'triangle', time + 0.09, 0.11, 0.08 * normalized, 2200);
        this.playEffectTone(587, 784, 'triangle', time + 0.18, 0.16, 0.075 * normalized, 2600);
        break;
      case 'capture':
        this.playEffectTone(220, 330, 'triangle', time, 0.14, 0.07 * normalized, 1400);
        this.playEffectTone(330, 494, 'triangle', time + 0.13, 0.17, 0.08 * normalized, 1800);
        break;
      case 'mission-clear':
        this.playEffectTone(294, 440, 'triangle', time, 0.16, 0.08 * normalized, 1800);
        this.playEffectTone(440, 659, 'triangle', time + 0.15, 0.18, 0.09 * normalized, 2200);
        this.playEffectTone(659, 880, 'triangle', time + 0.3, 0.22, 0.09 * normalized, 2600);
        break;
      case 'mission-fail':
        this.playEffectTone(220, 156, 'sawtooth', time, 0.24, 0.1 * normalized, 700);
        this.playEffectTone(156, 92, 'sawtooth', time + 0.2, 0.32, 0.09 * normalized, 520);
        break;
    }
  }

  setEngineLoad(load: number): void {
    if (!this.enabled) {
      return;
    }

    if (!this.context || !this.engineGain || !this.engineFilter || !this.engineOscillators) {
      return;
    }

    const time = this.context.currentTime;
    const normalized = clamp(load, 0, 1);
    const loadChanged = Math.abs(normalized - this.lastEngineLoad) >= ENGINE_LOAD_EPSILON;
    const forceIdle = normalized === 0 && this.lastEngineLoad !== 0;
    if (!forceIdle) {
      if (!loadChanged || time - this.lastEngineUpdateTime < ENGINE_UPDATE_INTERVAL_SECONDS) {
        return;
      }
    }

    this.lastEngineLoad = normalized;
    this.lastEngineUpdateTime = time;
    const gain = normalized < 0.04 ? 0.0001 : 0.012 + normalized * 0.035;
    this.smoothParameter(this.engineGain.gain, gain, time, 0.08);
    this.smoothParameter(this.engineFilter.frequency, 130 + normalized * 250, time, 0.12);
    this.smoothParameter(this.engineOscillators[0].frequency, 35 + normalized * 38, time, 0.11);
    this.smoothParameter(this.engineOscillators[1].frequency, 52 + normalized * 54, time, 0.1);
  }

  private smoothParameter(parameter: AudioParam, value: number, time: number, timeConstant: number): void {
    // Cancel pending ramps before adding the next one. This keeps the Web Audio
    // automation timeline bounded during long driving sessions.
    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(time);
    } else {
      const currentValue = parameter.value;
      parameter.cancelScheduledValues(time);
      parameter.setValueAtTime(currentValue, time);
    }
    parameter.setTargetAtTime(value, time, timeConstant);
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
    this.disconnectWhenEnded(oscillator, oscillator, filter, gain);
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
    this.disconnectWhenEnded(oscillator, oscillator, gain);
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
    this.disconnectWhenEnded(source, source, filter, gain);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  private ensureEngine(context: AudioContext): void {
    if (this.engineGain || !this.master) {
      return;
    }

    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const lowOscillator = context.createOscillator();
    const highOscillator = context.createOscillator();

    filter.type = 'lowpass';
    filter.frequency.value = 130;
    gain.gain.value = 0.0001;
    lowOscillator.type = 'sawtooth';
    lowOscillator.frequency.value = 35;
    highOscillator.type = 'triangle';
    highOscillator.frequency.value = 52;

    lowOscillator.connect(filter);
    highOscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    lowOscillator.start();
    highOscillator.start();

    this.engineFilter = filter;
    this.engineGain = gain;
    this.engineOscillators = [lowOscillator, highOscillator];
  }

  private playEffectTone(
    startFrequency: number,
    endFrequency: number,
    type: OscillatorType,
    time: number,
    duration: number,
    volume: number,
    cutoff: number,
  ): void {
    if (!this.context || !this.effects) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), time + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    this.disconnectWhenEnded(oscillator, oscillator, filter, gain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.04);
  }

  private playEffectNoise(
    time: number,
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    frequency: number,
  ): void {
    if (!this.context || !this.effects || !this.noiseBuffer) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(Math.max(0.0002, volume), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    this.disconnectWhenEnded(source, source, filter, gain);
    source.start(time);
    source.stop(time + duration + 0.03);
  }

  private disconnectWhenEnded(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    source.addEventListener('ended', () => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // A browser may already have detached a completed source node.
        }
      }
    }, { once: true });
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
