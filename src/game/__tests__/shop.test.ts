import { describe, expect, it } from 'vitest';
import { getActiveShopBoostMultiplier, getOfflineRewardCapSec } from '../shop/boosts';
import { createInitialGameState, gameReducer } from '../reducer';

describe('cash shop boosts', () => {
  it('extends the same paid time boost instead of stacking its multiplier', () => {
    const stageThree = { ...createInitialGameState(0), stageIdx: 2 };

    const first = gameReducer(stageThree, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 10_000,
    });
    const second = gameReducer(first, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 20_000,
    });

    expect(second.shopBoosts).toHaveLength(1);
    expect(second.shopBoosts[0].factor).toBe(3);
    expect(second.shopBoosts[0].expiresAt).toBe(10_000 + 2 * 60 * 60 * 1000);
    expect(getActiveShopBoostMultiplier(second.shopBoosts, 'time', 20_000)).toBe(3);
  });

  it('uses the strongest active boost in a category and falls back after it expires', () => {
    const stageThree = { ...createInitialGameState(0), stageIdx: 2 };
    const paid = gameReducer(stageThree, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 10_000,
    });
    const withAd = gameReducer(paid, {
      type: 'CLAIM_AD_REWARD',
      rewardId: 'free_time_burst',
      now: 20_000,
    });

    expect(getActiveShopBoostMultiplier(withAd.shopBoosts, 'time', 30_000)).toBe(3);
    expect(getActiveShopBoostMultiplier(withAd.shopBoosts, 'time', 20_000 + 5 * 60 * 1000 + 1)).toBe(3);
  });

  it('keeps time and matter boosts in separate categories', () => {
    const stageThree = { ...createInitialGameState(0), stageIdx: 2 };
    const timeBoosted = gameReducer(stageThree, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 10_000,
    });
    const both = gameReducer(timeBoosted, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'matter_surge',
      now: 10_000,
    });

    expect(getActiveShopBoostMultiplier(both.shopBoosts, 'time', 11_000)).toBe(3);
    expect(getActiveShopBoostMultiplier(both.shopBoosts, 'matter', 11_000)).toBe(3);
  });

  it('applies time boosts to actual passive simulation progress', () => {
    const base = {
      ...createInitialGameState(0),
      stageIdx: 2,
      skills: {
        ...createInitialGameState(0).skills,
        auto: { level: 1 },
      },
    };
    const boosted = gameReducer(base, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 10_000,
    });

    const baselineTick = gameReducer(base, { type: 'TICK', now: 11_000, dt: 1000 });
    const boostedTick = gameReducer(boosted, { type: 'TICK', now: 11_000, dt: 1000 });

    expect(boostedTick.quanta).toBeCloseTo(baselineTick.quanta * 3, 8);
    expect(boostedTick.timeGauge).toBeGreaterThan(baselineTick.timeGauge);
  });

  it('blocks cash shop rewards before Stage 3', () => {
    const beforeStageThree = createInitialGameState(0);
    const next = gameReducer(beforeStageThree, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'temporal_drive',
      now: 10_000,
    });

    expect(next.shopBoosts).toEqual([]);
    expect(next.totalShopSpentUSD).toBe(0);
  });

  it('owns offline storage permanently and does not charge repeat purchases', () => {
    const stageThree = { ...createInitialGameState(0), stageIdx: 2 };
    const first = gameReducer(stageThree, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'deep_space_storage',
      now: 10_000,
    });
    const second = gameReducer(first, {
      type: 'COMPLETE_SHOP_PURCHASE',
      itemId: 'deep_space_storage',
      now: 20_000,
    });

    expect(first.hasOfflineStorageUpgrade).toBe(true);
    expect(getOfflineRewardCapSec(false)).toBe(60 * 60);
    expect(getOfflineRewardCapSec(first.hasOfflineStorageUpgrade)).toBe(8 * 60 * 60);
    expect(second.totalShopSpentUSD).toBe(2.99);
  });
});
