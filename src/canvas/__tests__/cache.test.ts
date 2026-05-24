import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getRadial,
  getLinear,
  invalidateGradients,
  gradientCacheSize,
} from '../gradientCache';
import {
  getSprite,
  invalidateSprites,
  spriteCacheSize,
  getRadialGlowSprite,
} from '../spriteCache';

// Minimal CanvasGradient + CanvasRenderingContext2D stubs.
// These tests run in node env (vitest.config.ts environment: 'node'),
// so we hand-roll the gradient/canvas APIs we use.

function mockCtx(): CanvasRenderingContext2D {
  return {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

function mockSpriteEnv(): void {
  // Stub the minimum DOM we touch: document.createElement('canvas')
  // returning an object with width/height + getContext.
  // @ts-expect-error test-only global
  globalThis.document = {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        fillRect: vi.fn(),
        set fillStyle(_v: unknown) {},
      })),
    })),
  };
}

beforeEach(() => {
  invalidateGradients();
  invalidateSprites();
  mockSpriteEnv();
});

describe('gradientCache', () => {
  it('returns the same instance for the same key', () => {
    const ctx = mockCtx();
    const a = getRadial(ctx, 'k', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    const b = getRadial(ctx, 'k', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    expect(a).toBe(b);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
  });

  it('returns different instances for different keys', () => {
    const ctx = mockCtx();
    const a = getRadial(ctx, 'a', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    const b = getRadial(ctx, 'b', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    expect(a).not.toBe(b);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2);
  });

  it('invalidateGradients() clears cache', () => {
    const ctx = mockCtx();
    getRadial(ctx, 'k', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    expect(gradientCacheSize().radial).toBe(1);
    invalidateGradients();
    expect(gradientCacheSize().radial).toBe(0);
    const after = getRadial(ctx, 'k', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(after).toBeDefined();
  });

  it('invalidateGradients(prefix) only clears matching keys', () => {
    const ctx = mockCtx();
    getRadial(ctx, 'stage1_a', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    getRadial(ctx, 'stage1_b', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    getRadial(ctx, 'stage2_a', 0, 0, 0, 0, 0, 10, [[0, '#fff']]);
    invalidateGradients('stage1_');
    expect(gradientCacheSize().radial).toBe(1);
  });

  it('linear cache works independently', () => {
    const ctx = mockCtx();
    const a = getLinear(ctx, 'lin', 0, 0, 10, 10, [[0, '#fff']]);
    const b = getLinear(ctx, 'lin', 0, 0, 10, 10, [[0, '#fff']]);
    expect(a).toBe(b);
  });
});

describe('spriteCache', () => {
  it('builds the sprite only on first call for a key', () => {
    const builder = vi.fn();
    const a = getSprite('s', 32, 32, builder);
    const b = getSprite('s', 32, 32, builder);
    expect(a).toBe(b);
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it('rebuilds if size changes for the same key', () => {
    const builder = vi.fn();
    getSprite('s', 32, 32, builder);
    getSprite('s', 64, 64, builder);
    expect(builder).toHaveBeenCalledTimes(2);
  });

  it('invalidateSprites(prefix) deletes only matching entries', () => {
    const b = vi.fn();
    getSprite('stage1_glow_red', 16, 16, b);
    getSprite('stage1_glow_blue', 16, 16, b);
    getSprite('stage2_glow_red', 16, 16, b);
    invalidateSprites('stage1_');
    expect(spriteCacheSize()).toBe(1);
  });

  it('getRadialGlowSprite handles hex colors', () => {
    const a = getRadialGlowSprite('glow_a', 32, '#ff8800');
    const b = getRadialGlowSprite('glow_a', 32, '#ff8800');
    expect(a).toBe(b);
    expect(spriteCacheSize()).toBe(1);
  });
});
