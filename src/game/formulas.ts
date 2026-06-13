import { TUNING } from './constants';
import { STAGES } from './stages';
import {
  AUTO_OUTPUT_MULTIPLIER,
  CLICK_OUTPUT_MULTIPLIER,
  ENTROPY_W_AUTO,
  CODEX_MASS_BONUS,
  ENTROPY_W_CLICK,
  TIME_MAXED_STAGE_SECONDS,
  TIME_MIN_STAGE_SECONDS,
  TIME_STAGE_ENTRY_MIN_GROWTH,
  TIME_STAGE_ENTRY_MIN_SECONDS,
  TIME_STAGE_BASE_SECONDS,
  TIME_STAGE_GROWTH_AFTER_STAGE_6,
} from './balance';
import { getActiveShopBoostMultiplier } from './shop/boosts';
import type { EndingId, GameState, ShopBoost, ShopBoostCategory, Stage, TimedShopBoost } from './types';
import type { Modifiers } from './skills/effects';
import { getCodexCompletionFraction } from './entities/codexSets';
import {
  getMaxLegacyTimeEntityMultiplierBeforeStage,
  getMaxTimeEntityMultiplierThroughStage,
} from './entities/stageItems';

const SECONDS_PER_YEAR = 31_557_600;
const ENTROPY_BYTES_PER_UNIT = 1024;
const ENTROPY_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] as const;

export interface EntropyReadout {
  value: string;
  unit: (typeof ENTROPY_UNITS)[number];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Cap to prevent Infinity propagation in long-running saves.
export const MAX_SAFE_QUANTA = 1e300;

export function safeAdd(a: number, b: number): number {
  // NaN = missing → 0; Infinity = overflow → clamp to the cap.
  const aClean = Number.isNaN(a) ? 0 : Number.isFinite(a) ? Math.max(0, a) : MAX_SAFE_QUANTA;
  const bClean = Number.isNaN(b) ? 0 : Number.isFinite(b) ? Math.max(0, b) : MAX_SAFE_QUANTA;
  const sum = aClean + bClean;
  if (!Number.isFinite(sum)) return MAX_SAFE_QUANTA;
  return Math.min(MAX_SAFE_QUANTA, sum);
}

export function getClickPower(mods: Modifiers): number {
  const rawPower = Math.max(1, (1 + mods.clickPowerAdd) * mods.clickPowerMult);
  return 1 + (rawPower - 1) * CLICK_OUTPUT_MULTIPLIER;
}

export function getUnupgradedTimeGaugeSeconds(stageNumber: number): number {
  const stageId = Math.max(1, Math.floor(stageNumber));
  const tunedSeconds = TIME_STAGE_BASE_SECONDS[stageId];
  if (tunedSeconds !== undefined) return tunedSeconds;
  const stage6Seconds = TIME_STAGE_BASE_SECONDS[6] ?? 36_000;
  return stage6Seconds * Math.pow(TIME_STAGE_GROWTH_AFTER_STAGE_6, stageId - 6);
}

export function getFreshStageMinimumTimeSeconds(stageNumber: number): number {
  const stageId = Math.max(1, Math.floor(stageNumber));
  if (stageId < 4) return TIME_MIN_STAGE_SECONDS;
  return TIME_STAGE_ENTRY_MIN_SECONDS * Math.pow(TIME_STAGE_ENTRY_MIN_GROWTH, stageId - 4);
}

export function formatGameNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  const whole = Math.floor(value);
  if (whole < 1_000) return String(whole);
  if (whole < 1_000_000) return `${(whole / 1_000).toFixed(whole < 10_000 ? 1 : 0)}k`;
  if (whole < 1e9) return `${(whole / 1e6).toFixed(2)}M`;
  if (whole < 1e12) return `${(whole / 1e9).toFixed(2)}B`;
  if (whole < 1e15) return `${(whole / 1e12).toFixed(2)}T`;
  // 3 significant figures in scientific notation
  const exp = Math.floor(Math.log10(whole));
  const mantissa = whole / Math.pow(10, exp);
  return `${mantissa.toFixed(2)}e${exp}`;
}

/** Short form: compact notation — for thresholds / totals where space is tight. */
export function formatGameNumberShort(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  const whole = Math.floor(value);
  if (whole < 1_000) return String(whole);
  if (whole < 1_000_000) return `${(whole / 1_000).toFixed(whole < 10_000 ? 1 : 0)}k`;
  if (whole < 1e9) return `${(whole / 1e6).toFixed(1)}M`;
  if (whole < 1e12) return `${(whole / 1e9).toFixed(1)}B`;
  if (whole < 1e15) return `${(whole / 1e12).toFixed(1)}T`;
  const exp = Math.floor(Math.log10(whole));
  const mantissa = whole / Math.pow(10, exp);
  return `${mantissa.toFixed(1)}e${exp}`;
}

