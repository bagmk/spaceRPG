import { useEffect, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatGameNumberShort, getClickPower, getAutoRate } from '../game/formulas';
import { getCurrentModifiers } from '../game/reducers/helpers';
import type { GameAction } from '../game/reducer';
import {
  MATTER_PACK_PRODUCTS,
  DEEP_SPACE_STORAGE,
  REWARDED_AD_PRODUCTS,
  findPaidShopProduct,
  type PaidShopProduct,
  type RewardedAdProduct,
} from '../game/shop/items';
import { completePurchase, restorePurchases } from '../game/shop/purchase';
import { recordPurchaseEvent } from '../cloud/purchases';
import { Capacitor } from '@capacitor/core';
import { completeRewardedAd } from '../game/shop/adRewards';
import {
  getActiveBoostSummary,
  getBoostRemainingMs,
  isCashShopUnlocked,
} from '../game/shop/boosts';
import type { ActiveBoostSummary } from '../game/shop/boosts';
import { generateDailyShop, dailyRefreshCostSeconds, toDateKey } from '../game/shop/daily';
import { STONE_BUNDLES, STONE_MATTER_COST_SECONDS } from '../game/balance';
import { STAGES } from '../game/stages';
import { findEntityById, entityName } from '../game/entities/stageItems';
import type { EntityRarity } from '../game/entities/types';
import { EntityGlyph } from './EntityGlyph';
import type { GameState, ShopBoostCategory } from '../game/types';
import { t, type Lang } from '../i18n';

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
  mythic: '#ff5db5',
};

type ShopTab = 'matter' | 'daily' | 'boosts';

function formatRemainingMs(ms: number): string | null {
  if (ms <= 0) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface ShopPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  language: Lang;
  onClose: () => void;
}

