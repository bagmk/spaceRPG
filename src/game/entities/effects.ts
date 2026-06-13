/** Applies entity bonuses on top of existing Modifiers (equipped items only since Phase 2). */

import type { Modifiers } from '../skills/effects';
import type { EntityInstance, StageEntity } from './types';
import {
  AUTO_STAGE_POWER_BASE,
  ENTITY_COST_ANCHORS,
  ENTITY_LEVEL_EFFECT_BONUS,
  EQUIP_SLOT_UNLOCKS,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  RIFT_SLOT_UNLOCKS,
  SET_BONUS,
} from '../balance';
import { entityMatchesId, findEntityById, STAGE_ENTITIES } from './stageItems';
import { getGearPowerExponent, getGearPowerMult, getSecondaryStats, type GearPower } from './substats';
import {
  CODEX_SETS,
  collectedIdSet,
  isSetComplete,
  isSubsetComplete,
  type CodexReward,
} from './codexSets';

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

/**
 * Effective count for power purposes (Phase 4-1): collection stays uncapped
 * (모으는 맛) but the power contribution soft-caps at maxCount with a sqrt
 * tail — otherwise hoarded common stacks outscale every rarity under the
 * player-stage power curve. Time entities hard-cap (no tail): the cosmic
 * clock's fill rate is ceilinged anyway, so the tail would be a no-op lie.
 */
export function getEffectiveCount(count: number, maxCount: number, isTime: boolean): number {
  const n = Math.max(0, count);
  if (maxCount <= 0) return n;
  if (isTime) return Math.min(n, maxCount);
  return Math.min(n, maxCount) + Math.sqrt(Math.max(0, n - maxCount));
}

/**
 * Rift/auto output anchor: the entity's rarity weight within its origin stage
 * (baseCost ÷ origin cost anchor) times the SHARED gear power curve — the
 * exponent follows the player's progression (Phase 4-1 stage independence),
 * so rift gear from any stage stays viable.
 */
export function getAutoOutputAnchor(entity: StageEntity, power: GearPower, carried = false): number {
  const stageAnchor = ENTITY_COST_ANCHORS[entity.stageId as keyof typeof ENTITY_COST_ANCHORS] ?? entity.baseCost;
  const rarityWeight = stageAnchor > 0 ? entity.baseCost / stageAnchor : 1;
  return rarityWeight * ENTITY_COST_ANCHORS[1] * Math.pow(AUTO_STAGE_POWER_BASE, getGearPowerExponent(power, entity.stageId, carried));
}

