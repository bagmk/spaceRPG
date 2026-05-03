import { useEffect } from 'react';

interface EndingProps {
  onComplete: () => void;
}

export function VacuumDecayEnding({ onComplete }: EndingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="overlay-backdrop ending-cinematic vacuum-decay">
      <div className="overlay-card">
        <div className="q-stage">Vacuum Decay</div>
        <p>A cleaner vacuum appears. Its edge moves without malice and without delay.</p>
        <button className="q-continue" type="button" onClick={onComplete}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