export function formatAutoRateValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value < 1) return trimCompactNumber(value.toFixed(2));
  if (value < 10) return trimCompactNumber(value.toFixed(1));
  if (value < 1000) return trimCompactNumber(value.toFixed(1));
  return formatGameNumberShort(value);
}

export function formatEntropyParts(entropyKilobytes: number): EntropyReadout {
  const safeKilobytes = Number.isFinite(entropyKilobytes) && entropyKilobytes > 0
    ? entropyKilobytes
    : 0;
  let scaled = safeKilobytes * ENTROPY_BYTES_PER_UNIT;
  let unitIndex = 0;

  while (scaled >= ENTROPY_BYTES_PER_UNIT && unitIndex < ENTROPY_UNITS.length - 1) {
    scaled /= ENTROPY_BYTES_PER_UNIT;
    unitIndex += 1;
  }

  const value = unitIndex === 0
    ? String(Math.floor(scaled))
    : trimCompactNumber(scaled.toFixed(2));

  return {
    value,
    unit: ENTROPY_UNITS[unitIndex],
  };
}

export function formatEntropyAmount(entropyKilobytes: number): string {
  const readout = formatEntropyParts(entropyKilobytes);
  return `${readout.value} ${readout.unit}`;
}

/** Compact "current / target" entropy pair — merges the unit when both share it. */
export function formatEntropyPair(currentKilobytes: number, targetKilobytes: number): string {
  const current = formatEntropyParts(currentKilobytes);
  const target = formatEntropyParts(targetKilobytes);
  if (current.unit === target.unit) {
    return `${current.value} / ${target.value} ${target.unit}`;
  }
  return `${current.value} ${current.unit} / ${target.value} ${target.unit}`;
}

function trimCompactNumber(value: string): string {
  return value
    .replace(/\.0+(?=($|E|e))/, '')
    .replace(/(\.\d*?[1-9])0+(?=($|E|e))/, '$1')
    .replace(/e\+/g, 'E+')
    .replace(/e-/g, 'E-')
    .replace(/e/g, 'E');
}

function formatCompactMantissa(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 0.0001) return trimCompactNumber(value.toFixed(4));
  return trimCompactNumber(value.toExponential(1));
}

function formatProgressCurrentMantissa(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || Math.abs(value) < 0.0001) return '0.0000';
  return value.toFixed(4);
}

function formatProgressTargetMantissa(value: number, fixedSmall = false): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (fixedSmall && value < 1) return value.toFixed(4);
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) <= Math.max(1, Math.abs(value)) * 1e-9) {
    return String(rounded);
  }
  return formatCompactMantissa(value);
}

export interface ProgressReadout {
  value: string;
  exponent?: string;
  unit: string;
}

function getProgressExponent(value: number): number {
  return Math.floor(Math.log10(value));
}

function readoutToString(readout: ProgressReadout): string {
  return `${readout.value}${readout.exponent ?? ''}${readout.unit}`;
}

export function formatProgressNumberParts(current: number, target: number): ProgressReadout {
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(target) || target <= 0) {
    return { value: '0/0', unit: 'Q' };
  }
  if (target >= 1_000) {
    const exponent = getProgressExponent(Math.max(current, target));
    const scale = Math.pow(10, exponent);
    const passedTarget = current >= target;
    const currentLabel = passedTarget
      ? formatCompactMantissa(current / scale)
      : formatProgressCurrentMantissa(current / scale);
    return {
      value: `${currentLabel}/${passedTarget ? '-' : formatProgressTargetMantissa(target / scale, true)}`,
      exponent: `E+${exponent}`,
      unit: 'Q',
    };
  }
  if (current >= target) {
    return {
      value: `${formatCompactMantissa(current)}/-`,
      unit: 'Q',
    };
  }
  return {
    value: `${formatProgressCurrentMantissa(current)}/${formatProgressTargetMantissa(target)}`,
    unit: 'Q',
  };
}

export function formatProgressNumberPair(current: number, target: number): string {
  return readoutToString(formatProgressNumberParts(current, target));
}

