import { useEffect } from 'react';

interface EndingProps {
  onComplete: () => void;
}

export function BounceEnding({ onComplete }: EndingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="overlay-backdrop ending-cinematic bounce-ending">
      <div className="overlay-card">
        <div className="q-stage">Bounce</div>
        <p>The last universe folds into the first. This time, it remembers your touch.</p>
        <button className="q-continue" type="button" onClick={onComplete}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
