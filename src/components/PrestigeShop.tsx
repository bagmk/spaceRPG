import { useState } from 'react';
import {
  PRESTIGE_UPGRADES,
  PRESTIGE_MAX_LEVEL,
  getPrestigeCost,
  getPrestigeMultiplier,
  formatPrestigeCost,
} from '../game/prestige';
import type { PrestigeUpgradeId, PrestigeUpgradeLevels } from '../game/prestige';
import { formatEntropyParts } from '../game/formulas';
import type { Lang } from '../i18n';

const ICONS: Record<PrestigeUpgradeId, string> = {
  time_warp: '⏳',
  matter_forge: '⚛',
  critical_core: '◆',
  auto_engine: '⚡',
  entropy_echo: '∞',
};

const ACCENT_COLORS: Record<PrestigeUpgradeId, string> = {
  time_warp: '#7ec8ff',
  matter_forge: '#a0f0a0',
  critical_core: '#ffb347',
  auto_engine: '#c9a0ff',
  entropy_echo: '#ff8ea0',
};

interface PrestigeShopProps {
  entropy: number;
  prestigeUpgrades: PrestigeUpgradeLevels;
  onBuy: (upgradeId: PrestigeUpgradeId) => void;
  language: Lang;
}

export function PrestigeShop({ entropy, prestigeUpgrades, onBuy, language }: PrestigeShopProps) {
  const entropyReadout = formatEntropyParts(entropy);
  const [celebratingId, setCelebratingId] = useState<PrestigeUpgradeId | null>(null);

  function handleBuy(id: PrestigeUpgradeId) {
    onBuy(id);
    setCelebratingId(id);
    setTimeout(() => setCelebratingId(null), 700);
  }

  return (
    <section className="prestige-shop">
      <div className="prestige-shop__header">
        <span className="prestige-shop__icon">◈</span>
        <div className="prestige-shop__header-text">
          <span className="prestige-shop__label">
            {language === 'ko' ? '엔트로피 보유' : 'Available Entropy'}
          </span>
          <span className="prestige-shop__amount">
            {entropyReadout.value}{' '}
            <span className="hud-entropy-unit">{entropyReadout.unit}</span>
          </span>
        </div>
      </div>
      <div className="prestige-shop__subtitle">
        {language === 'ko'
          ? '영구 프레스티지 — 다음 우주부터 적용'
          : 'Permanent prestige — active from next universe'}
      </div>
      <div className="prestige-shop__grid">
        {PRESTIGE_UPGRADES.map((def, idx) => {
          const level = prestigeUpgrades[def.id] ?? 0;
          const isMaxed = level >= PRESTIGE_MAX_LEVEL;
          const cost = getPrestigeCost(level);
          const canAfford = cost !== null && entropy >= cost;
          const multiplier = getPrestigeMultiplier(level);
          const accent = ACCENT_COLORS[def.id];
          const isCelebrating = celebratingId === def.id;

          return (
            <button
              key={def.id}
              type="button"
              className={[
                'prestige-card',
                isMaxed ? 'prestige-card--maxed' : '',
                canAfford && !isMaxed ? 'prestige-card--affordable' : '',
                isCelebrating ? 'prestige-card--celebrate' : '',
              ].filter(Boolean).join(' ')}
              style={{
                '--prestige-accent': accent,
                '--card-anim-delay': `${idx * 60}ms`,
              } as React.CSSProperties}
              disabled={isMaxed || !canAfford}
              onClick={() => handleBuy(def.id)}
            >
              <div className="prestige-card__glyph">
                <span className="prestige-card__icon">{ICONS[def.id]}</span>
                {level > 0 && <div className="prestige-card__ring" />}
              </div>
              <div className="prestige-card__info">
                <div className="prestige-card__name">
                  {language === 'ko' ? def.name.ko : def.name.en}
                </div>
                <div className="prestige-card__desc">
                  {language === 'ko' ? def.description.ko : def.description.en}
                </div>
                <div className="prestige-card__progress-row">
                  <div className="prestige-card__progress-track">
                    {[0, 1, 2, 3, 4].map((pip) => (
                      <div
                        key={pip}
                        className={`prestige-card__pip ${pip < level ? 'prestige-card__pip--filled' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="prestige-card__mult">x{multiplier % 1 === 0 ? multiplier : multiplier.toFixed(2)}</span>
                </div>
              </div>
              <div className="prestige-card__right">
                {isMaxed ? (
                  <span className="prestige-card__max-badge">
                    {language === 'ko' ? '최대' : 'MAX'}
                  </span>
                ) : (
                  <span className="prestige-card__cost">
                    {formatPrestigeCost(level)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
