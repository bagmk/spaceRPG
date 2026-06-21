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
  ENHANCE_BREAK_STONE_MIN,
  ENHANCE_BREAK_STONE_MAX,
  ENHANCE_PROTECT_STONE_MULT,
  ENH_DUP_BASE,
  ENH_DUP_STEP,
} from '../balance';
import { type StageEntity } from './types';

export function getEnhanceLevelCap(entity: StageEntity): number {
  return ENHANCE_LEVEL_CAPS[entity.rarity] ?? 10;
}

// ── Overhaul-4 P7b: duplicate-collection enhance (pure merge math) ────────────
//    Level up by merging spare copies, not by spending matter. These pure helpers
//    are the core the reducer/save-v27/UI switch will build on; they have no live
//    callers yet (the money/risk path above is still the live mechanic).

/** Copies needed to go from `level` → `level+1`: 3, 5, 7, 9, … */
export function needCopiesForLevel(level: number): number {
  return ENH_DUP_BASE + ENH_DUP_STEP * (Math.max(1, Math.floor(level)) - 1);
}

/** Total copies to reach `level` from Lv1 (closed form: L² − 1). */
export function cumCopiesToLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return L * L - 1;
}

/**
 * Greedily spend `spares` copies to raise a copy from `currentLevel`, stopping at
 * `levelCap` or when the next level can't be afforded. Pure — returns the outcome
 * the reducer will apply (how many levels gained, copies consumed, copies left).
 */
export function applyMergeCopies(
  currentLevel: number,
  spares: number,
  levelCap: number,
): { newLevel: number; consumed: number; leftover: number; levelsGained: number } {
  let level = Math.max(1, Math.floor(currentLevel));
  let pool = Math.max(0, Math.floor(spares));
  let consumed = 0;
  const cap = Math.max(level, Math.floor(levelCap));
  while (level < cap) {
    const need = needCopiesForLevel(level);
    if (pool < need) break;
    pool -= need;
    consumed += need;
    level += 1;
  }
  return { newLevel: level, consumed, leftover: pool, levelsGained: level - Math.max(1, Math.floor(currentLevel)) };
}

// ── Risk phase (#47): from ENHANCE_STONE_THRESHOLD up, an enhance can FAIL.
//    The base cost is MATTER ONLY at EVERY level (getEnhanceCost). 강화석 is spent
//    only to 보호(protect); a failed unprotected attempt destroys a copy and mints
//    random 강화석. Levels below the threshold never fail. ──────────────────────

/** True when going from `level` to `level+1` carries failure risk. */
export function isEnhanceStonePhase(level: number): boolean {
  return Math.floor(level) >= ENHANCE_STONE_THRESHOLD;
}

/** Base 강화석 unit at a risk-phase `level` — the anchor for the 보호 cost. (Normal
 *  enhance is matter-only, so this is never charged for a plain attempt.) */
export function getEnhanceStoneCost(entity: StageEntity, level: number): number {
  const over = Math.max(0, Math.floor(level) - ENHANCE_STONE_THRESHOLD);
  return Math.ceil(ENHANCE_STONE_BASE[entity.rarity] * Math.pow(ENHANCE_STONE_GROWTH, over));
}

/** 강화석 to 보호(protect) a risk-phase attempt — a failed protected attempt loses nothing. */
export function getEnhanceProtectStoneCost(entity: StageEntity, level: number): number {
  return Math.ceil(getEnhanceStoneCost(entity, level) * ENHANCE_PROTECT_STONE_MULT);
}

/** Chance a risk-phase enhance FAILS (0 below the threshold), rising with level. */
export function getEnhanceFailChance(level: number): number {
  if (!isEnhanceStonePhase(level)) return 0;
  const over = Math.max(0, Math.floor(level) - ENHANCE_STONE_THRESHOLD);
  return Math.min(ENHANCE_FAIL_MAX, ENHANCE_FAIL_BASE + over * ENHANCE_FAIL_PER_LEVEL);
}

/** #47: random 강화석 minted when a failed unprotected enhance destroys a copy.
 *  `roll` ∈ [0,1); returns an integer in [min, max] for the entity's rarity. */
export function getEnhanceBreakStoneReward(entity: StageEntity, roll: number): number {
  const min = ENHANCE_BREAK_STONE_MIN[entity.rarity] ?? 1;
  const max = ENHANCE_BREAK_STONE_MAX[entity.rarity] ?? min;
  const clamped = Math.max(0, Math.min(0.999999, roll));
  return min + Math.floor(clamped * (max - min + 1));
}

/**
 * Quanta cost to go from `level` to `level + 1` — anchored to the ITEM's own
 * baseCost, NOT the player's stage (Overhaul-2 follow-up). So a given item's
 * enhance cost never changes as the PLAYER advances stages (it no longer
 * re-prices old gear up to the current anchor); it ramps only with item LEVEL
 * (ENHANCE_COST_GROWTH). `_playerStageId` is kept for call-site compatibility
 * but no longer used.
 */
export function getEnhanceCost(entity: StageEntity, level: number, _playerStageId?: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.ceil(entity.baseCost * ENHANCE_COST_FACTOR * Math.pow(ENHANCE_COST_GROWTH, safeLevel - 1));
}
