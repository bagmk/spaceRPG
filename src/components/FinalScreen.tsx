import { useEffect, useState } from 'react';
import {
  formatDuration,
  formatEntropyParts,
  formatWhole,
} from '../game/formulas';
import type { GameState } from '../game/types';
import type { PrestigeUpgradeId } from '../game/prestige';
import type { SingularityUnlockId } from '../game/types';
import type { SoundManager } from '../game/audio';
import { PRESTIGE_CHAPTER_ID, getPrestigeTrackUrls } from '../game/musicChapters';
import { computeCarriedInventory } from '../game/reducers/stage';
import { findEntityById, entityName } from '../game/entities/stageItems';
import { getCodexCompletionFraction } from '../game/entities/codexSets';
import { PrestigeShop } from './PrestigeShop';
import { SingularityTree } from './SingularityTree';
import { t, type Lang } from '../i18n';

const FINAL_QUOTES: { en: string; ko: string; attr: string; attrKo: string }[] = [
  {
    en: 'This is the way the world ends / Not with a bang but a whimper.',
    ko: '세상은 이렇게 끝난다. 쾅 하고가 아니라, 흐느끼듯.',
    attr: 'T.S. Eliot, The Hollow Men (1925)',
    attrKo: 'T.S. 엘리엇, 《텅 빈 사람들》 (1925)',
  },
  {
    en: 'The universe is under no obligation to make sense to you.',
    ko: '우주는 네가 이해하든 말든 신경 쓰지 않는다.',
    attr: 'Neil deGrasse Tyson',
    attrKo: '닐 디그래스 타이슨',
  },
  {
    en: 'We are a way for the cosmos to know itself.',
    ko: '우리는 우주가 자기 자신을 들여다보는 눈이다.',
    attr: 'Carl Sagan, Cosmos (1980)',
    attrKo: '칼 세이건, 《코스모스》 (1980)',
  },
  {
    en: 'The eternal silence of these infinite spaces frightens me.',
    ko: '이 끝없는 공간의 영원한 침묵이, 나를 두렵게 한다.',
    attr: 'Blaise Pascal, Pensées (1670)',
    attrKo: '블레즈 파스칼, 《팡세》 (1670)',
  },
  {
    en: 'Not only is the universe stranger than we think, it is stranger than we can think.',
    ko: '우주는 우리 생각보다 기이할 뿐 아니라, 우리가 상상할 수 있는 것보다도 기이하다.',
    attr: 'Werner Heisenberg',
    attrKo: '베르너 하이젠베르크',
  },
  {
    en: 'The most incomprehensible thing about the universe is that it is comprehensible.',
    ko: '우주에서 가장 이해하기 어려운 건, 우주를 이해할 수 있다는 사실 그 자체다.',
    attr: 'Albert Einstein',
    attrKo: '알베르트 아인슈타인',
  },
  {
    en: 'Two things are infinite: the universe and human stupidity; and I\'m not sure about the universe.',
    ko: '무한한 게 두 개 있다. 우주, 그리고 인간의 어리석음. 다만 우주 쪽은 좀 확신이 없다.',
    attr: 'Albert Einstein',
    attrKo: '알베르트 아인슈타인',
  },
  {
    en: 'In the beginning the Universe was created. This has made a lot of people very angry and been widely regarded as a bad move.',
    ko: '태초에 우주가 만들어졌다. 이 일은 수많은 사람을 분노하게 했으며, 대체로 실수였다는 평가를 받고 있다.',
    attr: 'Douglas Adams, The Restaurant at the End of the Universe (1980)',
    attrKo: '더글러스 애덤스, 《우주 끝의 레스토랑》 (1980)',
  },
  {
    en: 'Look again at that dot. That\'s here. That\'s home. That\'s us.',
    ko: '저 점을 다시 봐라. 저게 여기다. 저게 우리 집이다. 저게 우리다.',
    attr: 'Carl Sagan, Pale Blue Dot (1994)',
    attrKo: '칼 세이건, 《창백한 푸른 점》 (1994)',
  },
  {
    en: 'The nitrogen in our DNA, the calcium in our teeth, the iron in our blood, the carbon in our apple pies were made in the interiors of collapsing stars.',
    ko: 'DNA의 질소, 치아의 칼슘, 혈액의 철분, 애플파이의 탄소. 전부 죽어가는 별 속에서 만들어진 것들이다.',
    attr: 'Carl Sagan, Cosmos (1980)',
    attrKo: '칼 세이건, 《코스모스》 (1980)',
  },
];

