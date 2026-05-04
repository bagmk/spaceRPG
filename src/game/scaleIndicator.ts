export function getScreenScaleLabel(stageId: number): { length: number; unit: string; value: number } {
  if (stageId <= 2) return { length: 50, unit: 'nm', value: 100 };
  if (stageId <= 3) return { length: 50, unit: 'pm', value: 100 };
  if (stageId <= 4) return { length: 50, unit: 'fm', value: 10 };
  if (stageId <= 5) return { length: 50, unit: 'mm', value: 1000 };
  if (stageId <= 6) return { length: 50, unit: 'm', value: 100 };
  if (stageId <= 7) return { length: 50, unit: 'km', value: 100 };
  if (stageId <= 8) return { length: 50, unit: 'AU', value: 100 };
  if (stageId <= 9) return { length: 50, unit: 'ly', value: 100_000 };
  if (stageId <= 10) return { length: 50, unit: 'AU', value: 40 };
  if (stageId <= 11) return { length: 50, unit: 'km', value: 13_000 };
  if (stageId <= 12) return { length: 50, unit: 'AU', value: 1 };
  if (stageId <= 13) return { length: 50, unit: 'ly', value: 1000 };
  if (stageId <= 14) return { length: 50, unit: 'kpc', value: 10 };
  if (stageId <= 15) return { length: 50, unit: 'Mpc', value: 1 };
  return { length: 50, unit: 'Gpc', value: 100 };
}

export function getUnitTooltip(unit: string): string {
  const tooltips: Record<string, string> = {
    nm: 'Nanometer: one billionth of a meter.',
    pm: 'Picometer: one trillionth of a meter.',
    fm: 'Femtometer: about the scale of atomic nuclei.',
    AU: 'Astronomical Unit: Earth-Sun distance, about 150 million km.',
    ly: 'Light-year: distance light travels in 1 year, about 9.5 trillion km.',
    kpc: 'Kiloparsec: about 3,261 light-years.',
    Mpc: 'Megaparsec: about 3.26 million light-years.',
    Gpc: 'Gigaparsec: about 3.26 billion light-years.',
  };
  return tooltips[unit] ?? unit;
}
