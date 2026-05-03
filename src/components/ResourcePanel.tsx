interface ResourcePanelProps {
  label: string;
  quanta: string;
  threshold: string;
  rate: string;
  progressPercent: number;
  canCondense: boolean;
  entropyPreview: number;
  onCondense: () => void;
  clickPowerLabel: string;
  autoRateLabel: string;
  critLabel: string;
}

export function ResourcePanel({
  label,
  quanta,
  threshold,
  rate,
  progressPercent,
  canCondense,
  entropyPreview,
  onCondense,
  clickPowerLabel,
  autoRateLabel,
  critLabel,
}: ResourcePanelProps) {
  return (
    <section className="resource-panel">
      <div className="res-header">
        <span className="res-label">{label}</span>
        <span className="res-rate">{`+${rate}`}</span>
      </div>
      <div className="res-value">
        <span>{quanta}</span>
        <span className="total">{` / ${threshold}`}</span>
      </div>
      <div className="res-bar">
        <div className="res-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      {canCondense ? (
        <>
          <div className="condense-preview">{`Condense ready · +${entropyPreview} entropy if now`}</div>
          <button className="condense" type="button" onClick={onCondense}>
            {`Condense → +${entropyPreview} Entropy`}
          </button>
        </>
      ) : (
        <div className="condense-preview muted">Threshold not yet reached.</div>
      )}
      <div className="resource-subhead">{`Click ${clickPowerLabel} · Auto ${autoRateLabel} · Crit ${critLabel}`}</div>
    </section>
  );
}
