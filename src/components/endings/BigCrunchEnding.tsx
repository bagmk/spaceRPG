import { useEffect } from 'react';

interface EndingProps {
  onComplete: () => void;
}

export function BigCrunchEnding({ onComplete }: EndingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="overlay-backdrop ending-cinematic big-crunch">
      <div className="overlay-card">
        <div className="q-stage">Big Crunch</div>
        <p>Expansion yields. Everything falls back toward one unbearable center.</p>
        <button className="q-continue" type="button" onClick={onComplete}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
