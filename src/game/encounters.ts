export function formatEncounterDistance(stageId: number, fracOfScreen: number): string {
  const v = Math.max(0, fracOfScreen);
  if (stageId === 1) return `${(v * 100).toFixed(0)} ym`;
  if (stageId === 2) return `${(v * 1000).toFixed(0)} am`;
  if (stageId === 3) return `${(v * 100).toFixed(0)} fm`;
  if (stageId === 4) return `${(v * 10).toFixed(0)} pm`;
  if (stageId === 5) return `${(v * 100).toFixed(0)} nm`;
  if (stageId === 6) return `${(v * 100).toFixed(0)} m`;
  if (stageId === 7) return `${(v * 100).toFixed(0)} ly`;
  if (stageId === 8) return `${(v * 1000).toFixed(0)} ly`;
  if (stageId === 9) return `${(v * 10000).toFixed(0)} ly`;
  if (stageId === 10) return `${(v * 100).toFixed(0)} AU`;
  if (stageId === 11) return `${(v * 1000).toFixed(0)} km`;
  if (stageId === 12) return `${(v * 100).toFixed(0)} AU`;
  if (stageId === 13) return `${(v * 1000).toFixed(0)} ly`;
  if (stageId === 14) return `${(v * 10).toFixed(0)} kpc`;
  if (stageId === 15) return `${(v * 1).toFixed(2)} Mpc`;
  return `${(v * 100).toFixed(0)} Gpc`;
}
