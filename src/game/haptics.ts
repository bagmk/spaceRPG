/**
 * Thin wrapper around Capacitor Haptics — no-ops silently on web.
 */
import type { RogueTypeKey } from './types';

function getHapticsPlugin(): any | null {
  const cap = (globalThis as any).Capacitor;
  return cap?.Plugins?.Haptics ?? null;
}

export function vibrateCollision(tier: RogueTypeKey): void {
  const plugin = getHapticsPlugin();
  if (!plugin) return;
  try {
    if (tier === 'massive') {
      plugin.impact({ style: 'HEAVY' });
    } else if (tier === 'major') {
      plugin.impact({ style: 'MEDIUM' });
    } else {
      plugin.impact({ style: 'LIGHT' });
    }
  } catch { /* not available */ }
}
