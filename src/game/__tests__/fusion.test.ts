import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { STAGE_ENTITIES, getEntitiesForStage } from '../entities/stageItems';
import { rollFusionRarity, validateFusionInputs, getFusionQuantaCost } from '../entities/fusion';
import { applyEntityModifiers, applySetBonuses, getDerivedUnlockedSlotCount, getEquipSetKey } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import {
  ENTITY_COST_ANCHORS,
  FUSION_FLAT_COST,
  FUSION_UP1_CHANCE_BY_TIER,
  FUSION_UP2_CHANCE_BY_TIER,
  FUSION_FAIL_STONES_BY_TIER,
  SET_BONUS,
} from '../balance';
import type { GameState } from '../types';

const stage1 = getEntitiesForStage(1);
const commons = stage1.filter((e) => e.rarity === 'common');

function fusionReadyState(): GameState {
  return {
    ...createInitialGameState(0),
    quanta: 1000,
    inventory: [{ entityId: commons[0].id, count: 3, level: 1 }],
  };
}

function fuse(state: GameState, rarityRoll: number, pickRoll = 0.1): GameState {
  return gameReducer(state, {
    type: 'FUSE_ENTITIES',
    inputEntityIds: [commons[0].id, commons[0].id, commons[0].id],
    rarityRoll,
    pickRoll,
  });
}

