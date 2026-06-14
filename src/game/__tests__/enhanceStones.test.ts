import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { STAGE_ENTITIES } from '../entities/stageItems';
import {
  isEnhanceStonePhase,
  getEnhanceFailChance,
  getEnhanceStoneCost,
  isEnhanceDestroyEligible,
  getEnhanceLevelCap,
} from '../entities/enhance';
import {
  ENHANCE_FAIL_BASE,
  ENHANCE_FAIL_MAX,
  ENHANCE_STONE_BASE,
  ENHANCE_STONE_THRESHOLD,
} from '../balance';
import type { GameState } from '../types';

const common = STAGE_ENTITIES.find((e) => e.rarity === 'common')!;

function baseState(over: Partial<GameState>): GameState {
  // Low player stage so the player-anchored matter cost stays small/affordable;
  // stone costs are stage-independent so the stone tests are unaffected.
  return { ...createInitialGameState(0), stageIdx: 1, ...over };
}

describe('P1: 강화석 (enhance stones) two-phase enhancement', () => {
  it('Lv<5 spends matter and always succeeds (no stones)', () => {
    const s = baseState({ quanta: 1e12, inventory: [{ entityId: common.id, count: 1, level: 1 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 0, destroyRoll: 0 });
    expect(next.inventory[0].level).toBe(2);
    expect(next.quanta).toBeLessThan(1e12);
    expect(next.enhanceStones).toBe(0);
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('Lv≥5 success spends 강화석 (not matter) and levels up', () => {
    const s = baseState({ quanta: 1e9, enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 5 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 1, destroyRoll: 1 });
    expect(next.inventory[0].level).toBe(6);
    expect(next.enhanceStones).toBeLessThan(1000);
    expect(next.quanta).toBe(1e9);
    expect(next.inventory[0].investedStones ?? 0).toBeGreaterThan(0);
  });

  it('Lv≥5 failure drops a level, floored at the stone threshold', () => {
    const s = baseState({ enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 6 }] });
    const down = gameReducer(s, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 0, destroyRoll: 1 });
    expect(down.inventory[0].level).toBe(5);
    expect(down.lastEnhanceEvent?.outcome).toBe('down');
    // Never below the matter-bought line.
    const atFloor = baseState({ enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 5 }] });
    const floored = gameReducer(atFloor, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 0, destroyRoll: 1 });
    expect(floored.inventory[0].level).toBe(5);
  });

  it('protection negates a failed attempt (no loss, stones still spent)', () => {
    const s = baseState({ enhanceStones: 1000, inventory: [{ entityId: common.id, count: 1, level: 6 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 0, destroyRoll: 0, protect: true });
    expect(next.inventory[0].level).toBe(6);
    expect(next.enhanceStones).toBeLessThan(1000);
    expect(next.lastEnhanceEvent?.outcome).toBe('protected');
  });

  it('near the cap a failed attempt can destroy a copy (level resets)', () => {
    // common cap 10, destroy window 3 → eligible at Lv7+.
    const s = baseState({ enhanceStones: 1000, inventory: [{ entityId: common.id, count: 2, level: 9 }] });
    const next = gameReducer(s, { type: 'ENHANCE_ENTITY', entityId: common.id, failRoll: 0, destroyRoll: 0 });
    expect(next.inventory[0].count).toBe(1);
    expect(next.inventory[0].level).toBe(1);
    expect(next.lastEnhanceEvent?.outcome).toBe('break');
  });

  it('a failed fusion mints 강화석 (consolation)', () => {
    const s = baseState({ quanta: 1e9, inventory: [{ entityId: common.id, count: 3, level: 1 }] });
    const failed = gameReducer(s, { type: 'FUSE_ENTITIES', inputEntityIds: [common.id, common.id, common.id], rarityRoll: 0.99, pickRoll: 0.5, stageRoll: 0 });
    expect(failed.enhanceStones).toBeGreaterThan(0);
    expect(failed.lastFusionEvent?.stonesEarned).toBeGreaterThan(0);
  });
});

describe('P6: enhance fail / phase / destroy math (direct)', () => {
  const common = STAGE_ENTITIES.find((e) => e.rarity === 'common')!;
  const legendary = STAGE_ENTITIES.find((e) => e.rarity === 'legendary')!;

  it('two-currency phase boundary is exactly Lv5', () => {
    expect(isEnhanceStonePhase(4)).toBe(false); // last matter level
    expect(isEnhanceStonePhase(5)).toBe(true);  // first stone level
  });

  it('fail chance is 0 in the matter phase, then rises and saturates at the cap', () => {
    expect(getEnhanceFailChance(4)).toBe(0);
    expect(getEnhanceFailChance(ENHANCE_STONE_THRESHOLD)).toBeCloseTo(ENHANCE_FAIL_BASE);
    expect(getEnhanceFailChance(10)).toBeGreaterThan(getEnhanceFailChance(6));
    expect(getEnhanceFailChance(9999)).toBeCloseTo(ENHANCE_FAIL_MAX);
  });

  it('🅠1: stone cost is the flat rarity base at every stone level (growth 1.0)', () => {
    expect(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD)).toBe(ENHANCE_STONE_BASE.common);
    // Overhaul-2 🅠1: ENHANCE_STONE_GROWTH = 1.0 → every stone-phase level costs the same.
    expect(getEnhanceStoneCost(common, ENHANCE_STONE_THRESHOLD + 2)).toBe(ENHANCE_STONE_BASE.common);
  });

  it('destroy is only eligible within the window near the cap', () => {
    const cap = getEnhanceLevelCap(legendary);
    expect(isEnhanceDestroyEligible(legendary, cap - 1)).toBe(true);
    expect(isEnhanceDestroyEligible(legendary, ENHANCE_STONE_THRESHOLD)).toBe(false); // far from cap
  });
});
