/**
 * OVERHAUL5 crew tier view (docs/OVERHAUL5_CREW_PLAN.md §1-3).
 *
 * A crew member's power is decided by its CURRENT tier (crew[id].tier), not the
 * source entity's static rarity — but the whole power pipeline
 * (applyEntityModifiers / substats / wallet anchors / enhance curves) reads
 * `entity.rarity`, `entity.effect.value` and `entity.baseCost` off the entity
 * object. Rather than forking every consumer, we hand them a VIEW: the same
 * entity with those three fields swapped to the tier's values. Everything else
 * (id, stageId, glyph, formula, names) stays identical, so codex/almanac keys,
 * deterministic substat rolls (id-seeded) and UI identity are untouched.
 *
 * IMPORTANT: getSecondaryStats caches by id+rarity (the rarity suffix exists
 * exactly for this view), so views at different tiers never collide.
 */

import { CREW_TIER_BASE_VALUE, ENTITY_BASE_COST_FACTOR } from '../balance';
import type { EntityRarity, StageEntity } from '../entities/types';

const viewCache = new Map<string, StageEntity>();

/** The entity as seen at `tier` — identity fields untouched, power fields swapped. */
export function getCrewTierView(entity: StageEntity, tier: EntityRarity): StageEntity {
  if (tier === entity.rarity) return entity;
  const key = `${entity.id}:${tier}`;
  const cached = viewCache.get(key);
  if (cached) return cached;

  const bucket = CREW_TIER_BASE_VALUE[entity.effect.type];
  const value = bucket?.[tier] ?? entity.effect.value;
  // baseCost drives the off-gate wallet anchors — scale it by the rarity cost
  // ratio so a promoted crew's matter income ranks like a same-rarity item.
  const costRatio =
    (ENTITY_BASE_COST_FACTOR[tier] ?? 1) / (ENTITY_BASE_COST_FACTOR[entity.rarity] ?? 1);
  const view: StageEntity = {
    ...entity,
    rarity: tier,
    effect: { ...entity.effect, value },
    baseCost: entity.baseCost * costRatio,
  };
  viewCache.set(key, view);
  return view;
}
