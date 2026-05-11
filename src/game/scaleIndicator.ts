import type { Lang } from '../i18n';

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

export function getUnitTooltip(unit: string, lang: Lang = 'en'): string {
  const tooltips: Record<string, { en: string; ko: string }> = {
    ym:  { en: 'Yoctometer: one septillionth of a meter.', ko: '욕토미터: 1미터의 10^-24배.' },
    am:  { en: 'Attometer: one quintillionth of a meter.', ko: '아토미터: 1미터의 10^-18배.' },
    fm:  { en: 'Femtometer: about the scale of atomic nuclei.', ko: '펨토미터: 원자핵 크기에 가까운 단위.' },
    pm:  { en: 'Picometer: one trillionth of a meter.', ko: '피코미터: 1미터의 10^-12배.' },
    nm:  { en: 'Nanometer: one billionth of a meter.', ko: '나노미터: 1미터의 10^-9배.' },
    m:   { en: 'Meter.', ko: '미터.' },
    km:  { en: 'Kilometer: 1,000 meters.', ko: '킬로미터: 1,000미터.' },
    AU:  { en: 'Astronomical Unit: Earth-Sun distance, about 150 million km.', ko: '천문단위: 지구와 태양 사이 거리, 약 1억 5천만 km.' },
    ly:  { en: 'Light-year: distance light travels in 1 year, about 9.5 trillion km.', ko: '광년: 빛이 1년 동안 가는 거리, 약 9.5조 km.' },
    kpc: { en: 'Kiloparsec: about 3,261 light-years.', ko: '킬로파섹: 약 3,261광년.' },
    Mpc: { en: 'Megaparsec: about 3.26 million light-years.', ko: '메가파섹: 약 326만 광년.' },
    Gpc: { en: 'Gigaparsec: about 3.26 billion light-years.', ko: '기가파섹: 약 32억 6천만 광년.' },
  };
  return tooltips[unit]?.[lang] ?? unit;
}
