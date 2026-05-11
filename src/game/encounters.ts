import { getScreenScaleLabel } from './scaleIndicator';

function formatDistanceValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  if (value < 10) {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: value < 1 ? 1 : 0,
    });
  }

  return Math.round(value).toLocaleString('en-US');
}

// Compute real-space distance from pixel distance using the stage's scale ratio.
export function formatEncounterDistance(stageId: number, pixelDist: number): string {
  const scale = getScreenScaleLabel(stageId);
  const unitsPerPixel = scale.value / scale.length;
  const realDist = pixelDist * unitsPerPixel;
  return `${formatDistanceValue(realDist)} ${scale.unit}`;
}
