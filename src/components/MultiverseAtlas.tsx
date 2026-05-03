import { formatDuration } from '../game/formulas';
import { formatUniverseModifier, getAnomalyLabel } from '../game/multiverse';
import type { UniverseAtlasEntry, UniverseSeed } from '../game/types';

interface MultiverseAtlasProps {
  entries: UniverseAtlasEntry[];
  currentSeed: UniverseSeed;
  currentUniverseCount: number;
  onBack: () => void;
}

export function MultiverseAtlas({
  entries,
  currentSeed,
  currentUniverseCount,
  onBack,
}: MultiverseAtlasProps) {
  return (
    <section className="final-screen atlas-screen">
      <div className="final-card atlas-card">
        <div className="q-stage">UNIVERSE LOG</div>
        <h1>Multiverse Atlas</h1>
        <p className="final-attr">Every prestige bends gravity, time, color, and occasionally reality itself.</p>

        <div className="atlas-current">
          <div className="atlas-current-label">{`Current Seed · Universe #${currentUniverseCount}`}</div>
          <div className="atlas-current-name">{currentSeed.atlasName}</div>
          <div className="atlas-meta">
            <span>{`Gravity ${formatUniverseModifier(currentSeed.gravityMod)}`}</span>
            <span>{`Time ${formatUniverseModifier(currentSeed.timeMod)}`}</span>
            <span>{`Hue +${currentSeed.paletteShift}°`}</span>
            <span>{`Anomaly ${getAnomalyLabel(currentSeed.anomaly)}`}</span>
          </div>
        </div>

        <div className="atlas-list">
          {entries.length === 0 ? (
            <div className="atlas-empty">No completed universes yet. The first log entry appears after your first ending.</div>
          ) : (
            entries
              .slice()
              .reverse()
              .map((entry) => (
                <article key={`${entry.universeIndex}-${entry.completedAt}`} className="atlas-entry">
                  <div className="atlas-row">
                    <strong>{`#${entry.universeIndex}`}</strong>
                    <span className="atlas-name">"{entry.atlasName}"</span>
                    <span>{entry.endingId.replace('_', ' ')}</span>
                    <span>{formatDuration(entry.durationMs)}</span>
                  </div>
                  <div className="atlas-meta atlas-hover-hint">Hover or focus for details</div>
                  <div className="atlas-meta atlas-detail">
                    <span>{`Gravity ${formatUniverseModifier(entry.seed.gravityMod)}`}</span>
                    <span>{`Time ${formatUniverseModifier(entry.seed.timeMod)}`}</span>
                    <span>{`Hue +${entry.seed.paletteShift}°`}</span>
                    <span>{`Anomaly ${getAnomalyLabel(entry.seed.anomaly)}`}</span>
                    <span>{`${entry.totalClicks} clicks`}</span>
                    <span>{`${entry.collisions} encounters`}</span>
                  </div>
                </article>
              ))
          )}
        </div>

        <button className="mini-button atlas-back" type="button" onClick={onBack}>
          BACK
        </button>
      </div>
    </section>
  );
}
