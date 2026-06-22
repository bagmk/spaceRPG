import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatGameNumberShort, getEntropyGateProgress } from '../game/formulas';
import { useModalA11y } from '../hooks/useModalA11y';
import type { GameAction } from '../game/reducer';
import {
  MATTER_PACK_PRODUCTS,
  DEEP_SPACE_STORAGE,
  REWARDED_AD_PRODUCTS,
  findPaidShopProduct,
  type PaidShopProduct,
  type RewardedAdProduct,
} from '../game/shop/items';
import { completeMockPurchase, restorePurchases } from '../game/shop/purchase';
import { recordPurchaseEvent } from '../cloud/purchases';
import { Capacitor } from '@capacitor/core';
import { completeRewardedAd } from '../game/shop/adRewards';
import {
  getActiveBoostSummary,
  getBoostRemainingMs,
  isCashShopUnlocked,
} from '../game/shop/boosts';
import type { ActiveBoostSummary } from '../game/shop/boosts';
import { generateDailyShop, toDateKey } from '../game/shop/daily';
import { shopItemMatterCost, shopStoneMatterCost, shopRefreshMatterCost, gachaBoxMatterCost, packMatterPayout } from '../game/shop/pricing';
import { STONE_BUNDLES, GACHA_BOXES, EFFECT_TRAIT } from '../game/balance';
import { STAGES } from '../game/stages';
import { findEntityById, entityName } from '../game/entities/stageItems';
import { isTailQuality } from '../game/entities/quality';
import type { EntityRarity } from '../game/entities/types';
import type { GearPower } from '../game/entities/substats';
import { EntityGlyph } from './EntityGlyph';
import { effectValueLabel, SpecChip, TraitBadge, TRAIT_ICON_TONE } from './EntityPanel';
import type { GameState, ShopBoostCategory } from '../game/types';
import { t, type Lang } from '../i18n';

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
  mythic: '#ff5db5',
};
const RARITY_LABEL_KEY: Record<EntityRarity, Parameters<typeof t>[1]> = {
  common: 'rarityCommon', rare: 'rarityRare', epic: 'rarityEpic', legendary: 'rarityLegendary', mythic: 'rarityMythic',
};
/** Box tier display names (KO/EN). */
const GACHA_BOX_NAME: Record<string, { en: string; ko: string }> = {
  box_faint: { en: 'Faint Nebula', ko: '희미한 성운' },
  box_bright: { en: 'Bright Nebula', ko: '찬란한 성운' },
  box_prime: { en: 'Primordial Nebula', ko: '태초의 성운' },
};
/** Gacha box tier → grade-card accent (by GachaBoxSpec.rank 0/1/2). Drives the
 *  shared --rarity-color so each box reads its tier via the same color language.
 *  NB: keyed off rank, not box.odds — all boxes have legendary>0, so an
 *  odds-headline pick would collapse every box to one color. */
const GACHA_RANK_ACCENT: Record<number, string> = {
  0: RARITY_COLORS.rare,
  1: RARITY_COLORS.epic,
  2: RARITY_COLORS.legendary,
};

