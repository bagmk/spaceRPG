import { describe, expect, it } from 'vitest';
import { getActiveShopBoostMultiplier, getOfflineRewardCapSec, shiftBoostExpiry } from '../shop/boosts';
import { createInitialGameState, gameReducer } from '../reducer';
import { getEntitiesForStage } from '../entities/stageItems';
import { generateDailyShop, toDateKey } from '../shop/daily';
import { shopItemMatterCost, shopStoneMatterCost, shopRefreshMatterCost } from '../shop/pricing';

const AD = 'free_matter_burst';
const MIN5 = 5 * 60 * 1000;
const s3 = () => ({ ...createInitialGameState(0), stageIdx: 2 }); // stage 3 = shop unlocked

describe('cash shop matter boost (ad)', () => {
  it('extends the same matter boost instead of stacking its multiplier', () => {
    const first = gameReducer(s3(), { type: 'CLAIM_AD_REWARD', rewardId: AD, now: 10_000 });
    const second = gameReducer(first, { type: 'CLAIM_AD_REWARD', rewardId: AD, now: 20_000 });
    expect(second.shopBoosts).toHaveLength(1);
    expect(second.shopBoosts[0].factor).toBe(3);
    expect(second.shopBoosts[0].expiresAt).toBe(10_000 + 2 * MIN5);
    expect(getActiveShopBoostMultiplier(second.shopBoosts, 'matter', 20_000)).toBe(3);
  });

  it('applies the matter boost to passive income', () => {
    const autoEntity = getEntitiesForStage(3).find((e) => e.effect.type === 'auto')!;
    const base = { ...s3(), inventory: [{ entityId: autoEntity.id, count: 1, level: 1 }], riftSlots: [autoEntity.id] };
    const boosted = gameReducer(base, { type: 'CLAIM_AD_REWARD', rewardId: AD, now: 10_000 });
    const baselineTick = gameReducer(base, { type: 'TICK', now: 11_000, dt: 1000 });
    const boostedTick = gameReducer(boosted, { type: 'TICK', now: 11_000, dt: 1000 });
    expect(boostedTick.quanta).toBeGreaterThan(baselineTick.quanta);
  });

  it('blocks cash shop rewards before Stage 3', () => {
    const next = gameReducer(createInitialGameState(0), { type: 'CLAIM_AD_REWARD', rewardId: AD, now: 10_000 });
    expect(next.shopBoosts).toEqual([]);
  });

  it('owns offline storage permanently and does not charge repeat purchases', () => {
    const first = gameReducer(s3(), { type: 'COMPLETE_SHOP_PURCHASE', itemId: 'deep_space_storage', now: 10_000 });
    const second = gameReducer(first, { type: 'COMPLETE_SHOP_PURCHASE', itemId: 'deep_space_storage', now: 20_000 });
    expect(first.hasOfflineStorageUpgrade).toBe(true);
    expect(getOfflineRewardCapSec(false)).toBe(60 * 60);
    expect(getOfflineRewardCapSec(first.hasOfflineStorageUpgrade)).toBe(8 * 60 * 60);
    expect(second.totalShopSpentUSD).toBe(2.99);
  });
});

describe('matter packs + 강화석 purchase', () => {
  it('a matter pack grants stage-anchored matter (NOT click/auto-scaled, #43)', () => {
    const before = { ...s3(), quanta: 0 };
    const after = gameReducer(before, { type: 'COMPLETE_SHOP_PURCHASE', itemId: 'pack_1', now: 10_000 });
    expect(after.quanta).toBeGreaterThan(0);
    expect(after.totalShopSpentUSD).toBe(0.99);
    // Payout is a function of the STAGE anchor, not of the player's click power:
    // a build with huge click power gets the same pack payout at the same stage.
    const buffed = gameReducer({ ...s3(), quanta: 0, inventory: [] }, { type: 'COMPLETE_SHOP_PURCHASE', itemId: 'pack_1', now: 10_000 });
    expect(buffed.quanta).toBe(after.quanta);
  });

  it('buys 강화석 with matter, debiting quanta', () => {
    const rich = { ...s3(), quanta: 1e12 };
    const after = gameReducer(rich, { type: 'BUY_ENHANCE_STONES', count: 10 });
    expect(after.enhanceStones).toBe(rich.enhanceStones + 10);
    expect(after.quanta).toBeLessThan(rich.quanta);
  });

  it('rejects a 강화석 purchase the player cannot afford', () => {
    const broke = { ...s3(), quanta: 0 };
    const after = gameReducer(broke, { type: 'BUY_ENHANCE_STONES', count: 100 });
    expect(after.enhanceStones).toBe(broke.enhanceStones);
    expect(after.quanta).toBe(0);
  });
});

