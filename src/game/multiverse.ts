import type { EndingId, EndingOption, EndingProgressFlags, GameState, Stage, UniverseSeed, AnomalyType } from './types';
import type { Lang } from '../i18n';
import { STAGES } from './stages';

const BASE_ENDINGS: EndingId[] = ['heat_death', 'big_crunch', 'big_rip', 'vacuum_decay'];
export const ALL_ENDINGS: EndingId[] = [...BASE_ENDINGS, 'bounce'];
export const BIG_CRUNCH_ENTROPY_THRESHOLD_KB = 1024 * 1024;
/** 1 RB = 1024 YB = 1024^8 KB */
export const BIG_RIP_ENTROPY_THRESHOLD_KB = Math.pow(1024, 8);

interface BilingualHint { en: string; ko: string; }
interface EndingDefinition {
  label: BilingualHint;
  description: BilingualHint;
  condition: BilingualHint;
}

export const ENDING_DEFINITIONS: Record<EndingId, EndingDefinition> = {
  heat_death: {
    label: { en: 'Heat Death', ko: '열죽음' },
    description: {
      en: 'The clock fades into equilibrium.',
      ko: '시간은 균형 속으로 사라집니다.',
    },
    condition: {
      en: 'Always available.',
      ko: '항상 선택할 수 있습니다.',
    },
  },
  big_crunch: {
    label: { en: 'Big Crunch', ko: '대붕괴' },
    description: {
      en: 'The universe collapses under its own weight.',
      ko: '우주는 자신의 무게를 이기지 못하고 무너집니다.',
    },
    condition: {
      en: 'Reach 1GB Entropy by Stage 3.',
      ko: '스테이지 3까지 엔트로피 1GB를 달성하세요.',
    },
  },
  big_rip: {
    label: { en: 'Big Rip', ko: '대찢김' },
    description: {
      en: 'Acceleration tears every bound apart.',
      ko: '가속이 모든 결합을 찢어냅니다.',
    },
    condition: {
      en: 'Reach 1 Ronna Byte (1024 YB) of Entropy.',
      ko: '엔트로피 1 론나바이트(1024 YB)를 달성하세요.',
    },
  },
  vacuum_decay: {
    label: { en: 'Vacuum Decay', ko: '진공 붕괴' },
    description: {
      en: 'A new vacuum spreads through everything that was.',
      ko: '새로운 진공이 모든 것을 덮어갑니다.',
    },
    condition: {
      en: 'Reach the end without upgrading Critical.',
      ko: '크리티컬을 하나도 업그레이드하지 않고 스테이지를 클리어하세요.',
    },
  },
  bounce: {
    label: { en: 'Bounce', ko: '반동 우주' },
    description: {
      en: 'The cosmos folds inward and begins again.',
      ko: '우주는 접히고, 기억을 품은 채 다시 시작됩니다.',
    },
    condition: {
      en: 'Complete 3 different endings.',
      ko: '서로 다른 엔딩 3개를 완료하세요.',
    },
  },
};

const ANOMALIES: AnomalyType[] = ['crystalline', 'inverted_time', 'high_energy', 'dim', 'echoing'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickRandomAnomaly(): AnomalyType {
  return ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)] ?? 'crystalline';
}

interface AtlasL {
  en: string;
  ko: string;
}

function descriptorForGravity(gravityMod: number): AtlasL {
  if (gravityMod >= 1.1) return { en: 'Dense', ko: '밀집' };
  if (gravityMod <= 0.9) return { en: 'Drifting', ko: '희박' };
  return { en: 'Balanced', ko: '균형' };
}

function descriptorForTime(timeMod: number): AtlasL {
  if (timeMod >= 1.1) return { en: 'Swift', ko: '신속' };
  if (timeMod <= 0.9) return { en: 'Slow', ko: '완만' };
  return { en: 'Steady', ko: '안정' };
}

function descriptorForAnomaly(anomaly: AnomalyType | null): AtlasL {
  switch (anomaly) {
    case 'crystalline':
      return { en: 'Crystal', ko: '수정' };
    case 'inverted_time':
      return { en: 'Reverse', ko: '역행' };
    case 'high_energy':
      return { en: 'Bright', ko: '광휘' };
    case 'dim':
      return { en: 'Faded', ko: '퇴색' };
    case 'echoing':
      return { en: 'Echoing', ko: '메아리' };
    default:
      return { en: 'Cosmos', ko: '코스모스' };
  }
}

