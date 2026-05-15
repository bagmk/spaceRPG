import type { EndingId, EndingOption, GameState, Stage, UniverseSeed, AnomalyType } from './types';
import type { Lang } from '../i18n';
import { findEntityById } from './entities/stageItems';

const BASE_ENDINGS: EndingId[] = ['heat_death', 'big_crunch', 'big_rip', 'vacuum_decay'];
export const ALL_ENDINGS: EndingId[] = [...BASE_ENDINGS, 'bounce'];

interface BilingualHint { en: string; ko: string; }
interface BilingualCopy { label: BilingualHint; description: BilingualHint; }

const ENDING_HINTS: Record<Exclude<EndingId, 'heat_death'>, BilingualHint> = {
  big_crunch: {
    en: 'During stages 13–16, keep your manual click rate at 1+ click per second. The game checks your recent late-stage click-rate records plus the current stage rate.',
    ko: '13~16단계에서 수동 클릭 속도를 초당 1회 이상으로 유지하세요. 최근 후반 스테이지 클릭 기록과 현재 스테이지 클릭 속도를 함께 확인합니다.',
  },
  big_rip: {
    en: 'Build a time-dominant universe: reach Aeon Drive level 30 with the Time Lv.30 cross-node, or own 12+ Entity Lab upgrades whose effect is Time or All-source multiplier.',
    ko: '시간 중심 우주를 만드세요. Aeon Drive 30레벨과 Time Lv.30 교차 노드를 보유하거나, 효과가 시간 또는 만능 배율인 엔티티 연구소 업그레이드를 12개 이상 보유해야 합니다.',
  },
  vacuum_decay: {
    en: 'In the proton decay era, condense when the stage progress is very close to 25%, 50%, 75%, or 100%. Precision matters.',
    ko: '양성자 붕괴 시대에서 스테이지 진행도가 25%, 50%, 75%, 100%에 매우 가까울 때 응축하세요. 정확도가 중요합니다.',
  },
  bounce: {
    en: 'Complete the four base endings: Heat Death, Big Crunch, Big Rip, and Vacuum Decay. Then reach universe count 5 or higher.',
    ko: '기본 엔딩 4개인 열적 죽음, 빅 크런치, 빅 립, 진공 붕괴를 모두 완료한 뒤 우주 횟수 5 이상에 도달하세요.',
  },
};

const ENDING_COPY: Record<EndingId, BilingualCopy> = {
  heat_death: {
    label:       { en: 'Heat Death',    ko: '열적 죽음' },
    description: { en: 'The clock continues into equilibrium.',              ko: '시계는 평형 속으로 계속 흐른다.' },
  },
  big_crunch: {
    label:       { en: 'Big Crunch',    ko: '빅 크런치' },
    description: { en: 'Expansion reverses and all structure falls inward.', ko: '팽창이 역전되고 모든 구조가 안으로 붕괴한다.' },
  },
  big_rip: {
    label:       { en: 'Big Rip',       ko: '빅 립' },
    description: { en: 'Acceleration tears apart every bound scale.',        ko: '가속이 모든 묶인 규모를 찢어낸다.' },
  },
  vacuum_decay: {
    label:       { en: 'Vacuum Decay',  ko: '진공 붕괴' },
    description: { en: 'A truer vacuum expands through everything that was.', ko: '더 참된 진공이 존재했던 모든 것을 관통해 팽창한다.' },
  },
  bounce: {
    label:       { en: 'Bounce',        ko: '반동' },
    description: { en: 'The cosmos folds inward and begins again with memory intact.', ko: '우주가 안으로 접히고, 기억을 간직한 채 다시 시작한다.' },
  },
};

const ANOMALIES: AnomalyType[] = ['crystalline', 'inverted_time', 'high_energy', 'dim', 'echoing'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickRandomAnomaly(): AnomalyType {
  return ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)] ?? 'crystalline';
}

function descriptorForGravity(gravityMod: number): string {
  if (gravityMod >= 1.1) return 'Dense';
  if (gravityMod <= 0.9) return 'Drifting';
  return 'Balanced';
}

