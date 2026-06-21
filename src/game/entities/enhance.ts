/**
 * Enhancement (강화소): Overhaul-4 P7b — level an owned copy by MERGING spare
 * duplicate copies (collect, don't pay). Levels multiply the primary effect AND
 * secondary stats (+ENTITY_LEVEL_EFFECT_BONUS per level) and are capped by rarity.
 * The old matter-cost + 강화석 risk(fail/break)/protect mechanic is GONE; 물질/강화석
 * now buy a copy-token instead. Tunables live in balance.ts (ENHANCE_* / ENH_DUP_* /
 * COPY_TOKEN_*).
 */

import {
  ENHANCE_COST_FACTOR,
  ENHANCE_COST_GROWTH,
  ENHANCE_LEVEL_CAPS,
  ENH_DUP_BASE,
  ENH_DUP_STEP,
  COPY_TOKEN_MATTER_FACTOR,
  COPY_TOKEN_STONE_COST,
} from '../balance';
import { type StageEntity } from './types';

export function getEnhanceLevelCap(entity: StageEntity): number {
  return ENHANCE_LEVEL_CAPS[entity.rarity] ?? 10;
}

/** Cost to buy ONE spare copy of an item (the merge escape valve). Matter anchors
 *  to the item's baseCost (stage-independent); 강화석 is the flat per-rarity price. */
export function getCopyTokenCost(entity: StageEntity): { matter: number; stones: number } {
  return {
    matter: Math.ceil(entity.baseCost * COPY_TOKEN_MATTER_FACTOR),
    stones: COPY_TOKEN_STONE_COST[entity.rarity] ?? 1,
  };
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

/**
 * Legacy enhance-cost formula (matter to go `level`→`level+1`, item-anchored). The
 * live merge mechanic no longer charges matter, but the formula is retained: it
 * still pins the stage-independence invariant in tests and anchors nothing in-game.
 * `_playerStageId` is kept for call-site compatibility but unused.
 */
export function getEnhanceCost(entity: StageEntity, level: number, _playerStageId?: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.ceil(entity.baseCost * ENHANCE_COST_FACTOR * Math.pow(ENHANCE_COST_GROWTH, safeLevel - 1));
}