export function getAtlasName(seed: UniverseSeed, lang: Lang): string {
  if (seed.index === 1) {
    return lang === 'ko' ? '최초의 우주' : 'First Cosmos';
  }
  if (seed.gravityMod >= 1.1 && seed.anomaly === 'crystalline') {
    return lang === 'ko' ? '밀집 수정의 우주' : 'Universe of Dense Crystal';
  }
  if (seed.timeMod <= 0.9 && seed.anomaly === null) {
    return lang === 'ko' ? '완만한 광휘의 우주' : 'Slow Bright Universe';
  }
  const left = descriptorForTime(seed.timeMod);
  const right = seed.anomaly
    ? descriptorForAnomaly(seed.anomaly)
    : descriptorForGravity(seed.gravityMod);
  return lang === 'ko' ? `${left.ko} ${right.ko} 우주` : `${left.en} ${right.en} Universe`;
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
  const seed: UniverseSeed = { index, gravityMod, timeMod, paletteShift, anomaly, atlasName: '' };
  seed.atlasName = getAtlasName(seed, 'en');
  return seed;
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

function currentStageId(state: Pick<GameState, 'stageIdx'>): number {
  return state.stageIdx + 1;
}

export function hasCriticalUpgradeInCurrentUniverse(
  state: Pick<GameState, 'critLevel' | 'skills' | 'endingProgressFlags'>,
): boolean {
  return (
    state.endingProgressFlags.criticalUpgradedThisUniverse ||
    state.critLevel > 0 ||
    state.skills.crit.level > 0 ||
    state.skills.ownedCrossNodes.some((nodeId) => nodeId.startsWith('crit_'))
  );
}

export function isBigCrunchEligible(
  state: Pick<GameState, 'stageIdx' | 'entropy' | 'endingProgressFlags'>,
): boolean {
  return (
    state.endingProgressFlags.bigCrunchEligible ||
    (currentStageId(state) <= 3 && state.entropy >= BIG_CRUNCH_ENTROPY_THRESHOLD_KB)
  );
}

export function isBigRipEligible(
  state: Pick<GameState, 'entropy'>,
): boolean {
  return (state.entropy ?? 0) >= BIG_RIP_ENTROPY_THRESHOLD_KB;
}

export function isVacuumDecayEligible(
  state: Pick<GameState, 'stageIdx' | 'critLevel' | 'skills' | 'endingProgressFlags'>,
): boolean {
  return currentStageId(state) >= STAGES.length && !hasCriticalUpgradeInCurrentUniverse(state);
}

export function getUniqueCompletedNonBounceEndingCount(
  endingsCompleted: EndingId[],
): number {
  return new Set(endingsCompleted.filter((endingId) => endingId !== 'bounce')).size;
}

export function isBounceEligible(
  state: Pick<GameState, 'endingsCompleted'>,
): boolean {
  return getUniqueCompletedNonBounceEndingCount(state.endingsCompleted) >= 3;
}

export function getCurrentUniverseEndingProgressFlags(
  state: Pick<GameState, 'stageIdx' | 'entropy' | 'critLevel' | 'skills' | 'endingProgressFlags'>,
): EndingProgressFlags {
  const criticalUpgradedThisUniverse = hasCriticalUpgradeInCurrentUniverse(state);
  const bigCrunchEligible = isBigCrunchEligible(state);
  const bigRipEverEligible = state.endingProgressFlags.bigRipEverEligible || isBigRipEligible(state);
  const vacuumDecayEligible =
    !criticalUpgradedThisUniverse &&
    (state.endingProgressFlags.vacuumDecayEligible || currentStageId(state) >= STAGES.length);

  return {
    bigCrunchEligible,
    criticalUpgradedThisUniverse,
    bigRipEverEligible,
    vacuumDecayEligible,
  };
}

function sameEndingProgressFlags(a: EndingProgressFlags, b: EndingProgressFlags): boolean {
  return (
    a.bigCrunchEligible === b.bigCrunchEligible &&
    a.criticalUpgradedThisUniverse === b.criticalUpgradedThisUniverse &&
    a.bigRipEverEligible === b.bigRipEverEligible &&
    a.vacuumDecayEligible === b.vacuumDecayEligible
  );
}

export function withCurrentUniverseEndingProgress(state: GameState): GameState {
  const endingProgressFlags = getCurrentUniverseEndingProgressFlags(state);
  return sameEndingProgressFlags(state.endingProgressFlags, endingProgressFlags)
    ? state
    : { ...state, endingProgressFlags };
}

export function isEndingAvailable(state: GameState, endingId: EndingId): boolean {
  switch (endingId) {
    case 'heat_death':
      return true;
    case 'big_crunch':
      return isBigCrunchEligible(state);
    case 'big_rip':
      return state.endingProgressFlags.bigRipEverEligible || isBigRipEligible(state);
    case 'vacuum_decay':
      return isVacuumDecayEligible(state);
    case 'bounce':
      return isBounceEligible(state);
  }
}

export function getEndingOptions(state: GameState, _now: number, lang: Lang = 'en'): EndingOption[] {
  const progressedState = withCurrentUniverseEndingProgress(state);

  return ALL_ENDINGS.map((endingId) => ({
    id: endingId,
    label: ENDING_DEFINITIONS[endingId].label[lang],
    description: ENDING_DEFINITIONS[endingId].description[lang],
    unlocked: isEndingAvailable(progressedState, endingId),
    seen: state.endingsCompleted.includes(endingId),
    requirement: ENDING_DEFINITIONS[endingId].condition[lang],
  }));
}

export function formatUniverseModifier(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

export function getAnomalyLabel(anomaly: AnomalyType | null, lang: Lang): string {
  switch (anomaly) {
    case 'crystalline':
      return lang === 'ko' ? '수정질' : 'Crystalline';
    case 'inverted_time':
      return lang === 'ko' ? '역행 시간' : 'Inverted Time';
    case 'high_energy':
      return lang === 'ko' ? '고에너지' : 'High Energy';
    case 'dim':
      return lang === 'ko' ? '희미함' : 'Dim';
    case 'echoing':
      return lang === 'ko' ? '메아리' : 'Echoing';
    default:
      return lang === 'ko' ? '없음' : 'None';
  }
}

export function getEndingLabel(endingId: EndingId, lang: Lang): string {
  return ENDING_DEFINITIONS[endingId].label[lang];
}
