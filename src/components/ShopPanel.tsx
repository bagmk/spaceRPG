import { useEffect, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatWhole } from '../game/formulas';
import type { GameAction } from '../game/reducer';
import {
  PAID_SHOP_PRODUCTS,
  REWARDED_AD_PRODUCTS,
  findPaidShopProduct,
  type PaidShopProduct,
  type RewardedAdProduct,
  type ShopCatalogEntry,
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
import type { GameState, ShopBoostCategory } from '../game/types';
import { t, type Lang } from '../i18n';

const SECTION_COPY: Record<'free' | 'boosts' | 'permanent', Record<Lang, string>> = {
  free: { en: 'Free Boosts', ko: '무료 부스트' },
  boosts: { en: 'Boosts', ko: '부스트' },
  permanent: { en: 'Permanent Upgrades', ko: '영구 업그레이드' },
};

function formatRemainingMs(ms: number): string | null {
  if (ms <= 0) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
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
      <span className="hud-action-icon" aria-hidden="true">$</span>
      <span className="hud-action-label">{label}</span>
      {highlighted && !disabled ? <span className="hud-notification-dot" aria-hidden="true" /> : null}
    </button>
  );
}

function ActiveSummary({
  boosts,
  now,
  language,
}: {
  boosts: GameState['shopBoosts'];
  now: number;
  language: Lang;
}) {
  const summaries = (['time', 'matter'] as ShopBoostCategory[])
    .map((category) => getActiveBoostSummary(boosts, category, now))
    .filter((summary): summary is ActiveBoostSummary => summary !== null);

  if (summaries.length === 0) return null;

  return (
    <div className="shop-panel2__status">
      <div className="shop-panel2__status-title">{t(language, 'shopActiveBoosts')}</div>
      {summaries.map((summary) => {
        const label = summary.category === 'time' ? t(language, 'hudTime') : t(language, 'hudQuanta');
        const color = summary.category === 'time' ? '#4df0cc' : '#ffd766';
        const remaining = formatRemainingMs(summary.expiresAt - now);
        return (
          <div
            key={summary.category}
            className="shop-panel2__status-row"
            style={{ '--boost-color': color } as CSSProperties}
          >
            <span className="shop-panel2__status-label">
              {language === 'ko'
                ? `${label} x${formatWhole(summary.factor)} 활성화`
                : `${label} x${formatWhole(summary.factor)} active`}
            </span>
            {remaining ? <span className="shop-panel2__status-timer">{`${remaining} ${t(language, 'shopLeft')}`}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function ShopCard({
  entry,
  language,
  now,
  state,
  pending,
  animDelay,
  onPaid,
  onRewardedAd,
}: {
  entry: ShopCatalogEntry;
  language: Lang;
  now: number;
  state: GameState;
  pending: boolean;
  animDelay: number;
  onPaid: (product: PaidShopProduct) => void;
  onRewardedAd: (product: RewardedAdProduct) => void;
}) {
  const isPermanentOwned = entry.id === 'deep_space_storage' && state.hasOfflineStorageUpgrade;
  const remaining = entry.effect.type === 'timed_boost'
    ? formatRemainingMs(getBoostRemainingMs(state.shopBoosts, entry.id, now))
    : null;
  const isActive = Boolean(remaining) || isPermanentOwned;
  const isReward = entry.kind === 'rewarded_ad';
  const buttonLabel =
    isPermanentOwned
      ? (language === 'ko' ? '보유중' : 'Owned')
      : isReward
        ? entry.button[language]
        : t(language, 'shopBuy');

  return (
    <article
      className={[
        'shop-boost-card',
        isReward ? 'shop-boost-card--free' : '',
        isActive ? 'shop-boost-card--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--boost-color': entry.color, '--anim-delay': `${animDelay}ms` } as CSSProperties}
    >
      <div className="shop-boost-card__icon">{entry.icon}</div>
      <div className="shop-boost-card__body">
        <div className="shop-boost-card__name">{entry.name[language]}</div>
        <div className="shop-boost-card__desc">{entry.description[language]}</div>
        {remaining ? (
          <div className="shop-boost-card__timer">{`${remaining} ${t(language, 'shopLeft')}`}</div>
        ) : null}
        {isPermanentOwned ? (
          <div className="shop-boost-card__timer">{language === 'ko' ? '영구 업그레이드 보유중' : 'Permanent upgrade owned'}</div>
        ) : null}
      </div>
      <div className="shop-boost-card__right">
        <button
          type="button"
          className={`shop-boost-card__buy${isReward ? ' shop-boost-card__buy--free' : ''}`}
          disabled={pending || isPermanentOwned}
          onClick={() => {
            if (entry.kind === 'rewarded_ad') {
              onRewardedAd(entry);
            } else {
              onPaid(entry);
            }
          }}
        >
          {entry.kind === 'paid' && !isPermanentOwned ? (
            <>
              <span className="shop-boost-card__buy-price">{`$${entry.priceUSD.toFixed(2)}`}</span>
              <span className="shop-boost-card__buy-label">{t(language, 'shopBuy')}</span>
            </>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </article>
  );
}

export function ShopPanel({ state, dispatch, language, onClose }: ShopPanelProps) {
  const [now, setNow] = useState(Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const unlocked = isCashShopUnlocked(state);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!unlocked) return null;

  const handlePaid = async (product: PaidShopProduct) => {
    if (!unlocked || pendingId) return;
    setPendingId(product.id);
    const result = await completePurchase(product);
    // Native (RevenueCat): success === true means the store charged the user, so
    // grant the product client-side here. Web (Stripe) returns success: false
    // because it redirects the page; fulfillment happens server-side there.
    if (result.success) {
      dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: product.id, now: Date.now() });
      // Track native purchase in Firestore (web Stripe is tracked server-side).
      void recordPurchaseEvent({ type: 'purchase', productId: product.id, priceUSD: product.priceUSD });
    }
    setPendingId(null);
  };

  const handleRewardedAd = async (product: RewardedAdProduct) => {
    if (!unlocked || pendingId) return;
    setPendingId(product.id);
    const completed = await completeRewardedAd(product.id);
    if (completed) {
      dispatch({ type: 'CLAIM_AD_REWARD', rewardId: product.id, now: Date.now() });
    }
    setPendingId(null);
  };

  const handleRestore = async () => {
    if (pendingId) return;
    setPendingId('__restore__');
    setRestoreMsg(null);
    const ownedIds = await restorePurchases();
    let restored = 0;
    for (const id of ownedIds) {
      if (findPaidShopProduct(id)) {
        dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: id, now: Date.now() });
        void recordPurchaseEvent({ type: 'restore', productId: id });
        restored += 1;
      }
    }
    setRestoreMsg(t(language, restored > 0 ? 'shopRestoreDone' : 'shopRestoreNone'));
    setPendingId(null);
  };

  let globalCardIdx = 0;
  const renderSection = (
    section: 'free' | 'boosts' | 'permanent',
    entries: ShopCatalogEntry[],
  ) => {
    const sectionCards = entries.map((entry) => {
      const delay = globalCardIdx * 50;
      globalCardIdx += 1;
      return (
        <ShopCard
          key={entry.id}
          entry={entry}
          language={language}
          now={now}
          state={state}
          pending={pendingId === entry.id}
          animDelay={delay}
          onPaid={handlePaid}
          onRewardedAd={handleRewardedAd}
        />
      );
    });
    return (
      <section className="shop-panel2__section" key={section}>
        <div className="shop-panel2__section-title">{SECTION_COPY[section][language]}</div>
        <div className="shop-panel2__section-items">
          {sectionCards}
        </div>
      </section>
    );
  };

  return (
    <div className="shop-overlay" onClick={onClose} role="presentation">
      <aside
        className="shop-panel2"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shop-panel2__header">
          <div>
            <div className="shop-panel2__title">{t(language, 'shopEyebrow')}</div>
          </div>
          <button
            type="button"
            className="entity-panel__close"
            onClick={onClose}
            aria-label={t(language, 'shopClose')}
          >
            x
          </button>
        </div>

        <div className="shop-panel2__items">
          {renderSection('free', REWARDED_AD_PRODUCTS)}
          {renderSection('boosts', PAID_SHOP_PRODUCTS.filter((item) => item.section === 'boosts'))}
          {renderSection('permanent', PAID_SHOP_PRODUCTS.filter((item) => item.section === 'permanent'))}
        </div>

        <ActiveSummary boosts={state.shopBoosts} now={now} language={language} />

        <div className="shop-panel2__footer">
          {`${t(language, 'shopTotalSpent')}: $${state.totalShopSpentUSD.toFixed(2)} (${t(language, 'shopTestMode')})`}
        </div>

        {Capacitor.isNativePlatform() && (
          <div style={{ textAlign: 'center', padding: '2px 0 10px' }}>
            <button
              type="button"
              onClick={handleRestore}
              disabled={pendingId !== null}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.55)',
                font: 'inherit',
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: pendingId !== null ? 'default' : 'pointer',
              }}
            >
              {pendingId === '__restore__' ? '…' : t(language, 'shopRestore')}
            </button>
            {restoreMsg && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                {restoreMsg}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
