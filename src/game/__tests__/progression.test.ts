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
  ENHANCE_REFUND_RATE,
  RARITY_STAGE_GATES,
  SECONDARY_RARITY_COUNT,
  SECONDARY_STAT_POOLS,
  STAGE_POWER_BASE,
} from '../balance';
import { getEquipCategory } from '../entities/types';
import {
  applyFusionOutput,
  getExpectedFusionRefund,
  pickFusionOutput,
} from '../entities/fusion';
import type { GameState } from '../types';

describe('gear power curve (player-stage anchored — Phase 4-1)', () => {
  const P = (stageId: number, gateProgress01 = 0) => ({ stageId, gateProgress01 });

  it('same item gains ×STAGE_POWER_BASE per player stage (stage independence)', () => {
    const item = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click')!;
    const at5 = defaultModifiers();
    const at6 = defaultModifiers();
    applyEntityModifiers(at5, [{ entityId: item.id, count: 1, level: 1 }], P(5));
    applyEntityModifiers(at6, [{ entityId: item.id, count: 1, level: 1 }], P(6));
    expect((at6.clickPowerMult - 1) / (at5.clickPowerMult - 1)).toBeCloseTo(STAGE_POWER_BASE, 5);
  });

  it('origin stage no longer matters: per-point power is equal at one player context', () => {
    const early = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click')!;
    const late = STAGE_ENTITIES.find((e) => e.stageId >= 13 && e.effect.type === 'click')!;
    const modsEarly = defaultModifiers();
    const modsLate = defaultModifiers();
    applyEntityModifiers(modsEarly, [{ entityId: early.id, count: 1, level: 1 }], P(16));
    applyEntityModifiers(modsLate, [{ entityId: late.id, count: 1, level: 1 }], P(16));
    const perPointEarly = (modsEarly.clickPowerMult - 1) / early.effect.value;
    const perPointLate = (modsLate.clickPowerMult - 1) / late.effect.value;
    expect(perPointLate / perPointEarly).toBeCloseTo(1, 5);
  });

  it('gateProgress01 is the fractional exponent (in-stage acceleration)', () => {
    const item = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click')!;
    const atStart = defaultModifiers();
    const atGate = defaultModifiers();
    applyEntityModifiers(atStart, [{ entityId: item.id, count: 1, level: 1 }], P(5, 0));
    applyEntityModifiers(atGate, [{ entityId: item.id, count: 1, level: 1 }], P(5, 1));
    expect((atGate.clickPowerMult - 1) / (atStart.clickPowerMult - 1)).toBeCloseTo(STAGE_POWER_BASE, 5);
  });

  it('items never fall below their origin-stage power (migration is a strict buff)', () => {
    const late = STAGE_ENTITIES.find((e) => e.stageId >= 13 && e.effect.type === 'click')!;
    const atP1 = defaultModifiers();
    const atOrigin = defaultModifiers();
    applyEntityModifiers(atP1, [{ entityId: late.id, count: 1, level: 1 }], P(1));
    applyEntityModifiers(atOrigin, [{ entityId: late.id, count: 1, level: 1 }], P(late.stageId));
    // At player stage 1 the item clamps to its origin exponent — same output.
    expect(atP1.clickPowerMult).toBeCloseTo(atOrigin.clickPowerMult, 10);
  });

  it('keeps crit chance (capped resource) off the curve', () => {
    const flat = STAGE_ENTITIES.find((e) => e.effect.type === 'crit' && e.effect.isFlat)!;
    const at1 = defaultModifiers();
    const at16 = defaultModifiers();
    applyEntityModifiers(at1, [{ entityId: flat.id, count: 1, level: 1 }], P(flat.stageId));
    applyEntityModifiers(at16, [{ entityId: flat.id, count: 1, level: 1 }], P(16));
    expect(at16.critChanceAdd).toBeCloseTo(at1.critChanceAdd, 10);
  });

  it('soft-caps the power contribution of hoarded counts (sqrt tail past maxCount)', () => {
    const item = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click' && e.maxCount > 1)!;
    const atCap = defaultModifiers();
    const hoarded = defaultModifiers();
    applyEntityModifiers(atCap, [{ entityId: item.id, count: item.maxCount, level: 1 }], P(1));
    applyEntityModifiers(hoarded, [{ entityId: item.id, count: item.maxCount + 100, level: 1 }], P(1));
    const capPower = atCap.clickPowerMult - 1;
    const hoardPower = hoarded.clickPowerMult - 1;
    // More than the cap, but far less than linear: cap + sqrt(100) = cap + 10.
    expect(hoardPower).toBeGreaterThan(capPower);
    expect(hoardPower / capPower).toBeCloseTo((item.maxCount + 10) / item.maxCount, 5);
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
    const cost = getEnhanceCost(entity, 1, 1);
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
    applyEntityModifiers(lv1, [{ entityId: clickEntity.id, count: 1, level: 1 }], { stageId: 1, gateProgress01: 0 });
    applyEntityModifiers(lv5, [{ entityId: clickEntity.id, count: 1, level: 5 }], { stageId: 1, gateProgress01: 0 });
    expect(lv5.clickPowerMult).toBeGreaterThan(lv1.clickPowerMult);
  });
});

