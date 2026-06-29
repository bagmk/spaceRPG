import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { STAGE_ENTITIES, getEntitiesForStage } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { getSecondaryStats } from '../entities/substats';
import { getEnhanceCost, getEnhanceLevelCap, getEnhanceStoneCost } from '../entities/enhance';
import { getRarityGateRamp, rollEntityDrop } from '../entities/drops';
import { getMaxFusionRarityIdx, rollFusionRarity, getFusionQuantaCost } from '../entities/fusion';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { defaultModifiers } from '../skills/effects';
import {
  ENHANCE_LEVEL_CAPS,
  ENHANCE_REFUND_RATE,
  ENHANCE_MATTER_PAYOUT_SUCCESS,
  RARITY_STAGE_GATES,
  SECONDARY_RARITY_COUNT,
  SECONDARY_STAT_POOLS,
  STAGE_POWER_BASE,
} from '../balance';
import { getEquipCategory } from '../entities/types';
import {
  applyFusionOutput,
  consumeFusionInputs,
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

  it('owned duplicate count does NOT strengthen power (stacking rework 2026-06-19)', () => {
    const item = STAGE_ENTITIES.find((e) => e.stageId === 1 && e.effect.type === 'click' && e.maxCount > 1)!;
    const one = defaultModifiers();
    const hoarded = defaultModifiers();
    applyEntityModifiers(one, [{ entityId: item.id, count: 1, level: 1 }], P(1));
    applyEntityModifiers(hoarded, [{ entityId: item.id, count: item.maxCount + 100, level: 1 }], P(1));
    // Power rides rarity + level + slots only — owning 1 or 100 copies is identical.
    expect(hoarded.clickPowerMult).toBeCloseTo(one.clickPowerMult, 10);
    expect(one.clickPowerMult).toBeGreaterThan(1); // a single copy still has power
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
    const up2Roll = rollFusionRarity('common', 0.0, 1); // roll inside the up2 window
    expect(up2Roll.rarity).toBe('rare');
    // Rare inputs at stage 1 are already at the cap — no upgrade possible.
    const capped = rollFusionRarity('rare', 0.0, 1);
    expect(capped.rarity).toBe('rare');
    expect(capped.rarityUp).toBe(false);
    // Late game: full ladder reaches mythic (idx 4) — legendary is droppable
    // (gate 12), so fusion can craft one tier above it (the fusion-only tier).
    expect(getMaxFusionRarityIdx(16)).toBe(4);
    // Mythic only becomes craftable once legendary drops (stage 12+).
    expect(getMaxFusionRarityIdx(11)).toBe(3);
  });
});

