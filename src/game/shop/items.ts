import type { ShopBoostCategory } from '../types';

export type LocalizedText = Record<'en' | 'ko', string>;

export type ShopSectionId = 'free' | 'boosts' | 'permanent';

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

export interface BaseShopEntry {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  section: ShopSectionId;
  icon: string;
  color: string;
}

export interface PaidTimedBoostProduct extends BaseShopEntry {
  kind: 'paid';
  priceUSD: number;
  repeatable: true;
  effect: TimedBoostEffect;
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

export type PaidShopProduct = PaidTimedBoostProduct | PermanentUpgradeProduct;
export type RewardedAdProduct = RewardedAdBoostProduct;
export type ShopCatalogEntry = PaidShopProduct | RewardedAdProduct;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const REWARDED_AD_PRODUCTS: RewardedAdProduct[] = [
  {
    id: 'free_time_burst',
    kind: 'rewarded_ad',
    section: 'free',
    icon: 'T',
    color: '#4df0cc',
    name: { en: 'Free Time Burst', ko: '광고 시간 부스트' },
    description: { en: 'Time x3 for 5 minutes', ko: '5분 동안 시간 x3' },
    button: { en: 'Watch Ad', ko: '광고 보기' },
    effect: {
      type: 'timed_boost',
      category: 'time',
      factor: 3,
      durationMs: 5 * MINUTE_MS,
    },
  },
  {
    id: 'free_matter_burst',
    kind: 'rewarded_ad',
    section: 'free',
    icon: 'M',
    color: '#ffd766',
    name: { en: 'Free Matter Burst', ko: '광고 물질 부스트' },
    description: { en: 'Matter x3 for 5 minutes', ko: '5분 동안 물질 x3' },
    button: { en: 'Watch Ad', ko: '광고 보기' },
    effect: {
      type: 'timed_boost',
      category: 'matter',
      factor: 3,
      durationMs: 5 * MINUTE_MS,
    },
  },
];

export const PAID_SHOP_PRODUCTS: PaidShopProduct[] = [
  {
    id: 'temporal_drive',
    kind: 'paid',
    section: 'boosts',
    repeatable: true,
    icon: 'T',
    color: '#4df0cc',
    name: { en: 'Temporal Drive', ko: '시간 가속 드라이브' },
    description: { en: 'Time x3 for 1 hour', ko: '1시간 동안 시간 x3' },
    priceUSD: 0.99,
    effect: {
      type: 'timed_boost',
      category: 'time',
      factor: 3,
      durationMs: HOUR_MS,
    },
  },
  {
    id: 'matter_surge',
    kind: 'paid',
    section: 'boosts',
    repeatable: true,
    icon: 'M',
    color: '#ffd766',
    name: { en: 'Matter Surge', ko: '물질 쇄도' },
    description: { en: 'Matter x3 for 1 hour', ko: '1시간 동안 물질 x3' },
    priceUSD: 0.99,
    effect: {
      type: 'timed_boost',
      category: 'matter',
      factor: 3,
      durationMs: HOUR_MS,
    },
  },
  {
    id: 'deep_time_engine',
    kind: 'paid',
    section: 'boosts',
    repeatable: true,
    icon: 'T+',
    color: '#9cecff',
    name: { en: 'Deep Time Engine', ko: '심우주 시간 엔진' },
    description: { en: 'Time x3 for 6 hours', ko: '6시간 동안 시간 x3' },
    priceUSD: 4.99,
    effect: {
      type: 'timed_boost',
      category: 'time',
      factor: 3,
      durationMs: 6 * HOUR_MS,
    },
  },
  {
    id: 'matter_storm',
    kind: 'paid',
    section: 'boosts',
    repeatable: true,
    icon: 'M+',
    color: '#ff9f40',
    name: { en: 'Matter Storm', ko: '물질 폭풍' },
    description: { en: 'Matter x3 for 6 hours', ko: '6시간 동안 물질 x3' },
    priceUSD: 4.99,
    effect: {
      type: 'timed_boost',
      category: 'matter',
      factor: 3,
      durationMs: 6 * HOUR_MS,
    },
  },
  {
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
  },
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
