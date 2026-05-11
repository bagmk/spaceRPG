import { TUNING } from './constants';
import { dbToGain } from './formulas';
import type { EndingId, RogueTypeKey } from './types';

interface ActiveDrone {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextCtor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const win = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? win.webkitAudioContext;
}

export class SoundManager {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private lastAudioErrorAt = 0;

  private lastAudioErrorMessage = '';

  private unlocked = false;

  private bgmMuted: boolean;

  private sfxMuted: boolean;

  private clickTimestamps: number[] = [];

  private lastClickAt = 0;

  private ambient: ActiveDrone | null = null;

  constructor(bgmMuted: boolean, sfxMuted: boolean) {
    this.bgmMuted = bgmMuted;
    this.sfxMuted = sfxMuted;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    this.unlocked = true;
    void ctx.resume();
    if (this.ambient) {
      const targetGain = this.bgmMuted ? 0 : dbToGain(TUNING.DRONE_VOLUME_DB);
      this.ambient.gain.gain.setValueAtTime(targetGain, ctx.currentTime);
    }
  }

  setBgmMuted(bgmMuted: boolean): void {
    this.bgmMuted = bgmMuted;
    const ctx = this.context;
    if (!ctx || !this.ambient) {
      return;
    }
    const targetGain = bgmMuted ? 0 : dbToGain(TUNING.DRONE_VOLUME_DB);
    this.ambient.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.ambient.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
  }

  setSfxMuted(sfxMuted: boolean): void {
    this.sfxMuted = sfxMuted;
  }

