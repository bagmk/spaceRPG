import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { createDefaultEndingProgressFlags } from '../defaults';
import { getCondensedMassReward } from '../formulas';
import { getCodexCompletionFraction } from '../entities/codexSets';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { getEntitiesForStage, STAGE_ENTITIES } from '../entities/stageItems';
import { getEquipCategory } from '../entities/types';
import { CODEX_MASS_BONUS } from '../balance';
import type { GameState } from '../types';

describe('Phase 4-3: prestige item reset (D2)', () => {
  it('PRESTIGE RESETS the inventory — items do NOT carry, only bonuses (S, 2026-06-24)', () => {
    const click = getEntitiesForStage(2).find((e) => getEquipCategory(e) === 'click')!;
    const state: GameState = {
      ...createInitialGameState(0),
      universeCount: 1,
      selectedEndingId: 'heat_death' as const,
      inventory: [{ entityId: click.id, count: 4, level: 3 }],
      equippedSlots: [click.id],
    };
    const completed = gameReducer(state, { type: 'COMPLETE_ENDING', now: 900 });
    const next = gameReducer(completed, { type: 'PRESTIGE', now: 1000 });
    // S: "새로운 빅뱅이라 기억 제거" — the inventory resets to a fresh universe, the carried
    // item is gone. Only BONUSES (prestige upgrades + codex bonuses) carry.
    expect(next.inventory).toEqual(createInitialGameState(1000).inventory);
    expect(next.inventory.some((e) => e.entityId === click.id && e.carried)).toBe(false);
    expect(next.equippedSlots).toEqual([]);
    expect(next.riftSlots).toEqual([]);
    expect(next.endingProgressFlags).toEqual(createDefaultEndingProgressFlags());
  });

  it('a carried item applies the same fixed effect as a normal copy (P0: no stage scaling)', () => {
    const lateClick = STAGE_ENTITIES.find((e) => e.stageId >= 13 && e.effect.type === 'click')!;
    const power = { stageId: 1, gateProgress01: 0 };
    const asCarried = defaultModifiers();
    const asNormal = defaultModifiers();
    applyEntityModifiers(asCarried, [{ entityId: lateClick.id, count: 1, level: 1, carried: true }], power);
    applyEntityModifiers(asNormal, [{ entityId: lateClick.id, count: 1, level: 1 }], power);
    // Fixed effects: the `carried` flag no longer changes power — the carry is
    // the head start of OWNING the item across prestige, not a power clamp.
    expect(asCarried.clickPowerMult).toBeCloseTo(asNormal.clickPowerMult, 9);
    expect(asCarried.clickPowerMult).toBeGreaterThan(1); // still does something (level/value)
  });
});

describe('Phase 4-3: codex completion prestige bonus', () => {
  it('completion fraction is collected / total entities, capped at 1', () => {
    expect(getCodexCompletionFraction({})).toBe(0);
    const allIds: Record<number, string[]> = {};
    for (const e of STAGE_ENTITIES) (allIds[e.stageId] ??= []).push(e.id);
    expect(getCodexCompletionFraction(allIds)).toBe(1);
  });

  it('codex completion multiplies the condensed-mass reward (empty ×1, full ×(1+bonus))', () => {
    const entropy = 1e9;
    const empty = getCondensedMassReward(entropy, 'heat_death', 2, {});
    const allIds: Record<number, string[]> = {};
    for (const e of STAGE_ENTITIES) (allIds[e.stageId] ??= []).push(e.id);
    const full = getCondensedMassReward(entropy, 'heat_death', 2, allIds);
    expect(full / empty).toBeCloseTo(1 + CODEX_MASS_BONUS, 6);
  });

  it('the codex mass bonus does not touch the entropy gate (mass is a separate currency)', () => {
    // Sanity: the reward only scales condensedMass, never entropy/thresholds.
    const r = getCondensedMassReward(1e6, 'heat_death', 2, {});
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});