describe('enhancement (강화소)', () => {
  const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;

  it('P7b: merges need(L) spare copies to raise the anchor a level (no matter cost)', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 0, // no matter — merging is free, it consumes copies
      inventory: [
        { entityId: entity.id, instanceId: 'a', count: 1, level: 1 },
        { entityId: entity.id, instanceId: 'f1', count: 1, level: 1 },
        { entityId: entity.id, instanceId: 'f2', count: 1, level: 1 },
        { entityId: entity.id, instanceId: 'f3', count: 1, level: 1 }, // need(1)=3 fodder
      ],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a' });
    expect(next.inventory.find((e) => e.instanceId === 'a')?.level).toBe(2);
    expect(next.inventory.length).toBe(1); // the 3 spares were consumed
    expect(next.quanta).toBe(0); // free
    expect(next.lastEnhanceEvent?.mergedCount).toBe(3);
  });

  it('rejects when poor or at the rarity level cap', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      quanta: 0,
      inventory: [{ entityId: entity.id, count: 1, level: 1 }],
    };
    expect(gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: entity.id }).inventory[0].level).toBe(1);

    const capped: GameState = {
      ...createInitialGameState(0),
      quanta: 1e18,
      inventory: [{ entityId: entity.id, count: 1, level: ENHANCE_LEVEL_CAPS.common }],
    };
    expect(gameReducer(capped, { type: 'ENHANCE_ENTITY', instanceId: entity.id }).inventory[0].level)
      .toBe(ENHANCE_LEVEL_CAPS.common);
  });

  it('#8: ENHANCE with no spare copies uses the 강화석 escape (spends stones, mints no copy)', () => {
    const stoneCost = getEnhanceStoneCost(entity, 1);
    const state: GameState = {
      ...createInitialGameState(0),
      enhanceStones: stoneCost + 5,
      // one lone copy → no spares for a free merge → falls to the 강화석 escape valve.
      inventory: [{ entityId: entity.id, instanceId: 'a', count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a' });
    const anchor = next.inventory.find((e) => e.instanceId === 'a')!;
    expect(anchor.level).toBe(2); // leveled via 강화석
    expect(next.enhanceStones).toBe(5); // exactly stoneCost spent
    expect(next.inventory.filter((e) => e.entityId === entity.id).length).toBe(1); // no copy minted (buy removed)
  });

  it('#8: ENHANCE with no copies AND insufficient 강화석 is a no-op', () => {
    const stoneCost = getEnhanceStoneCost(entity, 1);
    const state: GameState = {
      ...createInitialGameState(0),
      enhanceStones: stoneCost - 1,
      inventory: [{ entityId: entity.id, instanceId: 'a', count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a' });
    expect(next.inventory.find((e) => e.instanceId === 'a')!.level).toBe(1); // unchanged
    expect(next.enhanceStones).toBe(stoneCost - 1); // no stones spent
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

// ── 강화 RISK phase + matter-bought protection (user "실패·파괴 부활 + 보호 아이템") ──
describe('enhancement RISK phase (fail / destroy / protection)', () => {
  const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;

  // Anchor at Lv2 so the next step (Lv2 → Lv3) LANDS on the risk threshold (3).
  // 5 spares ≥ SPECIAL_ENHANCE_CARD_COST (3), so the 특수강화 copy path is afforded.
  const riskyState = (extra: Partial<GameState> = {}): GameState => ({
    ...createInitialGameState(0),
    inventory: [
      { entityId: entity.id, instanceId: 'a', count: 1, level: 2 },
      ...Array.from({ length: 5 }, (_, k) => ({ entityId: entity.id, instanceId: `f${k}`, count: 1, level: 1 })),
    ],
    // 2026-06-28: 특수강화 now spends 강화석 + cards (both). Seed EXACTLY one step's stone cost
    // so post-spend is 0 — keeps the consolation-stone assertions (stonesEarned === final) exact.
    enhanceStones: getEnhanceStoneCost(entity, 2),
    ...extra,
  });

  it('Lv1→2 is guaranteed (below the threshold) — a forced-fail roll still succeeds', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      inventory: [
        { entityId: entity.id, instanceId: 'a', count: 1, level: 1 },
        ...Array.from({ length: 3 }, (_, k) => ({ entityId: entity.id, instanceId: `f${k}`, count: 1, level: 1 })),
      ],
    };
    // failRoll 0 would fail IF this were risky — but Lv1→2 is guaranteed, so it levels up.
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, useProtect: false });
    expect(next.inventory.find((e) => e.instanceId === 'a')?.level).toBe(2);
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('Lv2→3 (risk phase): a failed UNPROTECTED attempt DESTROYS the copy + mints 강화석', () => {
    const before = riskyState();
    // failRoll 0 < failChance → fail; destroyRoll 0 < ENHANCE_DESTROY_ON_FAIL (0.65) →
    // the DESTROY branch (not the neutral 유지); useProtect off → destroy.
    const next = gameReducer(before, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, destroyRoll: 0, breakRoll: 0.5, useProtect: false });
    expect(next.inventory.find((e) => e.instanceId === 'a')).toBeUndefined(); // destroyed
    expect(next.lastEnhanceEvent?.outcome).toBe('break');
    expect(next.enhanceStones).toBeGreaterThan(0); // consolation 강화석 minted
    expect(next.lastEnhanceEvent?.stonesEarned).toBe(next.enhanceStones);
    // 특수강화 (special enhance) pays a FLAT 3 cards: anchor + 3 consumed spares are
    // destroyed on the fail, leaving 2 of the original 5 spares (was: full wipe when the
    // copy cost equalled need(2)=5; the special path decouples cost from level).
    expect(next.inventory.filter((e) => e.entityId === entity.id).length).toBe(2);
  });

  it('Lv2→3 (risk phase): a fail with a high destroyRoll is the NEUTRAL 유지 — kept, no level, cost spent, no stones', () => {
    // failRoll 0 < failChance → fail; destroyRoll 0.99 ≥ ENHANCE_DESTROY_ON_FAIL (0.65) →
    // the neutral 유지 branch: the anchor SURVIVES at prevLevel, the copy cost (FLAT 3
    // cards) is consumed, NO 강화석 refunded, no level gained.
    const before = riskyState();
    const next = gameReducer(before, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, destroyRoll: 0.99, breakRoll: 0.5, useProtect: false });
    const anchor = next.inventory.find((e) => e.instanceId === 'a');
    expect(anchor).toBeDefined();        // survives
    expect(anchor?.level).toBe(2);       // kept at prevLevel, no level gain
    expect(next.lastEnhanceEvent?.outcome).toBe('fail');
    expect(next.enhanceStones).toBe(0);  // no consolation 강화석
    expect(next.enhanceProtectCharges).toBe(0); // no protection charge spent
    // FLAT 3 spares consumed, leaving 2 of the original 5 (anchor + 2 spares = 3 copies).
    expect(next.inventory.filter((e) => e.entityId === entity.id).length).toBe(3);
  });

  it('Lv2→3 (risk phase): a SUCCESSFUL attempt levels up like normal', () => {
    const before = riskyState();
    // failRoll 0.99 ≥ failChance → success.
    const next = gameReducer(before, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0.99, useProtect: false });
    expect(next.inventory.find((e) => e.instanceId === 'a')?.level).toBe(3);
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('protection absorbs a fail: spends ONE charge, the item SURVIVES unchanged', () => {
    const before = riskyState({ enhanceProtectCharges: 2 });
    const next = gameReducer(before, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, useProtect: true });
    // survives at the same level, one charge spent.
    const anchor = next.inventory.find((e) => e.instanceId === 'a');
    expect(anchor?.level).toBe(2); // no level gain
    expect(next.enhanceProtectCharges).toBe(1); // exactly one charge consumed
    expect(next.lastEnhanceEvent?.outcome).toBe('protected');
  });

  it('protection toggle ON but ZERO charges → a fail still destroys', () => {
    const before = riskyState({ enhanceProtectCharges: 0 });
    // destroyRoll 0 < ENHANCE_DESTROY_ON_FAIL → the DESTROY branch (no charge to absorb it).
    const next = gameReducer(before, { type: 'ENHANCE_ENTITY', instanceId: 'a', failRoll: 0, destroyRoll: 0, breakRoll: 0.5, useProtect: true });
    expect(next.inventory.find((e) => e.instanceId === 'a')).toBeUndefined(); // destroyed (no charge to spend)
    expect(next.lastEnhanceEvent?.outcome).toBe('break');
    expect(next.enhanceProtectCharges).toBe(0);
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

  it('P7b: a greedy merge climbs ONLY through the guaranteed band, stopping at the risk threshold', () => {
    const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;
    // Lv1→2 needs 3, Lv2→3 needs 5. Risk starts at the step LANDING on Lv3 (the threshold),
    // so the greedy merge climbs only Lv1→2 (guaranteed) and stops — the Lv2→3 step is a
    // separate, single, insurable risky attempt. 3 of the 8 spares are spent, 5 retained.
    const fodder = Array.from({ length: 8 }, (_, k) => ({ entityId: entity.id, instanceId: `f${k}`, count: 1, level: 1 }));
    const state: GameState = {
      ...createInitialGameState(0),
      inventory: [{ entityId: entity.id, instanceId: 'a', count: 1, level: 1 }, ...fodder],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a' });
    expect(next.inventory.find((e) => e.instanceId === 'a')?.level).toBe(2);
    expect(next.inventory.length).toBe(1 + 5); // anchor + 5 unspent spares
    expect(next.lastEnhanceEvent?.mergedCount).toBe(3);
  });

  it('P7b: not enough spare copies → enhance is a no-op', () => {
    const entity = getEntitiesForStage(1).find((e) => e.rarity === 'common')!;
    const state: GameState = {
      ...createInitialGameState(0),
      inventory: [
        { entityId: entity.id, instanceId: 'a', count: 1, level: 1 },
        { entityId: entity.id, instanceId: 'f1', count: 1, level: 1 }, // only 1 spare, need 3
      ],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'a' });
    expect(next.inventory.find((e) => e.instanceId === 'a')?.level).toBe(1);
    expect(next.inventory.length).toBe(2); // nothing consumed
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
    // quanta = start - cost + refund. 🅠1: common fusion cost = anchor[stage 1] × 0.04 (fixed).
    const fuseCost = getFusionQuantaCost('common', 1);
    expect(next.quanta).toBeCloseTo(1000 - fuseCost + expected, 3);
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
    // Fusion never levels up — the at-cap duplicate pays a refund and the
    // existing stack is returned untouched (still at the cap level).
    expect(result.capRefund).toBeGreaterThan(0);
    expect(result.inventory[0].level).toBe(ENHANCE_LEVEL_CAPS.common);
  });

  it('P7b: fusion output carries the lowest consumed input level', () => {
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const a = commons[0];
    const b = commons[1] ?? commons[0];
    // consume copies at levels [3, 5, 2] → minLevel 2 (lowest-first picks them all)
    const inv = [
      { entityId: a.id, instanceId: 'x1', count: 1, level: 3 },
      { entityId: a.id, instanceId: 'x2', count: 1, level: 5 },
      { entityId: b.id, instanceId: 'y1', count: 1, level: 2 },
    ];
    const { minLevel } = consumeFusionInputs(inv, [a.id, a.id, b.id]);
    expect(minLevel).toBe(2);
    // a freshly-minted output carries that level instead of resetting to Lv1
    const out = applyFusionOutput([], commons[2] ?? a, 1, undefined, minLevel);
    expect(out.inventory[out.inventory.length - 1].level).toBe(2);
    // …and Lv1 inputs still mint a plain Lv1 output (no inflation)
    const flat = consumeFusionInputs([
      { entityId: a.id, instanceId: 'z1', count: 1, level: 1 },
    ], [a.id]);
    expect(flat.minLevel).toBe(1);
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
      // mythic count (9) exceeds its category pool → the roll caps at the pool size (all stats).
      const poolLen = SECONDARY_STAT_POOLS[getEquipCategory(entity)].length;
      expect(stats.length).toBe(Math.min(SECONDARY_RARITY_COUNT[entity.rarity], poolLen));
      // Deterministic: a second call returns the same stats in the same order.
      expect(getSecondaryStats(entity)).toEqual(stats);
      // No duplicate stat types on one entity.
      expect(new Set(stats.map((s) => s.type)).size).toBe(stats.length);
      for (const stat of stats) expect(stat.value).toBeGreaterThan(0);
    }
  });

  it('P4: every entity including commons carries one signature specialty', () => {
    expect(SECONDARY_RARITY_COUNT.common).toBe(1);
    const commons = STAGE_ENTITIES.filter((e) => e.rarity === 'common');
    expect(commons.length).toBeGreaterThan(0);
    for (const c of commons) {
      const stats = getSecondaryStats(c);
      expect(stats.length).toBe(1);
      expect(stats[0].value).toBeGreaterThan(0);
    }
  });

  it('P4: common signatures never roll crit (keeps vacuum_decay reachable)', () => {
    // Equipping starter (common) gear must not silently forfeit the
    // never-equip-crit ending — crit stays reserved for deliberate rare+ rolls.
    for (const c of STAGE_ENTITIES.filter((e) => e.rarity === 'common')) {
      const sig = getSecondaryStats(c)[0];
      expect(sig.type).not.toBe('critChance');
      expect(sig.type).not.toBe('critMult');
    }
  });

  it('P4: commons in a stage+category have distinct signatures (round-robin)', () => {
    // R7: no two same-primary commons read identically. Round-robin assignment
    // guarantees distinctness up to the (crit-free) category pool size.
    const byBucket = new Map<string, Set<string>>();
    const counts = new Map<string, number>();
    for (const c of STAGE_ENTITIES.filter((e) => e.rarity === 'common')) {
      const cat = getEquipCategory(c);
      const key = `${c.stageId}:${cat}`;
      const sig = getSecondaryStats(c)[0].type;
      const set = byBucket.get(key) ?? new Set<string>();
      set.add(sig);
      byBucket.set(key, set);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Each padded stage has 5 click + 5 rift commons and a 5-type crit-free
    // pool per category, so every common in a bucket is distinct.
    for (const [key, set] of byBucket) {
      expect(set.size).toBe(counts.get(key));
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
