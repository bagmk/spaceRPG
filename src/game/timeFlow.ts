import { STAGES } from './stages';
import type { Stage } from './types';

export function getStageStartCosmicTime(stageIdx: number): number {
  if (stageIdx <= 0) {
    return 1e-34;
  }
  return STAGES[Math.max(0, stageIdx - 1)]?.cosmicTimeSec ?? 1e-32;
}

export function getCosmicTimePerRealSec(
  _stage: Stage,
  _prevStage: Stage | null,
  timeMult = 1,
): number {
  return timeMult;
}

export function getDisplayedCosmicTime(stageIdx: number, timeGauge: number): number {
  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
  const stageStart = getStageStartCosmicTime(stageIdx);
  const fraction = Math.min(1, Math.max(0, timeGauge / 100));
  const startLog = Math.log10(stageStart);
  const endLog = Math.log10(stage.cosmicTimeSec);
  return Math.pow(10, startLog + fraction * (endLog - startLog));
}

export function getStageClockTarget(stageIdx: number): number {
  return STAGES[stageIdx]?.cosmicTimeSec ?? STAGES[STAGES.length - 1].cosmicTimeSec;
}
