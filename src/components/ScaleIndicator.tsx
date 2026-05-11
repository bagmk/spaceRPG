import { getScreenScaleLabel, getUnitTooltip } from '../game/scaleIndicator';
import { t, type Lang } from '../i18n';

export function ScaleIndicator({ stageId, language }: { stageId: number; language: Lang }) {
  const scale = getScreenScaleLabel(stageId);
  return (
    <div className="scale-indicator" aria-hidden="true">
      <div className="scale-title">{t(language, 'scaleTitle')}</div>
      <div className="scale-bar" style={{ width: `${scale.length}px` }}>
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={`scale-tick ${index === 0 || index === 4 || index === 8 ? 'major' : ''}`}
            style={{ left: `${(index / 8) * 100}%` }}
          />
        ))}
      </div>
      <div className="scale-value">
        {scale.value.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}{' '}
        <span className="scale-unit" title={getUnitTooltip(scale.unit, language)}>
          {scale.unit}
        </span>
      </div>
    </div>
  );
}
