import type { Stage } from '../game/types';
import { STAGES } from '../game/stages';

interface QuoteOverlayProps {
  stage: Stage;
  visible: boolean;
  onContinue: () => void;
}

export function QuoteOverlay({ stage, visible, onContinue }: QuoteOverlayProps) {
  return (
    <div className={`quote-overlay ${visible ? 'show' : ''}`} aria-hidden={!visible}>
      <div className="q-stage">{`STAGE ${String(stage.id).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`}</div>
      <div className="q-time">{`t = ${stage.time}`}</div>
      <div className="q-text">"{stage.quote}"</div>
      <div className="q-attr">{stage.quoteAttr}</div>
      <button className="q-continue" type="button" onClick={onContinue}>
        CONTINUE →
      </button>
    </div>
  );
}
