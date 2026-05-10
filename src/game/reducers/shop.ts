/** Handler: BUY_SHOP_ITEM */

import { findShopItem } from '../shop/items';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';

type BuyShopItemAction = Extract<GameAction, { type: 'BUY_SHOP_ITEM' }>;

export function handleBuyShopItem(state: GameState, action: BuyShopItemAction): GameState {
  const item = findShopItem(action.itemId);
  if (!item) return state;
  const next = item.applyEffect(state, action.now);
  return {
    ...next,
    totalShopSpentUSD: state.totalShopSpentUSD + item.priceUSD,
  };
}
