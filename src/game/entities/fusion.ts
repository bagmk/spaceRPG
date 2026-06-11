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
  ENTROPY_FUSION_COST_FRAC,
  ENTROPY_FUSION_VALUE_SEC,
  ENTROPY_W_AUTO,
  ENTROPY_W_CLICK,
  FUSION_INPUT_COUNT,
  FUSION_PITY_THRESHOLD,
  FUSION_REF_CPS,
  FUSION_UP1_CHANCE,
  FUSION_UP2_CHANCE,
} from '../balance';
import { pickEntityByRarity } from './drops';
import { findEntityById } from './stageItems';
import type { EntityInstance, EntityRarity, StageEntity } from './types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface FusionValidation {
  ok: boolean;
  rarity?: EntityRarity;
  /** Highest stage among the inputs — the output rolls from this stage's pool. */
  stageId?: number;
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
  for (const [id, count] of needed) {
    const entity = findEntityById(id);
    if (!entity) return { ok: false };
    const owned = inventory.find((e) => e.entityId === id);
    if (!owned || owned.count < count) return { ok: false };
    if (rarity === undefined) rarity = entity.rarity;
    else if (entity.rarity !== rarity) return { ok: false };
    stageId = Math.max(stageId, entity.stageId);
  }
  return { ok: true, rarity, stageId };
}

export interface FusionRarityRoll {
  rarity: EntityRarity;
  rarityUp: boolean;
  /** False when the inputs were already legendary (no upgrade possible). */
  pityApplicable: boolean;
}

/** Resolve the output rarity from the input rarity, a 0..1 roll, and the pity counter. */
export function rollFusionRarity(
  inputRarity: EntityRarity,
  roll: number,
  pity: number,
): FusionRarityRoll {
  const idx = RARITY_ORDER.indexOf(inputRarity);
  if (idx >= RARITY_ORDER.length - 1) {
    return { rarity: 'legendary', rarityUp: false, pityApplicable: false };
  }
  const up2 = roll < FUSION_UP2_CHANCE && idx + 2 < RARITY_ORDER.length;
  const up1 = roll < FUSION_UP2_CHANCE + FUSION_UP1_CHANCE;
  const pityForced = pity >= FUSION_PITY_THRESHOLD;
  if (up2) return { rarity: RARITY_ORDER[idx + 2], rarityUp: true, pityApplicable: true };
  if (up1 || pityForced) return { rarity: RARITY_ORDER[idx + 1], rarityUp: true, pityApplicable: true };
  return { rarity: inputRarity, rarityUp: false, pityApplicable: true };
}

/** Pick the output entity for a resolved rarity (same fallback ladder as drops). */
export function pickFusionOutput(stageId: number, rarity: EntityRarity, pick01: number): StageEntity | null {
  return pickEntityByRarity(stageId, rarity, pick01);
}

/** Quanta consumed by one fusion — a fixed fraction of the current bank (sink). */
export function getFusionQuantaCost(quanta: number): number {
  if (!Number.isFinite(quanta) || quanta <= 0) return 0;
  return quanta * ENTROPY_FUSION_COST_FRAC;
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

/** Consume the input copies (counts may reach 0; entries are kept for the almanac/UI). */
export function consumeFusionInputs(
  inventory: EntityInstance[],
  inputEntityIds: string[],
): EntityInstance[] {
  const needed = new Map<string, number>();
  for (const id of inputEntityIds) needed.set(id, (needed.get(id) ?? 0) + 1);
  return inventory.map((e) =>
    needed.has(e.entityId) ? { ...e, count: e.count - (needed.get(e.entityId) ?? 0) } : e,
  );
}

export interface FusionOutputResult {
  inventory: EntityInstance[];
  /** True when the output hit max count and fed a level-up instead (dup sink). */
  leveledUp: boolean;
}

/** Add the fusion output: stack a copy, or level up when already at max count. */
export function applyFusionOutput(
  inventory: EntityInstance[],
  output: StageEntity,
): FusionOutputResult {
  const existing = inventory.find((e) => e.entityId === output.id);
  if (existing && output.maxCount > 0 && existing.count >= output.maxCount) {
    return {
      inventory: inventory.map((e) =>
        e.entityId === output.id ? { ...e, level: e.level + 1 } : e,
      ),
      leveledUp: true,
    };
  }
  if (existing) {
    return {
      inventory: inventory.map((e) =>
        e.entityId === output.id ? { ...e, count: e.count + 1 } : e,
      ),
      leveledUp: false,
    };
  }
  return { inventory: [...inventory, { entityId: output.id, count: 1, level: 1 }], leveledUp: false };
}
