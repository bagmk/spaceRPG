/**
 * Fusion / gacha system (entity redesign Phase 3).
 *
 * Feed FUSION_INPUT_COUNT copies of one rarity + a quanta cost into the forge;
 * out comes a weighted-random entity of the same stage with a chance to jump
 * one or two rarities. Rarity-up is pure odds — there is no pity/guarantee
 * (removed: it only added complexity). Every fusion fires an entropy burst,
 * wiring active play into the
 * progression gate. Duplicate outputs at max count become level-ups instead
 * of being wasted. Tunables live in balance.ts (FUSION_*).
 */

import {
  ENHANCE_REFUND_RATE,
  ENHANCE_STONE_REFUND_RATE,
  ENTITY_BASE_COST_FACTOR,
  FUSION_ENHANCE_COST_BASE,
  ENTROPY_FUSION_VALUE_SEC,
  ENTROPY_W_AUTO,
  ENTROPY_W_CLICK,
  FUSION_CAP_DUP_REFUND_FRAC,
  FUSION_FAMILY_BIAS,
  FUSION_FLAT_COST,
  FUSION_INPUT_COUNT,
  FUSION_REF_CPS,
  FUSION_UP1_CHANCE_BY_TIER,
  FUSION_UP2_CHANCE_BY_TIER,
  FUSION_UP_CHANCE_CAP,
  RARITY_STAGE_GATES,
} from '../balance';
import { getSetKey } from './effects';
import { getCodexSubsetIdForEntity } from './codexSets';
import { STAGE_ENTITIES, getEntitiesForStage, findEntityById } from './stageItems';
import { makeInstance } from './instances';
import { pickEntityByRarity } from './drops';
import { bestQuality } from './quality';
import { getEquipCategory, type EntityInstance, type EntityRarity, type EquipCategory, type StageEntity } from './types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

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
  equippedIds: ReadonlySet<string> = new Set(),
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
    // P6: count the FREE (un-equipped) flat copies. A copy is reserved when its
    // instanceId sits in a slot, so the worn item is never fused out from under
    // its slot (장착 = 조합 불가).
    const free = inventory
      .filter((e) => e.entityId === id && e.count > 0 && !(e.instanceId && equippedIds.has(e.instanceId)))
      .reduce((s, e) => s + e.count, 0);
    if (free < count) return { ok: false };
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
 * Resolve the output rarity from the input rarity, a 0..1 roll, and the PLAYER
 * stage's fusion rarity cap (gate + 1). Pure odds — no pity/guarantee. stageId
 * is required — a silent =16 default would skip the cap for any missed caller.
 */
export function rollFusionRarity(
  inputRarity: EntityRarity,
  roll: number,
  stageId: number,
  sameEntityBonus = 0,
): FusionRarityRoll {
  const idx = RARITY_ORDER.indexOf(inputRarity);
  const maxIdx = getMaxFusionRarityIdx(stageId);
  if (idx >= RARITY_ORDER.length - 1 || idx >= maxIdx) {
    // No upgrade possible (mythic inputs, or inputs already at the stage cap).
    return { rarity: inputRarity, rarityUp: false };
  }
  const up1c = FUSION_UP1_CHANCE_BY_TIER[inputRarity];
  const up2c = FUSION_UP2_CHANCE_BY_TIER[inputRarity];
  const up2 = roll < up2c && idx + 2 <= maxIdx;
  const up1 = roll < Math.min(FUSION_UP_CHANCE_CAP, up2c + up1c + sameEntityBonus);
  if (up2) return { rarity: RARITY_ORDER[idx + 2], rarityUp: true };
  if (up1) return { rarity: RARITY_ORDER[idx + 1], rarityUp: true };
  return { rarity: inputRarity, rarityUp: false };
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
  // Mythic is a single global pool (the non-playable stage-17 bucket), not a
  // per-stage roster — the rolled output stage doesn't contain mythics. This
  // is the ONLY path that yields a mythic (legendary-3 fusion → rarity-up).
  if (rarity === 'mythic') {
    const mythics = STAGE_ENTITIES.filter((e) => e.rarity === 'mythic');
    if (mythics.length === 0) return null;
    const idx = Math.floor(((pick01 * 9973) % 1) * mythics.length);
    return mythics[Math.min(idx, mythics.length - 1)];
  }

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

/**
 * Quanta consumed by one fusion — STAGE-INDEPENDENT (Overhaul-2 follow-up): a
 * fixed base × per-rarity factor, cheap for common and steep from rare up. The
 * cost is the SAME at stage 1 and stage 16 (it never inflates as the player
 * advances). The fusion reducer requires the player to afford this in full.
 * Overhaul-3 (user direction 2026-06-19): cost rises with RARITY ONLY — it does
 * NOT scale with the player's stage. A legendary fuse costs the same fixed
 * (FUSION_ENHANCE_COST_BASE × geometric FUSION_FLAT_COST[rarity]) at stage 1 or
 * stage 16; only climbing the rarity ladder (common→…→mythic) makes it pricier.
 * `_playerStageId` is kept for call-site compatibility but intentionally unused.
 */
export function getFusionQuantaCost(rarity: EntityRarity, _playerStageId?: number): number {
  return Math.ceil(FUSION_ENHANCE_COST_BASE * (FUSION_FLAT_COST[rarity] ?? 0.1));
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
  // P6: preview the refund from the SPECIFIC flat copies that would be consumed
  // (lowest-level first), matching consumeFusionInputs.
  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);
  let refund = 0;
  for (const [id, count] of needed) {
    const picks = inventory
      .filter((e) => e.entityId === id && e.count > 0)
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1))
      .slice(0, count);
    for (const c of picks) refund += (c.invested ?? 0) * ENHANCE_REFUND_RATE;
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

