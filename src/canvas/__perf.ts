// Dev-only performance counters. Tree-shaken in production builds.
// Read at runtime via `window.__perf` in DevTools console.

export interface PerfCounters {
  gradients: number;
  sprites: number;
  shadows: number;
  draws: number;
}

export const PerfCounters: PerfCounters = {
  gradients: 0,
  sprites: 0,
  shadows: 0,
  draws: 0,
};

export function resetPerfCounters(): void {
  PerfCounters.gradients = 0;
  PerfCounters.sprites = 0;
  PerfCounters.shadows = 0;
  PerfCounters.draws = 0;
}

declare global {
  interface Window {
    __perf?: PerfCounters;
    __resetPerf?: () => void;
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__perf = PerfCounters;
  window.__resetPerf = resetPerfCounters;
}
