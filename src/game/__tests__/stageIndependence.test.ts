import { describe, expect, it } from 'vitest';
import { DROP_CURRENT_STAGE_WEIGHT, ENTITY_COST_ANCHORS, ENTITY_BASE_COST_FACTOR, FUSION_BURST_REF_COST_FRAC } from '../balance';
import { pickDropStage, pickEntityByRarity, rollEntityDrop } from '../entities/drops';
import { consumeFusionInputs, getFusionQuantaCost, pickFusionOutput } from '../entities/fusion';
import { getEffectiveCount, getAutoOutputAnchor } from '../entities/effects';
import { getEntityCost, getPlayerAnchoredBaseCost } from '../entities/types';
import { getEnhanceCost } from '../entities/enhance';
import { getEntitiesForStage, STAGE_ENTITIES } from '../entities/stageItems';
import { createInitialGameState, gameReducer } from '../reducer';
import type { GameState } from '../types';

describe('Phase 4-1: drop/fusion stage pools', () => {
  it('pickDropStage: below the weight stays current; above backfills a past stage', () => {
    expect(pickDropStage(10, DROP_CURRENT_STAGE_WEIGHT - 0.01, {})).toBe(10);
    const past = pickDropStage(10, DROP_CURRENT_STAGE_WEIGHT + 0.01, {});
    expect(past).toBeGreaterThanOrEqual(1);
    expect(past).toBeLessThan(10);
    // Stage 1 has no past — always current.
    expect(pickDropStage(1, 0.99, {})).toBe(1);
  });

  it('pickDropStage: codex-backfill weighting pulls drops toward uncollected stages', () => {
    // Everything collected except stage 3 → past rolls should heavily favor 3.
    const allCollected: Record<number, string[]> = {};
    for (let s = 1; s < 10; s++) {
      allCollected[s] = s === 3 ? [] : getEntitiesForStage(s).map((e) => e.id);
    }
    let hits3 = 0;
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const roll = DROP_CURRENT_STAGE_WEIGHT + ((1 - DROP_CURRENT_STAGE_WEIGHT) * i) / samples;
      if (pickDropStage(10, roll, allCollected) === 3) hits3++;
    }
    // Stage 3 carries (14 uncollected + 1) weight vs 1 for each of the other 8.
    expect(hits3 / samples).toBeGreaterThan(0.5);
  });

  it('past-stage pools exclude time entities (cosmic clock is stage-relative)', () => {
    const timeStage = STAGE_ENTITIES.find((e) => e.effect.type === 'time')?.stageId;
    if (timeStage === undefined) return; // no time entities authored anymore
    for (let i = 0; i < 40; i++) {
      const picked = pickEntityByRarity(timeStage, 'common', i / 40, true);
      if (picked) expect(picked.effect.type).not.toBe('time');
    }
  });

  it('rollEntityDrop without a stageRoll stays on the current stage (legacy callers)', () => {
    for (let i = 0; i < 20; i++) {
      const drop = rollEntityDrop(5, 1, { roll: 0, pickRoll: i / 20 });
      expect(drop?.stageId).toBe(5);
    }
  });

  it('fusion outputs can come from any past stage and respect the time exclusion', () => {
    for (let i = 0; i < 25; i++) {
      const out = pickFusionOutput(3, 'rare', i / 25, {}, true);
      expect(out).not.toBeNull();
      expect(out!.stageId).toBe(3);
      expect(out!.effect.type).not.toBe('time');
    }
  });
});

