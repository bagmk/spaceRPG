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
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const TARGET_FRAME_MS = 1000 / (isMobile ? 24 : 30);
    let frameId = 0;
    let last = performance.now();
    let lastErrorAt = 0;
    let lastErrorMessage = '';

    const loop = (now: number) => {
      frameId = window.requestAnimationFrame(loop);

      // Skip frame when tab is hidden to avoid background CPU burn
      if (document.hidden) return;

      // Skip frame if not enough time has passed (throttle to 30 fps)
      const rawDt = now - last;
      if (rawDt < TARGET_FRAME_MS) return;

      last = now - (rawDt % TARGET_FRAME_MS); // keep phase aligned
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
    };

    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [active]);
}
