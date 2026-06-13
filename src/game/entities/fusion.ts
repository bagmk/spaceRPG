/**
 * Fusion / gacha system (entity redesign Phase 3).
 *
 * Feed FUSION_INPUT_COUNT copies of one rarity + a quanta cost into the forge;
 * out comes a weighted-random entity of the same stage with a chance to jump
 * one or two rarities (pity guarantees an upgrade after a dry streak — D4).
 * Every fusion fires an entropy burst, wiring active play into the
 * progression gate. Duplicate outputs at max count become level-ups instead
 * of being wasted. Tunables live in balance.ts (FUSION_*).
 */

import {
  ENHANCE_REFUND_RATE,
  ENHANCE_STONE_REFUND_RATE,
  ENTROPY_FUSION_COST_FRAC,
  ENTROPY_FUSION_VALUE_SEC,
  ENTROPY_W_AUTO,
  ENTROPY_W_CLICK,
  FUSION_CAP_DUP_REFUND_FRAC,
  FUSION_FAMILY_BIAS,
  FUSION_COST_RARITY_MULT,
  FUSION_INPUT_COUNT,
  FUSION_PITY_THRESHOLD_BY_TIER,
  FUSION_REF_CPS,
  FUSION_UP1_CHANCE_BY_TIER,
  FUSION_UP2_CHANCE_BY_TIER,
  FUSION_UP_CHANCE_CAP,
  RARITY_STAGE_GATES,
} from '../balance';
import { getSetKey } from './effects';
import { getCodexSubsetIdForEntity } from './codexSets';
import { getEntitiesForStage, findEntityById } from './stageItems';
import { pickEntityByRarity } from './drops';
import { getEnhanceLevelCap } from './enhance';
import { getEquipCategory, getPlayerAnchoredBaseCost, type EntityInstance, type EntityRarity, type EquipCategory, type StageEntity } from './types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface FusionValidation {
  ok: boolean;
  rarity?: EntityRarity;
  /**
   * Highest stage among the inputs. Since Phase 4-1 the OUTPUT pool stage is
   * rolled via pickDropStage (player-stage weighted) instead — this field
   * survives for validation/UI only.
   */
  stageId?: number;
  /** Set when ALL inputs share a gear category — the output stays in it. */
  category?: EquipCategory;
  /** Set when ALL inputs share a glyph family — biases the output toward it. */
  familyKey?: string;
  /** All three inputs are the SAME entity id (P2b same-entity bonus). */
  sameEntity?: boolean;
  /** Set when ALL inputs share one codex subset/category (P2b same-category bonus). */
  sameSubsetId?: string | null;
}

/**
 * Inputs are valid when there are exactly FUSION_INPUT_COUNT ids, every id is
 * owned with enough copies (ids may repeat), and all share one rarity.
 */
export function validateFusionInputs(
  inventory: EntityInstance[],
  inputEntityIds: string[],
): FusionValidation {
  if (inputEntityIds.length !== FUSION_INPUT_COUNT) return { ok: false };

  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);

  let rarity: EntityRarity | undefined;
  let stageId = 0;
  let category: EquipCategory | undefined;
  let mixedCategory = false;
  let familyKey: string | undefined;
  let mixedFamily = false;
  for (const [id, count] of needed) {
    const entity = findEntityById(id);
    if (!entity) return { ok: false };
    const owned = inventory.find((e) => e.entityId === id);
    if (!owned || owned.count < count) return { ok: false };
    if (rarity === undefined) rarity = entity.rarity;
    else if (entity.rarity !== rarity) return { ok: false };
    stageId = Math.max(stageId, entity.stageId);
    const entityCategory = getEquipCategory(entity);
    if (category === undefined) category = entityCategory;
    else if (category !== entityCategory) mixedCategory = true;
    const family = getSetKey(entity);
    if (familyKey === undefined) familyKey = family;
    else if (familyKey !== family) mixedFamily = true;
  }
  // Same-entity (all 3 ids identical) + same-codex-subset bonuses (P2b).
  const sameEntity = needed.size === 1;
  const subs = [...needed.keys()].map((id) => {
    const e = findEntityById(id);
    return e ? getCodexSubsetIdForEntity(e) : null;
  });
  const firstSub = subs[0];
  const sameSubsetId = firstSub !== null && subs.every((s) => s === firstSub) ? firstSub : null;
  return {
    ok: true,
    rarity,
    stageId,
    category: mixedCategory ? undefined : category,
    familyKey: mixedFamily ? undefined : familyKey,
    sameEntity,
    sameSubsetId,
  };
}

