import { useEffect } from 'react';

interface EndingProps {
  onComplete: () => void;
}

export function HeatDeathEnding({ onComplete }: EndingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="overlay-backdrop ending-cinematic heat-death">
      <div className="overlay-card">
        <div className="q-stage">Heat Death</div>
        <p>The gradients flatten. The clock keeps moving, but nothing answers it.</p>
        <button className="q-continue" type="button" onClick={onComplete}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
