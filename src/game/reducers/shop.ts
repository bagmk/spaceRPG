/** Handlers: COMPLETE_SHOP_PURCHASE, CLAIM_AD_REWARD, RESUME_BOOSTS,
 *  BUY_ENHANCE_STONES, BUY_DAILY_ITEM, REFRESH_DAILY_SHOP, SYNC_DAILY_SHOP */

import { applyTimedShopBoost, isCashShopUnlocked, shiftBoostExpiry } from '../shop/boosts';
import { findPaidShopProduct, findRewardedAdProduct } from '../shop/items';
import { generateDailyShop, toDateKey } from '../shop/daily';
import {
  shopItemMatterCost,
  shopStoneMatterCost,
  shopRefreshMatterCost,
  packMatterPayout,
  gachaBoxMatterCost,
  weightedRarityPick,
} from '../shop/pricing';
import { GACHA_BOXES, RARITY_STAGE_GATES, gachaItemCount, GACHA_STONES_BY_RANK } from '../balance';
import type { GachaPullItem } from '../types/events';
import { addToInventory, addToAlmanac, pickDropStage, pickEntityByRarity } from '../entities/drops';
import { rollQualityScore } from '../entities/quality';
import { findEntityById } from '../entities/stageItems';
import { nextEventId } from './helpers';
import { STAGES } from '../stages';
import type { EntityRarity } from '../entities/types';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';

type CompleteShopPurchaseAction = Extract<GameAction, { type: 'COMPLETE_SHOP_PURCHASE' }>;
type ClaimAdRewardAction = Extract<GameAction, { type: 'CLAIM_AD_REWARD' }>;
type ResumeBoostsAction = Extract<GameAction, { type: 'RESUME_BOOSTS' }>;
type BuyEnhanceStonesAction = Extract<GameAction, { type: 'BUY_ENHANCE_STONES' }>;
type BuyDailyItemAction = Extract<GameAction, { type: 'BUY_DAILY_ITEM' }>;
type RefreshDailyShopAction = Extract<GameAction, { type: 'REFRESH_DAILY_SHOP' }>;
type SyncDailyShopAction = Extract<GameAction, { type: 'SYNC_DAILY_SHOP' }>;
type OpenGachaBoxAction = Extract<GameAction, { type: 'OPEN_GACHA_BOX' }>;

const RARITY_LADDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Step a rolled rarity DOWN the ladder until its stage gate is open (#43 gacha safety). */
function clampRarityToStage(rarity: EntityRarity, playerStageId: number): EntityRarity {
  let idx = RARITY_LADDER.indexOf(rarity);
  while (idx > 0 && (RARITY_STAGE_GATES[RARITY_LADDER[idx]] ?? 1) > playerStageId) idx -= 1;
  return RARITY_LADDER[idx];
}

function playerStageId(state: GameState): number {
  return STAGES[Math.min(Math.max(0, state.stageIdx), STAGES.length - 1)].id;
}

/** Roll the day over when the stored date key is stale: fresh roster + no buys. */
function syncDailyShop(state: GameState, now: number): GameState {
  const key = toDateKey(now);
  if (state.dailyShopDateKey === key) return state;
  return { ...state, dailyShopDateKey: key, dailyShopRefreshCount: 0, dailyShopPurchased: [] };
}

export function handleCompleteShopPurchase(
  state: GameState,
  action: CompleteShopPurchaseAction,
): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const product = findPaidShopProduct(action.itemId);
  if (!product) return state;

  if (product.effect.type === 'offline_storage') {
    if (state.hasOfflineStorageUpgrade) return state;
    return {
      ...state,
      hasOfflineStorageUpgrade: true,
      totalShopSpentUSD: state.totalShopSpentUSD + product.priceUSD,
    };
  }

  // matter_pack: grant matter scaled to current output (priced in USD by the
  // store flow before this dispatch). Never credit a consumable on a RESTORE
  // path — restore is for non-consumables only (defense-in-depth vs the UI).
  if (action.viaRestore) return state;
  const payout = packMatterPayout(product.effect.packIndex, playerStageId(state));
  return {
    ...state,
    quanta: state.quanta + payout,
    totalShopSpentUSD: state.totalShopSpentUSD + product.priceUSD,
  };
}

export function handleClaimAdReward(state: GameState, action: ClaimAdRewardAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const reward = findRewardedAdProduct(action.rewardId);
  if (!reward) return state;

  return applyTimedShopBoost(
    state,
    {
      id: reward.id,
      category: reward.effect.category,
      factor: reward.effect.factor,
      durationMs: reward.effect.durationMs,
    },
    action.now,
  );
}

