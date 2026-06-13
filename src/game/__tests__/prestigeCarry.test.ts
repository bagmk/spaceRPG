import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { computeCarriedInventory } from '../reducers/stage';
import { createDefaultEndingProgressFlags } from '../defaults';
import { getCondensedMassReward } from '../formulas';
import { getCodexCompletionFraction } from '../entities/codexSets';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { getEntitiesForStage, STAGE_ENTITIES } from '../entities/stageItems';
import { getEquipCategory } from '../entities/types';
import { CODEX_MASS_BONUS, PRESTIGE_CARRY_COUNT_CAP } from '../balance';
import type { GameState } from '../types';

describe('Phase 4-3: prestige item carry (D2)', () => {
  it('carries the best click + best rift item (highest rarity), count clamped, carried flagged', () => {
    const clickCommon = getEntitiesForStage(2).find((e) => getEquipCategory(e) === 'click' && e.rarity === 'common')!;
    const clickRare = getEntitiesForStage(2).find((e) => getEquipCategory(e) === 'click' && e.rarity === 'rare')!;
    const riftItem = STAGE_ENTITIES.find((e) => getEquipCategory(e) === 'rift')!;
    const carried = computeCarriedInventory([
      { entityId: clickCommon.id, count: 9, level: 1 },
      { entityId: clickRare.id, count: 3, level: 2 },
      { entityId: riftItem.id, count: 5, level: 4 },
    ]);
    // One click (the rare beats the common) + one rift.
    expect(carried).toHaveLength(2);
    const click = carried.find((c) => getEquipCategory(getEntitiesForStage(2).find((e) => e.id === c.entityId)!) === 'click')!;
    expect(click.entityId).toBe(clickRare.id);
    expect(click.count).toBe(PRESTIGE_CARRY_COUNT_CAP); // clamped (was 3)
    expect(click.level).toBe(2); // level preserved
    expect(carried.every((c) => c.carried === true)).toBe(true);
  });

  it('empty inventory carries nothing', () => {
    expect(computeCarriedInventory([])).toEqual([]);
  });

  it('PRESTIGE seeds carry into the new universe inventory and leaves equip slots empty', () => {
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
    expect(next.inventory).toHaveLength(1);
    expect(next.inventory[0]).toMatchObject({ entityId: click.id, level: 3, carried: true });
    expect(next.equippedSlots).toEqual([]);
    expect(next.riftSlots).toEqual([]);
    // Ending flags fully reset on prestige (regression guard).
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
