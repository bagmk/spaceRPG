import { formatDuration, formatEntropyParts, formatWhole } from '../game/formulas';
import { t, type Lang } from '../i18n';

interface OfflineProgressModalProps {
  awayMs: number;
  capMs: number;
  gained: number;
  entropyGained: number;
  timeProgressGained: number;
  language: Lang;
  onDismiss: () => void;
}

export function OfflineProgressModal({
  awayMs,
  capMs,
  gained,
  entropyGained,
  timeProgressGained,
  language,
  onDismiss,
}: OfflineProgressModalProps) {
  const timeProgressLabel = `${Math.max(0, timeProgressGained).toFixed(1).replace(/\.0$/, '')}%`;
  const entropyReadout = formatEntropyParts(entropyGained);
  const capText = language === 'ko'
    ? `오프라인 보상은 최대 ${formatDuration(capMs)}까지 쌓입니다.`
    : `Offline rewards are capped at ${formatDuration(capMs)}.`;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card">
        <div className="q-stage">{t(language, 'offlineEyebrow')}</div>
        <h2>{t(language, 'offlineTitle')}</h2>
        <p>{`${t(language, 'offlineAwayFor')} ${formatDuration(awayMs)}.`}</p>
        <p>{capText}</p>
        <div className="offline-reward-list">
          <span>{`${t(language, 'offlineMatter')}: ${formatWhole(gained)} Q`}</span>
          <span>{`${t(language, 'offlineTime')}: ${timeProgressLabel}`}</span>
          <span className="entropy-inline">
            <span>{`${t(language, 'offlineEntropy')}: ${entropyReadout.value}`}</span>
            <span className="hud-entropy-unit">{entropyReadout.unit}</span>
          </span>
        </div>
        <button className="q-continue" type="button" onClick={onDismiss}>
          {t(language, 'offlineReturn')}
        </button>
      </div>
    </div>
  );
}
