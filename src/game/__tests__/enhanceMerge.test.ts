import { describe, expect, it } from 'vitest';
import { needCopiesForLevel, cumCopiesToLevel, applyMergeCopies } from '../entities/enhance';
import { ENH_DUP_BASE, ENH_DUP_STEP } from '../balance';

/**
 * Overhaul-4 P7b foundation: pure duplicate-collection merge math. These pin the
 * curve (need(L) = 3,5,7,…; cumNeed(L) = L²−1) and the greedy merge the reducer
 * will apply, BEFORE the live mechanic switch (save v27) lands.
 */
describe('P7b merge math — need(L) / cumNeed(L)', () => {
  it('need(L) = ENH_DUP_BASE + ENH_DUP_STEP·(L−1) → 3, 5, 7, 9, …', () => {
    expect(needCopiesForLevel(1)).toBe(ENH_DUP_BASE); // 3
    expect(needCopiesForLevel(2)).toBe(ENH_DUP_BASE + ENH_DUP_STEP); // 5
    expect(needCopiesForLevel(3)).toBe(7);
    expect(needCopiesForLevel(5)).toBe(11);
    // floored / clamped for fractional or <1 input
    expect(needCopiesForLevel(2.9)).toBe(needCopiesForLevel(2));
    expect(needCopiesForLevel(0)).toBe(ENH_DUP_BASE);
  });

  it('cumNeed(L) = L² − 1 and equals the running sum of need(1..L−1)', () => {
    expect(cumCopiesToLevel(1)).toBe(0);
    expect(cumCopiesToLevel(2)).toBe(3);
    expect(cumCopiesToLevel(3)).toBe(8);
    expect(cumCopiesToLevel(5)).toBe(24);
    for (let L = 1; L <= 30; L++) {
      let sum = 0;
      for (let k = 1; k < L; k++) sum += needCopiesForLevel(k);
      expect(cumCopiesToLevel(L)).toBe(sum);
      expect(cumCopiesToLevel(L)).toBe(L * L - 1);
    }
  });
});

describe('P7b merge math — applyMergeCopies (greedy spend)', () => {
  it('no spares → no change', () => {
    expect(applyMergeCopies(1, 0, 10)).toEqual({ newLevel: 1, consumed: 0, leftover: 0, levelsGained: 0 });
  });

  it('exactly one level worth from Lv1 (need=3)', () => {
    expect(applyMergeCopies(1, 3, 10)).toEqual({ newLevel: 2, consumed: 3, leftover: 0, levelsGained: 1 });
  });

  it('two levels from Lv1 cost 3+5=8; surplus is left over, not wasted', () => {
    expect(applyMergeCopies(1, 8, 10)).toEqual({ newLevel: 3, consumed: 8, leftover: 0, levelsGained: 2 });
    // 10 spares: reach Lv3 (8), can't afford need(3)=7 with 2 left
    expect(applyMergeCopies(1, 10, 10)).toEqual({ newLevel: 3, consumed: 8, leftover: 2, levelsGained: 2 });
  });

  it('below the next need → no level, all spares retained', () => {
    expect(applyMergeCopies(1, 2, 10)).toEqual({ newLevel: 1, consumed: 0, leftover: 2, levelsGained: 0 });
  });

  it('stops at the level cap even with a huge pool', () => {
    const r = applyMergeCopies(9, 9999, 10);
    expect(r.newLevel).toBe(10);
    expect(r.levelsGained).toBe(1);
    expect(r.consumed).toBe(needCopiesForLevel(9));
    expect(r.leftover).toBe(9999 - needCopiesForLevel(9));
  });

  it('already at cap → no-op', () => {
    expect(applyMergeCopies(10, 100, 10)).toEqual({ newLevel: 10, consumed: 0, leftover: 100, levelsGained: 0 });
  });
});