export function applyEntityModifiers(
  mods: Modifiers,
  inventory: EntityInstance[],
  power: GearPower,
): void {
  for (const entry of inventory) {
    if (entry.count <= 0) continue;
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;

    const { type, value, isFlat } = entity.effect;
    // Power contribution soft-caps at maxCount (collection itself is uncapped).
    const count = getEffectiveCount(entry.count, entity.maxCount, type === 'time');
    // Levels come from enhancement + the fusion duplicate sink and scale everything.
    const levelMult = 1 + Math.max(0, (entry.level ?? 1) - 1) * ENTITY_LEVEL_EFFECT_BONUS;
    // % effects ride the shared gear power curve anchored to the PLAYER's
    // progression (stage independence); capped/flat resources (crit chance,
    // combo cap) and auto (own anchor, same exponent) don't. Carried items
    // (prestige) follow only the player term — see getGearPowerExponent.
    const carried = entry.carried === true;
    const gearPower = getGearPowerMult(power, entity.stageId, carried);
    const total = value * count * levelMult;

    switch (type) {
      case 'auto':
        mods.autoRateFlatAdd += Math.max(0, getAutoOutputAnchor(entity, power, carried) * (total / 100));
        break;
      case 'auto_mult':
        // Auto Power — % multiplier on entity flat-auto. Isolated modifier so
        // it never entangles autoRateMult (substats/set bonuses/skill auto).
        mods.autoFlatMult *= 1 + total / 100;
        break;
      case 'click':
        mods.clickPowerMult *= 1 + (total * gearPower) / 100;
        break;
      case 'crit':
        if (isFlat) {
          mods.critChanceAdd += total / 100;
        } else {
          mods.critMultMult *= 1 + (total * gearPower) / 100;
        }
        break;
      case 'time':
        {
          // Time is the one stage-coupled effect (cosmic clock is stage-relative).
          const stageFactor =
            entity.stageId < power.stageId ? LEGACY_TIME_ENTITY_EFFECT_FACTOR : 1;
          mods.timeMultMult *= 1 + (total * stageFactor) / 100;
        }
        break;
      case 'entropy':
        // entropy entities boost encounter rewards
        mods.encounterBonusMult *= 1 + (total * gearPower) / 100;
        break;
      case 'combo_cap':
        mods.comboCapAdd += total;
        break;
      case 'multiplier':
        // Click-gear "all sources": click + crit only. Auto belongs to rift
        // gear — click gear must never leak into the auto calculation (스펙 §10).
        mods.clickPowerMult *= 1 + (total * gearPower) / 100;
        mods.critMultMult *= 1 + (total * gearPower) / 200;
        break;
    }

    // Secondary stats (A안): rare+ entities mix extra stats into the build.
    // `scales` substats ride the same gear power curve, applied at use time.
    for (const sub of getSecondaryStats(entity)) {
      const subTotal = sub.value * levelMult * (sub.scales ? gearPower : 1);
      switch (sub.type) {
        case 'critChance':
          mods.critChanceAdd += subTotal / 100;
          break;
        case 'critMult':
          mods.critMultMult *= 1 + subTotal / 100;
          break;
        case 'comboCap':
          mods.comboCapAdd += subTotal;
          break;
        case 'entropyGain':
          mods.entropyGainMult *= 1 + subTotal / 100;
          break;
        case 'dropRate':
          mods.dropChanceMult *= 1 + subTotal / 100;
          break;
        case 'fusionBurst':
          mods.fusionBurstMult *= 1 + subTotal / 100;
          break;
        case 'autoPct':
          mods.autoRateMult *= 1 + subTotal / 100;
          break;
        case 'clickPct':
          mods.clickPowerMult *= 1 + subTotal / 100;
          break;
        case 'offlineEff':
          mods.offlineGainMult *= 1 + subTotal / 100;
          break;
      }
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

/** Apply one codex completion reward to the modifiers. */
function applyCodexReward(mods: Modifiers, reward: CodexReward): void {
  const v = reward.value;
  switch (reward.stat) {
    case 'clickPower': mods.clickPowerMult *= 1 + v / 100; break;
    case 'critChance': mods.critChanceAdd += v / 100; break;
    case 'critMult': mods.critMultMult *= 1 + v / 100; break;
    case 'autoPower': mods.autoFlatMult *= 1 + v / 100; break;
    case 'dropRate': mods.dropChanceMult *= 1 + v / 100; break;
    case 'entropyGain': mods.entropyGainMult *= 1 + v / 100; break;
    case 'offline': mods.offlineGainMult *= 1 + v / 100; break;
  }
}

/**
 * Codex collection rewards (도감 완성 보너스): every completed sub-collection
 * grants its bonus; completing all sub-collections of a set grants the set
 * bonus on top. Permanent (almanac survives prestige), deterministic.
 */
export function applyCollectionRewards(
  mods: Modifiers,
  almanacCollected: Record<number, string[]>,
): void {
  const collected = collectedIdSet(almanacCollected);
  for (const set of CODEX_SETS) {
    for (const sub of set.subsets) {
      if (isSubsetComplete(sub, collected, STAGE_ENTITIES)) applyCodexReward(mods, sub.reward);
    }
    if (isSetComplete(set, collected, STAGE_ENTITIES)) applyCodexReward(mods, set.reward);
  }
}

// Category helper lives in ./types (dependency-free); re-exported for callers.
export { getEquipCategory, type EquipCategory } from './types';

function deriveSlotCount(
  rules: { slot: number; minStageId?: number; minAlmanacCount?: number }[],
  stageId: number,
  almanacCollected: Record<number, string[]>,
): number {
  const almanacTotal = Object.values(almanacCollected).reduce((sum, ids) => sum + ids.length, 0);
  let slots = 1;
  for (const rule of rules) {
    const stageOk = rule.minStageId === undefined || stageId >= rule.minStageId;
    const almanacOk = rule.minAlmanacCount === undefined || almanacTotal >= rule.minAlmanacCount;
    if (stageOk && almanacOk) slots = Math.max(slots, rule.slot);
  }
  return Math.min(3, slots);
}

/** How many click-gear slots the player has earned (slot 1 free; 2/3 per balance rules). */
export function getDerivedUnlockedSlotCount(
  stageId: number,
  almanacCollected: Record<number, string[]>,
): number {
  return deriveSlotCount(EQUIP_SLOT_UNLOCKS, stageId, almanacCollected);
}

/** How many rift (auto-gear) slots the player has earned. */
export function getDerivedRiftSlotCount(
  stageId: number,
  almanacCollected: Record<number, string[]>,
): number {
  return deriveSlotCount(RIFT_SLOT_UNLOCKS, stageId, almanacCollected);
}
