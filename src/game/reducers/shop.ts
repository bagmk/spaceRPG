/** Handlers: COMPLETE_SHOP_PURCHASE, CLAIM_AD_REWARD, RESUME_BOOSTS,
 *  BUY_ENHANCE_STONES, BUY_DAILY_ITEM, REFRESH_DAILY_SHOP, SYNC_DAILY_SHOP */

import { applyTimedShopBoost, isCashShopUnlocked, shiftBoostExpiry } from '../shop/boosts';
import { findPaidShopProduct, findRewardedAdProduct } from '../shop/items';
import { generateDailyShop, dailyRefreshCostSeconds, toDateKey } from '../shop/daily';
import { STONE_MATTER_COST_SECONDS } from '../balance';
import { getClickPower, getAutoRate } from '../formulas';
import { getCurrentModifiers } from './helpers';
import { addToInventory, addToAlmanac } from '../entities/drops';
import { findEntityById } from '../entities/stageItems';
import { STAGES } from '../stages';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';

type CompleteShopPurchaseAction = Extract<GameAction, { type: 'COMPLETE_SHOP_PURCHASE' }>;
type ClaimAdRewardAction = Extract<GameAction, { type: 'CLAIM_AD_REWARD' }>;
type ResumeBoostsAction = Extract<GameAction, { type: 'RESUME_BOOSTS' }>;
type BuyEnhanceStonesAction = Extract<GameAction, { type: 'BUY_ENHANCE_STONES' }>;
type BuyDailyItemAction = Extract<GameAction, { type: 'BUY_DAILY_ITEM' }>;
type RefreshDailyShopAction = Extract<GameAction, { type: 'REFRESH_DAILY_SHOP' }>;
type SyncDailyShopAction = Extract<GameAction, { type: 'SYNC_DAILY_SHOP' }>;

/** (clickPower + autoRate) — the per-second output rate that prices shop matter. */
function outputRate(state: GameState): number {
  const mods = getCurrentModifiers(state);
  return Math.max(1, getClickPower(mods) + getAutoRate(mods));
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
  const payout = Math.ceil(outputRate(state) * product.effect.payoutMult);
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

/** Buy 강화석 with matter: cost = outputRate × seconds × count. */
export function handleBuyEnhanceStones(state: GameState, action: BuyEnhanceStonesAction): GameState {
  if (!isCashShopUnlocked(state)) return state;
  const count = Math.max(1, Math.floor(action.count));
  const cost = Math.ceil(outputRate(state) * STONE_MATTER_COST_SECONDS * count);
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
  const cost = Math.ceil(outputRate(s) * offer.priceSeconds);
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
  const cost = Math.ceil(outputRate(s) * dailyRefreshCostSeconds(s.dailyShopRefreshCount));
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
 * Returning from the background: push boost expiry forward by the time spent
 * hidden so backgrounded time does not drain active boosts.
 */
export function handleResumeBoosts(state: GameState, action: ResumeBoostsAction): GameState {
  if (action.hiddenMs <= 0 || state.shopBoosts.length === 0) return state;
  return { ...state, shopBoosts: shiftBoostExpiry(state.shopBoosts, action.hiddenMs) };
}
