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
    if (this.unlocked && ctx.state === 'running') {
      return; // skip redundant calls
    }
    this.unlocked = true;
    void ctx.resume();
    if (this.ambient) {
      const targetGain = this.bgmMuted ? 0 : dbToGain(TUNING.DRONE_VOLUME_DB);
      this.ambient.gain.gain.setValueAtTime(targetGain, ctx.currentTime);
    }
  }

  // Call this when visibility returns. Safe to call multiple times.
  ensureRunning(): void {
    const ctx = this.context;
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
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

  playCondenseExplosion(stageId = 1): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !master || !this.unlocked || this.sfxMuted) {
      return;
    }
    try {
      const now = ctx.currentTime;
      const vol = dbToGain(TUNING.COLLISION_VOLUME_DB - 3);

      // Stage-based parameters for variety
      // Each stage gets different pitch, wave type, chord, and character
      const stageChar = this._getStageCondenseCharacter(stageId);

      // 1. Impact thump
      const impact = ctx.createOscillator();
      impact.type = stageChar.impactWave;
      const impactG = ctx.createGain();
      impact.frequency.setValueAtTime(stageChar.impactFreq, now);
      impact.frequency.exponentialRampToValueAtTime(stageChar.impactFreq * 0.25, now + 0.45);
      impactG.gain.setValueAtTime(vol * 1.1, now);
      impactG.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      impact.connect(impactG); impactG.connect(master);
      impact.start(now); impact.stop(now + 0.5);

      // 2. Noise texture
      const nDur = stageChar.noiseDur;
      const nBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * nDur), ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < nData.length; i++) nData[i] = (Math.random() * 2 - 1) * (1 - i / nData.length);
      const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
      const nFilt = ctx.createBiquadFilter();
      nFilt.type = stageChar.noiseFilterType;
      nFilt.frequency.setValueAtTime(stageChar.noiseFreqStart, now);
      nFilt.frequency.exponentialRampToValueAtTime(stageChar.noiseFreqEnd, now + nDur);
      nFilt.Q.value = stageChar.noiseQ;
      const nG = ctx.createGain();
      nG.gain.setValueAtTime(vol * 0.4, now);
      nG.gain.exponentialRampToValueAtTime(0.0001, now + nDur);
      nSrc.connect(nFilt); nFilt.connect(nG); nG.connect(master); nSrc.start(now);

      // 3. Chord tones
      stageChar.chord.forEach((freq: number, i: number) => {
        const o = ctx.createOscillator();
        o.type = stageChar.chordWave;
        const g = ctx.createGain();
        const d = 0.12 + i * 0.1;
        o.frequency.setValueAtTime(freq, now + d);
        o.frequency.linearRampToValueAtTime(freq * stageChar.chordSlide, now + d + 1.0);
        g.gain.setValueAtTime(0.0001, now + d);
        g.gain.linearRampToValueAtTime(vol * 0.1, now + d + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.1);
        o.connect(g); g.connect(master);
        o.start(now + d); o.stop(now + d + 1.2);
      });

      // 4. Tail shimmer
      const sh = ctx.createOscillator();
      sh.type = 'triangle';
      const shG = ctx.createGain();
      sh.frequency.setValueAtTime(stageChar.shimmerFreq, now + 0.25);
      sh.frequency.exponentialRampToValueAtTime(stageChar.shimmerFreq * 2, now + 1.8);
      shG.gain.setValueAtTime(0.0001, now + 0.25);
      shG.gain.linearRampToValueAtTime(vol * 0.05, now + 0.5);
      shG.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      sh.connect(shG); shG.connect(master);
      sh.start(now + 0.25); sh.stop(now + 2.1);

      // 5. Sub rumble
      const rb = ctx.createOscillator();
      rb.type = 'sine';
      const rbG = ctx.createGain();
      rb.frequency.setValueAtTime(stageChar.rumbleFreq, now + 0.08);
      rb.frequency.exponentialRampToValueAtTime(stageChar.rumbleFreq * 0.4, now + 2.2);
      rbG.gain.setValueAtTime(vol * 0.35, now + 0.08);
      rbG.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      rb.connect(rbG); rbG.connect(master);
      rb.start(now + 0.08); rb.stop(now + 2.3);
    } catch (err) {
      this.logAudioError(err);
    }
  }

  private _getStageCondenseCharacter(stageId: number) {
    type W = OscillatorType;
    type F = BiquadFilterType;
    // Each stage cluster has a unique sonic fingerprint
    const characters: Record<number, {
      impactWave: W; impactFreq: number;
      noiseFilterType: F; noiseFreqStart: number; noiseFreqEnd: number; noiseQ: number; noiseDur: number;
      chord: number[]; chordWave: W; chordSlide: number;
      shimmerFreq: number; rumbleFreq: number;
    }> = {
      1:  { impactWave:'sine',     impactFreq:140, noiseFilterType:'bandpass', noiseFreqStart:1000, noiseFreqEnd:300, noiseQ:2, noiseDur:1.0, chord:[262,330,392,523], chordWave:'sine',     chordSlide:1.5,  shimmerFreq:1400, rumbleFreq:60  }, // Inflation — bright expansion
      2:  { impactWave:'sine',     impactFreq:110, noiseFilterType:'lowpass',  noiseFreqStart:600,  noiseFreqEnd:150, noiseQ:1, noiseDur:1.3, chord:[196,247,294,392], chordWave:'sine',     chordSlide:1.3,  shimmerFreq:1000, rumbleFreq:50  }, // Baryogenesis — warm, deep
      3:  { impactWave:'square',   impactFreq:100, noiseFilterType:'bandpass', noiseFreqStart:900,  noiseFreqEnd:250, noiseQ:3, noiseDur:1.1, chord:[220,277,330,440], chordWave:'square',   chordSlide:1.2,  shimmerFreq:1100, rumbleFreq:55  }, // QGP — buzzy, electric
      4:  { impactWave:'sine',     impactFreq:130, noiseFilterType:'highpass', noiseFreqStart:400,  noiseFreqEnd:800, noiseQ:1, noiseDur:0.9, chord:[294,370,440,587], chordWave:'triangle', chordSlide:1.4,  shimmerFreq:1600, rumbleFreq:45  }, // Nucleosynthesis — fusion flash
      5:  { impactWave:'triangle', impactFreq:90,  noiseFilterType:'lowpass',  noiseFreqStart:500,  noiseFreqEnd:120, noiseQ:1, noiseDur:1.5, chord:[175,220,262,349], chordWave:'sine',     chordSlide:1.1,  shimmerFreq:800,  rumbleFreq:40  }, // Recombination — gentle release
      6:  { impactWave:'sine',     impactFreq:65,  noiseFilterType:'lowpass',  noiseFreqStart:300,  noiseFreqEnd:80,  noiseQ:1, noiseDur:2.0, chord:[131,165,196,262], chordWave:'sine',     chordSlide:1.05, shimmerFreq:600,  rumbleFreq:30  }, // Dark Age — deep, quiet
      7:  { impactWave:'sine',     impactFreq:150, noiseFilterType:'bandpass', noiseFreqStart:1200, noiseFreqEnd:400, noiseQ:2, noiseDur:1.0, chord:[330,415,494,659], chordWave:'sine',     chordSlide:1.6,  shimmerFreq:2000, rumbleFreq:55  }, // First Stars — bright ignition
      8:  { impactWave:'sawtooth', impactFreq:120, noiseFilterType:'bandpass', noiseFreqStart:1400, noiseFreqEnd:500, noiseQ:2, noiseDur:1.1, chord:[349,440,523,698], chordWave:'triangle', chordSlide:1.4,  shimmerFreq:2200, rumbleFreq:50  }, // Reionization — crackling energy
      9:  { impactWave:'sine',     impactFreq:100, noiseFilterType:'lowpass',  noiseFreqStart:700,  noiseFreqEnd:200, noiseQ:1, noiseDur:1.4, chord:[196,262,330,392], chordWave:'sine',     chordSlide:1.2,  shimmerFreq:1200, rumbleFreq:45  }, // Galaxy — swirling majesty
      10: { impactWave:'triangle', impactFreq:110, noiseFilterType:'bandpass', noiseFreqStart:800,  noiseFreqEnd:300, noiseQ:1, noiseDur:1.2, chord:[262,330,392,494], chordWave:'sine',     chordSlide:1.3,  shimmerFreq:1500, rumbleFreq:48  }, // Planetary — orbital harmony
      11: { impactWave:'sine',     impactFreq:85,  noiseFilterType:'lowpass',  noiseFreqStart:500,  noiseFreqEnd:150, noiseQ:1, noiseDur:1.6, chord:[220,277,330,440], chordWave:'triangle', chordSlide:1.15, shimmerFreq:900,  rumbleFreq:38  }, // Life — organic warmth
      12: { impactWave:'sawtooth', impactFreq:160, noiseFilterType:'highpass', noiseFreqStart:600,  noiseFreqEnd:1200,noiseQ:2, noiseDur:0.8, chord:[370,440,554,740], chordWave:'sawtooth', chordSlide:1.8,  shimmerFreq:2800, rumbleFreq:65  }, // Stellar Death — violent, harsh
      13: { impactWave:'sine',     impactFreq:70,  noiseFilterType:'lowpass',  noiseFreqStart:400,  noiseFreqEnd:100, noiseQ:1, noiseDur:2.0, chord:[147,175,220,294], chordWave:'sine',     chordSlide:0.9,  shimmerFreq:500,  rumbleFreq:32  }, // Remnant — fading, dim
      14: { impactWave:'square',   impactFreq:80,  noiseFilterType:'bandpass', noiseFreqStart:600,  noiseFreqEnd:200, noiseQ:3, noiseDur:1.8, chord:[165,196,247,330], chordWave:'square',   chordSlide:0.85, shimmerFreq:700,  rumbleFreq:28  }, // Degenerate — disintegrating
      15: { impactWave:'sine',     impactFreq:50,  noiseFilterType:'lowpass',  noiseFreqStart:350,  noiseFreqEnd:60,  noiseQ:2, noiseDur:2.5, chord:[110,139,165,220], chordWave:'sine',     chordSlide:0.7,  shimmerFreq:400,  rumbleFreq:22  }, // Black Hole — deep void
      16: { impactWave:'triangle', impactFreq:40,  noiseFilterType:'lowpass',  noiseFreqStart:200,  noiseFreqEnd:40,  noiseQ:1, noiseDur:3.0, chord:[98,123,147,196],  chordWave:'sine',     chordSlide:0.6,  shimmerFreq:300,  rumbleFreq:18  }, // Heat Death — silence approaching
    };
    return characters[stageId] ?? characters[1];
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

  /** Soft "pop" for opening panels (almanac, entity lab). */
  playUIOpen(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) return;
    try {
      const vol = dbToGain(TUNING.CLICK_VOLUME_DB - 4);
      // Rising two-tone chime: C6 → E6
      this.playTonedBurst(1047, 0.12, vol);
      window.setTimeout(() => this.playTonedBurst(1318, 0.10, vol * 0.7), 60);
    } catch (err) { this.logAudioError(err); }
  }

  /** Gentle toggle switch sound. */
  playToggle(on: boolean): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) return;
    try {
      const vol = dbToGain(TUNING.CLICK_VOLUME_DB - 5);
      // On: rising "bip", Off: falling "bop"
      const freq = on ? 880 : 660;
      const freq2 = on ? 1174 : 494;
      this.playTonedBurst(freq, 0.07, vol);
      window.setTimeout(() => this.playTonedBurst(freq2, 0.09, vol * 0.6), 45);
    } catch (err) { this.logAudioError(err); }
  }

  /** Soft "thud" for closing panels. */
  playUIClose(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) return;
    try {
      const vol = dbToGain(TUNING.CLICK_VOLUME_DB - 6);
      // Falling single tone: G5
      this.playTonedBurst(784, 0.09, vol);
    } catch (err) { this.logAudioError(err); }
  }

  /** Bright "ding" for entity level-up / purchase. */
  playEntityLevelUp(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) return;
    try {
      const vol = dbToGain(TUNING.CLICK_VOLUME_DB - 2);
      // Ascending arpeggio: C6 → E6 → G6
      this.playTonedBurst(1047, 0.14, vol);
      window.setTimeout(() => this.playTonedBurst(1318, 0.12, vol * 0.8), 50);
      window.setTimeout(() => this.playTonedBurst(1568, 0.18, vol * 0.65), 110);
    } catch (err) { this.logAudioError(err); }
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
