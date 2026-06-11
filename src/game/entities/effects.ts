/** Applies entity bonuses on top of existing Modifiers (equipped items only since Phase 2). */

import type { Modifiers } from '../skills/effects';
import type { EntityInstance, StageEntity } from './types';
import {
  ENTITY_LEVEL_EFFECT_BONUS,
  EQUIP_SLOT_UNLOCKS,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  SET_BONUS,
} from '../balance';
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
    // Levels come from the fusion duplicate sink (Phase 3) and scale the effect.
    const levelMult = 1 + Math.max(0, (entry.level ?? 1) - 1) * ENTITY_LEVEL_EFFECT_BONUS;
    const total = value * count * levelMult;

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

/** Set key = glyph family (entity redesign §3 — no per-entity data needed). */
export function getSetKey(entity: StageEntity): string {
  return entity.visual.glyph;
}

/**
 * Set bonus (Phase 3): equipping 2–3 entities sharing a setKey multiplies
 * click/auto output and can add crit chance. The largest matching family counts.
 */
export function applySetBonuses(mods: Modifiers, equipped: EntityInstance[]): void {
  const counts = new Map<string, number>();
  for (const entry of equipped) {
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;
    const key = getSetKey(entity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) best = Math.max(best, count);
  // Use the highest defined tier at or below the best matching family size.
  for (let tier = Math.min(best, 3); tier >= 2; tier--) {
    const bonus = SET_BONUS[tier];
    if (!bonus) continue;
    mods.clickPowerMult *= bonus.clickAutoMult;
    mods.autoRateMult *= bonus.clickAutoMult;
    mods.critChanceAdd += bonus.critChanceAdd;
    return;
  }
}

/** How many equip slots the player has earned (slot 1 free; 2/3 per balance rules). */
export function getDerivedUnlockedSlotCount(
  stageId: number,
  almanacCollected: Record<number, string[]>,
): number {
  const almanacTotal = Object.values(almanacCollected).reduce((sum, ids) => sum + ids.length, 0);
  let slots = 1;
  for (const rule of EQUIP_SLOT_UNLOCKS) {
    const stageOk = rule.minStageId === undefined || stageId >= rule.minStageId;
    const almanacOk = rule.minAlmanacCount === undefined || almanacTotal >= rule.minAlmanacCount;
    if (stageOk && almanacOk) slots = Math.max(slots, rule.slot);
  }
  return Math.min(3, slots);
}
