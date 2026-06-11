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
  /** Magnitude at level 1 (percent for *Pct/Gain/Rate/Burst/Mult stats, flat otherwise). */
  value: number;
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

/** The stage power multiplier shared with primary effects. */
export function getStagePowerMult(stageId: number): number {
  return Math.pow(STAGE_POWER_BASE, Math.max(0, stageId - 1));
}

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
      const stageMult = def.scales ? getStagePowerMult(entity.stageId) : 1;
      stats.push({ type, value: def.base * rarityScale * stageMult });
    }
  }
  cache.set(entity.id, stats);
  return stats;
}
