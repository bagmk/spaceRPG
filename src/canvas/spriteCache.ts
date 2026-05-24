// Caches offscreen canvas sprites by string key.
// Replaces expensive per-frame draw work (shadowBlur, gradients,
// multi-pass glow) with a single drawImage call.
//
// Usage:
//   const glow = getSprite(
//     `glow_${stage.id}_${size}`,
//     size, size,
//     (cctx) => {
//       const half = size / 2;
//       const g = cctx.createRadialGradient(half, half, 0, half, half, half);
//       g.addColorStop(0, 'rgba(255,255,255,0.8)');
//       g.addColorStop(1, 'rgba(255,255,255,0)');
//       cctx.fillStyle = g;
//       cctx.fillRect(0, 0, size, size);
//     },
//   );
//   ctx.drawImage(glow, x - size / 2, y - size / 2);
//
// Memory note: cache is unbounded. Use invalidateSprites(prefix)
// on stage transitions to avoid retaining old-stage sprites forever.

import { PerfCounters } from './__perf';

const cache = new Map<string, HTMLCanvasElement>();

export function getSprite(
  key: string,
  width: number,
  height: number,
  build: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const cached = cache.get(key);
  if (cached && cached.width === width && cached.height === height) return cached;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const cctx = c.getContext('2d');
  if (!cctx) throw new Error('spriteCache: no 2d context');
  build(cctx);
  cache.set(key, c);
  if (import.meta.env.DEV) PerfCounters.sprites++;
  return c;
}

export function invalidateSprites(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

export function spriteCacheSize(): number {
  return cache.size;
}

// Common helper: build a soft radial glow sprite of the given size and color.
// Color should be a hex like '#ffaa55'. Alpha is hardcoded for soft falloff.
export function getRadialGlowSprite(
  key: string,
  size: number,
  hexColor: string,
): HTMLCanvasElement {
  return getSprite(key, size, size, (cctx) => {
    const half = size / 2;
    const g = cctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, hexToRgba(hexColor, 0.85));
    g.addColorStop(0.45, hexToRgba(hexColor, 0.35));
    g.addColorStop(1, hexToRgba(hexColor, 0));
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, size, size);
  });
}

function hexToRgba(hex: string, alpha: number): string {
  // Accept '#rgb', '#rrggbb', or already-rgba string (pass-through).
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
