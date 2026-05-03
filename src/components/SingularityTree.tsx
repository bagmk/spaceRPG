import { SINGULARITY_UNLOCKS } from '../game/constants';
import { formatWhole } from '../game/formulas';
import type { SingularityUnlockId } from '../game/types';

interface SingularityTreeProps {
  condensedMass: number;
  unlocks: SingularityUnlockId[];
  onUnlock: (unlockId: SingularityUnlockId) => void;
}

export function SingularityTree({
  condensedMass,
  unlocks,
  onUnlock,
}: SingularityTreeProps) {
  return (
    <section className="singularity-tree">
      <div className="resource-subhead">{`Condensed Mass: ${formatWhole(condensedMass)}`}</div>
      <div className="singularity-list">
        {SINGULARITY_UNLOCKS.map((unlock) => {
          const owned = unlocks.includes(unlock.id);
          const affordable = condensedMass >= unlock.cost;
          return (
            <button
              key={unlock.id}
              className={`singularity-item ${owned ? 'owned' : ''}`}
              type="button"
              disabled={owned || !affordable}
              onClick={() => onUnlock(unlock.id)}
            >
              <span className="singularity-name">{unlock.label}</span>
              <span className="singularity-cost">{owned ? 'Owned' : `${unlock.cost} mass`}</span>
              <span className="singularity-effect">{unlock.effect}</span>
              <span className="singularity-desc">{unlock.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