describe('Phase 4-1: economy re-anchors', () => {
  it('power is count-independent — owned duplicates never strengthen it (time hard-caps)', () => {
    // STACKING REWORK (2026-06-19): any owned copy contributes exactly 1.
    expect(getEffectiveCount(5, 20, false)).toBe(1);
    expect(getEffectiveCount(20, 20, false)).toBe(1);
    expect(getEffectiveCount(120, 20, false)).toBe(1);
    expect(getEffectiveCount(7, 0, false)).toBe(1);  // even "uncapped" entities → 1
    expect(getEffectiveCount(0, 20, false)).toBe(0);  // unowned → 0
    expect(getEffectiveCount(120, 20, true)).toBe(20); // time keeps its cosmic-clock cap
  });

  it('past-stage items re-price to the player anchor (no 15-orders arbitrage)', () => {
    const s1Legendary = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.rarity === 'legendary')
      ?? STAGE_ENTITIES.find((e) => e.stageId === 1)!;
    // On its own stage: authored price.
    expect(getPlayerAnchoredBaseCost(s1Legendary, 1)).toBe(s1Legendary.baseCost);
    // At stage 16: player-anchor price.
    const rePriced = getPlayerAnchoredBaseCost(s1Legendary, 16);
    expect(rePriced).toBeGreaterThanOrEqual(
      Math.floor(ENTITY_COST_ANCHORS[16] * ENTITY_BASE_COST_FACTOR[s1Legendary.rarity]),
    );
    expect(getEntityCost(s1Legendary, 0, 16)).toBeGreaterThanOrEqual(rePriced);
    // Enhance cost is STAGE-INDEPENDENT (Overhaul-2 follow-up): the SHOP buy
    // price (getEntityCost) still re-anchors to the player stage, but enhancing
    // a given item costs the same regardless of the player's stage.
    expect(getEnhanceCost(s1Legendary, 1, 16)).toBe(getEnhanceCost(s1Legendary, 1, 1));
  });

  it('auto anchor is fixed across player stages (P0: per-stage scaling removed)', () => {
    const s1Auto = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'auto')!;
    const atP1 = getAutoOutputAnchor(s1Auto, { stageId: 1, gateProgress01: 0 });
    const atP5 = getAutoOutputAnchor(s1Auto, { stageId: 5, gateProgress01: 0 });
    // base^E collapsed to 1.0 — the anchor no longer grows with the player stage.
    expect(atP5 / atP1).toBeCloseTo(1, 5);
    // A late-origin item is likewise stage-invariant now.
    const s13Auto = STAGE_ENTITIES.find((e) => e.stageId === 13 && e.effect.type === 'auto')!;
    expect(getAutoOutputAnchor(s13Auto, { stageId: 1, gateProgress01: 0 }))
      .toBeCloseTo(getAutoOutputAnchor(s13Auto, { stageId: 13, gateProgress01: 0 }), 5);
  });

  it('P6: fusing away every copy drops the entry entirely (no near-free permanent levels)', () => {
    const target = getEntitiesForStage(1).filter((e) => e.rarity === 'common')[0];
    const { inventory } = consumeFusionInputs(
      [{ entityId: target.id, count: 3, level: 9, invested: 500 }],
      [target.id, target.id, target.id],
    );
    // Flat model: a fully-consumed entry is removed, so a future drop starts fresh
    // at Lv1 — the leveled copy can never resurrect as a near-free pre-leveled drop.
    expect(inventory.find((e) => e.entityId === target.id)).toBeUndefined();
  });

  it('🅠1: fusion cost is a fixed per-era price — burst is bank-independent + gated on affordability', () => {
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const input = commons[0];
    const mkState = (quanta: number): GameState => ({
      ...createInitialGameState(0),
      quanta,
      inventory: [{ entityId: input.id, count: 6, level: 1 }],
    });
    const inputs = [input.id, input.id, input.id];
    // Fixed cost = anchor[1] × FUSION_FLAT_COST.common (no bank dependence).
    const cost = getFusionQuantaCost('common', 1);
    // A bank that just covers the cost and a far richer bank → identical burst.
    const justEnough = gameReducer(mkState(cost), {
      type: 'FUSE_ENTITIES', inputEntityIds: inputs, rarityRoll: 0.99, pickRoll: 0.1,
    });
    const rich = gameReducer(mkState(cost * 1000), {
      type: 'FUSE_ENTITIES', inputEntityIds: inputs, rarityRoll: 0.99, pickRoll: 0.1,
    });
    expect(justEnough.lastFusionEvent!.entropyBurst).toBeCloseTo(rich.lastFusionEvent!.entropyBurst, 5);
    // A bank below the fixed cost cannot fuse at all (affordability guard).
    const poor = gameReducer(mkState(cost * 0.5), {
      type: 'FUSE_ENTITIES', inputEntityIds: inputs, rarityRoll: 0.99, pickRoll: 0.1,
    });
    expect(poor.lastFusionEvent).toBeFalsy();
    expect(FUSION_BURST_REF_COST_FRAC).toBeGreaterThan(0);
  });
});
