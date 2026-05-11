import type { Stage } from '../game/types';
import { STAGES } from '../game/stages';
import { t, type Lang } from '../i18n';

interface QuoteOverlayProps {
  stage: Stage;
  language: Lang;
  visible: boolean;
  onContinue: () => void;
}

export function QuoteOverlay({ stage, language, visible, onContinue }: QuoteOverlayProps) {
  const quote = language === 'ko' ? stage.quoteKo ?? stage.quote : stage.quote;
  const quoteAttr = language === 'ko'
    ? stage.quoteAttrKo ?? t(language, 'quoteAttrOriginal')
    : stage.quoteAttr;

  return (
    <div className={`quote-overlay ${visible ? 'show' : ''}`} aria-hidden={!visible}>
      <div className="q-stage">{`${t(language, 'quoteStage')} ${String(stage.id).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`}</div>
      <div className="q-time">{`t = ${stage.time}`}</div>
      <div className="q-text">"{quote}"</div>
      <div className="q-attr">{quoteAttr}</div>
      <button className="q-continue" type="button" onClick={onContinue}>
        {t(language, 'quoteContinue')}
      </button>
    </div>
  );
}