function descriptorForTime(timeMod: number): string {
  if (timeMod >= 1.1) return 'Swift';
  if (timeMod <= 0.9) return 'Slow';
  return 'Steady';
}

function descriptorForAnomaly(anomaly: AnomalyType | null): string {
  switch (anomaly) {
    case 'crystalline':
      return 'Crystal';
    case 'inverted_time':
      return 'Reverse';
    case 'high_energy':
      return 'Bright';
    case 'dim':
      return 'Faded';
    case 'echoing':
      return 'Echoing';
    default:
      return 'Cosmos';
  }
}

function generateAtlasName(gravityMod: number, timeMod: number, anomaly: AnomalyType | null): string {
  const left = descriptorForTime(timeMod);
  const right = anomaly ? descriptorForAnomaly(anomaly) : descriptorForGravity(gravityMod);
  if (gravityMod >= 1.1 && anomaly === 'crystalline') {
    return 'Universe of Dense Crystal';
  }
  if (timeMod <= 0.9 && anomaly === null) {
    return 'Slow Bright Universe';
  }
  return `${left} ${right} Universe`;
}

export function createInitialUniverseSeed(): UniverseSeed {
  return {
    index: 1,
    gravityMod: 1,
    timeMod: 1,
    paletteShift: 0,
    anomaly: null,
    atlasName: 'First Cosmos',
  };
}

export function generateUniverseSeed(prevIndex: number): UniverseSeed {
  const index = prevIndex + 1;
  const gravityMod = 0.8 + Math.random() * 0.4;
  const timeMod = 0.8 + Math.random() * 0.4;
  const paletteShift = Math.floor(Math.random() * 360);
  const anomaly = Math.random() < 0.05 ? pickRandomAnomaly() : null;
  return {
    index,
    gravityMod,
    timeMod,
    paletteShift,
    anomaly,
    atlasName: generateAtlasName(gravityMod, timeMod, anomaly),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return [0, 0, lightness];
  }
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  switch (max) {
    case rn:
      hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      hue = (bn - rn) / delta + 2;
      break;
    default:
      hue = (rn - gn) / delta + 4;
      break;
  }
  return [hue * 60, saturation, lightness];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [chroma, x, 0];
  else if (hue < 120) [r, g, b] = [x, chroma, 0];
  else if (hue < 180) [r, g, b] = [0, chroma, x];
  else if (hue < 240) [r, g, b] = [0, x, chroma];
  else if (hue < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  return [(r + match) * 255, (g + match) * 255, (b + match) * 255];
}

export function shiftHexHue(hex: string, hueShift: number, brightness = 1): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h + hueShift, s, clamp(l * brightness, 0, 1));
  return rgbToHex(nr, ng, nb);
}

export function applyUniverseToStage(stage: Stage, seed: UniverseSeed): Stage {
  const brightness = seed.anomaly === 'dim' ? 0.6 : 1;
  return {
    ...stage,
    accent: shiftHexHue(stage.accent, seed.paletteShift, brightness),
    coreColor: shiftHexHue(stage.coreColor, seed.paletteShift, brightness),
    particleColors: stage.particleColors.map((color) => shiftHexHue(color, seed.paletteShift, brightness)),
    background: {
      ...stage.background,
      gradientTop: shiftHexHue(stage.background.gradientTop, seed.paletteShift, brightness),
      gradientBottom: shiftHexHue(stage.background.gradientBottom, seed.paletteShift, brightness),
      starColor: shiftHexHue(stage.background.starColor, seed.paletteShift, brightness),
      distantElementColor: shiftHexHue(stage.background.distantElementColor, seed.paletteShift, brightness),
    },
  };
}

export function isBigRipEligible(
  state: Pick<GameState, 'skills' | 'endingsUnlocked' | 'endingsCompleted' | 'purchasedEntities'>,
): boolean {
  const timeEntityCount = state.purchasedEntities.reduce((sum, entry) => {
    const entity = findEntityById(entry.entityId);
    if (!entity) return sum;
    return entity.effect.type === 'time' || entity.effect.type === 'multiplier'
      ? sum + entry.count
      : sum;
  }, 0);

  return (
    state.endingsUnlocked.includes('big_rip') ||
    state.endingsCompleted.includes('big_rip') ||
    (state.skills.time.level >= 30 && state.skills.ownedCrossNodes.includes('time_lv30')) ||
    timeEntityCount >= 12
  );
}

