import { useState } from 'react';
import {
  PRESTIGE_UPGRADES,
  PRESTIGE_MAX_LEVEL,
  getPrestigeCost,
  getPrestigeMultiplier,
  formatPrestigeCost,
  getCondensationCoreCost,
  getResonanceCoreCost,
  getResonanceCoreMultiplier,
} from '../game/prestige';
import type { PrestigeUpgradeId, PrestigeUpgradeLevels } from '../game/prestige';
import { CONDENSATION_CORE_BOOST_PER_LEVEL } from '../game/balance';
import { formatEntropyParts, formatWhole, getSingularityEcho } from '../game/formulas';
import { t, type Lang } from '../i18n';

// Keyed by legacy save id (see PRESTIGE_UPGRADES) — time_warp now = drop rate.
// condensation_core renders as its OWN dedicated endless card (not in the
// PRESTIGE_UPGRADES grid loop), but the records are keyed by the full id union.
const ICONS: Record<PrestigeUpgradeId, string> = {
  matter_forge: '⚛',
  auto_engine: '⚡',
  critical_core: '◆',
  time_warp: '❖',
  entropy_echo: '∞',
  condensation_core: '◉',
  resonance_core: '✧', // P7 — endless 공명 코어 (echo-bought), its own card like condensation_core
};

const ACCENT_COLORS: Record<PrestigeUpgradeId, string> = {
  matter_forge: '#a0f0a0',
  auto_engine: '#c9a0ff',
  critical_core: '#ffb347',
  time_warp: '#5fe0c8',
  entropy_echo: '#ff8ea0',
  condensation_core: '#7fd8ff',
  resonance_core: '#ffd24a',
};

interface PrestigeShopProps {
  entropy: number;
  condensedMass: number;
  peakEntropy: number;
  echoSpent: number;
  prestigeUpgrades: PrestigeUpgradeLevels;
  onBuy: (upgradeId: PrestigeUpgradeId) => void;
  onSetFocus: (focus: number) => void;
  language: Lang;
}

