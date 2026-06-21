/** Applies entity bonuses on top of existing Modifiers (equipped items only since Phase 2). */

import type { Modifiers } from '../skills/effects';
import type { EntityInstance, StageEntity } from './types';
import {
  AUTO_GEAR_INCOME_SCALE,
  AUTO_STAGE_POWER_BASE,
  CODEX_REWARD_MULT,
  CLICK_GEAR_MATTER_BOOST,
  ENHANCE_MATTER_LEVEL_GROWTH,
  ENHANCE_RARITY_GROWTH,
  ENTITY_COST_ANCHORS,
  ENTITY_LEVEL_EFFECT_BONUS,
  EQUIP_SLOT_UNLOCKS,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  RIFT_SLOT_UNLOCKS,
  SET_BONUS,
} from '../balance';
import type { EntityRarity } from './types';
import { entityMatchesId, findEntityById, STAGE_ENTITIES } from './stageItems';
import { getGearPowerExponent, getGearPowerMult, getSecondaryStats, type GearPower } from './substats';
import { qualityMult } from './quality';
import {
  CODEX_SETS,
  collectedIdSet,
  getCodexSubsetIdForEntity,
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
    // P6: slots store an instanceId. Fall back to entityId resolution for any
    // legacy/unmigrated slot value so a stale save never blanks the loadout.
    let owned = inventory.find((e) => e.instanceId === slotId);
    if (!owned) {
      const entity = findEntityById(slotId);
      owned = entity ? inventory.find((e) => entityMatchesId(entity, e.entityId) && e.count > 0) : undefined;
    }
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
  if (n <= 0) return 0;
  // Time entities keep the cosmic-clock count cap (separate mechanic, unchanged).
  if (isTime) return maxCount > 0 ? Math.min(n, maxCount) : n;
  // STACKING REWORK (user 2026-06-19): a gear's power NO LONGER scales with how
  // many duplicate copies you own — owning more never strengthens it. Power comes
  // from rarity + LEVEL (enhance) + equipped slots; duplicates are fusion/level
  // fodder only. So any owned copy contributes exactly 1.
  return 1;
}

/**
 * Geometric per-level enhance growth, shared by the MATTER click channel and the
 * (GEAR-ONLY ECONOMY CRANK 2026-06-21) now-fixed AUTO channel so both feel the
 * same "수십배" climb. geoBase = ENHANCE_MATTER_LEVEL_GROWTH × the per-rarity
 * scalar, so legendary/mythic level steeper. Equals 1 at Lv1.
 */
export function getEnhanceGeoLevelMult(rarity: EntityRarity, level: number): number {
  const geoBase = ENHANCE_MATTER_LEVEL_GROWTH * (ENHANCE_RARITY_GROWTH[rarity] ?? 1);
  return Math.pow(geoBase, Math.max(0, Math.floor(level) - 1));
}

/**
 * Rift/auto output anchor.
 *
 * GEAR-ONLY ECONOMY CRANK (2026-06-21): the FIXED auto-channel bug. This used to
 * multiply by ENTITY_COST_ANCHORS[1] (=1725) — a STAGE-1 constant — so a rift
 * loadout's matter/sec stayed pinned to early-game magnitudes while shop prices
 * climbed ~15–20×/stage, leaving auto a dead path to afford anything past S3-4.
 * Now the anchor rides the PLAYER's current stage anchor (ENTITY_COST_ANCHORS
 * [power.stageId]) so auto income tracks the shop ladder and a maxed auto loadout
 * affords stage N's shop — comparable to the click path. The entity's rarity
 * weight (baseCost ÷ its origin cost anchor) is preserved so rarity still ranks
 * rift gear. The geometric LEVEL term is applied separately by the caller (auto
 * branch + label) via getEnhanceGeoLevelMult so it can't double-count here.
 * AUTO_STAGE_POWER_BASE stays 1.0 (P0 neutralised), kept for lockstep.
 */
export function getAutoOutputAnchor(entity: StageEntity, power: GearPower, carried = false): number {
  const stageAnchor = ENTITY_COST_ANCHORS[entity.stageId as keyof typeof ENTITY_COST_ANCHORS] ?? entity.baseCost;
  const rarityWeight = stageAnchor > 0 ? entity.baseCost / stageAnchor : 1;
  const playerStage = Math.max(1, Math.floor(power.stageId)) as keyof typeof ENTITY_COST_ANCHORS;
  const playerAnchor = ENTITY_COST_ANCHORS[playerStage] ?? ENTITY_COST_ANCHORS[1];
  return rarityWeight * playerAnchor * AUTO_GEAR_INCOME_SCALE
    * Math.pow(AUTO_STAGE_POWER_BASE, getGearPowerExponent(power, entity.stageId, carried));
}

