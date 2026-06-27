import { describe, expect, it } from 'vitest';
import { DROP_CURRENT_STAGE_WEIGHT, ENTITY_COST_ANCHORS, ENTITY_BASE_COST_FACTOR, FUSION_BURST_REF_COST_FRAC } from '../balance';
import { pickDropStage, pickEntityByRarity, rollEntityDrop } from '../entities/drops';
import { consumeFusionInputs, getFusionQuantaCost, pickFusionOutput } from '../entities/fusion';
import { getEffectiveCount, getAutoOutputAnchor, getTameAutoOutputAnchor } from '../entities/effects';
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
    // Everything collected except stage 3 → past rolls should still favor 3 the
    // most, even though P6 recency affinity dampens its (distant) weight.
    const allCollected: Record<number, string[]> = {};
    for (let s = 1; s < 10; s++) {
      allCollected[s] = s === 3 ? [] : getEntitiesForStage(s).map((e) => e.id);
    }
    const hits: Record<number, number> = {};
    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const roll = DROP_CURRENT_STAGE_WEIGHT + ((1 - DROP_CURRENT_STAGE_WEIGHT) * i) / samples;
      const s = pickDropStage(10, roll, allCollected);
      hits[s] = (hits[s] ?? 0) + 1;
    }
    // The lone hole (stage 3) is the single most-hit past stage by a clear margin.
    const others = Object.entries(hits).filter(([s]) => Number(s) !== 3 && Number(s) !== 10);
    const maxOther = Math.max(0, ...others.map(([, n]) => n));
    expect(hits[3] ?? 0).toBeGreaterThan(maxOther);
    expect((hits[3] ?? 0) / samples).toBeGreaterThan(0.35);
  });

  it('pickDropStage: P6 recency affinity favors nearer past stages (no holes)', () => {
    // All collected → weight is affinity-only; nearer stages must out-draw far ones.
    const allCollected: Record<number, string[]> = {};
    for (let s = 1; s < 10; s++) allCollected[s] = getEntitiesForStage(s).map((e) => e.id);
    const hits: Record<number, number> = {};
    const samples = 400;
    for (let i = 0; i < samples; i++) {
      const roll = DROP_CURRENT_STAGE_WEIGHT + ((1 - DROP_CURRENT_STAGE_WEIGHT) * i) / samples;
      const s = pickDropStage(10, roll, allCollected);
      hits[s] = (hits[s] ?? 0) + 1;
    }
    // Nearest past stage (9) draws strictly more than a distant one (1) — and 1 still > 0 (floor).
    expect(hits[9] ?? 0).toBeGreaterThan(hits[1] ?? 0);
    expect(hits[1] ?? 0).toBeGreaterThan(0);
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

  it('auto WALLET anchor is ITEM-anchored (player-stage-invariant); grows with the item, not the stage', () => {
    // GEAR-DRIVEN ECONOMY (2026-06-22, user): auto income is anchored to the ITEM's
    // own baseCost, NOT the player's current stage — advancing stages no longer
    // free-inflates auto; equipping a BETTER (higher-origin) item does. The
    // ENTROPY-feeding anchor (getTameAutoOutputAnchor) stays stage-1-pinned.
    const s1Auto = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'auto')!;
    const atP1 = getAutoOutputAnchor(s1Auto, { stageId: 1, gateProgress01: 0 });
    const atP5 = getAutoOutputAnchor(s1Auto, { stageId: 5, gateProgress01: 0 });
    // SAME item, different player stage → identical wallet anchor (no stage inflation).
    expect(atP5).toBeCloseTo(atP1, 5);
    // A higher-origin item pays MORE — the wallet anchor tracks the item's baseCost.
    // The income SCALE cancels in this ratio, so it must equal the baseCost ratio exactly
    // (up to FP). Assert RELATIVE closeness — the ratio is ~1e13, where toBeCloseTo's absolute
    // 5-decimal tolerance is far tighter than the magnitude's FP rounding allows.
    const s13Auto = STAGE_ENTITIES.find((e) => e.stageId === 13 && e.effect.type === 'auto')!;
    const anchorRatio = getAutoOutputAnchor(s13Auto, { stageId: 1, gateProgress01: 0 }) / atP1;
    const costRatio = s13Auto.baseCost / s1Auto.baseCost;
    expect(Math.abs(anchorRatio / costRatio - 1)).toBeLessThan(1e-9);
    // The TAME entropy anchor is player-stage-invariant (gate untouched).
    expect(getTameAutoOutputAnchor(s1Auto, { stageId: 5, gateProgress01: 0 }))
      .toBeCloseTo(getTameAutoOutputAnchor(s1Auto, { stageId: 1, gateProgress01: 0 }), 5);
    expect(getTameAutoOutputAnchor(s13Auto, { stageId: 1, gateProgress01: 0 }))
      .toBeCloseTo(getTameAutoOutputAnchor(s13Auto, { stageId: 13, gateProgress01: 0 }), 5);
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
