// Caches CanvasGradient instances by string key.
// Avoids re-allocating gradients in hot draw paths.
//
// Usage:
//   const grad = getRadial(ctx, `core_glow_${stage.id}`,
//     x, y, 0, x, y, r,
//     [[0, '#fff'], [1, 'rgba(255,255,255,0)']]);
//
// Call invalidateGradients() on stage transitions or theme changes
// so colors/sizes don't bleed across stages.

import { PerfCounters } from './__perf';

type Stop = readonly [number, string];

const radial = new Map<string, CanvasGradient>();
const linear = new Map<string, CanvasGradient>();

export function getRadial(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: ReadonlyArray<Stop>,
): CanvasGradient {
  const cached = radial.get(key);
  if (cached) return cached;
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  radial.set(key, g);
  if (import.meta.env.DEV) PerfCounters.gradients++;
  return g;
}

export function getLinear(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: ReadonlyArray<Stop>,
): CanvasGradient {
  const cached = linear.get(key);
  if (cached) return cached;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  linear.set(key, g);
  if (import.meta.env.DEV) PerfCounters.gradients++;
  return g;
}

export function invalidateGradients(prefix?: string): void {
  if (!prefix) {
    radial.clear();
    linear.clear();
    return;
  }
  for (const k of [...radial.keys()]) if (k.startsWith(prefix)) radial.delete(k);
  for (const k of [...linear.keys()]) if (k.startsWith(prefix)) linear.delete(k);
}

export function gradientCacheSize(): { radial: number; linear: number } {
  return { radial: radial.size, linear: linear.size };
}
