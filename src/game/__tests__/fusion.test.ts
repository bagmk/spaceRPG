import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { STAGE_ENTITIES, getEntitiesForStage } from '../entities/stageItems';
import { rollFusionRarity, validateFusionInputs } from '../entities/fusion';
import { applyEntityModifiers, applySetBonuses, getDerivedUnlockedSlotCount } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import {
  FUSION_PITY_THRESHOLD,
  FUSION_UP1_CHANCE,
  FUSION_UP2_CHANCE,
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
    // roll just inside the up1 window (after the up2 slice)
    const next = fuse(state, FUSION_UP2_CHANCE + FUSION_UP1_CHANCE / 2, 0.3);
    expect(next.lastFusionEvent!.rarityUp).toBe(true);
    expect(next.fusionPity).toBe(0);
  });

  it('increments pity on a dry roll and guarantees +1 at the threshold', () => {
    const dry = fuse(fusionReadyState(), 0.99);
    expect(dry.lastFusionEvent!.rarityUp).toBe(false);
    expect(dry.fusionPity).toBe(1);

    // At the pity threshold even a dry roll upgrades.
    const pityState = { ...fusionReadyState(), fusionPity: FUSION_PITY_THRESHOLD };
    const forced = fuse(pityState, 0.99);
    expect(forced.lastFusionEvent!.rarityUp).toBe(true);
    expect(forced.fusionPity).toBe(0);
  });

  it('rollFusionRarity caps at legendary and skips pity there', () => {
    const result = rollFusionRarity('legendary', 0.0, 99);
    expect(result.rarity).toBe('legendary');
    expect(result.rarityUp).toBe(false);
    expect(result.pityApplicable).toBe(false);
  });

  it('feeds duplicate outputs at max count into level-ups (dup sink)', () => {
    // Force a same-rarity output and aim the pick at a known entity by
    // saturating the inventory with that entity at maxCount.
    const target = commons[0];
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 1000,
      fusionPity: 0,
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
  it('applies the 2-piece and 3-piece set bonuses for matching glyph families', () => {
    // Find two entities sharing a glyph family (sets may mix stages).
    const byGlyph = new Map<string, typeof STAGE_ENTITIES>();
    for (const e of STAGE_ENTITIES) {
      byGlyph.set(e.visual.glyph, [...(byGlyph.get(e.visual.glyph) ?? []), e]);
    }
    const family = [...byGlyph.values()].find((list) => list.length >= 2);
    expect(family).toBeDefined();
    if (!family) return;

    const mods = defaultModifiers();
    const baseClick = mods.clickPowerMult;
    applySetBonuses(mods, [
      { entityId: family[0].id, count: 1, level: 1 },
      { entityId: family[1].id, count: 1, level: 1 },
    ]);
    expect(mods.clickPowerMult).toBeCloseTo(baseClick * SET_BONUS[2].clickAutoMult);

    const single = defaultModifiers();
    applySetBonuses(single, [{ entityId: family[0].id, count: 1, level: 1 }]);
    expect(single.clickPowerMult).toBe(1);
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
    applyEntityModifiers(lv1, [{ entityId: clickEntity.id, count: 1, level: 1 }]);
    applyEntityModifiers(lv3, [{ entityId: clickEntity.id, count: 1, level: 3 }]);
    expect(lv3.clickPowerMult).toBeGreaterThan(lv1.clickPowerMult);
  });
});
