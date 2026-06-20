import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { STAGE_ENTITIES } from '../entities/stageItems';
import {
  isEnhanceStonePhase,
  getEnhanceFailChance,
  getEnhanceStoneCost,
  getEnhanceProtectStoneCost,
  getEnhanceBreakStoneReward,
} from '../entities/enhance';
import {
  ENHANCE_FAIL_BASE,
  ENHANCE_FAIL_MAX,
  ENHANCE_STONE_BASE,
  ENHANCE_STONE_GROWTH,
  ENHANCE_STONE_THRESHOLD,
  ENHANCE_BREAK_STONE_MIN,
  ENHANCE_BREAK_STONE_MAX,
} from '../balance';
import type { GameState } from '../types';

const common = STAGE_ENTITIES.find((e) => e.rarity === 'common')!;

function baseState(over: Partial<GameState>): GameState {
  // Low player stage so the player-anchored matter cost stays small/affordable;
  // stone costs are stage-independent so the stone tests are unaffected.
  return { ...createInitialGameState(0), stageIdx: 1, ...over };
}

describe('#47: matter-only enhance + risk phase (강화석 = protect / break refund)', () => {
  it('Lv<3 spends matter only and always succeeds (no stones)', () => {
    const s = baseState({ quanta: 1e12, inventory: [{ entityId: common.id, count: 1, level: 1 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: common.id, failRoll: 0 });
    expect(next.inventory[0].level).toBe(2);
    expect(next.quanta).toBeLessThan(1e12);
    expect(next.enhanceStones).toBe(0);
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('Lv≥3 success spends MATTER ONLY (no 강화석) and levels up', () => {
    const s = baseState({ quanta: 1e9, enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 5 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: common.id, failRoll: 1 });
    expect(next.inventory[0].level).toBe(6);
    expect(next.quanta).toBeLessThan(1e9);    // matter spent
    expect(next.enhanceStones).toBe(1000);    // stones untouched on an unprotected success
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('Lv≥3 unprotected failure DESTROYS that specific copy, leaving the others intact (P6)', () => {
    const s = baseState({
      quanta: 1e9,
      enhanceStones: 0,
      inventory: [
        { entityId: common.id, instanceId: 'a', count: 1, level: 6 },
        { entityId: common.id, instanceId: 'b', count: 1, level: 6 },
      ],
    });
    const fail = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, stoneRoll: 0 });
    expect(fail.inventory).toHaveLength(1);            // the targeted copy is gone
    expect(fail.inventory[0].instanceId).toBe('b');    // the OTHER copy survives…
    expect(fail.inventory[0].level).toBe(6);           // …at its own level (per-copy)
    expect(fail.quanta).toBe(1e9);                     // no matter charged on a break
    expect(fail.enhanceStones).toBe(getEnhanceBreakStoneReward(common, 0)); // random refund (min at roll 0)
    expect(fail.lastEnhanceEvent?.outcome).toBe('break');
    expect(fail.lastEnhanceEvent?.stonesEarned).toBe(getEnhanceBreakStoneReward(common, 0));
  });

  it('destroying the LAST copy drops the entry and clears its slots', () => {
    const s = baseState({
      quanta: 1e9,
      enhanceStones: 0,
      inventory: [{ entityId: common.id, count: 1, level: 6 }],
      equippedSlots: [common.id],
    });
    const fail = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: common.id, failRoll: 0, stoneRoll: 0.5 });
    expect(fail.inventory.find((e) => e.entityId === common.id)).toBeUndefined();
    expect(fail.equippedSlots).not.toContain(common.id);
    expect(fail.enhanceStones).toBeGreaterThan(0);
  });

  it('보호(protect) negates a failed attempt — item kept, only protect stones spent', () => {
    const protectCost = getEnhanceProtectStoneCost(common, 6);
    const s = baseState({ quanta: 1e9, enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 6 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: common.id, failRoll: 0, protect: true });
    expect(next.inventory[0].level).toBe(6);              // no level change
    expect(next.inventory[0].count).toBe(1);              // not destroyed
    expect(next.enhanceStones).toBe(1000 - protectCost);  // only the protect cost
    expect(next.lastEnhanceEvent?.outcome).toBe('protected');
  });

  it('rejects a protected attempt when 강화석 are short', () => {
    const s = baseState({ quanta: 1e9, enhanceStones: 0, inventory: [{ entityId: common.id, count: 1, level: 6 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', instanceId: common.id, failRoll: 0, protect: true });
    expect(next).toBe(s); // unaffordable → no-op
  });

  it('a failed fusion mints 강화석 (consolation)', () => {
    const s = baseState({ quanta: 1e9, inventory: [{ entityId: common.id, count: 3, level: 1 }] });
    const failed = gameReducer(s, { type: 'FUSE_ENTITIES', inputEntityIds: [common.id, common.id, common.id], rarityRoll: 0.99, pickRoll: 0.5, stageRoll: 0 });
    expect(failed.enhanceStones).toBeGreaterThan(0);
    expect(failed.lastFusionEvent?.stonesEarned).toBeGreaterThan(0);
  });
});

describe('#47: enhance fail / phase / break-reward math (direct)', () => {
  const common = STAGE_ENTITIES.find((e) => e.rarity === 'common')!;
  const legendary = STAGE_ENTITIES.find((e) => e.rarity === 'legendary')!;

  it('risk-phase boundary is exactly Lv3 (#40)', () => {
    expect(isEnhanceStonePhase(ENHANCE_STONE_THRESHOLD - 1)).toBe(false); // last safe matter level
    expect(isEnhanceStonePhase(ENHANCE_STONE_THRESHOLD)).toBe(true);      // first risk level
  });

  it('fail chance is 0 below the threshold, then rises and saturates at the cap', () => {
    expect(getEnhanceFailChance(ENHANCE_STONE_THRESHOLD - 1)).toBe(0);
    expect(getEnhanceFailChance(ENHANCE_STONE_THRESHOLD)).toBeCloseTo(ENHANCE_FAIL_BASE);
    expect(getEnhanceFailChance(10)).toBeGreaterThan(getEnhanceFailChance(ENHANCE_STONE_THRESHOLD + 1));
    expect(getEnhanceFailChance(9999)).toBeCloseTo(ENHANCE_FAIL_MAX);
  });

  it('Overhaul-3: protect-stone cost climbs geometrically (ENHANCE_STONE_GROWTH=1.5) above the threshold', () => {
    // At the threshold it is exactly the rarity base; each further risk level ×1.5.
    expect(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD)).toBe(ENHANCE_STONE_BASE.common);
    expect(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD + 2))
      .toBe(Math.ceil(ENHANCE_STONE_BASE.common * ENHANCE_STONE_GROWTH ** 2));
    // Strictly increasing across risk levels.
    expect(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD + 3))
      .toBeGreaterThan(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD + 1));
  });

  it('break-stone reward stays within the rarity range and rises with rarity', () => {
    for (const ent of [common, legendary]) {
      const min = ENHANCE_BREAK_STONE_MIN[ent.rarity];
      const max = ENHANCE_BREAK_STONE_MAX[ent.rarity];
      expect(getEnhanceBreakStoneReward(ent, 0)).toBe(min);
      expect(getEnhanceBreakStoneReward(ent, 0.999999)).toBe(max);
      const mid = getEnhanceBreakStoneReward(ent, 0.5);
      expect(mid).toBeGreaterThanOrEqual(min);
      expect(mid).toBeLessThanOrEqual(max);
    }
    expect(getEnhanceBreakStoneReward(legendary, 0)).toBeGreaterThan(getEnhanceBreakStoneReward(common, 0));
  });
});
