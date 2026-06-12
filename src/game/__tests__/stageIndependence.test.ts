import { describe, expect, it } from 'vitest';
import { DROP_CURRENT_STAGE_WEIGHT, ENTITY_COST_ANCHORS, ENTITY_BASE_COST_FACTOR, FUSION_BURST_REF_COST_FRAC } from '../balance';
import { pickDropStage, pickEntityByRarity, rollEntityDrop } from '../entities/drops';
import { consumeFusionInputs, pickFusionOutput } from '../entities/fusion';
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
  it('soft-caps power counts with a sqrt tail (time hard-caps)', () => {
    expect(getEffectiveCount(5, 20, false)).toBe(5);
    expect(getEffectiveCount(20, 20, false)).toBe(20);
    expect(getEffectiveCount(120, 20, false)).toBeCloseTo(20 + 10, 10);
    expect(getEffectiveCount(120, 20, true)).toBe(20);
    expect(getEffectiveCount(7, 0, false)).toBe(7); // uncapped entities
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
    expect(getEnhanceCost(s1Legendary, 1, 16)).toBeGreaterThan(getEnhanceCost(s1Legendary, 1, 1));
  });

  it('auto anchor follows the player stage, clamped at the item origin', () => {
    const s1Auto = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'auto')!;
    const atP1 = getAutoOutputAnchor(s1Auto, { stageId: 1, gateProgress01: 0 });
    const atP5 = getAutoOutputAnchor(s1Auto, { stageId: 5, gateProgress01: 0 });
    expect(atP5 / atP1).toBeCloseTo(Math.pow(8, 4), 5);
    // Late-origin item at player stage 1 clamps to its origin exponent.
    const s13Auto = STAGE_ENTITIES.find((e) => e.stageId === 13 && e.effect.type === 'auto')!;
    expect(getAutoOutputAnchor(s13Auto, { stageId: 1, gateProgress01: 0 }))
      .toBeCloseTo(getAutoOutputAnchor(s13Auto, { stageId: 13, gateProgress01: 0 }), 5);
  });

  it('emptying a stack via fusion resets its level (no near-free permanent levels)', () => {
    const target = getEntitiesForStage(1).filter((e) => e.rarity === 'common')[0];
    const { inventory } = consumeFusionInputs(
      [{ entityId: target.id, count: 3, level: 9, invested: 500 }],
      [target.id, target.id, target.id],
    );
    const entry = inventory.find((e) => e.entityId === target.id)!;
    expect(entry.count).toBe(0);
    expect(entry.level).toBe(1);
  });

  it('fusion burst scales with cost paid against the player-stage reference', () => {
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const input = commons[0];
    const mkState = (quanta: number): GameState => ({
      ...createInitialGameState(0),
      quanta,
      inventory: [{ entityId: input.id, count: 6, level: 1 }],
    });
    const inputs = [input.id, input.id, input.id];
    // Full reference cost: bank == anchor → costPaid = 0.1×anchor = refCost → scale 1.
    const fullRef = ENTITY_COST_ANCHORS[1];
    const rich = gameReducer(mkState(fullRef), {
      type: 'FUSE_ENTITIES', inputEntityIds: inputs, rarityRoll: 0.99, pickRoll: 0.1,
    });
    // Tiny bank → costPaid ≪ refCost → proportionally tiny burst.
    const poor = gameReducer(mkState(fullRef / 100), {
      type: 'FUSE_ENTITIES', inputEntityIds: inputs, rarityRoll: 0.99, pickRoll: 0.1,
    });
    const richBurst = rich.lastFusionEvent!.entropyBurst;
    const poorBurst = poor.lastFusionEvent!.entropyBurst;
    expect(poorBurst).toBeLessThan(richBurst);
    expect(poorBurst / richBurst).toBeCloseTo(1 / 100, 1);
    expect(FUSION_BURST_REF_COST_FRAC).toBeGreaterThan(0);
  });
});
