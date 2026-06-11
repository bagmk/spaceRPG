/** Applies entity bonuses on top of existing Modifiers (equipped items only since Phase 2). */

import type { Modifiers } from '../skills/effects';
import type { EntityInstance } from './types';
import { LEGACY_TIME_ENTITY_EFFECT_FACTOR } from '../balance';
import { entityMatchesId, findEntityById } from './stageItems';

/**
 * Resolve equipped slot ids to their inventory stacks (entity redesign Phase 2).
 * Only these instances feed applyEntityModifiers — owning an entity no longer
 * grants its effect passively; it must be equipped. Stale slot ids (entity no
 * longer owned) are silently dropped.
 */
export function getEquippedInstances(
  inventory: EntityInstance[],
  equippedSlots: string[],
): EntityInstance[] {
  const result: EntityInstance[] = [];
  for (const slotId of equippedSlots) {
    if (!slotId) continue;
    const entity = findEntityById(slotId);
    if (!entity) continue;
    const owned = inventory.find((e) => entityMatchesId(entity, e.entityId));
    if (owned && owned.count > 0) result.push(owned);
  }
  return result;
}

function scaledFlatGain(baseCost: number, totalEffect: number): number {
  return Math.max(0, baseCost * (totalEffect / 100));
}

export function applyEntityModifiers(
  mods: Modifiers,
  inventory: EntityInstance[],
  currentStageId?: number,
): void {
  for (const entry of inventory) {
    if (entry.count <= 0) continue;
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;

    const { type, value, isFlat } = entity.effect;
    const count = entity.maxCount > 0 ? Math.min(entry.count, entity.maxCount) : entry.count;
    const total = value * count;

    switch (type) {
      case 'auto':
        mods.autoRateFlatAdd += scaledFlatGain(entity.baseCost, total);
        break;
      case 'click':
        mods.clickPowerMult *= 1 + total / 100;
        break;
      case 'crit':
        if (isFlat) {
          mods.critChanceAdd += total / 100;
        } else {
          mods.critMultMult *= 1 + total / 100;
        }
        break;
      case 'time':
        {
          const stageFactor =
            currentStageId !== undefined && entity.stageId < currentStageId
              ? LEGACY_TIME_ENTITY_EFFECT_FACTOR
              : 1;
          mods.timeMultMult *= 1 + (total * stageFactor) / 100;
        }
        break;
      case 'entropy':
        // entropy entities boost encounter rewards
        mods.encounterBonusMult *= 1 + total / 100;
        break;
      case 'combo_cap':
        mods.comboCapAdd += total;
        break;
      case 'multiplier':
        // All-source bonus: boosts click, auto, and crit — NOT time fill rate.
        // Time is governed solely by 'time' entities and the time skill tree.
        mods.clickPowerMult *= 1 + total / 100;
        mods.autoRateMult *= 1 + total / 100;
        mods.critMultMult *= 1 + total / 200;
        break;
    }
  }
}
