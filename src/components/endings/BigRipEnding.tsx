import { useEffect } from 'react';

interface EndingProps {
  onComplete: () => void;
}

export function BigRipEnding({ onComplete }: EndingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, 5500);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="overlay-backdrop ending-cinematic big-rip">
      <div className="overlay-card">
        <div className="q-stage">Big Rip</div>
        <p>Acceleration outruns cohesion. Structures unthread from the outside inward.</p>
        <button className="q-continue" type="button" onClick={onComplete}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