/** Buy 강화석 with matter: cost = stage anchor × SHOP_STONE_PRICE_FRAC × count (#43). */
export function handleBuyEnhanceStones(state: GameState, action: BuyEnhanceStonesAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const count = Math.max(1, Math.floor(action.count));
  const cost = shopStoneMatterCost(playerStageId(state), count);
  if (state.quanta < cost) return state;
  return {
    ...state,
    quanta: state.quanta - cost,
    enhanceStones: state.enhanceStones + count,
  };
}

/** Buy one daily-shop offer with matter — adds the entity to inventory + almanac. */
export function handleBuyDailyItem(state: GameState, action: BuyDailyItemAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const s = syncDailyShop(state, action.now);
  if (s.dailyShopPurchased.includes(action.slot)) return s;
  const roster = generateDailyShop(s.dailyShopDateKey, s.dailyShopRefreshCount, playerStageId(s));
  const offer = roster.find((o) => o.slot === action.slot);
  if (!offer) return s;
  const cost = shopItemMatterCost(offer.rarity, playerStageId(s));
  if (s.quanta < cost) return s;
  const entity = findEntityById(offer.entityId);
  return {
    ...s,
    quanta: s.quanta - cost,
    inventory: addToInventory(s.inventory, offer.entityId),
    almanacCollected: entity
      ? addToAlmanac(s.almanacCollected, entity.stageId, offer.entityId)
      : s.almanacCollected,
    dailyShopPurchased: [...s.dailyShopPurchased, action.slot],
  };
}

/** Re-roll the daily roster for matter (escalating cost), clearing purchases. */
export function handleRefreshDailyShop(state: GameState, action: RefreshDailyShopAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const s = syncDailyShop(state, action.now);
  const cost = shopRefreshMatterCost(playerStageId(s), s.dailyShopRefreshCount);
  if (s.quanta < cost) return s;
  return {
    ...s,
    quanta: s.quanta - cost,
    dailyShopRefreshCount: s.dailyShopRefreshCount + 1,
    dailyShopPurchased: [],
  };
}

/** Lazy daily reset on shop open (date rollover). */
export function handleSyncDailyShop(state: GameState, action: SyncDailyShopAction): GameState {
  return syncDailyShop(state, action.now);
}

/**
 * #43 뽑기 상자 (gacha): spend matter, roll a random entity by the box's odds
 * (GATE-CLAMPED to RARITY_STAGE_GATES so no tier drops before its stage), apply
 * the #50 quality roll, add it to inventory/almanac, and stash a transient
 * lastGachaEvent for the single-card reveal. A pure MATTER sink — unlimited.
 */
export function handleOpenGachaBox(state: GameState, action: OpenGachaBoxAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const box = GACHA_BOXES.find((b) => b.id === action.boxId);
  if (!box) return state;
  const stage = playerStageId(state);
  const cost = gachaBoxMatterCost(box.id, stage);
  if (cost <= 0 || state.quanta < cost) return state;

  // A7: a box yields a HAUL of gachaItemCount(rank) entities + 강화석. Each item
  // rolls independently from the box odds (one roll set per item, injected at dispatch).
  const wantCount = gachaItemCount(box.rank);
  const rolls = action.rolls.slice(0, wantCount);
  if (rolls.length === 0) return state;

  let inventory = state.inventory;
  let almanacCollected = state.almanacCollected;
  const items: GachaPullItem[] = [];
  for (const r of rolls) {
    const rolledRarity = clampRarityToStage(weightedRarityPick(box.odds, r.rarityRoll), stage);
    const poolStage = pickDropStage(stage, r.stageRoll, state.almanacCollected);
    const entity =
      pickEntityByRarity(poolStage, rolledRarity, r.pickRoll, poolStage !== stage) ??
      pickEntityByRarity(stage, 'common', r.pickRoll, true);
    if (!entity) continue;
    const quality = rollQualityScore(r.q1, r.q2);
    inventory = addToInventory(inventory, entity.id, quality);
    almanacCollected = addToAlmanac(almanacCollected, entity.stageId, entity.id);
    items.push({ entityId: entity.id, quality });
  }
  if (items.length === 0) return state;

  const stonesEarned = GACHA_STONES_BY_RANK[box.rank] ?? 0;
  const eventId = nextEventId(state);
  return {
    ...state,
    quanta: state.quanta - cost,
    inventory,
    almanacCollected,
    enhanceStones: Math.max(0, state.enhanceStones + stonesEarned),
    eventCounter: eventId,
    lastGachaEvent: { id: eventId, items, stonesEarned, boxId: box.id },
  };
}

/**
 * Returning from the background: push boost expiry forward by the time spent
 * hidden so backgrounded time does not drain active boosts.
 */
export function handleResumeBoosts(state: GameState, action: ResumeBoostsAction): GameState {
  if (action.hiddenMs <= 0 || state.shopBoosts.length === 0) return state;
  return { ...state, shopBoosts: shiftBoostExpiry(state.shopBoosts, action.hiddenMs) };
}
