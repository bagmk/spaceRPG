import { TUNING } from './constants';
import { dbToGain } from './formulas';
import type { EndingId, RogueTypeKey } from './types';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextCtor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const win = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? win.webkitAudioContext;
}

interface FadingOutEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stopTimer: number | null;
}

export class SoundManager {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private lastAudioErrorAt = 0;

  private lastAudioErrorMessage = '';

  private unlocked = false;

  private sfxMuted: boolean;

  private clickTimestamps: number[] = [];

  private lastClickAt = 0;

  // ── Music layer (chapter-based, separate from procedural drone) ──────────
  // Real audio-file BGM that plays per "chapter" (per-stage pool).
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private currentChapter: string | null = null;
  private musicBuffers = new Map<string, AudioBuffer>();
  private inflightLoads = new Map<string, Promise<AudioBuffer | null>>();
  private musicMuted = false;
  private musicVolume = 1; // user multiplier 0..1, applied on top of MUSIC_VOLUME_DB

  // LRU cache for decoded AudioBuffers. Web Audio decodes MP3s to 32-bit float
  // PCM in memory (~11x file size). With 25 stage/ending tracks at 256kbps,
  // unbounded caching reaches ~1.5GB after a full playthrough — enough to
  // trigger thermal throttling and GC stalls on mid-tier machines.
  // 4 entries ≈ current + last + next + pool partner; plenty for smooth UX.
  private static readonly MAX_CACHED_BUFFERS = 4;
  private bufferAccessOrder: string[] = []; // oldest -> newest

  // decodeAudioData supposedly runs off the main thread, but in practice large
  // MP3s can stall for >200ms on low-end hardware. Surface those so we know
  // which assets need re-encoding.
  private static readonly SLOW_DECODE_WARN_MS = 250;

  // Chapter-pool rotation: each chapter id maps to N candidate tracks (URLs).
  // When one finishes, we cross-fade into a random other one from the pool.
  private chapterPools = new Map<string, AudioBuffer[]>();
  private currentPoolId: string | null = null;
  private currentPoolIdx = -1;
  // Monotonic epoch — bumps on every chapter switch / fade-out. Async tasks
  // (load promises, chain timers) capture the epoch at start and bail if it
  // changed by the time they resolve, so they can't accidentally start an
  // outdated track on top of the current one.
  private musicEpoch = 0;
  // All currently-fading-out tracks. We keep an array (not a single slot)
  // because a single slot leaks under rapid switches: the old outgoing ref
  // gets nulled but its AudioBufferSourceNode keeps playing via closure,
  // creating ghost tracks that stack. With an array we snap-stop ALL of
  // them on each new switch, guaranteeing: at most 1 musicSource + 0..1
  // sources audible past the brief CLEANUP_FADE_MS window.
  private fadingOut: FadingOutEntry[] = [];
  // 80ms click-free fade for forced cleanup of orphaned sources.
  private static readonly CLEANUP_FADE_MS = 80;

  constructor(sfxMuted: boolean, musicMuted = false) {
    this.sfxMuted = sfxMuted;
    this.musicMuted = musicMuted;
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

  setSfxMuted(sfxMuted: boolean): void {
    this.sfxMuted = sfxMuted;
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

  /** Light tap for UI navigation (almanac, stage select, detail view). */
  playUITap(): void {
    const ctx = this.ensureContext();
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted) return;
    try {
      const vol = dbToGain(TUNING.CLICK_VOLUME_DB - 7);
      this.playTonedBurst(960, 0.06, vol);
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

  // ── Chapter music API ──────────────────────────────────────────────────
  // Lazy-load + cross-fade audio files (mp3/ogg/m4a) by chapter id.
  // playChapter('stellar') is idempotent — calling it again with the same id
  // is a no-op so the song doesn't restart when the player navigates within
  // the same era.

  async loadChapter(chapterId: string, url: string): Promise<AudioBuffer | null> {
    if (this.musicBuffers.has(chapterId)) {
      this.touchBuffer(chapterId);
      return this.musicBuffers.get(chapterId)!;
    }
    if (this.inflightLoads.has(chapterId)) return this.inflightLoads.get(chapterId)!;
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const promise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
        const arrayBuffer = await res.arrayBuffer();
        const decodeStart = performance.now();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        const decodeMs = performance.now() - decodeStart;
        if (decodeMs > SoundManager.SLOW_DECODE_WARN_MS) {
          console.warn(
            `[audio] slow decode: ${chapterId} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB) ` +
              `took ${decodeMs.toFixed(0)}ms — consider re-encoding at lower bitrate`,
          );
        }
        this.musicBuffers.set(chapterId, buffer);
        this.touchBuffer(chapterId);
        this.evictIfNeeded();
        return buffer;
      } catch (err) {
        this.logAudioError(err);
        return null;
      } finally {
        this.inflightLoads.delete(chapterId);
      }
    })();
    this.inflightLoads.set(chapterId, promise);
    return promise;
  }

