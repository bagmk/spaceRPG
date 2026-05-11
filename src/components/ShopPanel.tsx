import { useEffect, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatWhole, getCompositeBoostMultiplier } from '../game/formulas';
import type { GameAction } from '../game/reducer';
import { SHOP_ITEMS } from '../game/shop/items';
import type { GameState, ShopBoost } from '../game/types';
import { t, type Lang, type StringKey } from '../i18n';

const ITEM_VISUAL: Record<string, { icon: string; color: string }> = {
  time_boost:      { icon: '⟳', color: '#4df0cc' },
  cosmic_surge:    { icon: '✦', color: '#ffd766' },
  cosmic_surge_xl: { icon: '⚡', color: '#ff9f40' },
  time_boost_xl:   { icon: '∞', color: '#b48cf0' },
};

const FREE_ITEM_ID = 'cosmic_surge';

const SHOP_COPY: Record<string, { label: StringKey; description: StringKey }> = {
  time_boost: { label: 'shopQuickTimeName', description: 'shopQuickTimeDesc' },
  cosmic_surge: { label: 'shopCosmicSurgeName', description: 'shopCosmicSurgeDesc' },
  time_boost_xl: { label: 'shopAeonSurgeName', description: 'shopAeonSurgeDesc' },
  cosmic_surge_xl: { label: 'shopQuantaStormName', description: 'shopQuantaStormDesc' },
};

function formatRemaining(boosts: ShopBoost[], prefix: string, now: number): string | null {
  const active = boosts.filter((b) => b.id.startsWith(prefix) && b.expiresAt > now);
  if (active.length === 0) return null;
  const sec = Math.max(0, Math.floor((Math.min(...active.map((b) => b.expiresAt)) - now) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface ShopPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  language: Lang;
  onClose: () => void;
}

export function ShopButton({
  highlighted,
  onClick,
  label = 'Shop',
}: {
  highlighted: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`shop-button ${highlighted ? 'affordable' : ''}`}
      onClick={onClick}
      aria-label="Open cosmic shop"
    >
      <span className="hud-action-icon" aria-hidden="true">$</span>
      <span className="hud-action-label">{label}</span>
    </button>
  );
}

export function ShopPanel({ state, dispatch, language, onClose }: ShopPanelProps) {
  const [now, setNow] = useState(Date.now());
  const isTutorial = !state.tutorialFlags['shop-first-used'];
  const activeBoosts = state.shopBoosts.filter((b) => b.expiresAt > now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isTutorial) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isTutorial]);

  const handleBuy = (itemId: string) => {
    dispatch({ type: 'BUY_SHOP_ITEM', itemId, now: Date.now() });
    if (isTutorial) {
      dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'shop-first-used' });
      onClose();
    }
  };

  return (
    <div
      className={`shop-overlay${isTutorial ? ' shop-overlay--tutorial' : ''}`}
      onClick={isTutorial ? undefined : onClose}
      role="presentation"
    >
      <aside
        className={`shop-panel2${isTutorial ? ' shop-panel2--tutorial' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shop-panel2__header">
          <div>
            <div className="shop-panel2__eyebrow">{t(language, 'shopEyebrow')}</div>
            <div className="shop-panel2__title">
              {isTutorial ? t(language, 'shopWelcomeGift') : t(language, 'shopBoosts')}
            </div>
            {isTutorial && (
              <div className="shop-panel2__tutorial-hint">
                {t(language, 'shopTutorialHint')}
              </div>
            )}
          </div>
          {!isTutorial && (
            <button
              type="button"
              className="entity-panel__close"
              onClick={onClose}
              aria-label={t(language, 'shopClose')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Item cards */}
        <div className="shop-panel2__items">
          {SHOP_ITEMS.map((item, idx) => {
            const visual = ITEM_VISUAL[item.id] ?? { icon: '◈', color: '#8090b0' };
            const isFree = isTutorial && item.id === FREE_ITEM_ID;
            const locked = isTutorial && item.id !== FREE_ITEM_ID;
            const boostPrefix = item.id.startsWith('time') ? 'time_' : 'quanta_';
            const remaining = formatRemaining(activeBoosts, boostPrefix, now);
            const copy = SHOP_COPY[item.id];
            const itemLabel = copy ? t(language, copy.label) : item.label;
            const itemDescription = copy ? t(language, copy.description) : item.description;

            return (
              <article
                key={item.id}
                className={[
                  'shop-boost-card',
                  isFree ? 'shop-boost-card--free' : '',
                  locked ? 'shop-boost-card--locked' : '',
                  remaining ? 'shop-boost-card--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  {
                    '--boost-color': visual.color,
                    '--anim-delay': `${idx * 80}ms`,
                  } as CSSProperties
                }
              >
                <div className="shop-boost-card__icon">{visual.icon}</div>

                <div className="shop-boost-card__body">
                  <div className="shop-boost-card__name">{itemLabel}</div>
                  <div className="shop-boost-card__desc">{itemDescription}</div>
                  {remaining && (
                    <div className="shop-boost-card__timer">{`⏱ ${remaining} ${t(language, 'shopLeft')}`}</div>
                  )}
                </div>

                <div className="shop-boost-card__right">
                  {isFree ? (
                    <div className="shop-boost-card__free-badge">{t(language, 'shopFree')}</div>
                  ) : (
                    !locked && (
                      <div className="shop-boost-card__price">{`$${item.priceUSD.toFixed(2)}`}</div>
                    )
                  )}
                  <button
                    type="button"
                    className="shop-boost-card__buy"
                    disabled={locked}
                    onClick={() => handleBuy(item.id)}
                  >
                    {isFree ? t(language, 'shopClaim') : t(language, 'shopBuy')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Active boosts summary */}
        {activeBoosts.length > 0 && (
          <div className="shop-panel2__status">
            <div className="shop-panel2__status-title">{t(language, 'shopActiveBoosts')}</div>
            {(['time_', 'quanta_'] as const).map((prefix) => {
              const mult = getCompositeBoostMultiplier(activeBoosts, prefix, now);
              const rem = formatRemaining(activeBoosts, prefix, now);
              if (mult <= 1 || !rem) return null;
              const label = prefix === 'time_' ? t(language, 'hudTime') : t(language, 'hudQuanta');
              const color = prefix === 'time_' ? '#4df0cc' : '#ffd766';
              return (
                <div
                  key={prefix}
                  className="shop-panel2__status-row"
                  style={{ '--boost-color': color } as CSSProperties}
                >
                  <span className="shop-panel2__status-label">{`${label} ×${formatWhole(mult)}`}</span>
                  <span className="shop-panel2__status-timer">{rem}</span>
                </div>
              );
            })}
          </div>
        )}

        {!isTutorial && (
          <div className="shop-panel2__footer">
            {`${t(language, 'shopTotalSpent')}: $${state.totalShopSpentUSD.toFixed(2)} (${t(language, 'shopTestMode')})`}
          </div>
        )}
      </aside>
    </div>
  );
}
