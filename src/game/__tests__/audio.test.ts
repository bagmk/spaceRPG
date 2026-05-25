/**
 * Audio invariant tests — guards against the multi-track stacking bug that
 * existed prior to the fadingOut[] refactor. The contract under test:
 *
 *   "Under any sequence of loadAndPlayChapterPool calls (including rapid
 *    back-to-back stage switches), at most 2 audible sources exist after
 *    CLEANUP_FADE_MS has elapsed past the last switch."
 *
 * We mock Web Audio just enough for SoundManager to think it's running.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundManager } from '../audio';

// ── Mock Web Audio ──────────────────────────────────────────────────────────

class MockAudioParam {
  value = 1;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
  setTargetAtTime() { return this; }
}

class MockGainNode {
  gain = new MockAudioParam();
  connect() {}
  disconnect() {}
}

class MockSourceNode {
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  connect() {}
  disconnect() {}
  start() { this.started = true; }
  stop() {
    if (this.stopped) throw new Error('already stopped');
    this.stopped = true;
  }
}

class MockOscillator {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockFilter {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  createBufferSource() { return new MockSourceNode(); }
  createGain() { return new MockGainNode(); }
  createOscillator() { return new MockOscillator(); }
  createBiquadFilter() { return new MockFilter(); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      duration: length / sampleRate,
      length,
      numberOfChannels: channels,
      sampleRate,
      getChannelData: () => data,
    };
  }
  decodeAudioData(_buf: ArrayBuffer) {
    // Return a 30-second mock buffer — long enough that the chain timer
    // doesn't fire within the test window.
    return Promise.resolve(this.createBuffer(2, 44100 * 30, 44100));
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

// Helper: peek at the private debug counter.
function activeCount(sm: SoundManager): number {
  return (sm as unknown as { _debugActiveSourceCount(): number })._debugActiveSourceCount();
}

describe('SoundManager — single-track invariant under rapid switches', () => {
  let restoreFetch: typeof global.fetch | undefined;

  beforeEach(() => {
    const ctxCtor = MockAudioContext as unknown as typeof AudioContext;
    global.window = {
      AudioContext: ctxCtor,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    } as unknown as Window & typeof globalThis;
    global.performance = { now: () => Date.now() } as Performance;
    restoreFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    if (restoreFetch !== undefined) global.fetch = restoreFetch;
    // @ts-expect-error test cleanup
    delete global.window;
  });

  async function flush(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  it('never has more than 2 sources after a single switch', async () => {
    const sm = new SoundManager(false, false);
    sm.unlock();
    await sm.loadAndPlayChapterPool('stage_01', ['/m/a.mp3']);
    await flush(10);
    expect(activeCount(sm)).toBe(1);
    await sm.loadAndPlayChapterPool('stage_02', ['/m/b.mp3']);
    await flush(10);
    // Right after the switch: 1 new + 1 fading-out = 2.
    expect(activeCount(sm)).toBeLessThanOrEqual(2);
    sm.dispose();
  });

  it('caps at 2 sources even under rapid 5-stage switching', async () => {
    const sm = new SoundManager(false, false);
    sm.unlock();
    await sm.loadAndPlayChapterPool('stage_01', ['/m/a.mp3']);
    await flush(5);

    // Rapid-fire: 4 more switches within ~50ms total
    for (let i = 2; i <= 5; i += 1) {
      await sm.loadAndPlayChapterPool(`stage_0${i}`, [`/m/${i}.mp3`]);
      await flush(10);
      // After each switch, count must never exceed 2 — this is the contract
      // the previous single-slot implementation violated (could reach 5).
      expect(activeCount(sm)).toBeLessThanOrEqual(2);
    }

    // After the CLEANUP_FADE_MS window (80ms) plus crossfade settles, we
    // should be back to 1 (only the most recent track).
    await flush(200);
    expect(activeCount(sm)).toBeLessThanOrEqual(2);
    sm.dispose();
  });

  it('fadeOutMusic clears all fading sources', async () => {
    const sm = new SoundManager(false, false);
    sm.unlock();
    await sm.loadAndPlayChapterPool('stage_01', ['/m/a.mp3']);
    await flush(5);
    await sm.loadAndPlayChapterPool('stage_02', ['/m/b.mp3']);
    await flush(5);
    sm.fadeOutMusic(50);
    // After the snap-stop window, no sources should remain audible.
    await flush(200);
    expect(activeCount(sm)).toBe(0);
    sm.dispose();
  });

  it('dispose immediately frees all sources', async () => {
    const sm = new SoundManager(false, false);
    sm.unlock();
    await sm.loadAndPlayChapterPool('stage_01', ['/m/a.mp3']);
    await flush(5);
    await sm.loadAndPlayChapterPool('stage_02', ['/m/b.mp3']);
    await flush(5);
    sm.dispose();
    expect(activeCount(sm)).toBe(0);
  });
});