function getCosmicTimeDisplayUnit(targetSeconds: number): { seconds: number; suffix: string; exponent?: string; scientific?: boolean } {
  if (targetSeconds < 1e-3) return { seconds: 1, suffix: 's', scientific: true };
  if (targetSeconds < SECONDS_PER_YEAR) return { seconds: 1, suffix: 's', scientific: targetSeconds >= 100 };

  const targetYears = targetSeconds / SECONDS_PER_YEAR;
  if (targetYears >= 1_000) {
    const exponent = getProgressExponent(targetYears);
    return {
      seconds: SECONDS_PER_YEAR * Math.pow(10, exponent),
      suffix: 'yr',
      exponent: `E+${exponent}`,
    };
  }
  return { seconds: SECONDS_PER_YEAR, suffix: 'yr' };
}

function formatTimeCurrentMantissa(value: number): string {
  return formatProgressCurrentMantissa(value);
}

function formatTimeExponentPair(current: number, target: number, suffix: string): ProgressReadout {
  const exponent = Math.floor(Math.log10(Math.abs(target)));
  const scale = Math.pow(10, exponent);
  const exponentLabel = exponent >= 0 ? `E+${exponent}` : `E${exponent}`;
  return {
    value: `${formatTimeCurrentMantissa(current / scale)}/${formatProgressTargetMantissa(target / scale)}`,
    exponent: exponentLabel,
    unit: suffix,
  };
}

export function formatCosmicTimeProgressParts(currentSeconds: number, targetSeconds: number): ProgressReadout {
  if (!Number.isFinite(currentSeconds) || currentSeconds <= 0 || !Number.isFinite(targetSeconds) || targetSeconds <= 0) {
    return { value: '0', unit: 'S' };
  }
  const unit = getCosmicTimeDisplayUnit(targetSeconds);
  const current = currentSeconds / unit.seconds;
  const target = targetSeconds / unit.seconds;
  const suffix = unit.suffix.toUpperCase();
  if (unit.exponent) {
    return {
      value: `${formatTimeCurrentMantissa(current)}/${formatProgressTargetMantissa(target)}`,
      exponent: unit.exponent,
      unit: suffix,
    };
  }
  const basis = Math.max(Math.abs(current), Math.abs(target));
  if (unit.scientific || basis >= 1e4) {
    return formatTimeExponentPair(current, target, suffix);
  }
  return {
    value: `${formatTimeCurrentMantissa(current)}/${formatProgressTargetMantissa(target)}`,
    unit: suffix,
  };
}

export function formatCosmicTimeProgressPair(currentSeconds: number, targetSeconds: number): string {
  return readoutToString(formatCosmicTimeProgressParts(currentSeconds, targetSeconds));
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
  return Math.max(0, (mods.autoRateAdd * mods.autoRateMult + mods.autoRateFlatAdd * mods.autoFlatMult) * AUTO_OUTPUT_MULTIPLIER);
}

export function getCritMultiplier(mods: Modifiers): number {
  return 1.5 * mods.critMultMult * mods.apexMult;
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
  const base = mods.critChanceAdd;
  const comboBonus = combo * 0.003;
  const cap = TUNING.CRIT_MAX + mods.critChanceCapAdd;
  return Math.min(cap, base + comboBonus);
}

export function getTimeMultiplier(mods: Modifiers): number {
  return mods.apexMult * mods.timeMultMult;
}

export function getTimeBudget(_stage: Stage): number {
  return 100;
}

export function getCosmicTimeFillRate(
  mods: Modifiers,
  boostMultiplier = 1,
  stageNumber = 1,
): number {
  // Stage sets the unupgraded duration; time bonuses scale that baseline.
  const baseSeconds = getUnupgradedTimeGaugeSeconds(stageNumber);
  const baseRate = 100 / baseSeconds;
  const levelBoost = mods.apexMult;
  const rawTimeBoost = Math.max(0, mods.timeMultMult);
  const maxEntityTimeBoost = getMaxTimeEntityMultiplierThroughStage(stageNumber);
  const timeEntityProgress = stageNumber >= 4 && maxEntityTimeBoost > 1
    ? clamp((rawTimeBoost - 1) / (maxEntityTimeBoost - 1), 0, 1)
    : 1;
  const fastestSeconds = stageNumber >= 4
    ? baseSeconds * Math.pow(TIME_MAXED_STAGE_SECONDS / baseSeconds, timeEntityProgress)
    : TIME_MIN_STAGE_SECONDS;
  const requiredTimeBoost = baseSeconds / fastestSeconds;
  const timeBoost = stageNumber >= 4 && maxEntityTimeBoost > 1
    ? 1 + timeEntityProgress * (requiredTimeBoost - 1)
    : rawTimeBoost;
  const maxRate = 100 / fastestSeconds;
  return Math.min(maxRate, baseRate * levelBoost * timeBoost * boostMultiplier);
}

