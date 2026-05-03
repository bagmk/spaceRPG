import type { EndingOption, EndingId } from '../game/types';

interface EndingChooserProps {
  options: EndingOption[];
  onChoose: (endingId: EndingId) => void;
}

export function EndingChooser({ options, onChoose }: EndingChooserProps) {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="overlay-card ending-chooser">
        <div className="q-stage">The End</div>
        <h2>Choose the shape of the last moment.</h2>
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
              <span className="ending-requirement">
                {option.unlocked ? 'Available now' : option.requirement}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
