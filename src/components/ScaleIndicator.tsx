import { getScreenScaleLabel, getUnitTooltip } from '../game/scaleIndicator';

export function ScaleIndicator({ stageId }: { stageId: number }) {
  const scale = getScreenScaleLabel(stageId);
  return (
    <div className="scale-indicator" aria-hidden="true">
      <div className="scale-title">Scale</div>
      <div className="scale-bar" style={{ width: `${scale.length}px` }} />
      <div className="scale-value">
        {scale.value.toLocaleString('en-US')}{' '}
        <span className="scale-unit" title={getUnitTooltip(scale.unit)}>
          {scale.unit}
        </span>
      </div>
    </div>
  );
}
