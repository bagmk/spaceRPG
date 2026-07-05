/**
 * OVERHAUL5 v2 crew tier view — now an EVOLUTION view.
 *
 * A crew line's power fields still swap by tier (rarity/effect.value/baseCost —
 * tier N power = rarity-N bucket, sim parity), but the DISPLAY identity now
 * follows the line's current FORM: 양자 요동 at tier 3 renders as 양성자, at
 * tier 5 as 중성자별 (name/formula/visual/description all swap). The line's
 * mechanical effect TYPE is fixed by the roster (def.effectType) so a crew
 * never changes hexagon lane mid-evolution.
 *
 * Identity KEYS never change: view.id / view.stageId stay the T1 line id and
 * its home stage, so save slots, codex/almanac keys, substat seeds and the
 * gear-power stage clamp are all untouched by evolution.
 *
 * getSecondaryStats caches by id+rarity (the rarity suffix exists exactly for
 * this view), so views at different tiers never collide.
 */

import { CREW_TIER_BASE_VALUE, CREW_TIER_ORDER, ENTITY_BASE_COST_FACTOR } from '../balance';
import { CREW_BY_ID, crewFormAt } from './roster';
import { findEntityById } from '../entities/stageItems';
import type { EntityRarity, StageEntity } from '../entities/types';

const viewCache = new Map<string, StageEntity>();

/** The crew line (by its T1 entity) as seen at `tier` — power AND form identity. */
export function getCrewTierView(entity: StageEntity, tier: EntityRarity): StageEntity {
  const def = CREW_BY_ID.get(entity.id);
  if (!def) return entity; // not a crew line — nothing to view
  const key = `${entity.id}:${tier}`;
  const cached = viewCache.get(key);
  if (cached) return cached;

  const tierIdx = Math.max(0, CREW_TIER_ORDER.indexOf(tier));
  const form = crewFormAt(def, tierIdx);
  const formEntity = form.entityId ? findEntityById(form.entityId) : undefined;

  const bucket = CREW_TIER_BASE_VALUE[def.effectType];
  const value = bucket?.[tier] ?? entity.effect.value;
  // baseCost drives the off-gate wallet anchors — scale it by the rarity cost
  // ratio so an evolved crew's matter income ranks like a same-rarity item.
  const costRatio =
    (ENTITY_BASE_COST_FACTOR[tier] ?? 1) / (ENTITY_BASE_COST_FACTOR[entity.rarity] ?? 1);

  const view: StageEntity = {
    ...entity,
    rarity: tier,
    // The LINE's lane, at the tier's bucket value. Crit lines are flat chance.
    effect: { type: def.effectType, value, isFlat: def.effectType === 'crit' ? true : entity.effect.isFlat },
    baseCost: entity.baseCost * costRatio,
    // ── Evolution: display identity follows the current form ──
    name: formEntity?.name ?? form.nameEn ?? entity.name,
    nameKo: formEntity?.nameKo ?? form.nameKo ?? entity.nameKo,
    description: formEntity?.description ?? entity.description,
    descriptionKo: formEntity?.descriptionKo ?? entity.descriptionKo,
    formula: formEntity?.formula ?? form.formula ?? entity.formula,
    visual: formEntity?.visual ?? entity.visual,
  };
  viewCache.set(key, view);
  return view;
}
