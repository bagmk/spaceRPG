import { TUNING } from './constants';
import { STAGES } from './stages';
import type { EndingId, GameState, ShopBoost, Stage, TimedShopBoost } from './types';
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
  if (!Number.isFinite(value) || value < 0) return '0';
  const whole = Math.floor(value);
  if (whole < 1_000_000) return whole.toLocaleString('en-US');
  if (whole < 1e9) return `${(whole / 1e6).toFixed(2)}M`;
  if (whole < 1e12) return `${(whole / 1e9).toFixed(2)}B`;
  if (whole < 1e15) return `${(whole / 1e12).toFixed(2)}T`;
  // 6 significant figures in scientific notation
  const exp = Math.floor(Math.log10(whole));
  const mantissa = whole / Math.pow(10, exp);
  return `${mantissa.toFixed(5)}e${exp}`;
}

/** Short form: 2 significant figures — for thresholds / totals where space is tight. */
export function formatGameNumberShort(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  const whole = Math.floor(value);
  if (whole < 1_000_000) return whole.toLocaleString('en-US');
  if (whole < 1e9) return `${(whole / 1e6).toFixed(1)}M`;
  if (whole < 1e12) return `${(whole / 1e9).toFixed(1)}B`;
  if (whole < 1e15) return `${(whole / 1e12).toFixed(1)}T`;
  const exp = Math.floor(Math.log10(whole));
  const mantissa = whole / Math.pow(10, exp);
  return `${mantissa.toFixed(1)}e${exp}`;
}

/**
 * Cosmic time with N significant figures, keeping the unit (yr/Myr/Gyr/Tyr).
 * Default: 6 sig figs. Use sigFigs=2 for the threshold display.
 */
export function formatCosmicTimeSigFigs(seconds: number, sigFigs = 6): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < SECONDS_PER_YEAR) {
    // Short timescales — just use the original formatCosmicTime
    return formatCosmicTime(seconds);
  }
  const years = seconds / SECONDS_PER_YEAR;
  if (years < 1e6) return `${years.toPrecision(sigFigs)}yr`;
  if (years < 1e9) return `${(years / 1e6).toPrecision(sigFigs)}Myr`;
  if (years < 1e12) return `${(years / 1e9).toPrecision(sigFigs)}Gyr`;
  return `${(years / 1e12).toPrecision(sigFigs)}Tyr`;
}

export function getAutoRate(mods: Modifiers): number {
  return Math.max(0, (0 + mods.autoRateAdd) * mods.autoRateMult);
}

export function getCritMultiplier(critLevel: number, mods: Modifiers): number {
  const base = Math.max(1.5, 1.5 + critLevel * 0.5);
  return base * mods.critMultMult * mods.apexMult;
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

export function getCritChance(critLevel: number, combo: number, mods: Modifiers): number {
  const base = critLevel * 0.015 + mods.critChanceAdd;
  const comboBonus = combo * 0.003;
  const cap = 0.4 + mods.critChanceCapAdd;
  return Math.min(cap, base + comboBonus);
}

export function getTimeMultiplier(timeLevel: number, mods: Modifiers): number {
  return Math.pow(10, timeLevel) * mods.apexMult * mods.timeMultMult;
}

export function getTimeBudget(_stage: Stage): number {
  return 100;
}

export function getCosmicTimeFillRate(
  aeonLevel: number,
  mods: Modifiers,
  boostMultiplier = 1,
): number {
  return Math.pow(10, aeonLevel) * mods.apexMult * mods.timeMultMult * boostMultiplier;
}

export function getTimeFillRateGauge(
  stage: Stage,
  aeonLevel: number,
  mods: Modifiers,
  boostMultiplier = 1,
): number {
  void stage;
  return getCosmicTimeFillRate(aeonLevel, mods, boostMultiplier);
}

export function getTimeFillRate(
  _stage: Stage,
  aeonLevel: number,
  mods: Modifiers,
  boostMultiplier = 1,
): number {
  return getCosmicTimeFillRate(aeonLevel, mods, boostMultiplier);
}

export function getTimeFillSeconds(stage: Stage, aeonLevel: number, mods: Modifiers): number {
  void stage;
  const rate = getCosmicTimeFillRate(aeonLevel, mods);
  return rate <= 0 ? Number.POSITIVE_INFINITY : 100 / rate;
}

export function getCosmicClockForGauge(stageIdx: number, timeGauge: number): number {
  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
  const previous = stageIdx === 0 ? null : STAGES[stageIdx - 1];
  const stageStart = previous?.cosmicTimeSec ?? 1e-34;
  const fraction = clamp(timeGauge / 100, 0, 1);
  const startLog = Math.log10(stageStart);
  const endLog = Math.log10(stage.cosmicTimeSec);
  return Math.pow(10, startLog + fraction * (endLog - startLog));
}

export function getTimeGaugeForCosmicClock(stageIdx: number, cosmicClockSec: number): number {
  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
  const previous = stageIdx === 0 ? null : STAGES[stageIdx - 1];
  const stageStart = previous?.cosmicTimeSec ?? 1e-34;
  if (cosmicClockSec <= stageStart) {
    return 0;
  }
  const startLog = Math.log10(stageStart);
  const endLog = Math.log10(stage.cosmicTimeSec);
  const span = endLog - startLog;
  if (span <= 0) {
    return 100;
  }
  return clamp(((Math.log10(cosmicClockSec) - startLog) / span) * 100, 0, 125);
}

export function getCappedTimeGaugeForDisplay(timeGauge: number): number {
  return clamp(timeGauge, 0, 100);
}

export function getActiveBoostMultiplier(
  boost: TimedShopBoost | undefined,
  now: number,
): number {
  if (!boost || now >= boost.expiresAt) {
    return 1;
  }
  return boost.factor;
}

export function getCompositeBoostMultiplier(
  boosts: ShopBoost[] | undefined,
  idPrefix: string,
  now: number,
): number {
  return (boosts ?? [])
    .filter((boost) => boost.id.startsWith(idPrefix) && boost.expiresAt > now)
    .reduce((acc, boost) => acc * boost.factor, 1);
}

export function canCondense(state: GameState): boolean {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding) {
    return false;
  }
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  if (stage.id === STAGES.length) {
    return false;
  }
  const threshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  return state.quanta >= threshold && state.cosmicClockSec >= stage.cosmicTimeSec;
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

function formatScientific(value: number): string {
  const [mantissa, exponent] = value.toExponential(0).split('e');
  return `${mantissa}e${Number(exponent)}`;
}

export function formatCosmicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0ms';
  }
  if (seconds < 1e-3) {
    return `${formatScientific(seconds)}s`;
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
  return `${formatScientific(years)}yr`;
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
