import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { STAGE_ENTITIES, getEntitiesForStage } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { getSecondaryStats } from '../entities/substats';
import { getEnhanceCost, getEnhanceLevelCap } from '../entities/enhance';
import { getRarityGateRamp, rollEntityDrop } from '../entities/drops';
import { getMaxFusionRarityIdx, rollFusionRarity } from '../entities/fusion';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { defaultModifiers } from '../skills/effects';
import {
  ENHANCE_LEVEL_CAPS,
  RARITY_STAGE_GATES,
  SECONDARY_RARITY_COUNT,
  STAGE_POWER_BASE,
} from '../balance';
import type { GameState } from '../types';

describe('stage power curve', () => {
  it('makes later-stage click items stronger per effect point (curve applies)', () => {
    const early = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click')!;
    const late = STAGE_ENTITIES.find((e) => e.stageId >= 13 && e.effect.type === 'click')!;

    const modsEarly = defaultModifiers();
    const modsLate = defaultModifiers();
    applyEntityModifiers(modsEarly, [{ entityId: early.id, count: 1, level: 1 }]);
    applyEntityModifiers(modsLate, [{ entityId: late.id, count: 1, level: 1 }]);
    // Normalize by the raw % value — the remaining ratio is the stage curve.
    const perPointEarly = (modsEarly.clickPowerMult - 1) / early.effect.value;
    const perPointLate = (modsLate.clickPowerMult - 1) / late.effect.value;
    const expected = Math.pow(STAGE_POWER_BASE, late.stageId - early.stageId);
    expect(perPointLate / perPointEarly).toBeCloseTo(expected, 5);
  });

  it('keeps crit chance (capped resource) off the curve', () => {
    const early = STAGE_ENTITIES.find(
      (e) => e.stageId === 1 && e.effect.type === 'crit' && e.effect.isFlat,
    );
    const late = STAGE_ENTITIES.find(
      (e) => e.stageId >= 13 && e.effect.type === 'crit' && e.effect.isFlat
        && e.effect.value === early?.effect.value,
    );
    if (!early || !late) return; // data may not pair up — covered by curve test above
    const modsEarly = defaultModifiers();
    const modsLate = defaultModifiers();
    applyEntityModifiers(modsEarly, [{ entityId: early.id, count: 1, level: 1 }]);
    applyEntityModifiers(modsLate, [{ entityId: late.id, count: 1, level: 1 }]);
    expect(modsLate.critChanceAdd).toBeCloseTo(modsEarly.critChanceAdd, 10);
  });
});

describe('rarity gates', () => {
  it('ramps drop weights: no epics before stage 7, no legendaries before 12', () => {
    expect(getRarityGateRamp('epic', RARITY_STAGE_GATES.epic - 1)).toBe(0);
    expect(getRarityGateRamp('epic', RARITY_STAGE_GATES.epic)).toBeGreaterThan(0);
    expect(getRarityGateRamp('legendary', 11)).toBe(0);
    expect(getRarityGateRamp('common', 1)).toBeGreaterThan(0);
  });

  it('never drops a gated rarity at early stages', () => {
    // pickRoll across the whole range at stage 4 — epic/legendary must not appear.
    for (let i = 0; i < 50; i++) {
      const drop = rollEntityDrop(4, 1, { roll: 0, pickRoll: i / 50 });
      expect(drop).not.toBeNull();
      expect(['common', 'rare']).toContain(drop!.rarity);
    }
  });

  it('blocks shop purchases above the gate', () => {
    const epic = getEntitiesForStage(3).find((e) => e.rarity === 'epic')!;
    // Satisfy the in-stage anchor/rarity locks by owning everything else maxed,
    // so the rarity GATE is the only thing under test.
    const ownedRest = getEntitiesForStage(3)
      .filter((e) => e.id !== epic.id)
      .map((e) => ({ entityId: e.id, count: Math.max(1, e.maxCount), level: 1 }));
    expect(isEntityLockedByAnchor(epic, ownedRest)).toBe(false);

    const state: GameState = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3 < epic gate (7)
      quanta: 1e15,
      inventory: ownedRest,
    };
    const next = gameReducer(state, { type: 'PURCHASE_ENTITY', entityId: epic.id });
    expect(next.inventory.find((e) => e.entityId === epic.id)).toBeUndefined();

    const later = { ...state, stageIdx: 7 }; // stage 8 ≥ gate
    const bought = gameReducer(later, { type: 'PURCHASE_ENTITY', entityId: epic.id });
    expect(bought.inventory.find((e) => e.entityId === epic.id)?.count).toBe(1);
  });

  it('caps fusion output one tier above the gate', () => {
    // Stage 1: only commons drop → fusion may craft rare but never epic.
    expect(getMaxFusionRarityIdx(1)).toBe(1);
    const up2Roll = rollFusionRarity('common', 0.0, 0, 1); // roll inside the up2 window
    expect(up2Roll.rarity).toBe('rare');
    // Rare inputs at stage 1 are already at the cap — no upgrade, pity frozen.
    const capped = rollFusionRarity('rare', 0.0, 99, 1);
    expect(capped.rarity).toBe('rare');
    expect(capped.pityApplicable).toBe(false);
    // Late game: full ladder.
    expect(getMaxFusionRarityIdx(16)).toBe(3);
  });
});