/**
 * TAME (pre-crank) auto anchor — the ORIGINAL stage-1-pinned model. Feeds the
 * ENTROPY gate only (Modifiers.autoEntropyFlatAdd), so progression pacing is
 * EXACTLY as calibrated (no gate re-sim) while getAutoOutputAnchor's player-stage
 * crank flows to the WALLET (autoRateFlatAdd). The split mirrors how clickMatterMult
 * keeps the explosive click matter off the entropy gate.
 */
export function getTameAutoOutputAnchor(entity: StageEntity, power: GearPower, carried = false): number {
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
    // #50: per-copy quality multiplies the primary effect, the matter channel AND
    // the scaling substats — a tail (gold) item is simply a stronger specimen.
    const qMult = qualityMult(entry.quality);
    const total = value * count * levelMult * qMult;
    // Matter-only channel (#40): levels grow GEOMETRICALLY here so enhancing a
    // click item feels explosive — decoupled from `total` (which stays linear and
    // feeds the entropy gate). GEAR-ONLY ECONOMY CRANK (2026-06-21): the geo base
    // now folds in the per-rarity ENHANCE_RARITY_GROWTH scalar (getEnhanceGeoLevelMult)
    // so higher rarities level steeper. Equal to `total` at Lv1.
    const geoLevelMult = getEnhanceGeoLevelMult(entity.rarity, entry.level ?? 1);
    const matterTotal = value * count * geoLevelMult * qMult;

    switch (type) {
      case 'auto':
        // GEAR-ONLY ECONOMY CRANK (2026-06-21): the auto channel is split so the
        // dead-late-game bug is fixed for the WALLET without touching progression.
        //  • WALLET (autoRateFlatAdd): player-stage-anchored (getAutoOutputAnchor)
        //    + GEOMETRIC per-level/per-rarity climb (geoLevelMult) — so a maxed rift
        //    loadout's matter/sec tracks the shop ladder and affords stage N's shop.
        //  • ENTROPY (autoEntropyFlatAdd): the TAME, stage-1-pinned, linear-level
        //    value — so the entropy gate stays EXACTLY as calibrated (no re-sim, all
        //    pacing invariants hold). Mirrors clickMatterMult ↔ clickPowerMult.
        mods.autoRateFlatAdd += Math.max(0, getAutoOutputAnchor(entity, power, carried) * (value * count * geoLevelMult * qMult) / 100);
        mods.autoEntropyFlatAdd += Math.max(0, getTameAutoOutputAnchor(entity, power, carried) * (total / 100));
        break;
      case 'auto_mult':
        // Auto Power — % multiplier on entity flat-auto. Isolated modifier so
        // it never entangles autoRateMult (substats/set bonuses/skill auto).
        mods.autoFlatMult *= 1 + total / 100;
        break;
      case 'click':
        mods.clickPowerMult *= 1 + (total * gearPower) / 100;
        // Matter-only explosive layer (#39 + #40 geometric levels): the satisfying
        // click number multiplies hard per equipped click item + per level, WITHOUT
        // touching entropy (gate untouched).
        mods.clickMatterMult *= 1 + (matterTotal * gearPower * CLICK_GEAR_MATTER_BOOST) / 100;
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
        mods.clickMatterMult *= 1 + (matterTotal * gearPower * CLICK_GEAR_MATTER_BOOST) / 100;
        mods.critMultMult *= 1 + (total * gearPower) / 200;
        break;
    }

    // Secondary stats (A안): rare+ entities mix extra stats into the build.
    // `scales` substats ride the same gear power curve, applied at use time.
    for (const sub of getSecondaryStats(entity)) {
      const subTotal = sub.value * levelMult * (sub.scales ? gearPower : 1) * qMult;
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

/** Set key = glyph family. Used for the FUSION same-family output bias only. */
export function getSetKey(entity: StageEntity): string {
  return entity.visual.glyph;
}

/**
 * Equip set key = codex subset/category (P5, R8). Equipping items from the same
 * codex category grants the set bonus — "같은 도감 카테고리 같이 장착". Returns null
 * for entities that map to no NON-genesis subset (getCodexSubsetIdForEntity skips
 * the overlapping genesis set), e.g. the stage-1 tutorial entities s1_01/s1_03 —
 * those simply can't form an equip set. All consumers guard the null.
 */
export function getEquipSetKey(entity: StageEntity): string | null {
  return getCodexSubsetIdForEntity(entity);
}

/**
 * Set bonus (P5, R8): equipping 2–3 entities sharing a codex CATEGORY (subset)
 * multiplies click/auto output and can add crit chance. The largest matching
 * category counts.
 */
export function applySetBonuses(mods: Modifiers, equipped: EntityInstance[]): void {
  const counts = new Map<string, number>();
  for (const entry of equipped) {
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;
    const key = getEquipSetKey(entity);
    if (key === null) continue;
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
  // Scaled by CODEX_REWARD_MULT and rounded — identical to the label sites
  // (codexRewardLabel / shortReward) so the shown bonus equals the applied one.
  const v = Math.round(reward.value * CODEX_REWARD_MULT);
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