export function ShopButton({
  highlighted,
  disabled = false,
  onClick,
  label = 'Shop',
}: {
  highlighted: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`shop-button ${highlighted ? 'affordable' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={disabled ? 'Cosmic shop locked' : 'Open cosmic shop'}
    >
      <span className="hud-action-icon" aria-hidden="true">{disabled ? '🔒' : '🛒'}</span>
      <span className="hud-action-label">{label}</span>
      {highlighted && !disabled ? <span className="hud-notification-dot" aria-hidden="true" /> : null}
    </button>
  );
}

function ActiveSummary({ boosts, now, language }: { boosts: GameState['shopBoosts']; now: number; language: Lang }) {
  const summaries = (['time', 'matter'] as ShopBoostCategory[])
    .map((category) => getActiveBoostSummary(boosts, category, now))
    .filter((summary): summary is ActiveBoostSummary => summary !== null);
  if (summaries.length === 0) return null;
  return (
    <div className="shop-fs__status">
      {summaries.map((summary) => {
        const label = summary.category === 'time' ? t(language, 'hudTime') : t(language, 'hudQuanta');
        const remaining = formatRemainingMs(summary.expiresAt - now);
        return (
          <span key={summary.category} className="shop-fs__status-chip">
            {`${label} ×${summary.factor}`}{remaining ? ` · ${remaining}` : ''}
          </span>
        );
      })}
    </div>
  );
}

export function ShopPanel({ state, dispatch, language, onClose }: ShopPanelProps) {
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<ShopTab>('matter');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const unlocked = isCashShopUnlocked(state);
  // Local calendar day that drives the daily roster (changes once/day as now ticks).
  const todayKey = toDateKey(now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  // Commit the date-rollover on open AND whenever the local day flips while the
  // shop stays open, so the persisted roster matches what's displayed/charged.
  // (syncDailyShop returns the same state ref when the day is unchanged, so the
  // todayKey-gated re-fire is a no-op until midnight.)
  useEffect(() => { dispatch({ type: 'SYNC_DAILY_SHOP', now }); }, [dispatch, todayKey, now]);

  if (!unlocked) return null;

  const mods = getCurrentModifiers(state);
  const outputRate = Math.max(1, getClickPower(mods) + getAutoRate(mods));
  const quanta = state.quanta;
  const playerStageId = STAGES[Math.min(Math.max(0, state.stageIdx), STAGES.length - 1)].id;

  // Effective daily roster — mirrors the reducer's date-rollover so display
  // matches what a buy will charge (SYNC above persists it; buys use the same
  // `now` clock as this display).
  const fresh = state.dailyShopDateKey !== todayKey;
  const refreshCount = fresh ? 0 : state.dailyShopRefreshCount;
  const purchased = fresh ? [] : state.dailyShopPurchased;
  const roster = generateDailyShop(todayKey, refreshCount, playerStageId);
  const refreshCost = Math.ceil(outputRate * dailyRefreshCostSeconds(refreshCount));

  const handlePaid = async (product: PaidShopProduct) => {
    if (!unlocked || pendingId) return;
    setPendingId(product.id);
    const result = await completePurchase(product);
    if (result.success) {
      dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: product.id, now: Date.now() });
      void recordPurchaseEvent({ type: 'purchase', productId: product.id, priceUSD: product.priceUSD });
    }
    setPendingId(null);
  };
  const handleRewardedAd = async (product: RewardedAdProduct) => {
    if (!unlocked || pendingId) return;
    setPendingId(product.id);
    const completed = await completeRewardedAd(product.id);
    if (completed) dispatch({ type: 'CLAIM_AD_REWARD', rewardId: product.id, now: Date.now() });
    setPendingId(null);
  };
  const handleRestore = async () => {
    if (pendingId) return;
    setPendingId('__restore__');
    setRestoreMsg(null);
    const ownedIds = await restorePurchases();
    let restored = 0;
    for (const id of ownedIds) {
      const product = findPaidShopProduct(id);
      // Restore only NON-consumable products (Deep Space Storage). Matter packs
      // are repeatable consumables and would otherwise be re-granted for free on
      // every restore tap (they surface in the store's owned list).
      if (product && product.repeatable === false) {
        dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: id, now: Date.now(), viaRestore: true });
        void recordPurchaseEvent({ type: 'restore', productId: id });
        restored += 1;
      }
    }
    setRestoreMsg(t(language, restored > 0 ? 'shopRestoreDone' : 'shopRestoreNone'));
    setPendingId(null);
  };

  const TABS: { id: ShopTab; label: string }[] = [
    { id: 'matter', label: t(language, 'shopTabMatter') },
    { id: 'daily', label: t(language, 'shopTabDaily') },
    { id: 'boosts', label: t(language, 'shopTabBoosts') },
  ];

  const accent = STAGES[Math.min(Math.max(0, state.stageIdx), STAGES.length - 1)].accent ?? '#8090b0';
  return (
    <div className="entity-fs shop-fs" onClick={onClose}>
      <section className="entity-fs__panel" onClick={(e) => e.stopPropagation()} style={{ '--stage-accent': accent } as CSSProperties}>
      <header className="entity-fs__topbar">
        <h2 className="entity-fs__screen-title">{t(language, 'hudShop')}</h2>
        <span className="shop-fs__balance">⚛{formatGameNumberShort(quanta)} · 💎{formatGameNumberShort(state.enhanceStones)}</span>
        <button className="entity-fs__close" aria-label={t(language, 'shopClose')} onClick={onClose}>✕</button>
      </header>

      <div className="shop-fs__tabs">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`shop-fs__tab ${tab === tb.id ? 'shop-fs__tab--active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="shop-fs__body">
        {tab === 'matter' ? (
          <>
            {/* 강화석 with matter */}
            <div className="shop-fs__section-title">{t(language, 'shopStonesTitle')}</div>
            <div className="shop-fs__stones">
              {STONE_BUNDLES.map((count) => {
                const cost = Math.ceil(outputRate * STONE_MATTER_COST_SECONDS * count);
                const afford = quanta >= cost;
                return (
                  <button
                    key={count}
                    type="button"
                    className="shop-stone-card"
                    disabled={!afford}
                    onClick={() => dispatch({ type: 'BUY_ENHANCE_STONES', count })}
                  >
                    <span className="shop-stone-card__amount">💎 {count}</span>
                    <span className="shop-stone-card__cost">⚛{formatGameNumberShort(cost)}</span>
                  </button>
                );
              })}
            </div>

            {/* Matter packs (USD) */}
            <div className="shop-fs__section-title">{t(language, 'shopPacksTitle')}</div>
            <div className="shop-fs__packs">
              {MATTER_PACK_PRODUCTS.map((p) => {
                const payout = Math.ceil(outputRate * p.effect.payoutMult);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="shop-pack-card"
                    style={{ '--boost-color': p.color } as CSSProperties}
                    disabled={pendingId !== null}
                    onClick={() => handlePaid(p)}
                  >
                    <span className="shop-pack-card__icon">{p.icon}</span>
                    <span className="shop-pack-card__amount">+{formatGameNumberShort(payout)}</span>
                    <span className="shop-pack-card__price">{pendingId === p.id ? '…' : `$${p.priceUSD.toFixed(2)}`}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {tab === 'daily' ? (
          <>
            <div className="shop-fs__daily-head">
              <span className="shop-fs__section-title">{t(language, 'shopDailyTitle')}</span>
              <button
                type="button"
                className="shop-fs__refresh"
                disabled={quanta < refreshCost}
                onClick={() => dispatch({ type: 'REFRESH_DAILY_SHOP', now })}
              >
                {`↻ ${t(language, 'shopDailyRefresh')} · ⚛${formatGameNumberShort(refreshCost)}`}
              </button>
            </div>
            <div className="shop-fs__daily-grid">
              {roster.map((offer) => {
                const ent = findEntityById(offer.entityId);
                const cost = Math.ceil(outputRate * offer.priceSeconds);
                const sold = purchased.includes(offer.slot);
                const afford = quanta >= cost;
                return (
                  <button
                    key={offer.slot}
                    type="button"
                    className={`shop-daily-card ${sold ? 'shop-daily-card--sold' : ''}`}
                    style={{ '--rarity-color': RARITY_COLORS[offer.rarity] } as CSSProperties}
                    disabled={sold || !afford}
                    onClick={() => dispatch({ type: 'BUY_DAILY_ITEM', slot: offer.slot, now })}
                  >
                    {ent ? <EntityGlyph entity={ent} color={RARITY_COLORS[offer.rarity]} /> : null}
                    <span className="shop-daily-card__name">{ent ? entityName(ent, language) : offer.entityId}</span>
                    <span className="shop-daily-card__cost">
                      {sold ? t(language, 'shopSoldOut') : `⚛${formatGameNumberShort(cost)}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="shop-fs__daily-hint">{t(language, 'shopDailyHint')}</div>
          </>
        ) : null}

        {tab === 'boosts' ? (
          <>
            <ActiveSummary boosts={state.shopBoosts} now={now} language={language} />
            <div className="shop-fs__boosts">
              {REWARDED_AD_PRODUCTS.map((ad) => {
                const remaining = formatRemainingMs(getBoostRemainingMs(state.shopBoosts, ad.id, now));
                return (
                  <article key={ad.id} className="shop-boost-card shop-boost-card--free" style={{ '--boost-color': ad.color } as CSSProperties}>
                    <div className="shop-boost-card__icon">{ad.icon}</div>
                    <div className="shop-boost-card__body">
                      <div className="shop-boost-card__name">{ad.name[language]}</div>
                      <div className="shop-boost-card__desc">{ad.description[language]}</div>
                      {remaining ? <div className="shop-boost-card__timer">{`${remaining} ${t(language, 'shopLeft')}`}</div> : null}
                    </div>
                    <button type="button" className="shop-boost-card__buy shop-boost-card__buy--free" disabled={pendingId !== null} onClick={() => handleRewardedAd(ad)}>
                      {ad.button[language]}
                    </button>
                  </article>
                );
              })}
              {(() => {
                const owned = state.hasOfflineStorageUpgrade;
                const p = DEEP_SPACE_STORAGE;
                return (
                  <article className="shop-boost-card" style={{ '--boost-color': p.color } as CSSProperties}>
                    <div className="shop-boost-card__icon">{p.icon}</div>
                    <div className="shop-boost-card__body">
                      <div className="shop-boost-card__name">{p.name[language]}</div>
                      <div className="shop-boost-card__desc">{p.description[language]}</div>
                    </div>
                    <button type="button" className="shop-boost-card__buy" disabled={owned || pendingId !== null} onClick={() => handlePaid(p)}>
                      {owned ? (language === 'ko' ? '보유중' : 'Owned') : (pendingId === p.id ? '…' : `$${p.priceUSD.toFixed(2)}`)}
                    </button>
                  </article>
                );
              })()}
            </div>
            {Capacitor.isNativePlatform() ? (
              <div className="shop-fs__restore">
                <button type="button" onClick={handleRestore} disabled={pendingId !== null}>
                  {pendingId === '__restore__' ? '…' : t(language, 'shopRestore')}
                </button>
                {restoreMsg ? <div className="shop-fs__restore-msg">{restoreMsg}</div> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      </section>
    </div>
  );
}