describe('daily shop', () => {
  it('generates a deterministic roster per (dateKey, refresh, stage)', () => {
    const a = generateDailyShop('2026-06-16', 0, 5);
    const b = generateDailyShop('2026-06-16', 0, 5);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(generateDailyShop('2026-06-16', 1, 5)).not.toEqual(a); // refresh re-rolls
  });

  it('buys a daily offer with matter, adding the entity + recording the slot', () => {
    const key = toDateKey(10_000);
    const offer = generateDailyShop(key, 0, 3)[0];
    const rich = { ...s3(), quanta: 1e15, dailyShopDateKey: key, dailyShopRefreshCount: 0, dailyShopPurchased: [] };
    const after = gameReducer(rich, { type: 'BUY_DAILY_ITEM', slot: offer.slot, now: 10_000 });
    expect(after.dailyShopPurchased).toContain(offer.slot);
    expect(after.inventory.some((e) => e.entityId === offer.entityId)).toBe(true);
    expect(after.quanta).toBeLessThan(rich.quanta);
  });

  it('refresh increments the count and clears purchases', () => {
    const key = toDateKey(10_000);
    const rich = { ...s3(), quanta: 1e15, dailyShopDateKey: key, dailyShopRefreshCount: 0, dailyShopPurchased: [0] };
    const after = gameReducer(rich, { type: 'REFRESH_DAILY_SHOP', now: 10_000 });
    expect(after.dailyShopRefreshCount).toBe(1);
    expect(after.dailyShopPurchased).toEqual([]);
  });

  it('rolls over to a fresh roster on a new day (SYNC)', () => {
    const old = { ...s3(), dailyShopDateKey: '2000-01-01', dailyShopRefreshCount: 3, dailyShopPurchased: [1, 2] };
    const after = gameReducer(old, { type: 'SYNC_DAILY_SHOP', now: 10_000 });
    expect(after.dailyShopDateKey).toBe(toDateKey(10_000));
    expect(after.dailyShopRefreshCount).toBe(0);
    expect(after.dailyShopPurchased).toEqual([]);
  });
});

describe('#43 stage/rarity pricing + gacha', () => {
  it('item price is decoupled from click/auto: monotonic in stage AND rarity', () => {
    // Higher stage anchor → more expensive; higher rarity → more expensive.
    expect(shopItemMatterCost('common', 8)).toBeGreaterThan(shopItemMatterCost('common', 2));
    expect(shopItemMatterCost('legendary', 8)).toBeGreaterThan(shopItemMatterCost('common', 8));
    expect(shopStoneMatterCost(8, 10)).toBe(shopStoneMatterCost(8, 1) * 10);
    expect(shopRefreshMatterCost(8, 1)).toBeGreaterThan(shopRefreshMatterCost(8, 0));
  });

  it('a gacha box spends matter, grants an entity, and stashes a reveal event', () => {
    const rich = { ...s3(), quanta: 1e15 };
    const after = gameReducer(rich, {
      type: 'OPEN_GACHA_BOX', boxId: 'box_faint',
      rolls: { rarityRoll: 0.5, stageRoll: 0, pickRoll: 0.5, q1: 0.5, q2: 0.5 },
    });
    expect(after.quanta).toBeLessThan(rich.quanta);
    expect(after.inventory.length).toBeGreaterThan(0);
    expect(after.lastGachaEvent).not.toBeNull();
    expect(after.lastGachaEvent?.boxId).toBe('box_faint');
  });

  it('gacha rarity is gate-clamped: a prime box at stage 3 cannot mint legendary', () => {
    // RARITY_STAGE_GATES.legendary = 12, so at stage 3 the legendary/epic rolls
    // step down to the highest gate-open tier (rare at S3).
    const rich = { ...createInitialGameState(0), stageIdx: 2, quanta: 1e15 }; // stage 3
    const after = gameReducer(rich, {
      type: 'OPEN_GACHA_BOX', boxId: 'box_prime',
      rolls: { rarityRoll: 0.99, stageRoll: 0, pickRoll: 0.5, q1: 0.5, q2: 0.5 }, // rolls high (legendary)
    });
    const got = after.inventory.find((e) => e.entityId === after.lastGachaEvent?.entityId);
    const ent = got ? getEntitiesForStage(3).concat(getEntitiesForStage(2), getEntitiesForStage(1)).find((e) => e.id === got.entityId) : undefined;
    expect(ent).toBeDefined();
    expect(['common', 'rare']).toContain(ent!.rarity);
  });

  it('rejects a gacha open the player cannot afford', () => {
    const broke = { ...s3(), quanta: 0 };
    const after = gameReducer(broke, {
      type: 'OPEN_GACHA_BOX', boxId: 'box_prime',
      rolls: { rarityRoll: 0.5, stageRoll: 0, pickRoll: 0.5, q1: 0.5, q2: 0.5 },
    });
    expect(after).toBe(broke);
  });
});

describe('boost background pause (active-time)', () => {
  it('shiftBoostExpiry preserves remaining boost time across a background gap', () => {
    const now = 1_000_000;
    const boosts = [{ id: 'matter_2x', category: 'matter' as const, factor: 2, expiresAt: now + 30_000 }];
    const resumed = shiftBoostExpiry(boosts, 60_000);
    expect(getActiveShopBoostMultiplier(resumed, 'matter', now + 60_000)).toBe(2);
    expect(getActiveShopBoostMultiplier(resumed, 'matter', now + 90_001)).toBe(1);
  });

  it('RESUME_BOOSTS shifts active boosts by the hidden duration', () => {
    const withBoost = gameReducer(s3(), { type: 'CLAIM_AD_REWARD', rewardId: AD, now: 10_000 });
    const expiryBefore = withBoost.shopBoosts[0].expiresAt;
    const resumed = gameReducer(withBoost, { type: 'RESUME_BOOSTS', hiddenMs: 45_000 });
    expect(resumed.shopBoosts[0].expiresAt).toBe(expiryBefore + 45_000);
  });
});
