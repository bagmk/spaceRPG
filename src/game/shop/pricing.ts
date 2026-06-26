/**
 * #43 shop pricing — every shop matter (⚛) cost is anchored to the player's
 * STAGE (ENTITY_COST_ANCHORS) and scaled GEOMETRICALLY by rarity/rank. Fully
 * decoupled from click/auto output (the old outputRate model is gone), so prices
 * differ per stage and per rarity and you must advance to afford higher tiers.
 * Pure functions — safe to call from the reducer and the UI alike.
 */

import {
  ENTITY_COST_ANCHORS,
  SHOP_RARITY_PRICE_FRAC,
  SHOP_RANK_STEP,
  SHOP_RARITY_RANK,
  SHOP_STONE_PRICE_FRAC,
  SHOP_REFRESH_FRAC,
  SHOP_PACK_MATTER_FRAC,
  ENHANCE_PROTECT_MATTER_FRAC,
  GACHA_BOXES,
} from '../balance';
import type { EntityRarity } from '../entities/types';

/** Stage 17 is the non-playable mythic bucket — clamp shop pricing to playable 1..16. */
const MAX_PLAYABLE_STAGE = 16;

export function clampStage(stageId: number): number {
  return Math.min(MAX_PLAYABLE_STAGE, Math.max(1, Math.floor(stageId)));
}

function anchor(stageId: number): number {
  return ENTITY_COST_ANCHORS[clampStage(stageId) as keyof typeof ENTITY_COST_ANCHORS];
}

/** Matter cost of a shop item by rarity + stage (geometric in rank). */
export function shopItemMatterCost(
  rarity: EntityRarity,
  stageId: number,
  rank: number = SHOP_RARITY_RANK[rarity] ?? 0,
): number {
  return Math.ceil(anchor(stageId) * (SHOP_RARITY_PRICE_FRAC[rarity] ?? 0.1) * Math.pow(SHOP_RANK_STEP, rank));
}

/** Bulk discount on multi-강화석 bundles (user): 10개 −10%, 100개 −25%. */
export function stoneBulkDiscount(count: number): number {
  if (count >= 100) return 0.25;
  if (count >= 10) return 0.10;
  return 0;
}

/** Matter cost of `count` 강화석 at the player's stage (with the bulk discount). */
export function shopStoneMatterCost(stageId: number, count: number): number {
  const n = Math.max(1, Math.floor(count));
  return Math.ceil(anchor(stageId) * SHOP_STONE_PRICE_FRAC * n * (1 - stoneBulkDiscount(n)));
}

/** Bulk discount on 강화 보호 bundles (user: "많이 사면 할인해줘"). Slightly more generous
 *  than stones since you stock protection in bulk before a risky leveling session. */
export function protectBulkDiscount(count: number): number {
  if (count >= 50) return 0.35;
  if (count >= 25) return 0.25;
  if (count >= 10) return 0.15;
  if (count >= 5) return 0.08;
  return 0;
}

/** Matter cost of `count` 강화 보호 charges (인과 닻) at the player's stage. Priced a
 *  bit high (ENHANCE_PROTECT_MATTER_FRAC) so insuring a risky enhance is a real deliberate
 *  outlay, with a bulk discount that rewards stocking up before a leveling session. */
export function shopProtectMatterCost(stageId: number, count: number): number {
  const n = Math.max(1, Math.floor(count));
  return Math.ceil(anchor(stageId) * ENHANCE_PROTECT_MATTER_FRAC * n * (1 - protectBulkDiscount(n)));
}

/** Matter cost of the next daily refresh (escalating by refreshCount). */
export function shopRefreshMatterCost(stageId: number, refreshCount: number): number {
  const i = Math.min(Math.max(0, Math.floor(refreshCount)), SHOP_REFRESH_FRAC.length - 1);
  return Math.ceil(anchor(stageId) * (SHOP_REFRESH_FRAC[i] ?? SHOP_REFRESH_FRAC[SHOP_REFRESH_FRAC.length - 1]));
}

/** Matter granted by a USD pack (by index) at the player's stage. */
export function packMatterPayout(packIndex: number, stageId: number): number {
  const i = Math.min(Math.max(0, Math.floor(packIndex)), SHOP_PACK_MATTER_FRAC.length - 1);
  return Math.ceil(anchor(stageId) * (SHOP_PACK_MATTER_FRAC[i] ?? 1));
}

/** Matter cost of a gacha box at the player's stage (0 for an unknown box id). */
export function gachaBoxMatterCost(boxId: string, stageId: number): number {
  const box = GACHA_BOXES.find((b) => b.id === boxId);
  return box ? Math.ceil(anchor(stageId) * box.priceFrac) : 0;
}

/** Weighted pick from a rarity odds table given a [0,1) roll. */
export function weightedRarityPick(odds: Record<EntityRarity, number>, roll: number): EntityRarity {
  const order: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const total = order.reduce((s, r) => s + (odds[r] ?? 0), 0);
  if (total <= 0) return 'common';
  let cursor = Math.min(0.999999, Math.max(0, roll)) * total;
  for (const r of order) {
    cursor -= odds[r] ?? 0;
    if (cursor < 0) return r;
  }
  return 'common';
}
