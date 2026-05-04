// Scale table: 50px on screen = `value` units of `unit`.
// Used consistently by both ScaleIndicator and encounter distance labels.
export function getScreenScaleLabel(stageId: number): { length: number; unit: string; value: number } {
  if (stageId === 1)  return { length: 50, value: 100,     unit: 'ym' };
  if (stageId === 2)  return { length: 50, value: 100,     unit: 'am' };
  if (stageId === 3)  return { length: 50, value: 100,     unit: 'fm' };
  if (stageId === 4)  return { length: 50, value: 10,      unit: 'pm' };
  if (stageId === 5)  return { length: 50, value: 100,     unit: 'nm' };
  if (stageId === 6)  return { length: 50, value: 100,     unit: 'm'  };
  if (stageId === 7)  return { length: 50, value: 100,     unit: 'ly' };
  if (stageId === 8)  return { length: 50, value: 1000,    unit: 'ly' };
  if (stageId === 9)  return { length: 50, value: 100_000, unit: 'ly' };
  if (stageId === 10) return { length: 50, value: 40,      unit: 'AU' };
  if (stageId === 11) return { length: 50, value: 13_000,  unit: 'km' };
  if (stageId === 12) return { length: 50, value: 1,       unit: 'AU' };
  if (stageId === 13) return { length: 50, value: 1000,    unit: 'ly' };
  if (stageId === 14) return { length: 50, value: 10,      unit: 'kpc' };
  if (stageId === 15) return { length: 50, value: 1,       unit: 'Mpc' };
  return               { length: 50, value: 100,           unit: 'Gpc' };
}

export function getUnitTooltip(unit: string): string {
  const tooltips: Record<string, string> = {
    ym:  'Yoctometer: one septillionth of a meter.',
    am:  'Attometer: one quintillionth of a meter.',
    fm:  'Femtometer: about the scale of atomic nuclei.',
    pm:  'Picometer: one trillionth of a meter.',
    nm:  'Nanometer: one billionth of a meter.',
    m:   'Meter.',
    km:  'Kilometer: 1,000 meters.',
    AU:  'Astronomical Unit: Earth-Sun distance, about 150 million km.',
    ly:  'Light-year: distance light travels in 1 year, about 9.5 trillion km.',
    kpc: 'Kiloparsec: about 3,261 light-years.',
    Mpc: 'Megaparsec: about 3.26 million light-years.',
    Gpc: 'Gigaparsec: about 3.26 billion light-years.',
  };
  return tooltips[unit] ?? unit;
}