interface FinalScreenProps {
  state: GameState;
  language: Lang;
  soundManager?: SoundManager | null;
  onPrestige: () => void;
  onBuyPrestigeUpgrade: (upgradeId: PrestigeUpgradeId) => void;
  onBuySingularityUnlock: (unlockId: SingularityUnlockId) => void;
  onOpenAtlas: () => void;
  onOpenLeaderboard: () => void;
}

export function FinalScreen({ state, language, soundManager, onPrestige, onBuyPrestigeUpgrade, onBuySingularityUnlock, onOpenAtlas, onOpenLeaderboard }: FinalScreenProps) {
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
  // Phase 4-3: what carries to the next universe (best click + rift item) and
  // the codex completion that boosted this run's condensed-mass reward.
  const carried = computeCarriedInventory(state.inventory);
  const codexPct = Math.round(getCodexCompletionFraction(state.almanacCollected) * 100);
  const massEarned = state.lastCondensedMassEarned;
  const codexFactor = state.lastCodexMassBonus;
  const massBase = codexFactor > 0 ? massEarned / codexFactor : massEarned;

  // Prestige/final screen music — "Amazing Grace" instrumental, calm closer.
  // Fades out on unmount so the next screen starts clean.
  useEffect(() => {
    if (!soundManager) return undefined;
    soundManager.fadeOutMusic(1500);
    void soundManager.loadAndPlayChapterPool(PRESTIGE_CHAPTER_ID, getPrestigeTrackUrls(), 2500);
    return () => { soundManager.fadeOutMusic(1500); };
  }, [soundManager]);
  const quoteIdx = (state.universeCount - 1) % FINAL_QUOTES.length;
  const quote = FINAL_QUOTES[quoteIdx];
  const finalQuote = language === 'ko' ? quote.ko : quote.en;
  const finalQuoteAttr = language === 'ko' ? quote.attrKo : quote.attr;
  const entropyReadout = formatEntropyParts(state.entropy);

  return (
    <section className="final-screen">
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

        {/* Completion reward breakdown (Phase 4-3): base × codex = total. */}
        {massEarned > 0 ? (
          <div className="final-reward-row">
            <span className="final-reward-label">{t(language, 'finalCompletionReward')}</span>
            <span className="final-reward-value">
              {formatWhole(massBase)}
              {codexFactor > 1 ? (
                <span className="final-reward-codex">
                  {` × ${codexFactor.toFixed(2)} (${t(language, 'finalCodexProgress')} ${codexPct}%)`}
                </span>
              ) : null}
              {` = ${formatWhole(massEarned)} ${t(language, 'finalCondensedMass')}`}
            </span>
          </div>
        ) : null}

        {/* Singularity tree — spends condensed mass (was never mounted before 4-3). */}
        <SingularityTree
          condensedMass={state.condensedMass}
          unlocks={state.singularityUnlocks}
          onUnlock={onBuySingularityUnlock}
          language={language}
        />

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
          <div className="final-actions-row">
            <button className="final-action-secondary final-action-secondary--flex" type="button" onClick={onOpenAtlas}>
              {t(language, 'finalOpenAtlas')}
            </button>
            <button className="final-action-secondary final-action-secondary--icon" type="button" onClick={onOpenLeaderboard} title={language === 'ko' ? '랭킹' : 'Ranking'}>
              🏆
            </button>
          </div>
        </div>

        {showPrestigeConfirm ? (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" onClick={() => setShowPrestigeConfirm(false)}>
            <div className="overlay-card prestige-confirm" onClick={(e) => e.stopPropagation()}>
              <h2>{t(language, 'prestigeConfirmTitle')}</h2>
              <p className="prestige-confirm__body">{t(language, 'finalPrestigeWarning')}</p>
              {/* Carry preview (Phase 4-3) — on the same overlay as the commit click. */}
              <div className="prestige-confirm__carry">
                <span className="prestige-confirm__carry-title">{t(language, 'finalCarryTitle')}</span>
                {carried.length === 0 ? (
                  <span className="prestige-confirm__carry-none">{t(language, 'finalCarryNone')}</span>
                ) : (
                  <ul className="prestige-confirm__carry-list">
                    {carried.map((inst) => {
                      const ent = findEntityById(inst.entityId);
                      return (
                        <li key={inst.entityId}>
                          {ent ? entityName(ent, language) : inst.entityId}
                          {inst.level > 1 ? ` · Lv.${inst.level}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <span className="prestige-confirm__carry-hint">{t(language, 'finalCarryHint')}</span>
              </div>
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
