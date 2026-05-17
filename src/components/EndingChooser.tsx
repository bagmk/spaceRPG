import type { EndingOption, EndingId } from '../game/types';
import { t, type Lang } from '../i18n';

interface EndingChooserProps {
  options: EndingOption[];
  onChoose: (endingId: EndingId) => void;
  onClose?: () => void;
  language: Lang;
}

export function EndingChooser({ options, onChoose, onClose, language }: EndingChooserProps) {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card ending-chooser">
        <div className="ending-chooser__header">
          <div className="q-stage">{t(language, 'endingHeadline')}</div>
          {onClose ? (
            <button
              type="button"
              className="ending-chooser__close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
        <h2>{t(language, 'endingPrompt')}</h2>
        <div className="ending-options">
          {options.map((option) => (
            <button
              key={option.id}
              className={`ending-option ${option.unlocked ? 'unlocked' : 'locked'} ${option.seen ? 'seen' : ''}`}
              type="button"
              disabled={!option.unlocked}
              onClick={() => onChoose(option.id)}
            >
              <span className="ending-status">
                {option.seen
                  ? (language === 'ko' ? '✦ 완료' : '✦ Completed')
                  : option.unlocked ? t(language, 'endingStatusUnlocked') : t(language, 'endingStatusLocked')}
              </span>
              <span className="ending-label">{option.label}</span>
              <span className="ending-description">{option.description}</span>
              <span className="ending-requirement">
                <span>{t(language, 'endingRequirementLabel')}</span>
                {option.requirement}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
