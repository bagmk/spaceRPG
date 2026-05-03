interface ResourcePanelProps {
  label: string;
  quanta: string;
  threshold: string;
  rate: string;
  progressPercent: number;
  canCondense: boolean;
  entropyPreview: number;
}

export function ResourcePanel({
  label,
  quanta,
  threshold,
  rate,
  progressPercent,
  canCondense,
  entropyPreview,
}: ResourcePanelProps) {
  return (
    <section className="resource-panel">
      <div className="res-header">
        <span className="res-label">{label}</span>
        <span className="res-rate">{`+${rate}/s`}</span>
      </div>
      <div className="res-value">
        <span>{quanta}</span>
        <span className="total">{` / ${threshold}`}</span>
      </div>
      <div className="res-bar">
        <div className="res-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      {canCondense ? (
        <div className="condense-preview">{`Condense ready · +${entropyPreview} entropy if now`}</div>
      ) : (
        <div className="condense-preview muted">Threshold not yet reached.</div>
      )}
    </section>
  );
}
