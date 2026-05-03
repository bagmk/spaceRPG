import { useEffect, useRef } from 'react';

export function useGameLoop(callback: (now: number, dt: number) => void, active = true): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let frameId = 0;
    let last = performance.now();
    let lastErrorAt = 0;
    let lastErrorMessage = '';

    const loop = (now: number) => {
      const rawDt = now - last;
      last = now;
      const dt = Math.min(rawDt, 100);
      try {
        callbackRef.current(now, dt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== lastErrorMessage || now - lastErrorAt > 1000) {
          lastErrorAt = now;
          lastErrorMessage = message;
          console.error('[debug] useGameLoop callback threw:', err);
        }
      }
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [active]);
}