  setStage(stageIdx: number, silenceBeforeMs = 0): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked) {
      return;
    }
    if (stageIdx >= 15) {
      this.fadeOutAmbient(2000);
      return;
    }
    try {
      const root = 55 * Math.pow(2, stageIdx * 0.18);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      filter.Q.value = 0.9;
      gain.connect(filter);
      filter.connect(this.masterGain!);

      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.value = root;
      const oscB = ctx.createOscillator();
      oscB.type = 'sawtooth';
      oscB.frequency.value = root * 1.005;

      oscA.connect(gain);
      oscB.connect(gain);
      oscA.start();
      oscB.start();

      const targetGain = this.bgmMuted ? 0 : dbToGain(TUNING.DRONE_VOLUME_DB);
      if (silenceBeforeMs > 0) {
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + silenceBeforeMs / 1000);
        gain.gain.linearRampToValueAtTime(
          targetGain,
          ctx.currentTime + silenceBeforeMs / 1000 + TUNING.AMBIENT_CROSSFADE_MS / 1000,
        );
      } else {
        gain.gain.linearRampToValueAtTime(
          targetGain,
          ctx.currentTime + TUNING.AMBIENT_CROSSFADE_MS / 1000,
        );
      }

      const previous = this.ambient;
      this.ambient = { oscillators: [oscA, oscB], gain, filter };

      if (previous) {
        previous.gain.gain.cancelScheduledValues(ctx.currentTime);
        previous.gain.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + TUNING.AMBIENT_CROSSFADE_MS / 1000,
        );
        window.setTimeout(() => {
          previous.oscillators.forEach((oscillator) => oscillator.stop());
          previous.gain.disconnect();
          previous.filter.disconnect();
        }, TUNING.AMBIENT_CROSSFADE_MS + TUNING.CLICK_MIN_GAP_MS);
      }
    } catch (err) {
      this.logAudioError(err);
    }
  }

  playClick(stageIdx: number, isCrit: boolean): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    const now = performance.now();
    if (now - this.lastClickAt < TUNING.CLICK_MIN_GAP_MS) {
      return;
    }
    this.lastClickAt = now;
    this.clickTimestamps = this.clickTimestamps.filter((stamp) => now - stamp < 1000);
    this.clickTimestamps.push(now);
    const rate = this.clickTimestamps.length;
    const limiter =
      rate > TUNING.CLICK_RATE_LIMIT_THRESHOLD
        ? TUNING.CLICK_RATE_LIMIT_THRESHOLD / rate
        : 1;

    const baseFreq = 220 * Math.pow(1.12, stageIdx);
    const jitter = 1 + (Math.random() * 0.06 - 0.03);
    this.playTonedBurst(baseFreq * jitter, 0.15, dbToGain(TUNING.CLICK_VOLUME_DB) * limiter);
    if (isCrit) {
      this.playTonedBurst(
        baseFreq * 2 * jitter,
        0.15,
        dbToGain(TUNING.CLICK_VOLUME_DB - 2) * limiter,
      );
    }
  }

  fadeOutAmbient(durationMs: number): void {
    const ctx = this.context;
    const ambient = this.ambient;
    if (!ctx || !ambient) {
      return;
    }
    ambient.gain.gain.cancelScheduledValues(ctx.currentTime);
    ambient.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
    window.setTimeout(() => {
      ambient.oscillators.forEach((oscillator) => oscillator.stop());
      ambient.gain.disconnect();
      ambient.filter.disconnect();
      if (this.ambient === ambient) {
        this.ambient = null;
      }
    }, durationMs + TUNING.CLICK_MIN_GAP_MS);
  }

  playAutoTick(stageIdx: number, rate: number): void {
    if (rate > TUNING.CLICK_RATE_LIMIT_THRESHOLD) {
      return;
    }
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    const baseFreq = 180 * Math.pow(1.08, stageIdx);
    this.playTonedBurst(
      baseFreq,
      0.08,
      dbToGain(TUNING.CLICK_VOLUME_DB) * TUNING.AUTO_TICK_VOLUME_MULTIPLIER,
    );
  }

  playCollision(tier: RogueTypeKey): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    try {
      const baseVolume = dbToGain(TUNING.COLLISION_VOLUME_DB);
      if (tier === 'minor') {
        this.playNoiseBurst(0.2, baseVolume, 1200);
        return;
      }
      if (tier === 'major') {
        this.playNoiseBurst(0.3, baseVolume, 900);
        this.playTonedBurst(100, 0.3, baseVolume * 0.55);
        return;
      }
      this.playNoiseBurst(0.5, baseVolume, 700);
      this.playTonedBurst(80, 0.5, baseVolume * 0.8);
      this.playTonedBurst(40, 0.5, baseVolume * 0.65);
    } catch (err) {
      this.logAudioError(err);
    }
  }

  playCondenseExplosion(): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !master || !this.unlocked || this.sfxMuted) {
      return;
    }
    try {
      const volume = dbToGain(TUNING.COLLISION_VOLUME_DB - 3);
      const duration = 1.8;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        const fade = 1 - index / data.length;
        data[index] = (Math.random() * 2 - 1) * fade;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(520, ctx.currentTime);
      noiseFilter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + duration);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.75, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();

      const rumble = ctx.createOscillator();
      rumble.type = 'sine';
      const rumbleGain = ctx.createGain();
      rumble.frequency.setValueAtTime(82, ctx.currentTime);
      rumble.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + duration);
      rumbleGain.gain.setValueAtTime(volume, ctx.currentTime);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      rumble.connect(rumbleGain);
      rumbleGain.connect(master);
      rumble.start();
      rumble.stop(ctx.currentTime + duration);

      const light = ctx.createOscillator();
      light.type = 'triangle';
      const lightGain = ctx.createGain();
      light.frequency.setValueAtTime(440, ctx.currentTime + 0.16);
      light.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.62);
      lightGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      lightGain.gain.linearRampToValueAtTime(volume * 0.18, ctx.currentTime + 0.22);
      lightGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      light.connect(lightGain);
      lightGain.connect(master);
      light.start(ctx.currentTime + 0.05);
      light.stop(ctx.currentTime + 1.25);
    } catch (err) {
      this.logAudioError(err);
    }
  }

  playBigBang(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    try {
      const volume = dbToGain(TUNING.BIG_BANG_VOLUME_DB);
      this.playNoiseBurst(0.2, volume, 2000);

      const chirp = ctx.createOscillator();
      chirp.type = 'sawtooth';
      const chirpGain = ctx.createGain();
      chirpGain.gain.value = volume * 0.5;
      chirp.connect(chirpGain);
      chirpGain.connect(this.masterGain!);
      chirp.frequency.setValueAtTime(8000, ctx.currentTime);
      chirp.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.5);
      chirpGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
      chirp.start();
      chirp.stop(ctx.currentTime + 1.5);

      const boomDelay = 0.25;
      const boom = ctx.createOscillator();
      boom.type = 'sine';
      const boomGain = ctx.createGain();
      boomGain.gain.setValueAtTime(volume * 0.8, ctx.currentTime + boomDelay);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + boomDelay + 0.6);
      boom.frequency.setValueAtTime(80, ctx.currentTime + boomDelay);
      boom.connect(boomGain);
      boomGain.connect(this.masterGain!);
      boom.start(ctx.currentTime + boomDelay);
      boom.stop(ctx.currentTime + boomDelay + 0.6);
    } catch (err) {
      this.logAudioError(err);
    }
  }

  playTimeAccelerationWhoosh(intensity: number): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    const duration = 0.8;
    const master = this.masterGain;
    if (!master) {
      return;
    }
    try {
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(250, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(
        1800 + intensity * 3200,
        ctx.currentTime + duration,
      );
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05 + intensity * 0.08, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch (err) {
      this.logAudioError(err);
    }
  }

  playEndingSting(endingId: EndingId): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    const volume = dbToGain(TUNING.BIG_BANG_VOLUME_DB - 2);
    if (endingId === 'heat_death') {
      this.playTonedBurst(55, 3.5, volume * 0.3);
      this.playTonedBurst(82, 4.5, volume * 0.18);
      return;
    }
    if (endingId === 'big_crunch') {
      this.playTonedBurst(220, 1.4, volume * 0.25);
      this.playTonedBurst(330, 1.2, volume * 0.22);
      this.playTonedBurst(440, 1.0, volume * 0.2);
      return;
    }
    if (endingId === 'big_rip') {
      this.playNoiseBurst(0.9, volume * 0.3, 5000);
      this.playTonedBurst(1600, 0.8, volume * 0.15);
      return;
    }
    this.playTonedBurst(660, 1.1, volume * 0.22);
  }

  playCivilizationFlicker(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) {
      return;
    }
    const base = dbToGain(TUNING.CLICK_VOLUME_DB - 6);
    [880, 1046, 1318, 1568].forEach((freq, index) => {
      window.setTimeout(() => {
        this.playTonedBurst(freq + Math.random() * 30, 0.3, base * (1 - index * 0.12));
      }, index * 90);
    });
  }

  dispose(): void {
    if (this.ambient) {
      this.ambient.oscillators.forEach((oscillator) => oscillator.stop());
      this.ambient.gain.disconnect();
      this.ambient.filter.disconnect();
      this.ambient = null;
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.masterGain = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }
    const AudioCtor = getAudioContextCtor();
    if (!AudioCtor) {
      return null;
    }
    const context = new AudioCtor();
    const masterGain = context.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private isUsable(): boolean {
    const ctx = this.context;
    if (!ctx) {
      return false;
    }
    if (ctx.state === 'closed') {
      return false;
    }
    return true;
  }

  private logAudioError(err: unknown): void {
    const now = performance.now();
    const message = err instanceof Error ? err.message : String(err);
    if (message === this.lastAudioErrorMessage && now - this.lastAudioErrorAt <= 1000) {
      return;
    }
    this.lastAudioErrorAt = now;
    this.lastAudioErrorMessage = message;
    console.warn('[debug] audio call failed:', err);
  }

  private playTonedBurst(frequency: number, duration: number, gainAmount: number): void {
    const ctx = this.context;
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !master) {
      return;
    }
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  private playNoiseBurst(duration: number, gainAmount: number, cutoff: number): void {
    const ctx = this.context;
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !master) {
      return;
    }
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }
}
