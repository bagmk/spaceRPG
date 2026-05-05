import { useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import { formatWhole, getCompositeBoostMultiplier } from '../game/formulas';
import type { GameAction } from '../game/reducer';
import { SHOP_ITEMS } from '../game/shop/items';
import type { GameState, ShopBoost } from '../game/types';

const SP_ITEM_IDS = new Set(['sp_pack_small', 'sp_pack_large']);

interface ShopPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatRemaining(boosts: ShopBoost[], prefix: string, now: number): string | null {
  const active = boosts.filter((boost) => boost.id.startsWith(prefix) && boost.expiresAt > now);
  if (active.length === 0) {
    return null;
  }
  const nextExpiry = Math.min(...active.map((boost) => boost.expiresAt));
  const remainingSec = Math.max(0, Math.floor((nextExpiry - now) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

export function ShopButton({
  highlighted,
  onClick,
}: {
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`shop-button ${highlighted ? 'affordable' : ''}`}
      onClick={onClick}
      aria-label="Open cosmic shop"
    >
      <span>$</span>
    </button>
  );
}

export function ShopPanel({ state, dispatch, onClose }: ShopPanelProps) {
  const [now, setNow] = useState(Date.now());
  const timeRemaining = formatRemaining(state.shopBoosts, 'time_', now);
  const quantaRemaining = formatRemaining(state.shopBoosts, 'quanta_', now);
  const timeMult = getCompositeBoostMultiplier(state.shopBoosts, 'time_', now);
  const quantaMult = getCompositeBoostMultiplier(state.shopBoosts, 'quanta_', now);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="shop-overlay" onClick={onClose} role="presentation">
      <aside className="shop-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="shop-header">
          <div>
            <div className="q-stage">Cosmic Shop</div>
            <h2>Test Mode Boosts</h2>
          </div>
          <button type="button" className="mini-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="shop-items">
          {SHOP_ITEMS.map((item) => (
            <article className={`shop-card ${SP_ITEM_IDS.has(item.id) ? 'shop-card-sp' : ''}`} key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </div>
              <div className="shop-buy-row">
                <span>{formatPrice(item.priceUSD)}</span>
                <button
                  className="q-continue shop-buy"
                  type="button"
                  onClick={() => dispatch({ type: 'BUY_SHOP_ITEM', itemId: item.id, now: Date.now() })}
                >
                  Buy
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="shop-summary">
          <strong>Active boosts</strong>
          <span>{timeRemaining ? `Time x${formatWhole(timeMult)} — ${timeRemaining}` : 'Time boost inactive'}</span>
          <span>{quantaRemaining ? `Quanta x${formatWhole(quantaMult)} — ${quantaRemaining}` : 'Quanta boost inactive'}</span>
          <span className="shop-sp-balance">{`SP balance: ${formatWhole(state.skillPoints)}`}</span>
        </div>

        <div className="shop-total">{`Total spent: ${formatPrice(state.totalShopSpentUSD)} (test mode)`}</div>
      </aside>
    </div>
  );
}
