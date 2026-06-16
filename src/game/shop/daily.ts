/**
 * Daily shop (Overhaul-2 cash-shop rework): a deterministic roster of entity
 * offers that resets each local day and can be re-rolled for matter. The roster
 * is NEVER stored — it's re-derived from (dateKey, refreshCount, playerStageId)
 * so only the seed inputs + purchased-slot set need persisting. All tunables
 * (slot count, rarity odds, prices) live in balance.ts.
 */

import {
  DAILY_SHOP_SLOTS,
  DAILY_SHOP_RARITY_WEIGHTS,
  DAILY_SHOP_PRICE_SECONDS,
  DAILY_SHOP_REFRESH_SECONDS,
} from '../balance';
import { pickEntityByRarity } from '../entities/drops';
import type { EntityRarity } from '../entities/types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Local yyyy-mm-dd key for a timestamp — the daily-reset boundary. */
export function toDateKey(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Deterministic seeded RNG (xmur3 hash → mulberry32) so a given seed string
// always yields the same roster.
function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRarity(roll: number): EntityRarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + (DAILY_SHOP_RARITY_WEIGHTS[r] ?? 0), 0);
  let cursor = roll * total;
  for (const r of RARITY_ORDER) {
    cursor -= DAILY_SHOP_RARITY_WEIGHTS[r] ?? 0;
    if (cursor < 0) return r;
  }
  return 'common';
}

export interface DailyShopOffer {
  slot: number;
  entityId: string;
  rarity: EntityRarity;
  /** Matter price = (clickPower + autoRate) × priceSeconds. */
  priceSeconds: number;
}

/**
 * Deterministic daily roster — stable for the same (dateKey, refreshCount,
 * playerStageId). Each slot rolls a rarity by the odds table, then an entity of
 * that rarity from a random reachable stage (1..playerStageId).
 */
export function generateDailyShop(dateKey: string, refreshCount: number, playerStageId: number): DailyShopOffer[] {
  const rng = mulberry32(hashSeed(`${dateKey}#${refreshCount}#${playerStageId}`));
  const maxStage = Math.max(1, playerStageId);
  const offers: DailyShopOffer[] = [];
  for (let i = 0; i < DAILY_SHOP_SLOTS; i++) {
    const rarity = pickRarity(rng());
    const stage = 1 + Math.floor(rng() * maxStage);
    const ent =
      pickEntityByRarity(Math.min(stage, maxStage), rarity, rng(), true) ??
      pickEntityByRarity(1, 'common', rng(), true);
    if (!ent) continue;
    offers.push({
      slot: i,
      entityId: ent.id,
      rarity: ent.rarity,
      priceSeconds: DAILY_SHOP_PRICE_SECONDS[ent.rarity] ?? 60,
    });
  }
  return offers;
}

/** (clickPower+autoRate) × this = matter cost of the next refresh that day. */
export function dailyRefreshCostSeconds(refreshCount: number): number {
  const arr = DAILY_SHOP_REFRESH_SECONDS;
  return arr[Math.min(Math.max(0, refreshCount), arr.length - 1)] ?? arr[arr.length - 1];
}
