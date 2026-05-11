import type { EndingOption, EndingId } from '../game/types';
import { t, type Lang } from '../i18n';

interface EndingChooserProps {
  options: EndingOption[];
  onChoose: (endingId: EndingId) => void;
  language: Lang;
}

export function EndingChooser({ options, onChoose, language }: EndingChooserProps) {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card ending-chooser">
        <div className="q-stage">{t(language, 'endingHeadline')}</div>
        <h2>{t(language, 'endingPrompt')}</h2>
        <div className="ending-options">
          {options.map((option) => (
            <button
              key={option.id}
              className="ending-option"
              type="button"
              disabled={!option.unlocked}
              onClick={() => onChoose(option.id)}
            >
              <span className="ending-label">{option.label}</span>
              <span className="ending-description">{option.description}</span>
              <span className="ending-requirement">{option.requirement}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
