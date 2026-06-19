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
  DAILY_ROSTER_LOOKBACK,
} from '../balance';
import { pickEntityByRarity, getRarityGateRamp } from '../entities/drops';
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

// #43: rarity odds are GATE-CLAMPED per stage — a rarity's base weight is scaled
// by getRarityGateRamp so locked tiers contribute 0 (s2 = pure commons; epics
// trickle in at S7; legendaries at S12). So the roster differs per stage for free.
function pickRarity(roll: number, playerStageId: number): EntityRarity {
  const weight = (r: EntityRarity) => (DAILY_SHOP_RARITY_WEIGHTS[r] ?? 0) * getRarityGateRamp(r, playerStageId);
  const total = RARITY_ORDER.reduce((sum, r) => sum + weight(r), 0);
  if (total <= 0) return 'common';
  let cursor = roll * total;
  for (const r of RARITY_ORDER) {
    cursor -= weight(r);
    if (cursor < 0) return r;
  }
  return 'common';
}

export interface DailyShopOffer {
  slot: number;
  entityId: string;
  rarity: EntityRarity;
}

/**
 * Deterministic daily roster — stable for the same (dateKey, refreshCount,
 * playerStageId). Each slot rolls a stage-gated rarity, then an entity from a
 * RECENT stage (within DAILY_ROSTER_LOOKBACK of the player) so the roster skews
 * to the current era. Prices are NOT stored — the reducer/UI derive them from
 * (rarity, playerStageId) via shop/pricing.ts at display + buy time.
 */
export function generateDailyShop(dateKey: string, refreshCount: number, playerStageId: number): DailyShopOffer[] {
  const rng = mulberry32(hashSeed(`${dateKey}#${refreshCount}#${playerStageId}`));
  const maxStage = Math.max(1, playerStageId);
  const offers: DailyShopOffer[] = [];
  for (let i = 0; i < DAILY_SHOP_SLOTS; i++) {
    const rarity = pickRarity(rng(), maxStage);
    // Recency bias: draw from the most recent DAILY_ROSTER_LOOKBACK stages.
    const span = Math.min(maxStage, DAILY_ROSTER_LOOKBACK);
    const stage = Math.max(1, maxStage - Math.floor(rng() * span));
    const ent =
      pickEntityByRarity(stage, rarity, rng(), true) ??
      pickEntityByRarity(1, 'common', rng(), true);
    if (!ent) continue;
    offers.push({ slot: i, entityId: ent.id, rarity: ent.rarity });
  }
  return offers;
}
