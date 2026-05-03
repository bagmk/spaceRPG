import { TUNING } from './constants';
import type { EndingId, EndingOption, Stage } from './types';

const WHOLE_NUMBER_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
  'QaDc',
  'QiDc',
  'SxDc',
  'SpDc',
  'ODc',
  'NDc',
  'V',
  'UV',
] as const;

const SECONDS_PER_YEAR = 31_557_600;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeAdd(a: number, b: number): number {
  if (a < 1e15 && b < 1e15) {
    return a + b;
  }
  return a + b;
}

export function getClickPower(stage: Stage, clickLevel: number, prestigeBoost: number): number {
  const base = Math.max(1, stage.threshold / (stage.realPlayTargetSec * 5));
  const levelMult = Math.pow(1.12, clickLevel);
  const prestigeMult = 1 + prestigeBoost * 0.5;
  return base * levelMult * prestigeMult;
}

export function getAutoRate(stage: Stage, autoLevel: number, prestigeBoost: number): number {
  if (autoLevel === 0) {
    return 0;
  }
  const basePerLevel = stage.threshold / (stage.realPlayTargetSec * 30);
  const levelMult = autoLevel * Math.pow(1.04, autoLevel);
  return basePerLevel * levelMult * (1 + prestigeBoost * 0.3);
}

export function getCritMultiplier(critLevel: number): number {
  return 5 + critLevel * 2 + Math.floor(critLevel / 10) * 5;
}

export function getClickCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.005 * Math.pow(TUNING.COST_GROWTH, level));
}

export function getAutoCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.012 * Math.pow(TUNING.COST_GROWTH, level));
}

export function getCritCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.025 * Math.pow(TUNING.COST_GROWTH, level));
}

export function getEffectiveThreshold(stage: Stage, _prestigeBoost: number): number {
  return stage.threshold;
}

export function getComboMult(combo: number, comboCapBonus = 0): number {
  return (
    1 +
    Math.min(
      TUNING.COMBO_MULT_MAX + comboCapBonus - 1,
      Math.floor(combo / 10) * TUNING.COMBO_MULT_PER_10,
    )
  );
}

export function getCritChance(combo: number): number {
  return (
    TUNING.CRIT_BASE_CHANCE +
    Math.min(TUNING.CRIT_MAX - TUNING.CRIT_BASE_CHANCE, combo * TUNING.CRIT_PER_COMBO)
  );
}

export function getEntropyOnCondense(quanta: number, threshold: number): number {
  const baseLog = Math.floor(Math.log2(quanta + 1) * 3);
  const grindBonus = quanta > threshold ? Math.floor((quanta / threshold - 1) * 2) : 0;
  return baseLog + grindBonus;
}

export function applyAntiRunaway(raw: number): number {
  return raw;
}

export function getUniverseBoost(runEntropy: number): number {
  return Math.log10(1 + runEntropy) * 2;
}

export function getCondensedMassReward(
  runEntropy: number,
  endingId: EndingId,
  universeCount: number,
): number {
  const base = Math.pow(Math.max(1, runEntropy), 0.4);
  const endingMult: Record<EndingId, number> = {
    heat_death: 1,
    big_rip: 1.5,
    big_crunch: 1.2,
    vacuum_decay: 2,
  };
  const firstTimeBonus = universeCount === 1 ? 3 : 1;
  return base * endingMult[endingId] * firstTimeBonus;
}

export function getEchoReward(uniqueEndingsCompleted: number): number {
  return Math.pow(2, uniqueEndingsCompleted);
}

export function getEndingOptions(
  cumulativeBoost: number,
  condensedMass: number,
  unlocks: string[],
): EndingOption[] {
  return [
    {
      id: 'heat_death',
      label: 'Heat Death',
      description: 'The clock continues into equilibrium.',
      unlocked: true,
      requirement: 'Always available',
    },
    {
      id: 'big_crunch',
      label: 'Big Crunch',
      description: 'Expansion reverses and all structure falls inward.',
      unlocked: condensedMass >= 1000,
      requirement: 'Requires 1000 condensed mass',
    },
    {
      id: 'big_rip',
      label: 'Big Rip',
      description: 'Acceleration tears apart every bound scale.',
      unlocked: cumulativeBoost >= 100,
      requirement: 'Requires 100 cumulative boost',
    },
    {
      id: 'vacuum_decay',
      label: 'Vacuum Decay',
      description: 'A truer vacuum expands through everything that was.',
      unlocked: unlocks.includes('vacuum_stability'),
      requirement: 'Requires Vacuum Stability',
    },
  ];
}

export function getLifeStep(progress01: number): number {
  if (progress01 < 0.2) return 0;
  if (progress01 < 0.4) return 1;
  if (progress01 < 0.6) return 2;
  if (progress01 < 0.8) return 3;
  return 4;
}

export function getLifeStepLabel(step: number): string {
  return ['Abiogenesis', 'Multicellular', 'Cambrian', 'Land', 'Mind'][step] ?? 'Mind';
}

export function getProgress(quanta: number, threshold: number): number {
  return clamp(quanta / threshold, 0, 1);
}

export function formatWhole(value: number): string {
  if (!Number.isFinite(value)) {
    return '∞';
  }
  if (value < 0) {
    return `-${formatWhole(Math.abs(value))}`;
  }
  if (value < 1000) {
    return Math.floor(value).toString();
  }

  if (value >= 1e33) {
    return value.toExponential(2).replace('+', '');
  }

  let unitIdx = Math.floor(Math.log10(value) / 3);
  unitIdx = clamp(unitIdx, 0, WHOLE_NUMBER_SUFFIXES.length - 1);
  const scaled = value / Math.pow(1000, unitIdx);

  if (unitIdx === 0) {
    return Math.floor(scaled).toString();
  }

  return `${scaled.toFixed(2)}${WHOLE_NUMBER_SUFFIXES[unitIdx]}`;
}

export function formatCosmicTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '∞ yr';
  }
  if (seconds <= 0) {
    return '0 s';
  }
  if (seconds < 1) {
    return `${seconds.toExponential(1).replace('+', '')} s`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
  }
  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(2)} min`;
  }
  if (seconds < 86_400) {
    return `${(seconds / 3600).toFixed(2)} hr`;
  }
  if (seconds < SECONDS_PER_YEAR) {
    return `${(seconds / 86_400).toFixed(2)} days`;
  }

  const years = seconds / SECONDS_PER_YEAR;
  if (years < 1e3) {
    return `${years.toFixed(2)} yr`;
  }
  if (years < 1e6) {
    return `${(years / 1e3).toFixed(2)} Kyr`;
  }
  if (years < 1e9) {
    return `${(years / 1e6).toFixed(2)} Myr`;
  }
  if (years < 1e12) {
    return `${(years / 1e9).toFixed(2)} Gyr`;
  }
  return `${years.toExponential(1).replace('+', '')} yr`;
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) {
    return '∞';
  }
  if (value >= 1e6) {
    return formatWhole(value);
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return value.toFixed(digits);
}

export function formatDuration(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':');
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
