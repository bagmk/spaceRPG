/**
 * Enhancement (강화소): spend quanta to level an owned stack directly.
 * Levels share the same field the fusion duplicate sink feeds, multiply the
 * primary effect AND secondary stats (+ENTITY_LEVEL_EFFECT_BONUS per level),
 * and are capped by rarity. Tunables live in balance.ts (ENHANCE_*).
 */

import { ENHANCE_COST_FACTOR, ENHANCE_COST_GROWTH, ENHANCE_LEVEL_CAPS } from '../balance';
import { getPlayerAnchoredBaseCost, type StageEntity } from './types';

export function getEnhanceLevelCap(entity: StageEntity): number {
  return ENHANCE_LEVEL_CAPS[entity.rarity] ?? 10;
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