export function isVacuumDecayProgress(progress01: number): boolean {
  return [0.25, 0.5, 0.75, 1].some((target) => Math.abs(progress01 - target) <= 0.005);
}

function getCurrentStageClickRate(state: Pick<GameState, 'stageIdx' | 'totalClicks' | 'stageClicksAtStageStart' | 'stageStartedAt'>, now: number): number | null {
  if (state.stageIdx + 1 < 13) {
    return null;
  }
  const elapsedSec = Math.max(1, (now - state.stageStartedAt) / 1000);
  return Math.max(0, state.totalClicks - state.stageClicksAtStageStart) / elapsedSec;
}

export function isBigCrunchEligible(
  state: Pick<GameState, 'clickRateLog' | 'stageIdx' | 'totalClicks' | 'stageClicksAtStageStart' | 'stageStartedAt' | 'endingsUnlocked' | 'endingsCompleted'>,
  now: number,
): boolean {
  if (state.endingsUnlocked.includes('big_crunch') || state.endingsCompleted.includes('big_crunch')) {
    return true;
  }
  const currentRate = getCurrentStageClickRate(state, now);
  const rates = [...state.clickRateLog];
  if (currentRate !== null) {
    rates.push(currentRate);
  }
  if (rates.length < 4) {
    return false;
  }
  const recentRates = rates.slice(-4);
  return recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length >= 1;
}

export function isBounceEligible(
  state: Pick<GameState, 'universeCount' | 'endingsCompleted' | 'endingsUnlocked'>,
): boolean {
  if (state.endingsUnlocked.includes('bounce') || state.endingsCompleted.includes('bounce')) {
    return true;
  }
  return state.universeCount >= 5 && BASE_ENDINGS.every((endingId) => state.endingsCompleted.includes(endingId));
}

export function getEndingOptions(state: GameState, now: number, lang: Lang = 'en'): EndingOption[] {
  const everythingUnlocked =
    state.endingsCompleted.includes('bounce') || state.endingsUnlocked.includes('bounce');
  const bigCrunchUnlocked = everythingUnlocked || isBigCrunchEligible(state, now);
  const bigRipUnlocked = everythingUnlocked || isBigRipEligible(state);
  const vacuumUnlocked =
    everythingUnlocked ||
    state.endingsUnlocked.includes('vacuum_decay') ||
    state.endingsCompleted.includes('vacuum_decay') ||
    state.endingProgressFlags.vacuumDecayEligible;
  const bounceUnlocked = everythingUnlocked || isBounceEligible(state);

  const unlockedMap: Record<EndingId, boolean> = {
    heat_death: true,
    big_crunch: bigCrunchUnlocked,
    big_rip: bigRipUnlocked,
    vacuum_decay: vacuumUnlocked,
    bounce: bounceUnlocked,
  };

  const alwaysAvailable = lang === 'ko'
    ? '특수 조건 없이 항상 선택할 수 있는 기본 엔딩입니다.'
    : 'Always available as the default ending; no special condition is required.';
  const requirementMap: Record<EndingId, string> = {
    heat_death: alwaysAvailable,
    big_crunch: ENDING_HINTS.big_crunch[lang],
    big_rip: ENDING_HINTS.big_rip[lang],
    vacuum_decay: ENDING_HINTS.vacuum_decay[lang],
    bounce: ENDING_HINTS.bounce[lang],
  };

  return ALL_ENDINGS.map((endingId) => ({
    id: endingId,
    label: ENDING_COPY[endingId].label[lang],
    description: ENDING_COPY[endingId].description[lang],
    unlocked: unlockedMap[endingId],
    seen: state.endingsCompleted.includes(endingId),
    requirement: requirementMap[endingId],
  }));
}

export function formatUniverseModifier(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

export function getAnomalyLabel(anomaly: AnomalyType | null): string {
  if (!anomaly) return 'None';
  return anomaly.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