  /**
   * Prefetch a chapter's buffers without starting playback. Use this to warm
   * the cache for the next stage during idle time, so the actual transition
   * doesn't stall on fetch+decode. Idempotent and respects LRU cache size.
   */
  async prefetchChapter(chapterId: string, urls: string[]): Promise<void> {
    if (!urls.length) return;
    await Promise.all(
      urls.map((url, i) => this.loadChapter(`${chapterId}#${i}`, url)),
    );
  }

  /** Move a buffer key to the most-recently-used position. */
  private touchBuffer(id: string): void {
    const idx = this.bufferAccessOrder.indexOf(id);
    if (idx >= 0) this.bufferAccessOrder.splice(idx, 1);
    this.bufferAccessOrder.push(id);
  }

  /**
   * Evict oldest buffers until we are at or below MAX_CACHED_BUFFERS.
   * NEVER evicts:
   *   - The buffer currently driving musicSource (audible)
   *   - Any buffer in the currently-active chapterPool (next in chain)
   *   - The outgoing source's buffer (mid-crossfade)
   * If all remaining entries are protected, eviction stops early — better to
   * exceed the limit briefly than to glitch the audio.
   */
  private evictIfNeeded(): void {
    while (this.bufferAccessOrder.length > SoundManager.MAX_CACHED_BUFFERS) {
      const activePool = this.currentPoolId
        ? this.chapterPools.get(this.currentPoolId)
        : null;
      const playingBuf = this.musicSource?.buffer ?? null;
      const fadingBufs = new Set<AudioBuffer>();
      for (const entry of this.fadingOut) {
        if (entry.source.buffer) fadingBufs.add(entry.source.buffer);
      }
      let evictedIdx = -1;
      for (let i = 0; i < this.bufferAccessOrder.length; i += 1) {
        const id = this.bufferAccessOrder[i];
        const buf = this.musicBuffers.get(id);
        if (!buf) {
          // Stale entry — just drop it from the order list.
          evictedIdx = i;
          break;
        }
        if (buf === playingBuf) continue;
        if (fadingBufs.has(buf)) continue;
        if (activePool && activePool.includes(buf)) continue;
        evictedIdx = i;
        break;
      }
      if (evictedIdx < 0) return; // all remaining are protected
      const evictId = this.bufferAccessOrder.splice(evictedIdx, 1)[0];
      this.musicBuffers.delete(evictId);
    }
  }

  private getMusicTargetGain(): number {
    if (this.musicMuted) return 0;
    const base = dbToGain(TUNING.MUSIC_VOLUME_DB);
    return base * Math.max(0, Math.min(1, this.musicVolume));
  }

  playChapter(chapterId: string, fadeMs: number = TUNING.MUSIC_CROSSFADE_MS): void {
    if (this.currentChapter === chapterId) return;
    const ctx = this.ensureContext();
    const buffer = this.musicBuffers.get(chapterId);
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !this.unlocked || !buffer || !master) return;
    try {
      const next = ctx.createBufferSource();
      next.buffer = buffer;
      next.loop = true;
      const nextGain = ctx.createGain();
      nextGain.gain.setValueAtTime(0, ctx.currentTime);
      const targetGain = this.getMusicTargetGain();
      nextGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + fadeMs / 1000);
      next.connect(nextGain);
      nextGain.connect(master);
      next.start();