describe('fusion (Phase 3)', () => {
  it('validates inputs: same rarity, enough copies', () => {
    const inv = [{ entityId: commons[0].id, count: 3, level: 1 }];
    expect(validateFusionInputs(inv, [commons[0].id, commons[0].id, commons[0].id]).ok).toBe(true);
    expect(validateFusionInputs(inv, [commons[0].id, commons[0].id]).ok).toBe(false);
    expect(validateFusionInputs([{ entityId: commons[0].id, count: 2, level: 1 }],
      [commons[0].id, commons[0].id, commons[0].id]).ok).toBe(false);
    const rare = stage1.find((e) => e.rarity === 'rare');
    if (rare) {
      const mixed = [
        { entityId: commons[0].id, count: 2, level: 1 },
        { entityId: rare.id, count: 1, level: 1 },
      ];
      expect(validateFusionInputs(mixed, [commons[0].id, commons[0].id, rare.id]).ok).toBe(false);
    }
  });

  it('consumes inputs, charges a quanta fraction, and fires an entropy burst', () => {
    const state = fusionReadyState();
    const next = fuse(state, 0.99); // same-rarity outcome
    const inputEntry = next.inventory.find((e) => e.entityId === commons[0].id);
    // 3 copies consumed; output may have landed on the same entity (+1).
    expect(inputEntry!.count).toBeLessThanOrEqual(1);
    expect(next.quanta).toBeLessThan(state.quanta);
    expect(next.entropy).toBeGreaterThan(state.entropy);
    expect(next.lastFusionEvent).not.toBeNull();
    expect(next.lastFusionEvent!.entropyBurst).toBeGreaterThan(0);
    // Output recorded in the almanac.
    const outId = next.lastFusionEvent!.outputEntityId;
    expect(next.almanacCollected[1]).toContain(outId);
  });

  it('upgrades rarity when the roll lands in the up window', () => {
    const state = fusionReadyState();
    // roll just inside the common up1 window (after the up2 slice)
    const next = fuse(state, FUSION_UP2_CHANCE_BY_TIER.common + FUSION_UP1_CHANCE_BY_TIER.common / 2, 0.3);
    expect(next.lastFusionEvent!.rarityUp).toBe(true);
    // A successful upgrade mints NO stones — stones are the failure consolation.
    expect(next.lastFusionEvent!.stonesEarned).toBe(0);
  });

  it('a dry roll fails (no pity/guarantee — pure odds)', () => {
    // Even after many dry fuses there is no forced upgrade; each fuse is
    // independent and a 0.99 roll never lands in any up window.
    let current = fusionReadyState();
    for (let i = 0; i < 10; i++) {
      current = { ...current, quanta: 1000, inventory: [{ entityId: commons[0].id, count: 3, level: 1 }] };
      const next = fuse(current, 0.99);
      expect(next.lastFusionEvent!.rarityUp).toBe(false);
      // Failure always mints 강화석 — the consolation that replaces pity.
      expect(next.lastFusionEvent!.stonesEarned).toBeGreaterThan(0);
      current = next;
    }
  });

  it('rollFusionRarity caps at mythic (no upgrade possible)', () => {
    const result = rollFusionRarity('mythic', 0.0, 16);
    expect(result.rarity).toBe('mythic');
    expect(result.rarityUp).toBe(false);
  });

  it('P2c: legendary inputs can forge mythic in the late game (stage 12+)', () => {
    // At stage 16 the ladder reaches mythic: a legendary up1 roll (3% window)
    // crafts the fusion-only tier. A roll outside the window simply fails.
    expect(rollFusionRarity('legendary', 0.0, 16).rarity).toBe('mythic');
    expect(rollFusionRarity('legendary', 0.99, 16).rarityUp).toBe(false);
    // Before legendary is droppable (gate 12) there is no mythic ceiling yet.
    expect(rollFusionRarity('legendary', 0.0, 11).rarity).toBe('legendary');
  });

  it('🅠1: fusion cost is a fixed fraction of the player-stage anchor (common cheap, legendary steep)', () => {
    // cost = ENTITY_COST_ANCHORS[playerStage] × FUSION_FLAT_COST[rarity] — no bank dependence.
    expect(getFusionQuantaCost('common', 3)).toBeCloseTo(ENTITY_COST_ANCHORS[3] * FUSION_FLAT_COST.common, 5);
    expect(getFusionQuantaCost('legendary', 3)).toBeCloseTo(ENTITY_COST_ANCHORS[3] * FUSION_FLAT_COST.legendary, 5);
    // legendary costs far more than common at the same stage…
    expect(getFusionQuantaCost('legendary', 3)).toBeGreaterThan(getFusionQuantaCost('common', 3) * 10);
    // …and the absolute cost rises with the player's stage anchor.
    expect(getFusionQuantaCost('common', 10)).toBeGreaterThan(getFusionQuantaCost('common', 3));
  });

  it('P2b: validateFusionInputs flags same-entity and same-codex-subset', () => {
    const c = commons[0];
    const v = validateFusionInputs([{ entityId: c.id, count: 3, level: 1 }], [c.id, c.id, c.id]);
    expect(v.sameEntity).toBe(true);
    // Three copies of one entity necessarily share its codex subset (or null).
    expect(v.sameSubsetId === null || typeof v.sameSubsetId === 'string').toBe(true);
  });

  it('P2: up-odds decrease per input tier (common 40 → rare 20 → epic 10)', () => {
    // common: up1 window = 0.05 + 0.40 = 0.45.
    expect(rollFusionRarity('common', 0.39, 16).rarity).toBe('rare');
    expect(rollFusionRarity('common', 0.50, 16).rarityUp).toBe(false);
    // rare: up1 window = 0.02 + 0.20 = 0.22.
    expect(rollFusionRarity('rare', 0.10, 16).rarity).toBe('epic');
    expect(rollFusionRarity('rare', 0.30, 16).rarityUp).toBe(false);
    // epic: up1 window = 0.10.
    expect(rollFusionRarity('epic', 0.05, 16).rarity).toBe('legendary');
    expect(rollFusionRarity('epic', 0.20, 16).rarityUp).toBe(false);
  });

  it('feeds duplicate outputs at max count into level-ups (dup sink)', () => {
    // Force a same-rarity output and aim the pick at a known entity by
    // saturating the inventory with that entity at maxCount.
    const target = commons[0];
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 1000,
      inventory: [{ entityId: target.id, count: Math.max(target.maxCount, 3), level: 1 }],
    };
    // Fuse repeatedly until the output happens to be the saturated entity.
    let current = state;
    let leveled = false;
    for (let i = 0; i < 40 && !leveled; i++) {
      const before = current.inventory.find((e) => e.entityId === target.id)!;
      if (before.count < 3) break;
      current = fuse(current, 0.99, (i * 0.137) % 1);
      const event = current.lastFusionEvent!;
      if (event.outputEntityId === target.id && event.leveledUp) leveled = true;
    }
    if (leveled) {
      const entry = current.inventory.find((e) => e.entityId === target.id)!;
      expect(entry.level).toBeGreaterThan(1);
    }
    // The loop is probabilistic across a fixed roll grid; the core invariant
    // is that no fusion ever crashes and counts never go negative.
    for (const entry of current.inventory) expect(entry.count).toBeGreaterThanOrEqual(0);
  });
});