export interface FusionRarityRoll {
  rarity: EntityRarity;
  rarityUp: boolean;
  /** False when the inputs were already legendary (no upgrade possible). */
  pityApplicable: boolean;
}

/**
 * Highest rarity fusion can produce at this stage: one tier above what drops
 * (gates) — fusion is always the way to reach the next tier early.
 */
export function getMaxFusionRarityIdx(stageId: number): number {
  let droppable = 0;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    if ((RARITY_STAGE_GATES[RARITY_ORDER[i]] ?? 1) <= stageId) droppable = i;
  }
  return Math.min(RARITY_ORDER.length - 1, droppable + 1);
}

/**
 * Resolve the output rarity from the input rarity, a 0..1 roll, the pity
 * counter, and the PLAYER stage's fusion rarity cap (gate + 1). stageId is
 * required — a silent =16 default would skip the cap for any missed caller.
 */
export function rollFusionRarity(
  inputRarity: EntityRarity,
  roll: number,
  pity: number,
  stageId: number,
  sameEntityBonus = 0,
): FusionRarityRoll {
  const idx = RARITY_ORDER.indexOf(inputRarity);
  const maxIdx = getMaxFusionRarityIdx(stageId);
  if (idx >= RARITY_ORDER.length - 1 || idx >= maxIdx) {
    // No upgrade possible (legendary inputs, or inputs already at the stage cap).
    return { rarity: inputRarity, rarityUp: false, pityApplicable: false };
  }
  const up1c = FUSION_UP1_CHANCE_BY_TIER[inputRarity];
  const up2c = FUSION_UP2_CHANCE_BY_TIER[inputRarity];
  const pityThr = FUSION_PITY_THRESHOLD_BY_TIER[inputRarity] || Infinity;
  const up2 = roll < up2c && idx + 2 <= maxIdx;
  const up1 = roll < Math.min(FUSION_UP_CHANCE_CAP, up2c + up1c + sameEntityBonus);
  const pityForced = pity >= pityThr;
  if (up2) return { rarity: RARITY_ORDER[idx + 2], rarityUp: true, pityApplicable: true };
  if (up1 || pityForced) return { rarity: RARITY_ORDER[idx + 1], rarityUp: true, pityApplicable: true };
  return { rarity: inputRarity, rarityUp: false, pityApplicable: true };
}

export interface FusionOutputBias {
  /** Same-category inputs guarantee a same-category output (스펙 §7). */
  category?: EquipCategory;
  /** Same-family inputs keep the output in that family FUSION_FAMILY_BIAS of the time. */
  familyKey?: string;
}

/**
 * Pick the output entity for a resolved rarity. Category is a hard filter
 * (falls back to the unfiltered pool only when the stage has no candidate);
 * family is a probabilistic bias derived from the same pick roll.
 * `excludeTime` removes time-type entities (past-stage output pools).
 */
