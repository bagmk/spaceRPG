interface TimelineProps {
  timelinePos: number;
  cosmicClockLabel: string;
  stageTimeLabel: string;
  stagePositions: { id: number; left: number; label: string }[];
  currentStageId: number;
  entropy: string;
  entropyUnit?: string;
  comboVisible: boolean;
  comboMult: string;
  universeLabel: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onOpenInfo: () => void;
  onRequestReset: () => void;
}

export function Timeline({
  timelinePos,
  cosmicClockLabel,
  stageTimeLabel,
  stagePositions,
  currentStageId,
  entropy,
  entropyUnit = 'KB',
  comboVisible,
  comboMult,
  universeLabel,
  muted,
  onToggleMute,
  onOpenInfo,
  onRequestReset,
}: TimelineProps) {
  return (
    <header className="timeline">
      <div className="tl-label">Cosmic Time</div>
      <div className="tl-bar">
        <div className="tl-fill" style={{ width: `${timelinePos}%` }} />
        <div className="tl-marker" style={{ left: `${timelinePos}%` }} />
        {stagePositions.map((position) => (
          <div
            key={position.id}
            className={`tl-stage-chevron ${position.id === currentStageId ? 'current' : position.id < currentStageId ? 'past' : 'future'}`}
            style={{ left: `${position.left}%` }}
            title={position.label}
          />
        ))}
      </div>
      <div className="timeline-clock">
        <div className="tl-time">{cosmicClockLabel}</div>
        <div className="tl-stage-time">{stageTimeLabel}</div>
      </div>
      <div className="entropy-block">
        <div className="entropy-label">Entropy</div>
        <div className="entropy-value">
          {entropy} <sub>{entropyUnit}</sub>
        </div>
      </div>
      <div className={`combo-block ${comboVisible ? 'active' : ''}`}>
        <div className="combo-label">Combo</div>
        <div className="combo-value">{`×${comboMult}`}</div>
      </div>
      <div className="timeline-actions">
        {universeLabel ? <div className="universe-badge">{universeLabel}</div> : null}
        <button className="mini-button" type="button" onClick={onToggleMute}>
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>
        <button className="mini-button" type="button" onClick={onOpenInfo}>
          INFO
        </button>
        <button className="mini-button" type="button" onClick={onRequestReset}>
          RESET
        </button>
      </div>
    </header>
  );
}
