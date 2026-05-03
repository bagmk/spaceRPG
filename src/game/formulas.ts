import { TUNING } from './constants';
import type { EndingId, Stage } from './types';
import type { Modifiers } from './skills/effects';

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

export function getClickPower(mods: Modifiers): number {
  return Math.max(1, (1 + mods.clickPowerAdd) * mods.clickPowerMult);
}

export function formatGameNumber(value: number): string {
  return formatWhole(value);
}

export function getAutoRate(mods: Modifiers): number {
  return Math.max(0, (0 + mods.autoRateAdd) * mods.autoRateMult);
}

export function getCritMultiplier(mods: Modifiers): number {
  return 3 * mods.critMultMult;
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

export function getCritChance(combo: number, mods: Modifiers): number {
  const base = mods.critChanceAdd + combo * 0.005;
  const cap = 0.5 + mods.critChanceCapAdd;
  return Math.min(cap, base);
}

export function getTimeMultiplier(mods: Modifiers): number {
  return mods.timeMultMult;
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
    bounce: 2.5,
  };
  const firstTimeBonus = universeCount === 1 ? 3 : 1;
  return base * endingMult[endingId] * firstTimeBonus;
}

export function getEchoReward(uniqueEndingsCompleted: number): number {
  return Math.pow(2, uniqueEndingsCompleted);
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
  if (!Number.isFinite(value) || value < 0) {
    return '0';
  }
  const whole = Math.floor(value);
  if (whole < 1_000) {
    return whole.toString();
  }
  if (whole < 1_000_000) {
    return whole.toLocaleString('en-US');
  }
  if (whole < 1e9) {
    return `${Math.floor(whole / 1e6)}M`;
  }
  if (whole < 1e12) {
    return `${Math.floor(whole / 1e9)}B`;
  }
  if (whole < 1e15) {
    return `${Math.floor(whole / 1e12)}T`;
  }
  const exp = Math.floor(Math.log10(whole));
  const mantissa = Math.floor(whole / Math.pow(10, exp));
  return `${mantissa}e${exp}`;
}

export function formatCosmicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0ms';
  }
  if (seconds < 1) {
    return `${Math.floor(seconds * 1e3)}ms`;
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}hr`;
  }
  if (seconds < SECONDS_PER_YEAR) {
    return `${Math.floor(seconds / 86_400)}d`;
  }

  const years = seconds / SECONDS_PER_YEAR;
  if (years < 1e6) {
    return `${Math.floor(years)}yr`;
  }
  if (years < 1e9) {
    return `${Math.floor(years / 1e6)}Myr`;
  }
  if (years < 1e12) {
    return `${Math.floor(years / 1e9)}Gyr`;
  }
  const exp = Math.floor(Math.log10(years));
  const mantissa = Math.floor(years / Math.pow(10, exp));
  return `${mantissa}e${exp}yr`;
}

export function formatRate(value: number): string {
  return `${formatWhole(value)}/s`;
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