export function PrestigeShop({ entropy, condensedMass, peakEntropy, echoSpent, prestigeUpgrades, onBuy, onSetFocus, language }: PrestigeShopProps) {
  const entropyReadout = formatEntropyParts(entropy);
  const [celebratingId, setCelebratingId] = useState<PrestigeUpgradeId | null>(null);

  function handleBuy(id: PrestigeUpgradeId) {
    onBuy(id);
    setCelebratingId(id);
    setTimeout(() => setCelebratingId(null), 700);
  }

  // Condensation Core — the ENDLESS condensed-mass sink (uncapped, off-gate).
  const condCoreLevel = prestigeUpgrades.condensation_core ?? 0;
  const condCoreCost = getCondensationCoreCost(condCoreLevel);
  const condCoreCanAfford = condensedMass >= condCoreCost;
  const condCoreBonusPct = Math.round(condCoreLevel * CONDENSATION_CORE_BOOST_PER_LEVEL * 100);
  const condCoreNextPct = Math.round(CONDENSATION_CORE_BOOST_PER_LEVEL * 100);
  const condCoreCelebrating = celebratingId === 'condensation_core';

  // P7 Resonance Core — the INFINITE echo sink (off-gate, geometric). Echo (특이점 잔향) is
  // DERIVED from peakEntropy; spendable = total earned − echoSpent.
  const echoTotal = getSingularityEcho(peakEntropy);
  const echoBalance = Math.max(0, echoTotal - echoSpent);
  const resoLevel = prestigeUpgrades.resonance_core ?? 0;
  const resoCost = getResonanceCoreCost(resoLevel);
  const resoCanAfford = echoBalance >= resoCost;
  const resoMult = getResonanceCoreMultiplier(resoLevel);          // total off-gate wallet ×
  const resoNextMult = getResonanceCoreMultiplier(resoLevel + 1);
  const resoCelebrating = celebratingId === 'resonance_core';
  // echoFocus 0..100 (click weight). The aggregate ×N.NN is the SAME source getActiveModifiers
  // reads (getResonanceCoreMultiplier) — never recomputed, so the readout can't drift.
  const focus = prestigeUpgrades.echoFocus ?? 50;

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

      {/* Condensation Core — the ENDLESS condensed-mass sink (uncapped, off-gate). */}
      <div className="prestige-shop__grid">
        <button
          type="button"
          className={[
            'prestige-card',
            'prestige-card--endless',
            condCoreCanAfford ? 'prestige-card--affordable' : '',
            condCoreCelebrating ? 'prestige-card--celebrate' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--prestige-accent': '#7fd8ff' } as React.CSSProperties}
          disabled={!condCoreCanAfford}
          onClick={() => handleBuy('condensation_core')}
        >
          <div className="prestige-card__glyph">
            <span className="prestige-card__icon">◉</span>
            {condCoreLevel > 0 && <div className="prestige-card__ring" />}
          </div>
          <div className="prestige-card__info">
            <div className="prestige-card__name">
              {t(language, 'condCoreName')}{' '}
              <span className="prestige-card__endless-tag">{t(language, 'condCoreEndless')}</span>
            </div>
            <div className="prestige-card__desc">{t(language, 'condCoreDesc')}</div>
            <div className="prestige-card__progress-row">
              <span className="prestige-card__mult">
                {t(language, 'condCoreLevel')} {condCoreLevel}
                {condCoreLevel > 0 ? ` · +${condCoreBonusPct}%` : ''}
                {` (→ +${condCoreNextPct}% ${t(language, 'condCoreIncome')})`}
              </span>
            </div>
          </div>
          <div className="prestige-card__right">
            <span className="prestige-card__cost">
              {formatWhole(condCoreCost)} {t(language, 'finalMassUnit')}
            </span>
          </div>
        </button>
      </div>

      {/* P7 — Singularity Echo (특이점 잔향): the INFINITE compounding sink. Balance bar +
          endless Resonance Core card + a click↔auto focus slider (pure re-spec). */}
      <div className="prestige-shop__echo-bar">
        <div className="prestige-shop__echo-balance">
          <span className="prestige-shop__echo-label">{t(language, 'echoBalanceLabel')}</span>
          <span className="prestige-shop__echo-amount">✧ {formatWhole(echoBalance)}</span>
        </div>
        <span className="prestige-shop__echo-mult">{t(language, 'echoIncomeAll')} ×{resoMult.toFixed(2)}</span>
      </div>
      <div className="prestige-shop__grid">
        <button
          type="button"
          className={[
            'prestige-card',
            'prestige-card--endless',
            resoCanAfford ? 'prestige-card--affordable' : '',
            resoCelebrating ? 'prestige-card--celebrate' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--prestige-accent': '#ffd24a' } as React.CSSProperties}
          disabled={!resoCanAfford}
          onClick={() => handleBuy('resonance_core')}
        >
          <div className="prestige-card__glyph">
            <span className="prestige-card__icon">✧</span>
            {resoLevel > 0 && <div className="prestige-card__ring" />}
          </div>
          <div className="prestige-card__info">
            <div className="prestige-card__name">
              {t(language, 'resonanceCoreName')}{' '}
              <span className="prestige-card__endless-tag">{t(language, 'condCoreEndless')}</span>
            </div>
            <div className="prestige-card__desc">{t(language, 'resonanceCoreDesc')}</div>
            <div className="prestige-card__progress-row">
              <span className="prestige-card__mult">
                {t(language, 'condCoreLevel')} {resoLevel}
                {resoLevel > 0 ? ` · ×${resoMult.toFixed(2)}` : ''}
                {` (→ ×${resoNextMult.toFixed(2)})`}
              </span>
            </div>
          </div>
          <div className="prestige-card__right">
            <span className="prestige-card__cost">✧ {formatWhole(resoCost)}</span>
          </div>
        </button>
      </div>
      <div className="prestige-shop__focus">
        <span className="prestige-shop__focus-label">{t(language, 'echoFocusLabel')}</span>
        <div className="prestige-shop__focus-row">
          <span className="prestige-shop__focus-end">{t(language, 'echoFocusAuto')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={focus}
            onChange={(e) => onSetFocus(Number(e.target.value))}
            className="prestige-shop__focus-slider"
            aria-label={t(language, 'echoFocusLabel')}
          />
          <span className="prestige-shop__focus-end">{t(language, 'echoFocusClick')}</span>
        </div>
        <span className="prestige-shop__focus-readout">
          {t(language, 'echoFocusClick')} {focus}% · {t(language, 'echoFocusAuto')} {100 - focus}%
        </span>
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