export function pickFusionOutput(
  stageId: number,
  rarity: EntityRarity,
  pick01: number,
  bias: FusionOutputBias = {},
  excludeTime = false,
): StageEntity | null {
  let pool = getEntitiesForStage(stageId);
  if (excludeTime) pool = pool.filter((e) => e.effect.type !== 'time');
  if (pool.length === 0) return null;

  let candidates = pool.filter((e) => e.rarity === rarity);
  if (candidates.length === 0) return pickEntityByRarity(stageId, rarity, pick01, excludeTime);

  if (bias.category) {
    const sameCategory = candidates.filter((e) => getEquipCategory(e) === bias.category);
    if (sameCategory.length > 0) candidates = sameCategory;
  }
  if (bias.familyKey) {
    const familyRoll = (pick01 * 7919) % 1;
    if (familyRoll < FUSION_FAMILY_BIAS) {
      const sameFamily = candidates.filter((e) => getSetKey(e) === bias.familyKey);
      if (sameFamily.length > 0) candidates = sameFamily;
    }
  }
  const index = Math.floor(((pick01 * 9973) % 1) * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Quanta consumed by one fusion — a fixed fraction of the current bank (sink). */
export function getFusionQuantaCost(rarity: EntityRarity, quanta: number): number {
  if (!Number.isFinite(quanta) || quanta <= 0) return 0;
  const mult = FUSION_COST_RARITY_MULT[rarity] ?? 1;
  return Math.min(quanta, quanta * ENTROPY_FUSION_COST_FRAC * mult);
}

/**
 * Entropy burst for one fusion ≈ ENTROPY_FUSION_VALUE_SEC seconds of entropy
 * income at the reference click rate (mirrors the Phase 0 sim's burst model).
 */
export function getFusionEntropyBurst(clickPower: number, autoRate: number): number {
  const rate =
    ENTROPY_W_CLICK * Math.max(0, clickPower) * FUSION_REF_CPS +
    ENTROPY_W_AUTO * Math.max(0, autoRate);
  return ENTROPY_FUSION_VALUE_SEC * Math.max(rate, 1e-9);
}

/**
 * Quanta refunded for the enhance investment riding on the consumed copies:
 * each consumed copy carries its proportional share of the stack's invested
 * total, refunded at ENHANCE_REFUND_RATE (스펙 §7 — 투자 비용 일부 환급).
 */
export function getExpectedFusionRefund(
  inventory: EntityInstance[],
  inputEntityIds: string[],
): number {
  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);
  let refund = 0;
  for (const [id, consumed] of needed) {
    const owned = inventory.find((e) => e.entityId === id);
    if (!owned || owned.count <= 0) continue;
    const share = Math.min(1, consumed / owned.count);
    refund += (owned.invested ?? 0) * share * ENHANCE_REFUND_RATE;
  }
  return refund;
}

export interface ConsumeResult {
  inventory: EntityInstance[];
  /** Enhance-investment (matter) refund earned by consuming these copies. */
  refund: number;
  /** 강화석 refund from consumed stacks' stone-phase investment (P1). */
  stoneRefund: number;
}

/** Consume the input copies (counts may reach 0; entries are kept for the almanac/UI). */
export function consumeFusionInputs(
  inventory: EntityInstance[],
  inputEntityIds: string[],
): ConsumeResult {
  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);
  const refund = getExpectedFusionRefund(inventory, inputEntityIds);
  let stoneRefund = 0;
  const next = inventory.map((e) => {
    const consumed = needed.get(e.entityId);
    if (consumed === undefined) return e;
    const share = e.count > 0 ? Math.min(1, consumed / e.count) : 0;
    const remaining = e.count - consumed;
    stoneRefund += (e.investedStones ?? 0) * share * ENHANCE_STONE_REFUND_RATE;
    return {
      ...e,
      count: remaining,
      // Levels do NOT survive an emptied stack — otherwise max-level → fuse
      // away → refund 60% leaves every future drop of this id pre-leveled
      // for a net 40% of an already-paid cost (permanent level inflation).
      level: remaining <= 0 ? 1 : e.level,
      invested: Math.max(0, (e.invested ?? 0) * (1 - share)),
      investedStones: remaining <= 0 ? 0 : Math.max(0, (e.investedStones ?? 0) * (1 - share)),
    };
  });
  return { inventory: next, refund, stoneRefund: Math.floor(stoneRefund) };
}

export interface FusionOutputResult {
  inventory: EntityInstance[];
  /** True when the output hit max count and fed a level-up instead (dup sink). */
  leveledUp: boolean;
  /** Quanta refunded when the output was at max count AND max level (nothing to gain). */
  capRefund: number;
}

/** Add the fusion output: stack a copy, or level up when already at max count. */
export function applyFusionOutput(
  inventory: EntityInstance[],
  output: StageEntity,
  playerStageId: number,
): FusionOutputResult {
  const existing = inventory.find((e) => e.entityId === output.id);
  if (existing && output.maxCount > 0 && existing.count >= output.maxCount) {
    // Duplicate sink levels up — but never past the rarity's enhance cap.
    // Fully capped duplicates pay out quanta instead of vanishing (스펙 §10).
    // Refund anchors to the player's stage (matching re-anchored enhance
    // costs) so past-stage outputs can't pay out more than they ever cost.
    if (existing.level >= getEnhanceLevelCap(output)) {
      return {
        inventory,
        leveledUp: false,
        capRefund: getPlayerAnchoredBaseCost(output, playerStageId) * FUSION_CAP_DUP_REFUND_FRAC,
      };
    }
    return {
      inventory: inventory.map((e) =>
        e.entityId === output.id ? { ...e, level: e.level + 1 } : e,
      ),
      leveledUp: true,
      capRefund: 0,
    };
  }
  if (existing) {
    return {
      inventory: inventory.map((e) =>
        e.entityId === output.id ? { ...e, count: e.count + 1 } : e,
      ),
      leveledUp: false,
      capRefund: 0,
    };
  }
  return {
    inventory: [...inventory, { entityId: output.id, count: 1, level: 1 }],
    leveledUp: false,
    capRefund: 0,
  };
}
