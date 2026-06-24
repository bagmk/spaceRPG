import { SINGULARITY_UNLOCKS } from '../game/constants';
import { formatWhole } from '../game/formulas';
import type { SingularityUnlockId } from '../game/types';
import { t, type Lang } from '../i18n';

interface SingularityTreeProps {
  condensedMass: number;
  unlocks: SingularityUnlockId[];
  onUnlock: (unlockId: SingularityUnlockId) => void;
  language?: Lang;
}

export function SingularityTree({
  condensedMass,
  unlocks,
  onUnlock,
  language = 'en',
}: SingularityTreeProps) {
  return (
    <section className="singularity-tree">
      <div className="singularity-tree__header">
        <span className="singularity-tree__label">{t(language, 'finalCondensedMassLabel')}</span>
        <span className="singularity-tree__amount">{formatWhole(condensedMass)}</span>
      </div>
      <div className="singularity-list">
        {SINGULARITY_UNLOCKS.map((unlock) => {
          const owned = unlocks.includes(unlock.id);
          const affordable = condensedMass >= unlock.cost;
          // Panel #7: a node whose effect isn't wired must never be purchasable
          // (it silently ate condensedMass). Show it as "준비 중/Coming soon", disabled.
          const comingSoon = unlock.unimplemented === true;
          return (
            <button
              key={unlock.id}
              className={`singularity-item ${owned ? 'owned' : ''}${comingSoon ? ' coming-soon' : ''}`}
              type="button"
              disabled={owned || comingSoon || !affordable}
              onClick={() => { if (!comingSoon) onUnlock(unlock.id); }}
            >
              <span className="singularity-name">{unlock.label}</span>
              <span className="singularity-cost">
                {comingSoon
                  ? t(language, 'singularityComingSoon')
                  : owned
                    ? t(language, 'finalOwned')
                    : `${unlock.cost} ${t(language, 'finalMassUnit')}`}
              </span>
              <span className="singularity-effect">{unlock.effect}</span>
              <span className="singularity-desc">{unlock.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