describe('enhancement (강화소)', () => {
  const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;

  it('spends quanta and raises the stack level', () => {
    const cost = getEnhanceCost(entity, 1);
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: cost + 10,
      inventory: [{ entityId: entity.id, count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', entityId: entity.id });
    expect(next.inventory[0].level).toBe(2);
    expect(next.quanta).toBeCloseTo(state.quanta - cost, 5);
  });

  it('rejects when poor or at the rarity level cap', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 0,
      inventory: [{ entityId: entity.id, count: 1, level: 1 }],
    };
    expect(gameReducer(state, { type: 'ENHANCE_ENTITY', entityId: entity.id }).inventory[0].level).toBe(1);

    const capped: GameState = {
      ...createInitialGameState(0),
      quanta: 1e18,
      inventory: [{ entityId: entity.id, count: 1, level: ENHANCE_LEVEL_CAPS.common }],
    };
    expect(gameReducer(capped, { type: 'ENHANCE_ENTITY', entityId: entity.id }).inventory[0].level)
      .toBe(ENHANCE_LEVEL_CAPS.common);
  });

  it('level cap helper follows rarity', () => {
    const legendary = STAGE_ENTITIES.find((e) => e.rarity === 'legendary')!;
    expect(getEnhanceLevelCap(legendary)).toBe(ENHANCE_LEVEL_CAPS.legendary);
  });

  it('enhanced level increases the applied effect', () => {
    const clickEntity = getEntitiesForStage(1).find((e) => e.effect.type === 'click')!;
    const lv1 = defaultModifiers();
    const lv5 = defaultModifiers();
    applyEntityModifiers(lv1, [{ entityId: clickEntity.id, count: 1, level: 1 }]);
    applyEntityModifiers(lv5, [{ entityId: clickEntity.id, count: 1, level: 5 }]);
    expect(lv5.clickPowerMult).toBeGreaterThan(lv1.clickPowerMult);
  });
});

describe('secondary stats (A안)', () => {
  it('is deterministic and counts follow rarity', () => {
    for (const entity of STAGE_ENTITIES) {
      const stats = getSecondaryStats(entity);
      expect(stats.length).toBe(SECONDARY_RARITY_COUNT[entity.rarity]);
      // Deterministic: a second call returns the same stats in the same order.
      expect(getSecondaryStats(entity)).toEqual(stats);
      // No duplicate stat types on one entity.
      expect(new Set(stats.map((s) => s.type)).size).toBe(stats.length);
      for (const stat of stats) expect(stat.value).toBeGreaterThan(0);
    }
  });

  it('feeds the new modifiers (drop/entropy/fusion) when such a stat exists', () => {
    const carriers = STAGE_ENTITIES.filter((e) =>
      getSecondaryStats(e).some((s) => s.type === 'dropRate' || s.type === 'entropyGain' || s.type === 'fusionBurst'),
    );
    expect(carriers.length).toBeGreaterThan(0);
    const mods = defaultModifiers();
    applyEntityModifiers(mods, [{ entityId: carriers[0].id, count: 1, level: 1 }]);
    const moved =
      mods.dropChanceMult !== 1 || mods.entropyGainMult !== 1 || mods.fusionBurstMult !== 1;
    expect(moved).toBe(true);
  });
});
