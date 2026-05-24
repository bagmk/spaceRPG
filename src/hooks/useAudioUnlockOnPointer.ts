import { useEffect } from 'react';
import type { SoundManager } from '../game/audio';

/**
 * Attaches a one-shot-style pointerdown listener to window that calls
 * `soundManager.unlock()`. Covers users who entered via deep link / OS Resume
 * and never tapped an intro button. `unlock()` is idempotent so leaving the
 * listener attached for the lifetime of the screen is harmless.
 */
export function useAudioUnlockOnPointer(soundManager: SoundManager | null): void {
  useEffect(() => {
    const handler = () => soundManager?.unlock();
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [soundManager]);
}
