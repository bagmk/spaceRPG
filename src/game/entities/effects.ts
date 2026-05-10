/** Applies purchased entity bonuses on top of existing Modifiers. */

import type { Modifiers } from '../skills/effects';
import type { PurchasedEntityEntry } from './types';
import { STAGE_ENTITIES } from './stageItems';

function scaledFlatGain(baseCost: number, totalEffect: number): number {
  return Math.max(0, baseCost * (totalEffect / 100));
}

export function applyEntityModifiers(
  mods: Modifiers,
  purchasedEntities: PurchasedEntityEntry[],
): void {
  for (const entry of purchasedEntities) {
    if (entry.count <= 0) continue;
    const entity = STAGE_ENTITIES.find((e) => e.id === entry.entityId);
    if (!entity) continue;

    const { type, value, isFlat } = entity.effect;
    const total = value * entry.count;

    switch (type) {
      case 'auto':
        mods.autoRateAdd += scaledFlatGain(entity.baseCost, total);
        break;
      case 'click':
        mods.clickPowerAdd += scaledFlatGain(entity.baseCost, total);
        break;
      case 'crit':
        if (isFlat) {
          mods.critChanceAdd += total / 100;
        } else {
          mods.critMultMult *= 1 + total / 100;
        }
        break;
      case 'time':
        mods.timeMultMult *= 1 + total / 100;
        break;
      case 'entropy':
        mods.timeMultMult *= 1 + total / 100;
        break;
      case 'combo_cap':
        mods.comboCapAdd += total;
        break;
      case 'multiplier':
        // Legendary all-source bonus
        mods.clickPowerMult *= 1 + total / 100;
        mods.autoRateMult *= 1 + total / 100;
        mods.critMultMult *= 1 + total / 200;
        mods.timeMultMult *= 1 + total / 100;
        break;
    }
  }
}
