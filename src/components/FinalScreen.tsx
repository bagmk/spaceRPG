import { useState } from 'react';
import {
  formatDuration,
  formatEntropyParts,
  formatWhole,
} from '../game/formulas';
import { STAGES } from '../game/stages';

import type { GameState } from '../game/types';
import type { PrestigeUpgradeId } from '../game/prestige';
import { PrestigeShop } from './PrestigeShop';
import { t, type Lang } from '../i18n';

interface FinalScreenProps {
  state: GameState;
  language: Lang;
  onPrestige: () => void;
  onBuyPrestigeUpgrade: (upgradeId: PrestigeUpgradeId) => void;
  onOpenAtlas: () => void;
  onOpenLeaderboard: () => void;
  onClose: () => void;
}

export function FinalScreen({ state, language, onPrestige, onBuyPrestigeUpgrade, onOpenAtlas, onOpenLeaderboard, onClose }: FinalScreenProps) {
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
  const finalStage = STAGES[STAGES.length - 1];
  const finalQuote = language === 'ko' ? finalStage.quoteKo ?? finalStage.quote : finalStage.quote;
  const finalQuoteAttr = language === 'ko'
    ? finalStage.quoteAttrKo ?? finalStage.quoteAttr
    : finalStage.quoteAttr;
  const entropyReadout = formatEntropyParts(state.entropy);

  return (
    <section className="final-screen">
      <button type="button" className="final-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="final-card">

        {/* Header */}
        <div className="final-header">
          <div className="final-universe-tag">
            {t(language, 'finalUniverse')} <span className="final-universe-num">#{state.universeCount}</span>
          </div>
        </div>

        {/* Quote */}
        <div className="final-quote-block">
          <blockquote className="final-quote-text">"{finalQuote}"</blockquote>
          <cite className="final-quote-attr">— {finalQuoteAttr}</cite>
        </div>

        {/* Stats */}
        <div className="final-stats">
          <div className="final-stat-cell">
            <strong className="final-entropy-amount">
              <span>{entropyReadout.value}</span>
              <span className="hud-entropy-unit">{entropyReadout.unit}</span>
            </strong>
            <span>{t(language, 'finalTotalEntropy')}</span>
          </div>
          <div className="final-stat-cell">
            <strong>{formatWhole(state.totalClicks)}</strong>
            <span>{t(language, 'finalTotalClicks')}</span>
          </div>
          <div className="final-stat-cell">
            <strong>{formatDuration(state.totalTimePlayed)}</strong>
            <span>{t(language, 'finalTimeElapsed')}</span>
          </div>
        </div>

        {/* Prestige Shop */}
        <PrestigeShop
          entropy={state.entropy}
          prestigeUpgrades={state.prestigeUpgrades}
          onBuy={onBuyPrestigeUpgrade}
          language={language}
        />

        {/* Actions */}
        <div className="final-actions">
          <button className="final-action-primary" type="button" onClick={() => setShowPrestigeConfirm(true)}>
            {t(language, 'finalNextBigBang')}
          </button>
          <button className="final-action-secondary" type="button" onClick={onOpenAtlas}>
            {t(language, 'finalOpenAtlas')}
          </button>
          <button className="final-action-icon" type="button" onClick={onOpenLeaderboard} title={language === 'ko' ? '랭킹' : 'Ranking'}>
            🏆
          </button>
        </div>

        {showPrestigeConfirm ? (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" onClick={() => setShowPrestigeConfirm(false)}>
            <div className="overlay-card prestige-confirm" onClick={(e) => e.stopPropagation()}>
              <h2>{t(language, 'prestigeConfirmTitle')}</h2>
              <p className="prestige-confirm__body">{t(language, 'finalPrestigeWarning')}</p>
              <div className="prestige-confirm__actions">
                <button className="final-action-primary" type="button" onClick={onPrestige}>
                  {t(language, 'prestigeConfirmYes')}
                </button>
                <button className="final-action-secondary" type="button" onClick={() => setShowPrestigeConfirm(false)}>
                  {t(language, 'prestigeConfirmNo')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </section>
  );
}
