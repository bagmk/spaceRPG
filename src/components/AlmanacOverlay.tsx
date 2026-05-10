import { useEffect, useRef, useState } from 'react';
import { ALMANAC } from '../game/almanac';
import { STAGE_LOGS, getLogsForStage } from '../game/stageLogs';
import { STAGES } from '../game/stages';

interface AlmanacOverlayProps {
  currentStageId: number;    // 1-indexed current stage
  progressPercent: number;   // 0–100 for current stage
  onClose: () => void;
}

export function AlmanacOverlay({ currentStageId, progressPercent, onClose }: AlmanacOverlayProps) {
  const [selectedId, setSelectedId] = useState(currentStageId);
  const pillsRef = useRef<HTMLDivElement | null>(null);

  // Scroll selected pill into view
  useEffect(() => {
    const container = pillsRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(`[data-stage-id="${selectedId}"]`);
    btn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selectedId]);

  const isPast = (id: number) => id < currentStageId;
  const isCurrent = (id: number) => id === currentStageId;
  const isFuture = (id: number) => id > currentStageId;

  // Logs visible for the selected stage
  const allLogs = getLogsForStage(selectedId);
  const effectiveProgress = isPast(selectedId) ? 100 : isCurrent(selectedId) ? progressPercent : -1;

  const almanac = ALMANAC[selectedId];
  const stageMeta = STAGES.find((s) => s.id === selectedId);

  // Count unlocked logs across all stages for the header badge
  const unlockedCount = STAGE_LOGS.filter((l) => {
    if (l.stageId < currentStageId) return true;
    if (l.stageId === currentStageId) return progressPercent >= l.progress;
    return false;
  }).length;
  const totalCount = STAGE_LOGS.length;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Cosmic Almanac">
      <div className="overlay-card almanac-overlay">
        {/* Header */}
        <div className="almanac-header">
          <div>
            <span className="q-stage">Cosmic Almanac</span>
            <span className="almanac-badge">{`${unlockedCount} / ${totalCount} discovered`}</span>
          </div>
          <button className="mini-button" type="button" onClick={onClose}>CLOSE</button>
        </div>

        {/* Stage pills */}
        <div className="almanac-stage-pills" ref={pillsRef}>
          {STAGES.map((s) => {
            const state = isPast(s.id) ? 'past' : isCurrent(s.id) ? 'current' : 'future';
            return (
              <button
                key={s.id}
                type="button"
                data-stage-id={s.id}
                className={`almanac-pill almanac-pill--${state} ${selectedId === s.id ? 'almanac-pill--active' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="almanac-pill-num">{String(s.id).padStart(2, '0')}</span>
                {isFuture(s.id) ? <span className="almanac-pill-lock">🔒</span> : null}
              </button>
            );
          })}
        </div>

        {/* Selected stage content */}
        <div className="almanac-content">
          {/* Left: almanac info */}
          <div className="almanac-info">
            <div className={`almanac-stage-label ${isFuture(selectedId) ? 'muted' : ''}`}>
              {`Stage ${selectedId} / 16`}
            </div>
            <h2 className="almanac-stage-name">
              {isFuture(selectedId) ? <span className="almanac-locked-name">{stageMeta?.name ?? '???'}</span> : (almanac?.title ?? stageMeta?.name)}
            </h2>

            {isFuture(selectedId) ? (
              <p className="almanac-locked-body">This era has not yet been reached. Its secrets remain sealed.</p>
            ) : (
              <>
                <p className="resource-subhead">{almanac?.short}</p>
                <p>{almanac?.body ?? stageMeta?.quote}</p>
                {almanac?.uncertaintyNote ? (
                  <p className="almanac-note">{`Note: ${almanac.uncertaintyNote}`}</p>
                ) : null}
                {almanac?.cosmicEra ? (
                  <div className="almanac-era">
                    <div className="q-stage">Era Info</div>
                    <div>{`Time: ${almanac.cosmicEra.timeRange}`}</div>
                    <div>{`Temp: ${almanac.cosmicEra.temperature}`}</div>
                    <div>{`Key: ${almanac.cosmicEra.keyParticles.join(', ')}`}</div>
                    <p>{almanac.cosmicEra.realWorldScale}</p>
                  </div>
                ) : null}
                {almanac?.funFact ? (
                  <p className="resource-subhead">{almanac.funFact}</p>
                ) : null}
              </>
            )}
          </div>

          {/* Right: milestone log */}
          <div className="almanac-log">
            <div className="q-stage almanac-log-header">
              {isFuture(selectedId) ? 'Milestones — Locked' : 'Milestones'}
            </div>
            {isFuture(selectedId) ? (
              <div className="almanac-log-locked-stage">
                <div className="almanac-log-locked-count">
                  {`${allLogs.length} milestones sealed`}
                </div>
                <p className="almanac-locked-body">Complete previous stages to unlock this era.</p>
              </div>
            ) : (
              <div className="almanac-log-list">
                {allLogs.map((log) => {
                  const unlocked = effectiveProgress >= log.progress;
                  return (
                    <div key={log.progress} className={`almanac-log-entry ${unlocked ? 'almanac-log-entry--open' : 'almanac-log-entry--locked'}`}>
                      {!unlocked && (
                        <div className="almanac-log-progress">???</div>
                      )}
                      <div className="almanac-log-body">
                        <div className="almanac-log-entry-title">
                          {unlocked ? log.title : '— locked —'}
                        </div>
                        {unlocked ? (
                          <div className="almanac-log-entry-msg">{log.message}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
