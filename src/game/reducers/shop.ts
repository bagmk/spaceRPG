/** Handlers: COMPLETE_SHOP_PURCHASE, CLAIM_AD_REWARD, RESUME_BOOSTS */

import { applyTimedShopBoost, isCashShopUnlocked, shiftBoostExpiry } from '../shop/boosts';
import { findPaidShopProduct, findRewardedAdProduct } from '../shop/items';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';

type CompleteShopPurchaseAction = Extract<GameAction, { type: 'COMPLETE_SHOP_PURCHASE' }>;
type ClaimAdRewardAction = Extract<GameAction, { type: 'CLAIM_AD_REWARD' }>;
type ResumeBoostsAction = Extract<GameAction, { type: 'RESUME_BOOSTS' }>;

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

  const next = applyTimedShopBoost(
    state,
    {
      id: product.id,
      category: product.effect.category,
      factor: product.effect.factor,
      durationMs: product.effect.durationMs,
    },
    action.now,
  );

  return {
    ...next,
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

/**
 * Returning from the background: push boost expiry forward by the time spent
 * hidden so backgrounded time does not drain active boosts.
 */
export function handleResumeBoosts(state: GameState, action: ResumeBoostsAction): GameState {
  if (action.hiddenMs <= 0 || state.shopBoosts.length === 0) return state;
  return { ...state, shopBoosts: shiftBoostExpiry(state.shopBoosts, action.hiddenMs) };
}