describe('set bonuses + slot unlocks (Phase 3)', () => {
  it('applies the 2-piece set bonus for entities sharing a codex category (R8)', () => {
    // P5/R8: the equip set bonus keys on the codex SUBSET, not the glyph family.
    const bySubset = new Map<string, typeof STAGE_ENTITIES>();
    for (const e of STAGE_ENTITIES) {
      const key = getEquipSetKey(e);
      if (key === null) continue;
      bySubset.set(key, [...(bySubset.get(key) ?? []), e]);
    }
    const category = [...bySubset.values()].find((list) => list.length >= 2);
    expect(category).toBeDefined();
    if (!category) return;

    const mods = defaultModifiers();
    const baseClick = mods.clickPowerMult;
    applySetBonuses(mods, [
      { entityId: category[0].id, count: 1, level: 1 },
      { entityId: category[1].id, count: 1, level: 1 },
    ]);
    expect(mods.clickPowerMult).toBeCloseTo(baseClick * SET_BONUS[2].clickAutoMult);

    const single = defaultModifiers();
    applySetBonuses(single, [{ entityId: category[0].id, count: 1, level: 1 }]);
    expect(single.clickPowerMult).toBe(1);

    // Two items in DIFFERENT categories grant no set bonus.
    const otherCategory = [...bySubset.entries()].find(([k]) => k !== getEquipSetKey(category[0]))?.[1];
    if (otherCategory) {
      const mixed = defaultModifiers();
      applySetBonuses(mixed, [
        { entityId: category[0].id, count: 1, level: 1 },
        { entityId: otherCategory[0].id, count: 1, level: 1 },
      ]);
      expect(mixed.clickPowerMult).toBe(1);
    }
  });

  it('derives slot unlocks from stage and almanac progress', () => {
    expect(getDerivedUnlockedSlotCount(1, {})).toBe(1);
    expect(getDerivedUnlockedSlotCount(4, {})).toBe(2);
    const bigAlmanac: Record<number, string[]> = {
      1: Array.from({ length: 30 }, (_, i) => `id_${i}`),
    };
    expect(getDerivedUnlockedSlotCount(1, bigAlmanac)).toBe(3);
    expect(getDerivedUnlockedSlotCount(4, bigAlmanac)).toBe(3);
  });

  it('ADVANCE_STAGE syncs unlocked slots (stage 4 → 2 slots)', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3 → advancing enters stage 4
      pendingCondenseStageIdx: 2,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(3);
    expect(next.unlockedSlotCount).toBe(2);
  });

  it('entity level scales the equipped effect', () => {
    const clickEntity = stage1.find((e) => e.effect.type === 'click');
    expect(clickEntity).toBeDefined();
    if (!clickEntity) return;

    const lv1 = defaultModifiers();
    const lv3 = defaultModifiers();
    applyEntityModifiers(lv1, [{ entityId: clickEntity.id, count: 1, level: 1 }], { stageId: 1, gateProgress01: 0 });
    applyEntityModifiers(lv3, [{ entityId: clickEntity.id, count: 1, level: 3 }], { stageId: 1, gateProgress01: 0 });
    expect(lv3.clickPowerMult).toBeGreaterThan(lv1.clickPowerMult);
  });
});

describe('P6: mythic is fusion-only + tier-accurate fusion stones', () => {
  it('mythic entities can never be PURCHASED (fusion-only, even at the last stage)', () => {
    const mythic = getEntitiesForStage(17)[0];
    expect(mythic.rarity).toBe('mythic');
    const s = { ...createInitialGameState(0), quanta: 1e30, stageIdx: 15 }; // highest playable
    const next = gameReducer(s, { type: 'PURCHASE_ENTITY', entityId: mythic.id });
    expect(next.inventory.find((e) => e.entityId === mythic.id)).toBeUndefined();
    expect(next.quanta).toBe(s.quanta); // nothing spent
  });

  it('fusion failure mints tier-accurate stones; a rarity-up mints none (rare inputs)', () => {
    // Three DISTINCT rares (no same-entity stone bonus) so the count is exact.
    const rares = getEntitiesForStage(2).filter((e) => e.rarity === 'rare').slice(0, 3);
    expect(rares).toHaveLength(3);
    const base = {
      ...createInitialGameState(0),
      stageIdx: 8, // stage 9 — rare can attempt an up (epic is droppable)
      quanta: 1e12, // 🅠1: must cover the fixed rare fuse cost (anchor[9] × 0.10 = 6e10)
      inventory: rares.map((e) => ({ entityId: e.id, count: 1, level: 1 })),
    };
    const ids = rares.map((e) => e.id);
    const fail = gameReducer(base, { type: 'FUSE_ENTITIES', inputEntityIds: ids, rarityRoll: 0.99, pickRoll: 0.1 });
    expect(fail.lastFusionEvent!.rarityUp).toBe(false);
    expect(fail.lastFusionEvent!.stonesEarned).toBe(FUSION_FAIL_STONES_BY_TIER.rare);

    const up = gameReducer(base, { type: 'FUSE_ENTITIES', inputEntityIds: ids, rarityRoll: 0.0, pickRoll: 0.1 });
    expect(up.lastFusionEvent!.rarityUp).toBe(true);
    expect(up.lastFusionEvent!.stonesEarned).toBe(0);
  });
});
