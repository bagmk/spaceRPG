import { STAGES } from './stages';
import type { Stage } from './types';

export function getStageStartCosmicTime(stageIdx: number): number {
  if (stageIdx <= 0) {
    return 1e-32;
  }
  return STAGES[Math.max(0, stageIdx - 1)]?.cosmicTimeSec ?? 1e-32;
}

export function getCosmicTimePerRealSec(
  stage: Stage,
  prevStage: Stage | null,
  _progress01: number,
): number {
  const span = stage.cosmicTimeSec - (prevStage?.cosmicTimeSec ?? 0);
  return span / Math.max(1, stage.realPlayTargetSec);
}

export function getStageClockTarget(stageIdx: number): number {
  return STAGES[stageIdx]?.cosmicTimeSec ?? STAGES[STAGES.length - 1].cosmicTimeSec;
}