describe('gear system (category purity + refunds)', () => {
  it('substats are category-pure: click gear never rolls auto stats and vice versa', () => {
    for (const entity of STAGE_ENTITIES) {
      const pool = SECONDARY_STAT_POOLS[getEquipCategory(entity)];
      for (const stat of getSecondaryStats(entity)) {
        expect(pool).toContain(stat.type);
      }
    }
  });

  it("multiplier (click gear) no longer leaks into the auto calculation", () => {
    const multiplierEntity = STAGE_ENTITIES.find((e) => e.effect.type === 'multiplier')!;
    const mods = defaultModifiers();
    applyEntityModifiers(mods, [{ entityId: multiplierEntity.id, count: 1, level: 1 }], { stageId: 1, gateProgress01: 0 });
    expect(mods.clickPowerMult).toBeGreaterThan(1);
    // autoRateMult may only move via an autoPct substat — impossible for click gear now.
    expect(mods.autoRateMult).toBe(1);
  });

  it('ENHANCE_ENTITY accumulates invested quanta on the stack', () => {
    const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;
    const cost1 = getEnhanceCost(entity, 1, 1);
    const cost2 = getEnhanceCost(entity, 2, 1);
    let state: GameState = {
      ...createInitialGameState(0),
      quanta: cost1 + cost2 + 10,
      inventory: [{ entityId: entity.id, count: 1, level: 1 }],
    };
    state = gameReducer(state, { type: 'ENHANCE_ENTITY', entityId: entity.id });
    state = gameReducer(state, { type: 'ENHANCE_ENTITY', entityId: entity.id });
    expect(state.inventory[0].level).toBe(3);
    expect(state.inventory[0].invested).toBeCloseTo(cost1 + cost2, 5);
  });

  it('fusing enhanced copies refunds part of the investment (UI estimate matches payout)', () => {
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const input = commons[0];
    const invested = 900;
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 1000,
      inventory: [{ entityId: input.id, count: 3, level: 4, invested }],
    };
    const inputIds = [input.id, input.id, input.id];
    const expected = getExpectedFusionRefund(state.inventory, inputIds);
    expect(expected).toBeCloseTo(invested * ENHANCE_REFUND_RATE, 5);

    const next = gameReducer(state, {
      type: 'FUSE_ENTITIES', inputEntityIds: inputIds, rarityRoll: 0.99, pickRoll: 0.1,
    });
    expect(next.lastFusionEvent!.refund).toBeCloseTo(expected, 5);
    // quanta = start - 10% cost + refund (event may add nothing else at this roll)
    expect(next.quanta).toBeCloseTo(1000 - 100 + expected, 3);
    // remaining stack keeps no stale investment (all copies consumed)
    const remaining = next.inventory.find((e) => e.entityId === input.id);
    expect(remaining?.invested ?? 0).toBeCloseTo(0, 5);
  });

  it('at-cap duplicates refund instead of vanishing', () => {
    const target = getEntitiesForStage(1).filter((e) => e.rarity === 'common')[0];
    const result = applyFusionOutput(
      [{ entityId: target.id, count: Math.max(1, target.maxCount), level: ENHANCE_LEVEL_CAPS.common }],
      target,
      1,
    );
    expect(result.leveledUp).toBe(false);
    expect(result.capRefund).toBeGreaterThan(0);
  });

  it('same-category inputs guarantee a same-category fusion output', () => {
    // Every pick roll at a late stage must stay in the rift category.
    for (let i = 0; i < 25; i++) {
      const out = pickFusionOutput(10, 'rare', i / 25, { category: 'rift' });
      expect(out).not.toBeNull();
      expect(getEquipCategory(out!)).toBe('rift');
    }
    for (let i = 0; i < 25; i++) {
      const out = pickFusionOutput(10, 'rare', i / 25, { category: 'click' });
      expect(out).not.toBeNull();
      expect(getEquipCategory(out!)).toBe('click');
    }
  });

  it('offlineEff substat feeds offlineGainMult', () => {
    const carrier = STAGE_ENTITIES.find((e) =>
      getSecondaryStats(e).some((sub) => sub.type === 'offlineEff'),
    );
    expect(carrier).toBeDefined();
    if (!carrier) return;
    const mods = defaultModifiers();
    applyEntityModifiers(mods, [{ entityId: carrier.id, count: 1, level: 1 }], { stageId: 1, gateProgress01: 0 });
    expect(mods.offlineGainMult).toBeGreaterThan(1);
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
    applyEntityModifiers(mods, [{ entityId: carriers[0].id, count: 1, level: 1 }], { stageId: 1, gateProgress01: 0 });
    const moved =
      mods.dropChanceMult !== 1 || mods.entropyGainMult !== 1 || mods.fusionBurstMult !== 1;
    expect(moved).toBe(true);
  });
});
