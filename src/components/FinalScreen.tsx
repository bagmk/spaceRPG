import { useState } from 'react';
import {
  formatDuration,
  formatEntropyParts,
  formatWhole,
} from '../game/formulas';
import type { GameState } from '../game/types';
import type { PrestigeUpgradeId } from '../game/prestige';
import { PrestigeShop } from './PrestigeShop';
import { t, type Lang } from '../i18n';

const FINAL_QUOTES: { en: string; ko: string; attr: string; attrKo: string }[] = [
  {
    en: 'This is the way the world ends / Not with a bang but a whimper.',
    ko: '이것이 세상이 끝나는 방식이다 / 쾅 소리가 아닌 흐느낌으로.',
    attr: 'T.S. Eliot, The Hollow Men (1925)',
    attrKo: 'T.S. 엘리엇, 《텅 빈 사람들》 (1925)',
  },
  {
    en: 'The universe is under no obligation to make sense to you.',
    ko: '우주는 당신에게 이해되어야 할 의무가 없다.',
    attr: 'Neil deGrasse Tyson',
    attrKo: '닐 디그래스 타이슨',
  },
  {
    en: 'We are a way for the cosmos to know itself.',
    ko: '우리는 우주가 스스로를 알기 위한 방법이다.',
    attr: 'Carl Sagan, Cosmos (1980)',
    attrKo: '칼 세이건, 《코스모스》 (1980)',
  },
  {
    en: 'The eternal silence of these infinite spaces frightens me.',
    ko: '이 무한한 공간의 영원한 침묵이 나를 두렵게 한다.',
    attr: 'Blaise Pascal, Pensées (1670)',
    attrKo: '블레즈 파스칼, 《팡세》 (1670)',
  },
  {
    en: 'Not only is the universe stranger than we think, it is stranger than we can think.',
    ko: '우주는 우리가 생각하는 것보다 기묘할 뿐 아니라, 생각할 수 있는 것보다도 기묘하다.',
    attr: 'Werner Heisenberg',
    attrKo: '베르너 하이젠베르크',
  },
  {
    en: 'The most incomprehensible thing about the universe is that it is comprehensible.',
    ko: '우주에서 가장 이해할 수 없는 것은 우주가 이해 가능하다는 것이다.',
    attr: 'Albert Einstein',
    attrKo: '알베르트 아인슈타인',
  },
  {
    en: 'Two things are infinite: the universe and human stupidity; and I\'m not sure about the universe.',
    ko: '무한한 것은 두 가지다: 우주 그리고 인간의 어리석음. 우주에 대해서는 확신이 없지만.',
    attr: 'Albert Einstein',
    attrKo: '알베르트 아인슈타인',
  },
  {
    en: 'In the beginning the Universe was created. This has made a lot of people very angry and been widely regarded as a bad move.',
    ko: '태초에 우주가 창조되었다. 이것은 많은 사람을 매우 화나게 했고 널리 나쁜 결정으로 여겨졌다.',
    attr: 'Douglas Adams, The Restaurant at the End of the Universe (1980)',
    attrKo: '더글러스 애덤스, 《우주 끝의 레스토랑》 (1980)',
  },
  {
    en: 'Look again at that dot. That\'s here. That\'s home. That\'s us.',
    ko: '저 점을 다시 보라. 저것이 여기다. 저것이 우리의 집이다. 저것이 우리다.',
    attr: 'Carl Sagan, Pale Blue Dot (1994)',
    attrKo: '칼 세이건, 《창백한 푸른 점》 (1994)',
  },
  {
    en: 'The nitrogen in our DNA, the calcium in our teeth, the iron in our blood, the carbon in our apple pies were made in the interiors of collapsing stars.',
    ko: 'DNA 속의 질소, 치아의 칼슘, 피의 철, 애플파이의 탄소는 모두 붕괴하는 별의 내부에서 만들어졌다.',
    attr: 'Carl Sagan, Cosmos (1980)',
    attrKo: '칼 세이건, 《코스모스》 (1980)',
  },
];

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
  const quoteIdx = (state.universeCount - 1) % FINAL_QUOTES.length;
  const quote = FINAL_QUOTES[quoteIdx];
  const finalQuote = language === 'ko' ? quote.ko : quote.en;
  const finalQuoteAttr = language === 'ko' ? quote.attrKo : quote.attr;
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