      // Snap-cut any orphaned fading sources before starting a new track —
      // otherwise rapid switches can stack 3+ tracks. After this call, only
      // the soon-to-be-demoted prev track remains audible.
      this.snapStopAllFadingOut();

      const prev = this.musicSource;
      const prevGain = this.musicGain;
      if (prev && prevGain) {
        prevGain.gain.cancelScheduledValues(ctx.currentTime);
        prevGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000);
        this.pushFadingOut(prev, prevGain, fadeMs + 100);
      }

      this.musicSource = next;
      this.musicGain = nextGain;
      this.currentChapter = chapterId;
    } catch (err) {
      this.logAudioError(err);
    }
  }

  /** Load and play in one shot; resolves once playback has actually started. */
  async loadAndPlayChapter(chapterId: string, url: string, fadeMs?: number): Promise<void> {
    const buffer = await this.loadChapter(chapterId, url);
    if (buffer) this.playChapter(chapterId, fadeMs);
  }


  /** Load all tracks for a chapter and start rotation. Idempotent per pool id. */
  async loadAndPlayChapterPool(chapterId: string, urls: string[], fadeMs?: number): Promise<void> {
    if (this.currentPoolId === chapterId) return; // no-op within same pool
    if (!urls.length) return;
    // Bump epoch IMMEDIATELY so any pending chain timers from the previous
    // pool no-op on fire. Capture our own epoch so we can detect if a newer
    // chapter request supersedes us while we await load.
    this.musicEpoch += 1;
    const myEpoch = this.musicEpoch;
    // Load each url under a synthetic per-track id so the existing cache works.
    const loaded = await Promise.all(
      urls.map((url, i) => this.loadChapter(`${chapterId}#${i}`, url)),
    );
    // If another chapter request came in while we were loading, abandon.
    if (myEpoch !== this.musicEpoch) return;
    const buffers = loaded.filter((b): b is AudioBuffer => b !== null);
    if (!buffers.length) return; // nothing usable — fall back to silence
    this.chapterPools.set(chapterId, buffers);
    this.currentPoolId = chapterId;
    this.currentPoolIdx = -1;
    this.playRandomFromPool(chapterId, fadeMs);
  }

  private playRandomFromPool(chapterId: string, fadeMs?: number): void {
    const pool = this.chapterPools.get(chapterId);
    if (!pool || !pool.length) return;
    // Pick a random index, avoiding the current one if possible.
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === this.currentPoolIdx) {
      idx = (idx + 1) % pool.length;
    }
    this.currentPoolIdx = idx;
    this.playBufferWithChain(pool[idx], chapterId, fadeMs ?? TUNING.MUSIC_CROSSFADE_MS);
  }

  /**
   * Play a one-shot buffer (NOT looping); on natural end, queue the next
   * random pool track. Cross-fades against the existing musicSource.
   * Use this instead of playChapter() when you want pool rotation.
   */
  private playBufferWithChain(buffer: AudioBuffer, chapterId: string, fadeMs: number): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !this.unlocked || !master) return;
    try {
      const next = ctx.createBufferSource();
      next.buffer = buffer;
      next.loop = false; // chained pool, not looping
      const nextGain = ctx.createGain();
      nextGain.gain.setValueAtTime(0, ctx.currentTime);
      nextGain.gain.linearRampToValueAtTime(this.getMusicTargetGain(), ctx.currentTime + fadeMs / 1000);
      // Fade out the trailing edge so the chain cross-fades cleanly.
      const trackDur = buffer.duration;
      const trailFadeStart = Math.max(0, trackDur - fadeMs / 1000);
      nextGain.gain.setValueAtTime(this.getMusicTargetGain(), ctx.currentTime + trailFadeStart);
      nextGain.gain.linearRampToValueAtTime(0, ctx.currentTime + trackDur);
      next.connect(nextGain);
      nextGain.connect(master);
      next.start();

      // Step 1: snap-cut EVERY orphaned fading source (not just the most
      // recent one — that was the old bug). After this returns, at most the
      // current musicSource is audible, guaranteeing no track stacking under
      // rapid stage switches.
      this.snapStopAllFadingOut();

      // Step 2: demote current musicSource into the fading-out set.
      const prev = this.musicSource;
      const prevGain = this.musicGain;
      if (prev && prevGain) {
        prevGain.gain.cancelScheduledValues(ctx.currentTime);
        prevGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000);
        this.pushFadingOut(prev, prevGain, fadeMs + 100);
      }

      this.musicSource = next;
      this.musicGain = nextGain;
      this.currentChapter = chapterId;

      // When the track ends naturally, queue the next random one.
      // Schedule the chain a bit before the actual end so cross-fade overlaps.
      // Capture epoch at schedule time — if anything (chapter switch, fade-out,
      // another playback call) bumps the epoch before this fires, no-op.
      const myEpoch = this.musicEpoch;
      const queueAheadMs = Math.max(0, fadeMs - 200);
      const chainDelayMs = Math.max(0, trackDur * 1000 - queueAheadMs);
      window.setTimeout(() => {
        if (this.musicEpoch !== myEpoch) return;
        if (this.currentPoolId !== chapterId) return;
        this.playRandomFromPool(chapterId, fadeMs);
      }, chainDelayMs);
    } catch (err) {
      this.logAudioError(err);
    }
  }

  fadeOutMusic(fadeMs: number = TUNING.MUSIC_FADE_OUT_MS): void {
    this.musicEpoch += 1; // invalidate any pending chain timers
    this.currentPoolId = null; // stop any pool rotation chaining
    // Snap any orphaned fading-out sources — no point fading them twice.
    this.snapStopAllFadingOut();
    const ctx = this.context;
    const prev = this.musicSource;
    const prevGain = this.musicGain;
    if (!ctx || !prev || !prevGain) return;
    prevGain.gain.cancelScheduledValues(ctx.currentTime);
    prevGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000);
    this.pushFadingOut(prev, prevGain, fadeMs + 100);
    this.musicSource = null;
    this.musicGain = null;
    this.currentChapter = null;
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    const ctx = this.context;
    const g = this.musicGain;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(this.getMusicTargetGain(), ctx.currentTime, 0.1);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    const ctx = this.context;
    const g = this.musicGain;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(this.getMusicTargetGain(), ctx.currentTime, 0.1);
  }

  isChapterLoaded(chapterId: string): boolean {
    return this.musicBuffers.has(chapterId);
  }

  getCurrentChapter(): string | null {
    return this.currentChapter;
  }

  /**
   * Grand stage-advance impact — 3-layer synthesis evoking a "cosmic birth"
   * moment. Replaces the old playCondenseExplosion noise burst.
   *
   *  Layer 1: 42 Hz sub-bass swell (slow ramp-in, the "weight")
   *  Layer 2: pure sine impact + 3rd harmonic (the "moment", gong-like)
   *  Layer 3: 3 ascending high sine pings (the "shimmer")
   *
   * Pitch base shifts up subtly per stage so progression is audible:
   *   Stage 1 ~110 Hz, Stage 8 ~165 Hz, Stage 16 ~265 Hz.
   */
  playStageAdvanceImpact(nextStageIdx: number): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!this.isUsable() || !ctx || !this.unlocked || this.sfxMuted || !master) return;
    try {
      const now = ctx.currentTime;
      const stageIdx = Math.max(0, nextStageIdx);
      const baseFreq = 110 * Math.pow(1.06, stageIdx);
      const volume = dbToGain(TUNING.STAGE_ADVANCE_VOLUME_DB);

      // Layer 1 — sub-bass swell
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.value = 42;
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(volume * 0.55, now + 0.6);
      subGain.gain.setValueAtTime(volume * 0.55, now + 1.4);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 3.0);

      // Layer 2 — main chime (fundamental + 3rd harmonic for body)
      const impactAt = now + 0.4;
      const fundamental = ctx.createOscillator();
      fundamental.type = 'sine';
      fundamental.frequency.value = baseFreq;
      const fundGain = ctx.createGain();
      fundGain.gain.setValueAtTime(volume * 0.7, impactAt);
      fundGain.gain.exponentialRampToValueAtTime(0.0001, impactAt + 2.5);
      fundamental.connect(fundGain);
      fundGain.connect(master);
      fundamental.start(impactAt);
      fundamental.stop(impactAt + 2.6);

      const harm = ctx.createOscillator();
      harm.type = 'sine';
      harm.frequency.value = baseFreq * 3;
      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(volume * 0.18, impactAt);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, impactAt + 1.8);
      harm.connect(harmGain);
      harmGain.connect(master);
      harm.start(impactAt);
      harm.stop(impactAt + 2.0);

      // Layer 3 — ascending high sparkle (3 quick sine pings)
      const sparkleAt = impactAt + 0.2;
      [8, 10, 12].forEach((mult, i) => {
        const s = ctx.createOscillator();
        s.type = 'sine';
        s.frequency.value = baseFreq * mult;
        const sg = ctx.createGain();
        const t0 = sparkleAt + i * 0.06;
        sg.gain.setValueAtTime(volume * 0.08, t0);
        sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
        s.connect(sg);
        sg.connect(master);
        s.start(t0);
        s.stop(t0 + 0.45);
      });
    } catch (err) {
      this.logAudioError(err);
    }
  }

  /**
   * Track a fading-out source. After stopDelayMs, the source is stopped
   * and disconnected. Used by both crossfade demotion and forced cleanup.
   */
  private pushFadingOut(source: AudioBufferSourceNode, gain: GainNode, stopDelayMs: number): void {
    const entry: FadingOutEntry = { source, gain, stopTimer: null };
    entry.stopTimer = window.setTimeout(() => {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      gain.disconnect();
      this.fadingOut = this.fadingOut.filter((e) => e !== entry);
    }, stopDelayMs);
    this.fadingOut.push(entry);
  }

  /**
   * Snap-stop every currently-fading source with a short click-free fade.
   * Call this BEFORE starting any new track so we never stack 3+ tracks.
   * Idempotent and cheap when fadingOut is empty (the common case).
   */
  private snapStopAllFadingOut(): void {
    const ctx = this.context;
    if (!ctx || this.fadingOut.length === 0) return;
    const fadeSec = SoundManager.CLEANUP_FADE_MS / 1000;
    const stopAtMs = SoundManager.CLEANUP_FADE_MS + 30;
    for (const entry of this.fadingOut) {
      if (entry.stopTimer !== null) window.clearTimeout(entry.stopTimer);
      entry.gain.gain.cancelScheduledValues(ctx.currentTime);
      entry.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
      const { source, gain } = entry;
      window.setTimeout(() => {
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
        gain.disconnect();
      }, stopAtMs);
    }
    this.fadingOut = [];
  }

  /** TEST-ONLY: returns the number of audible sources right now. */
  _debugActiveSourceCount(): number {
    return (this.musicSource ? 1 : 0) + this.fadingOut.length;
  }

  dispose(): void {
    if (this.musicSource && this.musicGain) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource.disconnect();
      this.musicGain.disconnect();
      this.musicSource = null;
      this.musicGain = null;
    }
    this.musicEpoch += 1;
    // Stop every fading-out source and clear their cleanup timers.
    for (const entry of this.fadingOut) {
      if (entry.stopTimer !== null) window.clearTimeout(entry.stopTimer);
      try { entry.source.stop(); } catch { /* already stopped */ }
      entry.source.disconnect();
      entry.gain.disconnect();
    }
    this.fadingOut = [];
    this.musicBuffers.clear();
    this.bufferAccessOrder = [];
    this.inflightLoads.clear();
    this.chapterPools.clear();
    this.currentChapter = null;
    this.currentPoolId = null;
    this.currentPoolIdx = -1;
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