function formatRemainingMs(ms: number): string | null {
  if (ms <= 0) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** HH:MM:SS until the next LOCAL midnight — when the daily shop roster resets. */
function formatResetCountdown(now: number): string {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  let s = Math.max(0, Math.floor((next.getTime() - now) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

interface ShopPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  language: Lang;
  onClose: () => void;
  /** Plays a purchase chime (wired to the sound manager in GameScreen). */
  onSfx?: () => void;
}

export function ShopButton({
  highlighted,
  disabled = false,
  onClick,
  label = 'Shop',
  lockStageLabel,
}: {
  highlighted: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  /** e.g. "S3" — corner badge while locked (parity with the equip/fuse rail buttons). */
  lockStageLabel?: string;
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
      {disabled && lockStageLabel ? <span className="entity-lab-button__lockstage" aria-hidden="true">{lockStageLabel}</span> : null}
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

/** A board section ("게시판") wrapping a group of shop cards so groups read distinctly. */
function ShopBoard({ title, modifier, action, children }: { title: string; modifier?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`shop-board ${modifier ?? ''}`}>
      <div className="shop-board__head">
        <span className="shop-board__title">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ShopPanel({ state, dispatch, language, onClose, onSfx }: ShopPanelProps) {
  const [now, setNow] = useState(Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const unlocked = isCashShopUnlocked(state);
  // Local calendar day that drives the daily roster (changes once/day as now ticks).
  const todayKey = toDateKey(now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  // C-P1 a11y: Esc-to-close + focus trap + restore (replaces the old Esc-only effect).
  const overlayRef = useRef<HTMLDivElement>(null);
  useModalA11y(overlayRef, onClose);
  // Commit the date-rollover on open AND whenever the local day flips while the
  // shop stays open, so the persisted roster matches what's displayed/charged.
  useEffect(() => { dispatch({ type: 'SYNC_DAILY_SHOP', now }); }, [dispatch, todayKey, now]);

  // Clear any lingering gacha reveal when the shop closes.
  useEffect(() => () => {
    if (state.lastGachaEvent) dispatch({ type: 'CLEAR_GACHA_EVENT', id: state.lastGachaEvent.id });
  }, [dispatch, state.lastGachaEvent]);

  if (!unlocked) return null;

  const quanta = state.quanta;
  const playerStageId = STAGES[Math.min(Math.max(0, state.stageIdx), STAGES.length - 1)].id;
  // GearPower for the inline spec preview — matches what equipping would yield.
  const power: GearPower = { stageId: playerStageId, gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx) };

  // Effective daily roster — mirrors the reducer's date-rollover so display
  // matches what a buy will charge.
  const fresh = state.dailyShopDateKey !== todayKey;
  const refreshCount = fresh ? 0 : state.dailyShopRefreshCount;
  const purchased = fresh ? [] : state.dailyShopPurchased;
  const roster = generateDailyShop(todayKey, refreshCount, playerStageId);
  const refreshCost = shopRefreshMatterCost(playerStageId, refreshCount);

  const handlePaid = async (product: PaidShopProduct) => {
    // #43: cash-shop payment is OFF — everything is FREE for now. completeMockPurchase
    // always succeeds; no purchase event is recorded.
    if (!unlocked || pendingId) return;
    setPendingId(product.id);
    const result = await completeMockPurchase(product);
    if (result.success) {
      dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: product.id, now: Date.now() });
      onSfx?.();
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
      if (product && product.repeatable === false) {
        dispatch({ type: 'COMPLETE_SHOP_PURCHASE', itemId: id, now: Date.now(), viaRestore: true });
        void recordPurchaseEvent({ type: 'restore', productId: id });
        restored += 1;
      }
    }
    setRestoreMsg(t(language, restored > 0 ? 'shopRestoreDone' : 'shopRestoreNone'));
    setPendingId(null);
  };

  const openBox = (boxId: string) => {
    const cost = gachaBoxMatterCost(boxId, playerStageId);
    if (cost <= 0 || quanta < cost) return;
    dispatch({
      type: 'OPEN_GACHA_BOX',
      boxId,
      // A7: one roll set per potential item (handler slices to the box's count).
      rolls: Array.from({ length: 4 }, () => ({
        rarityRoll: Math.random(), stageRoll: Math.random(), pickRoll: Math.random(), q1: Math.random(), q2: Math.random(),
      })),
      stoneRoll: Math.random(),
    });
    onSfx?.();
  };

  const gachaEvent = state.lastGachaEvent;

  const accent = STAGES[Math.min(Math.max(0, state.stageIdx), STAGES.length - 1)].accent ?? '#8090b0';
  return (
    <div className="entity-fs shop-fs" role="dialog" aria-modal="true" aria-label={t(language, 'hudShop')} onClick={onClose} ref={overlayRef} tabIndex={-1}>
      <section className="entity-fs__panel" onClick={(e) => e.stopPropagation()} style={{ '--stage-accent': accent } as CSSProperties}>
      <header className="entity-fs__topbar">
        <h2 className="entity-fs__screen-title">{t(language, 'hudShop')}</h2>
        <span className="shop-fs__balance">⚛{formatGameNumberShort(quanta)} · ◆{formatGameNumberShort(state.enhanceStones)}</span>
        <button className="entity-fs__close" aria-label={t(language, 'shopClose')} onClick={onClose}>✕</button>
      </header>

      <div className="shop-fs__body cc-scroll">
        {/* 1) Today's Shop — the loudest board so daily items read distinct. */}
        <ShopBoard
          title={t(language, 'shopDailyTitle')}
          modifier="shop-board--daily"
          action={(
            <button
              type="button"
              className="shop-fs__refresh"
              disabled={quanta < refreshCost}
              onClick={() => dispatch({ type: 'REFRESH_DAILY_SHOP', now })}
            >
              {`↻ ⚛${formatGameNumberShort(refreshCost)}`}
            </button>
          )}
        >
          <div className="shop-fs__reset-timer">{`⏱ ${formatResetCountdown(now)} ${t(language, 'shopResetIn')}`}</div>
          <div className="shop-fs__daily-grid">
            {roster.map((offer) => {
              const ent = findEntityById(offer.entityId);
              const cost = shopItemMatterCost(offer.rarity, playerStageId);
              const sold = purchased.includes(offer.slot);
              const afford = quanta >= cost;
              const rc = RARITY_COLORS[offer.rarity];
              const spec = ent ? effectValueLabel(ent, language, power, 1, 1, false, false) : null;
              const tr = ent ? EFFECT_TRAIT[ent.effect.type] : null;
              return (
                <button
                  key={offer.slot}
                  type="button"
                  className={`shop-card shop-item-card ${sold ? 'shop-item-card--sold' : ''}`}
                  style={{ '--rarity-color': rc } as CSSProperties}
                  disabled={sold || !afford}
                  onClick={() => { dispatch({ type: 'BUY_DAILY_ITEM', slot: offer.slot, now }); onSfx?.(); }}
                >
                  {ent ? <TraitBadge entity={ent} className="trait-badge--card" /> : null}
                  <span className="shop-item-card__rarity" style={{ color: rc }}>{t(language, RARITY_LABEL_KEY[offer.rarity])}</span>
                  {ent ? <EntityGlyph entity={ent} color={rc} /> : null}
                  <span className="shop-item-card__name">{ent ? entityName(ent, language) : offer.entityId}</span>
                  {spec && tr ? <SpecChip icon={tr.icon} value={spec.value} label={spec.label} accent={TRAIT_ICON_TONE} /> : null}
                  <span className="shop-card__price">
                    {sold ? t(language, 'shopSoldOut') : `⚛${formatGameNumberShort(cost)}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="shop-fs__daily-hint">{t(language, 'shopDailyHint')}</div>
        </ShopBoard>

        {/* 2) Nebula Boxes (gacha) — buy with matter, reveal in place. */}
        <ShopBoard title={t(language, 'shopGachaTitle')} modifier="shop-board--feature">
          <div className="shop-gacha-row">
            {GACHA_BOXES.map((box) => {
              const cost = gachaBoxMatterCost(box.id, playerStageId);
              const afford = quanta >= cost;
              const odds = (['rare', 'epic', 'legendary'] as EntityRarity[])
                .filter((r) => (box.odds[r] ?? 0) > 0)
                .map((r) => `${t(language, RARITY_LABEL_KEY[r])} ${box.odds[r]}%`)
                .join(' · ');
              return (
                <button
                  key={box.id}
                  type="button"
                  className="shop-card shop-gacha-card"
                  style={{ '--rarity-color': GACHA_RANK_ACCENT[box.rank] } as CSSProperties}
                  disabled={!afford}
                  onClick={() => openBox(box.id)}
                  title={`${t(language, 'shopGachaOdds')}: ${odds}`}
                >
                  <span className="shop-gacha-card__icon" aria-hidden="true">🎁</span>
                  <span className="shop-gacha-card__name">{GACHA_BOX_NAME[box.id]?.[language] ?? box.id}</span>
                  <span className="shop-gacha-card__odds">{odds}</span>
                  <span className="shop-card__price">⚛{formatGameNumberShort(cost)}</span>
                </button>
              );
            })}
          </div>
          {gachaEvent && gachaEvent.items.length > 0 ? (() => {
            const again = gachaBoxMatterCost(gachaEvent.boxId, playerStageId);
            return (
              <div className="fusion-result fusion-result--boom shop-gacha-reveal" role="status">
                <div className="fusion-result__rays" aria-hidden="true" />
                <div className="shop-gacha-haul">
                  {gachaEvent.items.map((it, i) => {
                    const ent = findEntityById(it.entityId);
                    if (!ent) return null;
                    const rc = RARITY_COLORS[ent.rarity];
                    const tail = isTailQuality(it.quality);
                    return (
                      <div
                        key={i}
                        className={`shop-gacha-haul-card shop-gacha-haul-card--${ent.rarity} ${tail ? 'entity-detail-card--tail' : ''}`}
                        style={{ '--rarity-color': rc } as CSSProperties}
                      >
                        <EntityGlyph entity={ent} color={rc} />
                        <span className="shop-gacha-haul-card__name">{entityName(ent, language)}</span>
                        <span className="shop-gacha-haul-card__rarity" style={{ color: rc }}>{t(language, RARITY_LABEL_KEY[ent.rarity])}</span>
                      </div>
                    );
                  })}
                </div>
                {gachaEvent.stonesEarned > 0 ? (
                  <div className="shop-gacha-haul__stones">{`◆ ${gachaEvent.stonesEarned} ${t(language, 'shopStonesTitle')}`}</div>
                ) : null}
                <div className="fusion-result__actions">
                  <button type="button" className="fusion-result__retry" disabled={quanta < again} onClick={() => openBox(gachaEvent.boxId)}>
                    {t(language, 'shopGachaAgain')}
                  </button>
                  <button type="button" className="fusion-result__close" onClick={() => dispatch({ type: 'CLEAR_GACHA_EVENT', id: gachaEvent.id })}>
                    {t(language, 'fuseClose')}
                  </button>
                </div>
              </div>
            );
          })() : null}
        </ShopBoard>

        {/* 3) Enhance Stones + Matter Packs. */}
        <ShopBoard title={t(language, 'shopStonesTitle')}>
          <div className="shop-fs__stones">
            {STONE_BUNDLES.map((count) => {
              const cost = shopStoneMatterCost(playerStageId, count);
              const afford = quanta >= cost;
              return (
                <button
                  key={count}
                  type="button"
                  className="shop-card shop-stone-card"
                  style={{ '--rarity-color': 'var(--cc-stone-accent)' } as CSSProperties}
                  disabled={!afford}
                  onClick={() => { dispatch({ type: 'BUY_ENHANCE_STONES', count }); onSfx?.(); }}
                >
                  <span className="shop-stone-card__amount">◆ {count}</span>
                  <span className="shop-card__price">⚛{formatGameNumberShort(cost)}</span>
                </button>
              );
            })}
          </div>
          <div className="shop-fs__section-title">{t(language, 'shopPacksTitle')}</div>
          <div className="shop-fs__packs">
            {MATTER_PACK_PRODUCTS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="shop-card shop-pack-card"
                style={{ '--boost-color': p.color, '--rarity-color': p.color } as CSSProperties}
                disabled={pendingId !== null}
                onClick={() => handlePaid(p)}
              >
                <span className="shop-pack-card__icon">{p.icon}</span>
                <span className="shop-pack-card__amount">{p.name[language]}</span>
                <span className="shop-pack-card__payout">⚛{formatGameNumberShort(packMatterPayout(i, playerStageId))}</span>
                <span className="shop-card__price">{pendingId === p.id ? '…' : `$${p.priceUSD.toFixed(2)}`}</span>
              </button>
            ))}
          </div>
        </ShopBoard>

        {/* 4) Boosts & storage. */}
        <ShopBoard title={t(language, 'shopTabBoosts')}>
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
        </ShopBoard>
      </div>
      </section>
    </div>
  );
}
