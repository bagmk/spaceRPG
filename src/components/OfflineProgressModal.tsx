import { formatDuration, formatWhole } from '../game/formulas';

interface OfflineProgressModalProps {
  awayMs: number;
  gained: number;
  onDismiss: () => void;
}

export function OfflineProgressModal({
  awayMs,
  gained,
  onDismiss,
}: OfflineProgressModalProps) {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card">
        <div className="q-stage">While You Were Away</div>
        <h2>The universe kept moving.</h2>
        <p>{`Away for ${formatDuration(awayMs)}.`}</p>
        <p>{`It gathered ${formatWhole(gained)} resources in your absence.`}</p>
        <button className="q-continue" type="button" onClick={onDismiss}>
          RETURN
        </button>
      </div>
    </div>
  );
}
