/**
 * #50 Item quality (가우시언 테일).
 *
 * Substats/effects are otherwise deterministic per id — quality is the ONLY
 * per-copy variation. Each acquired copy rolls a gaussian score in [0,1]
 * (mean ~0.5, most mass mid-range, rare values near 0/1). A stack keeps its
 * BEST roll. The score multiplies the item's primary effect AND scaling
 * substats; the high tail (≥ QUALITY_TAIL_THRESHOLD) earns a gold card border.
 *
 * Pure functions only — rolls come from the caller (action-supplied randoms) so
 * the reducer stays replayable. A missing/undefined quality is treated as a
 * neutral 0 (× 1.0), so legacy or untagged entries are never silently buffed.
 */

import { QUALITY_MAX_BONUS, QUALITY_TAIL_THRESHOLD } from '../balance';

/**
 * Two uniform [0,1) rolls → a gaussian-distributed quality score in [0,1].
 * Box-Muller for the normal sample, then squashed to [0,1] with sd≈1 (g/6+0.5):
 * g∈[-3,3] maps to the full range, so mean 0.5 and the tails (score→0/1) are
 * genuinely rare. Clamped for safety.
 */
export function rollQualityScore(r1: number, r2: number): number {
  const u1 = Math.min(1 - 1e-9, Math.max(1e-9, r1));
  const u2 = Math.min(1 - 1e-9, Math.max(0, r2));
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // N(0,1)
  return Math.min(1, Math.max(0, 0.5 + g / 6));
}

/** Effect/substat multiplier for a quality score (undefined → neutral 1.0). */
export function qualityMult(quality: number | undefined): number {
  if (quality === undefined || !Number.isFinite(quality)) return 1;
  return 1 + Math.min(1, Math.max(0, quality)) * QUALITY_MAX_BONUS;
}

/** Whether a quality score lands in the gold "tail" (border-worthy). */
export function isTailQuality(quality: number | undefined): boolean {
  return quality !== undefined && Number.isFinite(quality) && quality >= QUALITY_TAIL_THRESHOLD;
}

/**
 * Merge a freshly-rolled quality into a stack: a stack shows its BEST specimen,
 * so the higher of the existing and new score wins.
 */
export function bestQuality(existing: number | undefined, rolled: number | undefined): number | undefined {
  if (existing === undefined) return rolled;
  if (rolled === undefined) return existing;
  return Math.max(existing, rolled);
}
