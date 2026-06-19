import { describe, expect, it } from 'vitest';
import { rollQualityScore, qualityMult, isTailQuality, bestQuality } from '../entities/quality';
import { QUALITY_TAIL_THRESHOLD } from '../balance';
import { addToInventory } from '../entities/drops';
import { STAGE_ENTITIES } from '../entities/stageItems';

const common = STAGE_ENTITIES.find((e) => e.rarity === 'common')!;

describe('#50 item quality (가우시언 테일)', () => {
  it('rollQualityScore stays in [0,1] and is gaussian-shaped (mid-heavy, rare tails)', () => {
    let tailHits = 0;
    let sum = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      // Deterministic-ish sweep of the unit square so we cover the distribution.
      const r1 = (i * 0.61803398875) % 1;
      const r2 = ((i * 0.7548776662) + 0.123) % 1;
      const q = rollQualityScore(r1, r2);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
      sum += q;
      if (q >= QUALITY_TAIL_THRESHOLD) tailHits++;
    }
    // Mean clusters near 0.5 (gaussian centered).
    expect(sum / N).toBeGreaterThan(0.4);
    expect(sum / N).toBeLessThan(0.6);
    // The gold tail is genuinely rare (well under 15% of rolls).
    expect(tailHits / N).toBeLessThan(0.15);
  });

  it('qualityMult is DISABLED → always 1 (no per-copy power variation)', () => {
    expect(qualityMult(undefined)).toBe(1);
    expect(qualityMult(0)).toBe(1);
    expect(qualityMult(1)).toBe(1);
    expect(qualityMult(0.5)).toBe(1);
  });

  it('isTailQuality is DISABLED → always false (no gold/명품 distinction)', () => {
    expect(isTailQuality(undefined)).toBe(false);
    expect(isTailQuality(0.5)).toBe(false);
    expect(isTailQuality(QUALITY_TAIL_THRESHOLD)).toBe(false);
    expect(isTailQuality(1)).toBe(false);
  });

  it('bestQuality keeps the higher specimen (undefined-safe)', () => {
    expect(bestQuality(undefined, 0.3)).toBe(0.3);
    expect(bestQuality(0.6, undefined)).toBe(0.6);
    expect(bestQuality(0.4, 0.9)).toBe(0.9);
    expect(bestQuality(0.9, 0.4)).toBe(0.9);
    expect(bestQuality(undefined, undefined)).toBeUndefined();
  });

  it('addToInventory stamps a new stack and keeps the best across copies', () => {
    const inv0 = addToInventory([], common.id, 0.4);
    expect(inv0[0].quality).toBe(0.4);
    // A weaker second copy does not lower the stack.
    const inv1 = addToInventory(inv0, common.id, 0.1);
    expect(inv1[0].count).toBe(2);
    expect(inv1[0].quality).toBe(0.4);
    // A stronger copy raises it.
    const inv2 = addToInventory(inv1, common.id, 0.95);
    expect(inv2[0].count).toBe(3);
    expect(inv2[0].quality).toBe(0.95);
    // Omitting quality leaves a new stack neutral (undefined).
    const plain = addToInventory([], common.id);
    expect(plain[0].quality).toBeUndefined();
  });
});
