import { formatDuration, formatWhole } from '../game/formulas';
import { t, type Lang } from '../i18n';

interface OfflineProgressModalProps {
  awayMs: number;
  gained: number;
  entropyGained: number;
  timeProgressGained: number;
  language: Lang;
  onDismiss: () => void;
}

export function OfflineProgressModal({
  awayMs,
  gained,
  entropyGained,
  timeProgressGained,
  language,
  onDismiss,
}: OfflineProgressModalProps) {
  const timeProgressLabel = `${Math.max(0, timeProgressGained).toFixed(1).replace(/\.0$/, '')}%`;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card">
        <div className="q-stage">{t(language, 'offlineEyebrow')}</div>
        <h2>{t(language, 'offlineTitle')}</h2>
        <p>{`${t(language, 'offlineAwayFor')} ${formatDuration(awayMs)}.`}</p>
        <p>{t(language, 'offlineCap')}</p>
        <div className="offline-reward-list">
          <span>{`${t(language, 'offlineMatter')}: ${formatWhole(gained)} Q`}</span>
          <span>{`${t(language, 'offlineTime')}: ${timeProgressLabel}`}</span>
          <span>{`${t(language, 'offlineEntropy')}: ${formatWhole(entropyGained)} kB`}</span>
        </div>
        <button className="q-continue" type="button" onClick={onDismiss}>
          {t(language, 'offlineReturn')}
        </button>
      </div>
    </div>
  );
}
