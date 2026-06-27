/**
 * Enhancement (강화소): Overhaul-4 P7b — level an owned copy by MERGING spare
 * duplicate copies (collect, don't pay), with the 강화석 escape valve when you have
 * no spares. Levels multiply the primary effect AND secondary stats
 * (+ENTITY_LEVEL_EFFECT_BONUS per level) and are capped by rarity.
 *
 * RISK is back (user "실패·파괴 부활 + 보호 아이템"): enhancing is GUARANTEED through Lv2;
 * from the step that lands on ENHANCE_STONE_THRESHOLD (Lv3) up, an attempt can FAIL.
 * An unprotected fail DESTROYS the copy (minting consolation 강화석); a matter-bought
 * 보호 charge (인과 닻, enhanceProtectCharges) absorbs the fail instead. The fail curve
 * + break-refund + protection price all live in balance.ts (ENHANCE_FAIL_* /
 * ENHANCE_BREAK_STONE_* / ENHANCE_PROTECT_*).
 */

import {
  ENHANCE_COST_FACTOR,
  ENHANCE_COST_GROWTH,
  ENHANCE_LEVEL_CAPS,
  ENH_DUP_BASE,
  ENH_DUP_STEP,
  ENHANCE_STONE_BASE,
  ENHANCE_STONE_GROWTH,
  ENHANCE_STONE_THRESHOLD,
  ENHANCE_FAIL_BASE,
  ENHANCE_FAIL_PER_LEVEL,
  ENHANCE_FAIL_MAX,
  ENHANCE_BREAK_STONE_MIN,
  ENHANCE_BREAK_STONE_MAX,
  SPECIAL_ENHANCE_FAIL_MULT,
} from '../balance';
import { type StageEntity, type EntityRarity } from './types';

export function getEnhanceLevelCap(entity: StageEntity): number {
  return ENHANCE_LEVEL_CAPS[entity.rarity] ?? 10;
}

/**
 * 강화석 (diamond) cost to level ONE step WITHOUT spare copies — the "no-card"
 * escape valve (user #8: "카드가 없으면 비싸게 업그레이트", and "카드 사는건 안 됨" so the
 * copy-token BUY is gone). Copies stay the cheap path (free merge); when you have
 * none, you pay an escalating 강화석 price instead. Per-rarity base × growth^(level-1),
 * reusing the same constants the entropy-gate sim's stone phase already models, so
 * the gate calibration is unchanged (copies fund levels for free on top → conservative).
 */
export function getEnhanceStoneCost(entity: StageEntity, level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const base = ENHANCE_STONE_BASE[entity.rarity] ?? 2;
  return Math.ceil(base * Math.pow(ENHANCE_STONE_GROWTH, safeLevel - 1));
}

// ── 강화 RISK phase (user: "실패·파괴 부활 + 보호 아이템") ─────────────────────────
//   Enhancing is GUARANTEED through Lv2 (i.e. the Lv1→2 and Lv2→3 steps). From the
//   step that LANDS on ENHANCE_STONE_THRESHOLD (3) and above, an attempt can FAIL.
//   On an unprotected fail the enhanced copy is DESTROYED (and mints consolation
//   강화석); a held protection charge (인과 닻) absorbs the fail instead. Applies to
//   BOTH the copy-merge and 강화석-escape paths.

/** True when enhancing FROM `level` (level → level+1) is in the risk phase — i.e. the
 *  resulting level is ≥ ENHANCE_STONE_THRESHOLD. Lv1→2 / Lv2→3 stay guaranteed. */
export function isEnhanceRiskLevel(level: number): boolean {
  return Math.floor(level) + 1 >= ENHANCE_STONE_THRESHOLD;
}

/**
 * Fail chance for the level → level+1 step. 0 below the risk phase; in the risk
 * phase it is min(MAX, BASE + (resultLevel − THRESHOLD)·PER_LEVEL) so it rises with
 * level and caps at ENHANCE_FAIL_MAX. The "level above the threshold" is measured on
 * the RESULTING level (the first risky step, landing on THRESHOLD, pays BASE exactly).
 */
export function getEnhanceFailChance(level: number): number {
  if (!isEnhanceRiskLevel(level)) return 0;
  const resultLevel = Math.floor(level) + 1;
  const over = resultLevel - ENHANCE_STONE_THRESHOLD;
  return Math.min(ENHANCE_FAIL_MAX, ENHANCE_FAIL_BASE + over * ENHANCE_FAIL_PER_LEVEL);
}

/**
 * 특수강화 fail chance: the same risk curve scaled DOWN by SPECIAL_ENHANCE_FAIL_MULT
 * — the special copy-paid path (flat 3 cards) trades a fixed card cost for a higher
 * success rate. Mirrored in scripts/entropy-gate-sim.mjs.
 */
export function getSpecialEnhanceFailChance(level: number): number {
  return getEnhanceFailChance(level) * SPECIAL_ENHANCE_FAIL_MULT;
}

/**
 * Consolation 강화석 minted when an UNPROTECTED fail destroys a copy — a random
 * integer in [min, max] by rarity (losing a rarer item softens the loss more). The
 * caller passes a [0,1) roll (deterministic in tests); defaults to Math.random().
 */
export function rollBreakStones(rarity: EntityRarity, roll: number = Math.random()): number {
  const min = ENHANCE_BREAK_STONE_MIN[rarity] ?? 1;
  const max = ENHANCE_BREAK_STONE_MAX[rarity] ?? min;
  const span = Math.max(0, max - min);
  const r = Math.min(0.999999, Math.max(0, roll));
  return min + Math.floor(r * (span + 1));
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
