import { formatEntropyAmount } from '../game/formulas';

interface ResourcePanelProps {
  label: string;
  quanta: string;
  threshold: string;
  rate: string;
  progressPercent: number;
  timeGauge: string;
  timeBudget: string;
  timeProgressPercent: number;
  cosmicTimeLabel: string;
  canCondense: boolean;
  condenseHint: string;
  entropyPreview: number;
  onCondense: () => void;
}

export function ResourcePanel({
  label,
  quanta,
  threshold,
  rate,
  progressPercent,
  timeGauge,
  timeBudget,
  timeProgressPercent,
  cosmicTimeLabel,
  canCondense,
  condenseHint,
  entropyPreview,
  onCondense,
}: ResourcePanelProps) {
  const entropyPreviewLabel = formatEntropyAmount(entropyPreview);

  return (
    <section className="resource-panel">
      <div className="res-header">
        <span className="res-label">{label}</span>
        <span className="res-rate">{rate}</span>
      </div>
      <div className="res-stack">
        <div>
          <div className="res-value">
            <span>{quanta}</span>
            <span className="total">{` / ${threshold}`}</span>
          </div>
          <div className="res-bar">
            <div className="res-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="res-header small">
            <span className="res-label">Cosmic Time</span>
          </div>
          <div className="res-value time">
            <span>{timeGauge}</span>
            <span className="total">{` / ${timeBudget}`}</span>
          </div>
          <div className="res-bar time">
            <div className="res-fill time" style={{ width: `${timeProgressPercent}%` }} />
          </div>
          <div className="time-subtitle">{cosmicTimeLabel}</div>
        </div>
      </div>
      {canCondense ? (
        <>
          <div className="condense-preview">{`Condense ready · +${entropyPreviewLabel} entropy if now`}</div>
          <button className="condense" type="button" onClick={onCondense}>
            {`Condense → +${entropyPreviewLabel} Entropy`}
          </button>
        </>
      ) : (
        <div className="condense-preview muted">{condenseHint}</div>
      )}
    </section>
  );
}
