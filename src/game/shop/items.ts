import type { GameState } from '../types';

export interface ShopItem {
  id: string;
  label: string;
  description: string;
  priceUSD: number;
  applyEffect: (state: GameState, now: number) => GameState;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'time_boost',
    label: 'Quick Time Boost',
    description: 'Time x10 for 10 minutes.',
    priceUSD: 0.99,
    applyEffect: (state, now) => ({
      ...state,
      shopBoosts: [
        ...state.shopBoosts,
        { id: `time_boost_${now}_${state.shopBoosts.length}`, factor: 10, expiresAt: now + 10 * 60_000 },
      ],
    }),
  },
  {
    id: 'cosmic_surge',
    label: 'Cosmic Surge',
    description: 'Quanta x3 for 30 minutes.',
    priceUSD: 2.99,
    applyEffect: (state, now) => ({
      ...state,
      shopBoosts: [
        ...state.shopBoosts,
        { id: `quanta_surge_${now}_${state.shopBoosts.length}`, factor: 3, expiresAt: now + 30 * 60_000 },
      ],
    }),
  },
  {
    id: 'time_boost_xl',
    label: 'Aeon Surge',
    description: 'Time x100 for 30 minutes.',
    priceUSD: 4.99,
    applyEffect: (state, now) => ({
      ...state,
      shopBoosts: [
        ...state.shopBoosts,
        { id: `time_boost_xl_${now}_${state.shopBoosts.length}`, factor: 100, expiresAt: now + 30 * 60_000 },
      ],
    }),
  },
  {
    id: 'sp_pack_small',
    label: 'SP Pack',
    description: '+5 Skill Points. Use in the skill tree cross-nodes.',
    priceUSD: 0.99,
    applyEffect: (state) => ({
      ...state,
      skillPoints: state.skillPoints + 5,
    }),
  },
  {
    id: 'sp_pack_large',
    label: 'SP Mega Pack',
    description: '+20 Skill Points. Supercharge your entire skill tree.',
    priceUSD: 2.99,
    applyEffect: (state) => ({
      ...state,
      skillPoints: state.skillPoints + 20,
    }),
  },
];

export function findShopItem(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === itemId);
}
