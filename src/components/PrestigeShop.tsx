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

interface PrestigeShopProps {
  entropy: number;
  prestigeUpgrades: PrestigeUpgradeLevels;
  onBuy: (upgradeId: PrestigeUpgradeId) => void;
  language: Lang;
}

export function PrestigeShop({ entropy, prestigeUpgrades, onBuy, language }: PrestigeShopProps) {
  const entropyReadout = formatEntropyParts(entropy);

  return (
    <section className="prestige-shop">
      <div className="prestige-shop__header">
        <span className="prestige-shop__label">
          {language === 'ko' ? '엔트로피 보유' : 'Available Entropy'}
        </span>
        <span className="prestige-shop__amount">
          {entropyReadout.value}
          <span className="hud-entropy-unit">{entropyReadout.unit}</span>
        </span>
      </div>
      <div className="prestige-shop__subtitle">
        {language === 'ko'
          ? '영구 프레스티지 업그레이드 — 다음 우주부터 적용됩니다.'
          : 'Permanent prestige upgrades — active from next universe.'}
      </div>
      <div className="prestige-shop__grid">
        {PRESTIGE_UPGRADES.map((def) => {
          const level = prestigeUpgrades[def.id] ?? 0;
          const isMaxed = level >= PRESTIGE_MAX_LEVEL;
          const cost = getPrestigeCost(level);
          const canAfford = cost !== null && entropy >= cost;
          const multiplier = getPrestigeMultiplier(level);

          return (
            <div
              key={def.id}
              className={`prestige-card ${isMaxed ? 'prestige-card--maxed' : ''}`}
            >
              <div className="prestige-card__name">
                {language === 'ko' ? def.name.ko : def.name.en}
              </div>
              <div className="prestige-card__desc">
                {language === 'ko' ? def.description.ko : def.description.en}
              </div>
              <div className="prestige-card__stats">
                <span className="prestige-card__level">
                  Lv {level}/{PRESTIGE_MAX_LEVEL}
                </span>
                <span className="prestige-card__mult">x{multiplier}</span>
              </div>
              {isMaxed ? (
                <button
                  className="prestige-card__btn prestige-card__btn--max"
                  type="button"
                  disabled
                >
                  {language === 'ko' ? '최대' : 'MAX'}
                </button>
              ) : (
                <button
                  className="prestige-card__btn"
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onBuy(def.id)}
                >
                  {canAfford
                    ? `${language === 'ko' ? '구매' : 'Buy'} — ${formatPrestigeCost(level)}`
                    : `${formatPrestigeCost(level)}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
