import type { ShopBoostCategory } from '../types';
import { MATTER_PACKS } from '../balance';

export type LocalizedText = Record<'en' | 'ko', string>;

export type ShopSectionId = 'free' | 'matter' | 'permanent';

export interface TimedBoostEffect {
  type: 'timed_boost';
  category: ShopBoostCategory;
  factor: number;
  durationMs: number;
}

export interface OfflineStorageEffect {
  type: 'offline_storage';
  capHours: number;
}

/** USD matter pack: grants matter = ENTITY_COST_ANCHORS[stage] × SHOP_PACK_MATTER_FRAC[packIndex]
 *  (#43 — stage-anchored, reducer-computed; no longer coupled to click/auto output). */
export interface MatterPackEffect {
  type: 'matter_pack';
  packIndex: number;
}

export interface BaseShopEntry {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  section: ShopSectionId;
  icon: string;
  color: string;
}

export interface MatterPackProduct extends BaseShopEntry {
  kind: 'paid';
  priceUSD: number;
  repeatable: true;
  effect: MatterPackEffect;
}

export interface PermanentUpgradeProduct extends BaseShopEntry {
  kind: 'paid';
  priceUSD: number;
  repeatable: false;
  effect: OfflineStorageEffect;
}

export interface RewardedAdBoostProduct extends BaseShopEntry {
  kind: 'rewarded_ad';
  button: LocalizedText;
  effect: TimedBoostEffect;
}

export type PaidShopProduct = MatterPackProduct | PermanentUpgradeProduct;
export type RewardedAdProduct = RewardedAdBoostProduct;
export type ShopCatalogEntry = PaidShopProduct | RewardedAdProduct;

const MINUTE_MS = 60_000;

// Overhaul-2: only the matter ad boost + Deep Space Storage survive from the old
// boost catalog; the time/matter timed-boost IAPs were removed.
export const REWARDED_AD_PRODUCTS: RewardedAdProduct[] = [
  {
    id: 'free_matter_burst',
    kind: 'rewarded_ad',
    section: 'free',
    icon: '⚛',
    color: '#ffd766',
    name: { en: 'Matter Boost (Ad)', ko: '광고 물질 부스트' },
    description: { en: 'Matter ×3 for 5 minutes', ko: '5분 동안 물질 ×3' },
    button: { en: 'Watch Ad', ko: '광고 보기' },
    effect: {
      type: 'timed_boost',
      category: 'matter',
      factor: 3,
      durationMs: 5 * MINUTE_MS,
    },
  },
];

const PACK_COLORS = ['#ffd766', '#ffcf6b', '#ffb347', '#ff9f40', '#ff7a59', '#ff5e8a'];

export const MATTER_PACK_PRODUCTS: MatterPackProduct[] = MATTER_PACKS.map((p, i) => ({
  id: p.id,
  kind: 'paid',
  section: 'matter',
  repeatable: true,
  icon: '⚛',
  color: PACK_COLORS[i] ?? '#ffd766',
  name: { en: `Matter Pack ${i + 1}`, ko: `물질 팩 ${i + 1}` },
  description: {
    en: 'Matter scaled to your current output',
    ko: '현재 생산량에 비례한 물질',
  },
  priceUSD: p.priceUSD,
  effect: { type: 'matter_pack', packIndex: i },
}));

export const DEEP_SPACE_STORAGE: PermanentUpgradeProduct = {
  id: 'deep_space_storage',
  kind: 'paid',
  section: 'permanent',
  repeatable: false,
  icon: 'S',
  color: '#c6a4ff',
  name: { en: 'Deep Space Storage', ko: '딥 스페이스 저장소' },
  description: { en: 'Offline reward storage up to 8 hours', ko: '오프라인 보상 최대 8시간' },
  priceUSD: 2.99,
  effect: {
    type: 'offline_storage',
    capHours: 8,
  },
};

export const PAID_SHOP_PRODUCTS: PaidShopProduct[] = [
  ...MATTER_PACK_PRODUCTS,
  DEEP_SPACE_STORAGE,
];

export const SHOP_CATALOG: ShopCatalogEntry[] = [
  ...REWARDED_AD_PRODUCTS,
  ...PAID_SHOP_PRODUCTS,
];

export function findPaidShopProduct(itemId: string): PaidShopProduct | undefined {
  return PAID_SHOP_PRODUCTS.find((item) => item.id === itemId);
}

export function findRewardedAdProduct(rewardId: string): RewardedAdProduct | undefined {
  return REWARDED_AD_PRODUCTS.find((item) => item.id === rewardId);
}