/** Consume the input copies. P6 flat: emptied entries are dropped, not kept. */
export function consumeFusionInputs(
  inventory: EntityInstance[],
  inputEntityIds: string[],
  reserved: ReadonlySet<string> = new Set(),
): ConsumeResult {
  // P6: consume copies lowest-level first (keep the player's enhanced copy as
  // fodder last) and never an equipped copy. Count-aware so a legacy count>1
  // stack consumes per-copy too. Refund = each consumed copy's invested share.
  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);
  const taken = new Map<EntityInstance, number>();
  let refund = 0;
  let stoneRefund = 0;
  for (const [entityId, want] of needed) {
    let remaining = want;
    const candidates = inventory
      .filter((e) => e.entityId === entityId && e.count > 0 && !(e.instanceId && reserved.has(e.instanceId)))
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
    for (const c of candidates) {
      if (remaining <= 0) break;
      const already = taken.get(c) ?? 0;
      const avail = c.count - already;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      remaining -= take;
      taken.set(c, already + take);
      const frac = take / c.count;
      refund += (c.invested ?? 0) * frac * ENHANCE_REFUND_RATE;
      stoneRefund += (c.investedStones ?? 0) * frac * ENHANCE_STONE_REFUND_RATE;
    }
  }
  const next: EntityInstance[] = [];
  for (const e of inventory) {
    const t = taken.get(e) ?? 0;
    if (t <= 0) { next.push(e); continue; }
    const remainingCount = e.count - t;
    if (remainingCount <= 0) continue; // fully consumed → drop the entry (flat)
    const frac = remainingCount / e.count;
    next.push({
      ...e,
      count: remainingCount,
      invested: Math.max(0, (e.invested ?? 0) * frac),
      investedStones: Math.max(0, (e.investedStones ?? 0) * frac),
    });
  }
  return { inventory: next, refund: Math.floor(refund), stoneRefund: Math.floor(stoneRefund) };
}

export interface FusionOutputResult {
  inventory: EntityInstance[];
  /** Quanta refunded when the output is already at max count. Fusion NEVER
   *  levels/enhances an item — a duplicate at the cap pays out quanta instead. */
  capRefund: number;
}

/**
 * Add the fusion output: stack a copy, or refund quanta when already at max
 * count. Fusion is rarity-up OR break only — it must NEVER level up / enhance an
 * item (that is the 강화 system's job; mixing them confused players who saw a
 * common "등급업" that was actually a hidden level-up). So an over-cap duplicate
 * always pays capRefund. The refund uses the same stage-independent base as
 * fusion/enhance costs, so it can never exceed what fusing the item ever costs.
 */
export function applyFusionOutput(
  inventory: EntityInstance[],
  output: StageEntity,
  _playerStageId?: number,
  quality?: number,
): FusionOutputResult {
  // P6: count total flat copies; at the cap, refund instead of minting another.
  const ownedCount = inventory.reduce((s, e) => (e.entityId === output.id ? s + e.count : s), 0);
  if (output.maxCount > 0 && ownedCount >= output.maxCount) {
    return {
      inventory,
      capRefund: Math.ceil(FUSION_ENHANCE_COST_BASE * ENTITY_BASE_COST_FACTOR[output.rarity] * FUSION_CAP_DUP_REFUND_FRAC),
    };
  }
  return {
    inventory: [...inventory, makeInstance(output.id, quality !== undefined ? { quality } : {})],
    capRefund: 0,
  };
}
