import { getScreenScaleLabel } from './scaleIndicator';

// Compute real-space distance from pixel distance using the stage's scale ratio.
export function formatEncounterDistance(stageId: number, pixelDist: number): string {
  const scale = getScreenScaleLabel(stageId);
  const unitsPerPixel = scale.value / scale.length;
  const realDist = pixelDist * unitsPerPixel;
  // Cap display at 1000 units to keep labels readable; show "+" suffix when over cap.
  const cap = 1000;
  if (realDist > cap) {
    return `${cap}+ ${scale.unit}`;
  }
  return `${Math.floor(realDist)} ${scale.unit}`;
}
