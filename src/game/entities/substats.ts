/**
 * Secondary stats (entity redesign A안).
 *
 * Every rare+ entity carries 1–3 extra stats on top of its primary effect,
 * derived DETERMINISTICALLY from the entity id — "First Ocean is always
 * crit-chance + drop-rate". No save or data changes; 240 entities gain
 * identity for free, and the simulator can reason about them. Magnitudes
 * ride the stage power curve (scaling stats only) and the level multiplier.
 * Tunables live in balance.ts (SECONDARY_*).
 */

import {
  SECONDARY_RARITY_COUNT,
  SECONDARY_RARITY_SCALE,
  SECONDARY_STAT_DEFS,
  SECONDARY_STAT_POOLS,
  STAGE_POWER_BASE,
  type SecondaryStatType,
} from '../balance';
import { getEquipCategory, type StageEntity } from './types';

export interface SecondaryStat {
  type: SecondaryStatType;
  /**
   * BASE magnitude at level 1 before the gear power curve (percent for
   * *Pct/Gain/Rate/Burst/Mult stats, flat otherwise). `scales` stats are
   * multiplied by getGearPowerMult at USE time (effects.ts / EntityPanel) —
   * never cached, since the curve follows the player's live progression.
   */
  value: number;
  /** Whether this stat rides the gear power curve (mirrors SECONDARY_STAT_DEFS). */
  scales: boolean;
}


/** FNV-1a — tiny, stable string hash so substats never change between sessions. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const cache = new Map<string, SecondaryStat[]>();

/**
 * Gear power context (Phase 4-1 stage independence): the power curve follows
 * the PLAYER's progression, not an item's origin stage.
 */
export interface GearPower {
  /** The player's current stage id (1-based). */
  stageId: number;
  /** Entropy-gate progress within the current stage, 0..1 (fractional exponent). */
  gateProgress01: number;
}

/**
 * Shared gear-power exponent: E = max(playerStage - 1 + gateProgress01,
 * itemStage - 1). The clamp guarantees an item is never weaker than its
 * origin-stage value (migration is a strict buff; prestige-persistent
 * inventories stay safe).
 */
export function getGearPowerExponent(power: GearPower, itemStageId: number, carried = false): number {
  const player = Math.max(0, power.stageId - 1) + Math.min(1, Math.max(0, power.gateProgress01));
  // Carried items (Phase 4-3 prestige carry) drop the itemStage clamp — their
  // power follows ONLY the player's progression, so a carried late item is a
  // head start at its kept level, never full origin-stage power on turn one.
  if (carried) return player;
  return Math.max(player, Math.max(0, itemStageId - 1));
}

/** The gear power multiplier shared by % effects and scaling substats. */
export function getGearPowerMult(power: GearPower, itemStageId: number, carried = false): number {
  return Math.pow(STAGE_POWER_BASE, getGearPowerExponent(power, itemStageId, carried));
}

/**
 * Deterministic substats at their BASE magnitude (no power curve). The gear
 * power curve is applied at use time by the caller (applyEntityModifiers /
 * EntityPanel) for `scales` stats — caching curved values would freeze the
 * player-stage curve at first read.
 */
export function getSecondaryStats(entity: StageEntity): SecondaryStat[] {
  const cached = cache.get(entity.id);
  if (cached) return cached;

  const count = SECONDARY_RARITY_COUNT[entity.rarity] ?? 0;
  const rarityScale = SECONDARY_RARITY_SCALE[entity.rarity] ?? 0;
  // Category-pure pool: click gear never rolls auto stats and vice versa.
  const pool = SECONDARY_STAT_POOLS[getEquipCategory(entity)];
  const stats: SecondaryStat[] = [];
  if (count > 0 && rarityScale > 0) {
    const taken = new Set<SecondaryStatType>();
    for (let k = 0; k < Math.min(count, pool.length); k++) {
      // Linear probe from the hashed start so the k stats are distinct.
      let idx = hashString(`${entity.id}:${k}`) % pool.length;
      while (taken.has(pool[idx])) idx = (idx + 1) % pool.length;
      const type = pool[idx];
      taken.add(type);
      const def = SECONDARY_STAT_DEFS[type];
      stats.push({ type, value: def.base * rarityScale, scales: def.scales });
    }
  }
  cache.set(entity.id, stats);
  return stats;
}
