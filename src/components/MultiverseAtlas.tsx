import { useState } from 'react';
import { formatDuration, formatEntropyAmount } from '../game/formulas';
import { formatUniverseModifier, getAnomalyLabel, getEndingLabel } from '../game/multiverse';
import type { EndingId, UniverseAtlasEntry, UniverseSeed } from '../game/types';
import { EndingCredits } from './endings/EndingCredits';
import { t, type Lang } from '../i18n';

interface MultiverseAtlasProps {
  entries: UniverseAtlasEntry[];
  currentSeed: UniverseSeed;
  currentUniverseCount: number;
  language: Lang;
  onBack: () => void;
}

export function MultiverseAtlas({
  entries,
  currentSeed,
  currentUniverseCount,
  language,
  onBack,
}: MultiverseAtlasProps) {
  const [replayEndingId, setReplayEndingId] = useState<EndingId | null>(null);

  if (replayEndingId) {
    return (
      <EndingCredits
        endingId={replayEndingId}
        language={language}
        onComplete={() => setReplayEndingId(null)}
      />
    );
  }

  return (
    <section className="final-screen atlas-screen">
      <div className="final-card atlas-card">
        <div className="q-stage">{t(language, 'atlasLogTitle')}</div>
        <h1>{t(language, 'atlasHeadline')}</h1>
        <p className="final-attr">{t(language, 'atlasIntro')}</p>

        <div className="atlas-current">
          <div className="atlas-current-label">{`${t(language, 'atlasCurrentSeed')} · ${t(language, 'finalUniverse')} #${currentUniverseCount}`}</div>
          <div className="atlas-meta">
            <span>{`${t(language, 'atlasGravity')} ${formatUniverseModifier(currentSeed.gravityMod)}`}</span>
            <span>{`${t(language, 'atlasTime')} ${formatUniverseModifier(currentSeed.timeMod)}`}</span>
            <span>{`${t(language, 'atlasHue')} +${currentSeed.paletteShift}°`}</span>
            <span>{`${t(language, 'atlasAnomaly')} ${getAnomalyLabel(currentSeed.anomaly, language)}`}</span>
          </div>
        </div>

        <div className="atlas-list">
          {entries.length === 0 ? (
            <div className="atlas-empty">{t(language, 'atlasEmpty')}</div>
          ) : (
            entries
              .slice()
              .reverse()
              .map((entry) => (
                <article key={`${entry.universeIndex}-${entry.completedAt}`} className="atlas-entry">
                  <div className="atlas-row">
                    <strong>{`#${entry.universeIndex}`}</strong>
                    <span>{getEndingLabel(entry.endingId, language)}</span>
                    <span>{formatDuration(entry.durationMs)}</span>
                    {entry.entropy != null ? (
                      <span className="atlas-entropy">{`${formatEntropyAmount(entry.entropy)} entropy`}</span>
                    ) : null}
                  </div>
                  <div className="atlas-meta">
                    <span>{`${entry.totalClicks} ${t(language, 'atlasClicks')}`}</span>
                  </div>
                  <button
                    type="button"
                    className="atlas-replay-btn"
                    onClick={() => setReplayEndingId(entry.endingId)}
                  >
                    {language === 'ko' ? '▶ 엔딩 다시 보기' : '▶ Replay Ending'}
                  </button>
                </article>
              ))
          )}
        </div>

        <button className="mini-button atlas-back" type="button" onClick={onBack}>
          {t(language, 'atlasBack')}
        </button>
      </div>
    </section>
  );
}
