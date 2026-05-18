import type { GameState, ShopBoost, ShopBoostCategory } from '../types';

export const CASH_SHOP_UNLOCK_STAGE_ID = 3;
export const DEFAULT_OFFLINE_REWARD_CAP_SEC = 60 * 60;
export const UPGRADED_OFFLINE_REWARD_CAP_SEC = 8 * 60 * 60;

export function isCashShopUnlocked(state: Pick<GameState, 'stageIdx'>): boolean {
  return state.stageIdx + 1 >= CASH_SHOP_UNLOCK_STAGE_ID;
}

export function getOfflineRewardCapSec(hasOfflineStorageUpgrade: boolean): number {
  return hasOfflineStorageUpgrade
    ? UPGRADED_OFFLINE_REWARD_CAP_SEC
    : DEFAULT_OFFLINE_REWARD_CAP_SEC;
}

export function getBoostCategory(boost: Pick<ShopBoost, 'id'> & Partial<Pick<ShopBoost, 'category'>>): ShopBoostCategory {
  if (boost.category === 'time' || boost.category === 'matter') {
    return boost.category;
  }
  return boost.id.startsWith('time_') || boost.id.includes('time') ? 'time' : 'matter';
}

export function normalizeShopBoost(boost: Pick<ShopBoost, 'id' | 'factor' | 'expiresAt'> & Partial<ShopBoost>): ShopBoost {
  return {
    id: boost.id,
    category: getBoostCategory(boost),
    factor: boost.factor,
    expiresAt: boost.expiresAt,
  };
}

export function pruneExpiredShopBoosts(boosts: ShopBoost[] | undefined, now: number): ShopBoost[] {
  return (boosts ?? [])
    .map(normalizeShopBoost)
    .filter((boost) => boost.expiresAt > now);
}

/**
 * Shift every boost's wall-clock expiry forward by deltaMs. Called when the
 * game returns from the background so time spent backgrounded does not drain
 * active boosts — they effectively count down only while the game is visible.
 */
export function shiftBoostExpiry(boosts: ShopBoost[] | undefined, deltaMs: number): ShopBoost[] {
  const list = (boosts ?? []).map(normalizeShopBoost);
  if (deltaMs <= 0) return list;
  return list.map((boost) => ({ ...boost, expiresAt: boost.expiresAt + deltaMs }));
}

export function applyTimedShopBoost(
  state: GameState,
  boost: {
    id: string;
    category: ShopBoostCategory;
    factor: number;
    durationMs: number;
  },
  now: number,
): GameState {
  const activeBoosts = pruneExpiredShopBoosts(state.shopBoosts, now);
  const existing = activeBoosts.find((entry) => entry.id === boost.id);
  const nextExpiresAt = Math.max(now, existing?.expiresAt ?? now) + boost.durationMs;
  const nextBoost: ShopBoost = {
    id: boost.id,
    category: boost.category,
    factor: boost.factor,
    expiresAt: nextExpiresAt,
  };
  const otherBoosts = activeBoosts.filter((entry) => entry.id !== boost.id);

  return {
    ...state,
    shopBoosts: [...otherBoosts, nextBoost],
  };
}

export function getActiveShopBoostMultiplier(
  boosts: ShopBoost[] | undefined,
  category: ShopBoostCategory,
  now: number,
): number {
  return pruneExpiredShopBoosts(boosts, now)
    .filter((boost) => boost.category === category)
    .reduce((max, boost) => Math.max(max, boost.factor), 1);
}

export interface ActiveBoostSummary {
  category: ShopBoostCategory;
  factor: number;
  expiresAt: number;
}

export function getActiveBoostSummary(
  boosts: ShopBoost[] | undefined,
  category: ShopBoostCategory,
  now: number,
): ActiveBoostSummary | null {
  const active = pruneExpiredShopBoosts(boosts, now).filter((boost) => boost.category === category);
  if (active.length === 0) return null;
  const factor = active.reduce((max, boost) => Math.max(max, boost.factor), 1);
  const strongest = active.filter((boost) => boost.factor === factor);
  return {
    category,
    factor,
    expiresAt: Math.max(...strongest.map((boost) => boost.expiresAt)),
  };
}

export function getBoostRemainingMs(
  boosts: ShopBoost[] | undefined,
  boostId: string,
  now: number,
): number {
  const boost = pruneExpiredShopBoosts(boosts, now).find((entry) => entry.id === boostId);
  return Math.max(0, (boost?.expiresAt ?? now) - now);
}

export function integrateBoostedSeconds(
  boosts: ShopBoost[] | undefined,
  categories: ShopBoostCategory[],
  startMs: number,
  endMs: number,
): number {
  if (endMs <= startMs) return 0;
  const normalized = (boosts ?? []).map(normalizeShopBoost);
  const boundaries = new Set<number>([startMs, endMs]);

  for (const boost of normalized) {
    if (boost.expiresAt > startMs && boost.expiresAt < endMs) {
      boundaries.add(boost.expiresAt);
    }
  }

  const points = Array.from(boundaries).sort((a, b) => a - b);
  let total = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const sample = segmentStart + (segmentEnd - segmentStart) / 2;
    const multiplier = categories.reduce((product, category) => {
      const categoryMultiplier = normalized
        .filter((boost) => boost.category === category && boost.expiresAt > sample)
        .reduce((max, boost) => Math.max(max, boost.factor), 1);
      return product * categoryMultiplier;
    }, 1);
    total += ((segmentEnd - segmentStart) / 1000) * multiplier;
  }

  return total;
}
