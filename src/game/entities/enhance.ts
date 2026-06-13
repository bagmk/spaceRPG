/**
 * Enhancement (강화소): spend quanta to level an owned stack directly.
 * Levels share the same field the fusion duplicate sink feeds, multiply the
 * primary effect AND secondary stats (+ENTITY_LEVEL_EFFECT_BONUS per level),
 * and are capped by rarity. Tunables live in balance.ts (ENHANCE_*).
 */

import {
  ENHANCE_COST_FACTOR,
  ENHANCE_COST_GROWTH,
  ENHANCE_LEVEL_CAPS,
  ENHANCE_STONE_THRESHOLD,
  ENHANCE_STONE_BASE,
  ENHANCE_STONE_GROWTH,
  ENHANCE_FAIL_BASE,
  ENHANCE_FAIL_PER_LEVEL,
  ENHANCE_FAIL_MAX,
  ENHANCE_DESTROY_WINDOW_FROM_CAP,
  ENHANCE_PROTECT_STONE_MULT,
} from '../balance';
import { getPlayerAnchoredBaseCost, type StageEntity } from './types';

export function getEnhanceLevelCap(entity: StageEntity): number {
  return ENHANCE_LEVEL_CAPS[entity.rarity] ?? 10;
}

// ── Stone phase (P1): levels ≥ ENHANCE_STONE_THRESHOLD cost 강화석, not matter,
//    and carry failure risk. Levels below it use matter (getEnhanceCost) and
//    never fail. ──────────────────────────────────────────────────────────────

/** True when going from `level` to `level+1` costs stones (and can fail). */
export function isEnhanceStonePhase(level: number): boolean {
  return Math.floor(level) >= ENHANCE_STONE_THRESHOLD;
}

/** 강화석 cost to go from a stone-phase `level` to `level+1`. */
export function getEnhanceStoneCost(entity: StageEntity, level: number): number {
  const over = Math.max(0, Math.floor(level) - ENHANCE_STONE_THRESHOLD);
  return Math.ceil(ENHANCE_STONE_BASE[entity.rarity] * Math.pow(ENHANCE_STONE_GROWTH, over));
}

/** Extra 강화석 to protect a stone-phase attempt (a failed protected attempt loses nothing). */
export function getEnhanceProtectStoneCost(entity: StageEntity, level: number): number {
  return Math.ceil(getEnhanceStoneCost(entity, level) * ENHANCE_PROTECT_STONE_MULT);
}

/** Chance a stone-phase enhance FAILS (0 below the threshold), rising with level. */
export function getEnhanceFailChance(level: number): number {
  if (!isEnhanceStonePhase(level)) return 0;
  const over = Math.max(0, Math.floor(level) - ENHANCE_STONE_THRESHOLD);
  return Math.min(ENHANCE_FAIL_MAX, ENHANCE_FAIL_BASE + over * ENHANCE_FAIL_PER_LEVEL);
}

/** Within this band of the cap, a failed stone-phase enhance can DESTROY a copy. */
export function isEnhanceDestroyEligible(entity: StageEntity, level: number): boolean {
  return isEnhanceStonePhase(level) && Math.floor(level) >= getEnhanceLevelCap(entity) - ENHANCE_DESTROY_WINDOW_FROM_CAP;
}

/**
 * Quanta cost to go from `level` to `level + 1` — anchored to the player's
 * stage (Phase 4-1): under the player-stage power curve the resulting power
 * is identical regardless of origin stage, so origin pricing would make
 * enhancing old-stage gear ~15 orders of magnitude cheaper for the same gain.
 */
export function getEnhanceCost(entity: StageEntity, level: number, playerStageId: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.ceil(
    getPlayerAnchoredBaseCost(entity, playerStageId) * ENHANCE_COST_FACTOR * Math.pow(ENHANCE_COST_GROWTH, safeLevel - 1),
  );
}