export function getTimeFillRateGauge(
  stage: Stage,
  mods: Modifiers,
  boostMultiplier = 1,
): number {
  return getCosmicTimeFillRate(mods, boostMultiplier, stage.id);
}

export function getTimeFillRate(
  stage: Stage,
  mods: Modifiers,
  boostMultiplier = 1,
): number {
  return getCosmicTimeFillRate(mods, boostMultiplier, stage.id);
}

export function getTimeFillSeconds(stage: Stage, mods: Modifiers): number {
  const rate = getCosmicTimeFillRate(mods, 1, stage.id);
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
  const category: ShopBoostCategory = idPrefix.startsWith('time') ? 'time' : 'matter';
  return getActiveShopBoostMultiplier(boosts, category, now);
}

// Entity redesign D1: stage advancement is gated by cumulative entropy alone.
// Quanta is the economy (spend on upgrades/fusion); cosmic time is a narrative readout.
export function canCondense(state: GameState): boolean {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding) {
    return false;
  }
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  return state.entropy >= stage.entropyThreshold;
}

/** Cumulative entropy the player entered this stage with (= previous stage's gate). */
export function getEntropyGateFloor(stageIdx: number): number {
  if (stageIdx <= 0) return 0;
  return STAGES[Math.min(stageIdx - 1, STAGES.length - 1)].entropyThreshold;
}

/** 0..1 progress through the current stage's entropy gate window. */
export function getEntropyGateProgress(entropy: number, stageIdx: number): number {
  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
  const floor = getEntropyGateFloor(stageIdx);
  const span = stage.entropyThreshold - floor;
  if (span <= 0) return entropy >= stage.entropyThreshold ? 1 : 0;
  return clamp((entropy - floor) / span, 0, 1);
}

/**
 * Entropy rate: fraction of matter that converts to entropy (in KB).
 * Entropy scales linearly with matter so it naturally follows the same
 * exponential growth curve across stages.
 *
 * Stage  1 threshold   2K → ~1K KB entropy/stage  (1 MB)
 * Stage  8 threshold 300B → ~150B KB              (150 TB)
 * Stage 16 threshold  4Z → ~2Z KB                 (2 ZB)
 */
const ENTROPY_CONDENSE_RATE = 0.1;

export function getEntropyOnCondense(quanta: number, _threshold: number): number {
  if (!Number.isFinite(quanta) || quanta <= 0) return 0;
  return Math.floor(quanta * ENTROPY_CONDENSE_RATE);
}

/**
 * Entropy from matter income, weighted by how it was earned (entity redesign).
 * Clicking converts at ENTROPY_W_CLICK, auto income at ENTROPY_W_AUTO — active
 * play drives the progression gate roughly twice as fast per quanta.
 */
export function getEntropyFromMatterGain(
  beforeQuanta: number,
  afterQuanta: number,
  _threshold: number,
  source: 'click' | 'auto' = 'auto',
): number {
  if (!Number.isFinite(beforeQuanta) || !Number.isFinite(afterQuanta) || afterQuanta <= beforeQuanta) {
    return 0;
  }
  const weight = source === 'click' ? ENTROPY_W_CLICK : ENTROPY_W_AUTO;
  return (afterQuanta - beforeQuanta) * weight;
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
  almanacCollected: Record<number, string[]> = {},
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
  // Codex completion meta bonus (Phase 4-3): ×(1 + collected% × CODEX_MASS_BONUS).
  // Spends only into the Singularity tree, never the entropy gate — rewards
  // collection without touching stage pacing. Distinct from the live codex
  // stat modifiers (applyCollectionRewards).
  return base * endingMult[endingId] * firstTimeBonus * getCodexMassBonusFactor(almanacCollected);
}

/** The codex completion factor applied to the condensed-mass reward (for display). */
export function getCodexMassBonusFactor(almanacCollected: Record<number, string[]>): number {
  return 1 + getCodexCompletionFraction(almanacCollected) * CODEX_MASS_BONUS;
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
  const safeAlpha = Number.isFinite(alpha) ? alpha : 0;

  if (hex.startsWith('rgb(') || hex.startsWith('rgba(')) {
    const channels = hex.match(/[\d.]+/g);
    if (channels && channels.length >= 3) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${safeAlpha})`;
    }
  }

  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return `rgba(255, 255, 255, ${safeAlpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
