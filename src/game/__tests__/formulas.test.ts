import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import { STAGE_ENTITIES } from '../entities/stageItems';
import {
  formatAutoRateValue,
  formatCosmicTime,
  formatCosmicTimeProgressPair,
  formatEntropyAmount,
  formatEntropyParts,
  formatProgressNumberPair,
  formatWhole,
  getAutoRate,
  getClickPower,
  getCosmicTimeFillRate,
  getCondensedMassReward,
  getCritChance,
  getEchoReward,
  getTimeMultiplier,
  getUnupgradedTimeGaugeSeconds,
  getUniverseBoost,
  safeAdd,
  MAX_SAFE_QUANTA,
} from '../formulas';
import { BIG_CRUNCH_ENTROPY_THRESHOLD_KB, getEndingOptions } from '../multiverse';
import { createInitialGameState } from '../reducer';
import { defaultModifiers, getActiveModifiers } from '../skills/effects';
import { SKILL_TIME_RATE_BASE, TIME_MAXED_STAGE_SECONDS } from '../balance';
import {
  getMaxLegacyTimeEntityMultiplierBeforeStage,
  getMaxTimeEntityMultiplierThroughStage,
} from '../entities/stageItems';
import { getParticleEntropyBonus } from '../particles';

describe('formatWhole', () => {
  it('formats small whole numbers without suffixes', () => {
    expect(formatWhole(0)).toBe('0');
    expect(formatWhole(999)).toBe('999');
  });

  it('formats threshold-scale numbers as floored integers', () => {
    expect(formatWhole(1_500)).toBe('1,500');
    expect(formatWhole(2_300_000)).toBe('2M');
  });

  it('switches to scientific notation for very large values', () => {
    expect(formatWhole(1.2e15)).toBe('1e15');
  });
});

describe('formatCosmicTime', () => {
  it('formats times with floored integer units', () => {
    expect(formatCosmicTime(0.75)).toBe('750ms');
    expect(formatCosmicTime(380000 * 31557600)).toBe('380000yr');
  });

  it('formats extremely large cosmic times in scientific notation', () => {
    expect(formatCosmicTime(1e100 * 31557600)).toBe('1e100yr');
    expect(formatCosmicTime(STAGES[14].cosmicTimeSec)).toBe('2e28yr');
  });

  it('formats the V7 initial cosmic time without a one-second baseline', () => {
    expect(formatCosmicTime(1e-34)).toBe('1e-34s');
  });
});

describe('formatAutoRateValue', () => {
  it('keeps small positive auto rates visible instead of rounding to zero', () => {
    expect(formatAutoRateValue(0.2128)).toBe('0.21');
    expect(formatAutoRateValue(2.432)).toBe('2.43');
    expect(formatAutoRateValue(24.32)).toBe('24.3');
  });
});

describe('formatEntropyParts', () => {
  it('scales entropy from bytes through large byte units', () => {
    expect(formatEntropyParts(0)).toEqual({ value: '0', unit: 'Bytes' });
    expect(formatEntropyParts(0.5)).toEqual({ value: '512', unit: 'Bytes' });
    expect(formatEntropyParts(1)).toEqual({ value: '1', unit: 'KB' });
    expect(formatEntropyParts(1536)).toEqual({ value: '1.5', unit: 'MB' });
    expect(formatEntropyAmount(1024 ** 6)).toBe('1 ZB');
  });

  it('keeps MB-scale entropy precise enough for comet pickups to be visible', () => {
    expect(formatEntropyAmount(526_648)).toBe('514.3 MB');
    expect(formatEntropyAmount(526_658)).toBe('514.31 MB');
  });
});

describe('particle entropy rewards', () => {
  it('grants entropy for comet pickups in the Solar System stage', () => {
    expect(getParticleEntropyBonus(10, 'Comet')).toBeGreaterThan(0);
  });
});

describe('compact HUD progress formatting', () => {
  it('shares the target exponent for large matter progress', () => {
    expect(formatProgressNumberPair(1.2e9, 2e9)).toBe('1.2000/2E+9Q');
    expect(formatProgressNumberPair(8.1e18, 9e18)).toBe('8.1000/9E+18Q');
  });

  it('moves the shared matter exponent up after the threshold is far exceeded', () => {
    expect(formatProgressNumberPair(1.234e8, 3e4)).toBe('1.234/-E+8Q');
  });

  it('replaces the matter target with a dash once the threshold is exceeded', () => {
    expect(formatProgressNumberPair(2865, 2000)).toBe('2.865/-E+3Q');
    expect(formatProgressNumberPair(1.234e8, 1_725)).toBe('1.234/-E+8Q');
  });

  it('keeps every stage matter threshold display clean after threshold rounding', () => {
    const labels = STAGES.map((stage) => formatProgressNumberPair(0, stage.threshold));

    expect(labels).toEqual([
      '0.0000/2E+3Q',
      '0.0000/3E+4Q',
      '0.0000/4E+5Q',
      '0.0000/6E+6Q',
      '0.0000/8E+7Q',
      '0.0000/2E+9Q',
      '0.0000/2E+10Q',
      '0.0000/3E+11Q',
      '0.0000/5E+12Q',
      '0.0000/8E+13Q',
      '0.0000/2E+15Q',
      '0.0000/3E+16Q',
      '0.0000/5E+17Q',
      '0.0000/9E+18Q',
      '0.0000/2E+20Q',
      '0.0000/4E+21Q',
    ]);
  });

  it('shares the target exponent and cosmic unit for large time progress', () => {
    const tyr = 1e12 * 31_557_600;
    expect(formatCosmicTimeProgressPair(4.25e14 * tyr, 7.3e14 * tyr)).toBe('4.2500/7.3E+26YR');
  });

  it('keeps every stage time threshold display clean after threshold rounding', () => {
    const startingSecond = 1e-34;
    const labels = STAGES.map((stage, index) => formatCosmicTimeProgressPair(
      index === 0 ? startingSecond : STAGES[index - 1].cosmicTimeSec,
      stage.cosmicTimeSec,
    ));

    expect(labels).toEqual([
      '0.0100/1E-32S',
      '0.0000/1E-12S',
      '0.0000/1E-6S',
      '0.0000/2E+2S',
      '0.0000/3E+5YR',
      '0.0030/1E+8YR',
      '1.0000/2E+8YR',
      '2.0000/6E+8YR',
      '0.6000/1E+9YR',
      '0.1000/1E+10YR',
      '1.0000/2E+10YR',
      '2.0000/2E+10YR',
      '0.0002/1E+14YR',
      '0.0000/8E+26YR',
      '0.0800/2E+28YR',
      '0.0200/2E+30YR',
    ]);
  });
});

describe('scaling formulas', () => {
  it('keeps click power and costs positive for every stage', () => {
    const modifiers = defaultModifiers();
    expect(getClickPower(modifiers)).toBe(1);
  });

  it('keeps auto rate strictly increasing by level', () => {
    const none = defaultModifiers();
    const scaled = { ...defaultModifiers(), autoRateAdd: 10, autoRateMult: 3 };
    expect(getAutoRate(none)).toBe(0);
    expect(getAutoRate(scaled)).toBeGreaterThan(getAutoRate(none));
  });

  it('uses V8 2x scaling for click/auto and tuned time scaling at level 5', () => {
    const skills = {
      click: { level: 5 },
      auto: { level: 5 },
      crit: { level: 0 },
      time: { level: 5 },
      unlockedTracks: ['click', 'crit', 'auto', 'time'] as Array<'click' | 'crit' | 'auto' | 'time'>,
      ownedCrossNodes: [],
    };
    const modifiers = getActiveModifiers(skills, {
      stageId: 5,
      stagesCleared: 4,
      progress01: 0,
      clickLevel: 5,
    });
    expect(getClickPower(modifiers)).toBeCloseTo(1 + (32 - 1) / 3, 10);   // baseline 1 plus globally 1/3 debuffed click bonus
    expect(getAutoRate(modifiers)).toBe(16);      // 2^5 with global 1/2 auto debuff
    expect(getTimeMultiplier(skills.time.level, modifiers)).toBeCloseTo(Math.pow(SKILL_TIME_RATE_BASE, 5), 10);
    expect(getCosmicTimeFillRate(skills.time.level, modifiers, 1, 5)).toBeCloseTo(
      100 / getUnupgradedTimeGaugeSeconds(5),
      10,
    );
  });

  it('sets dramatic Stage 4+ unupgraded time budgets', () => {
    expect(getUnupgradedTimeGaugeSeconds(4)).toBe(1_800);
    expect(getUnupgradedTimeGaugeSeconds(5)).toBe(10_800);
    expect(getUnupgradedTimeGaugeSeconds(6)).toBe(86_400);
    expect(getUnupgradedTimeGaugeSeconds(7)).toBe(518_400);
    expect(getUnupgradedTimeGaugeSeconds(16)).toBe(86_400 * Math.pow(6, 10));
  });

  it('caps fully upgraded Stage 4+ time gauges around three and a half minutes', () => {
    const maxedTimeModifiers = { ...defaultModifiers(), timeMultMult: 1e12 };

    [4, 5, 6, 10, 16].forEach((stageId) => {
      expect(100 / getCosmicTimeFillRate(40, maxedTimeModifiers, 1, stageId)).toBeCloseTo(TIME_MAXED_STAGE_SECONDS, 8);
    });
  });

  it('lets maxed time entities alone pull late-stage gauges down to the target time', () => {
    [4, 5, 6, 10, 16].forEach((stageId) => {
      const maxedEntityModifiers = {
        ...defaultModifiers(),
        timeMultMult: getMaxTimeEntityMultiplierThroughStage(stageId),
      };

      expect(100 / getCosmicTimeFillRate(0, maxedEntityModifiers, 1, stageId)).toBeCloseTo(TIME_MAXED_STAGE_SECONDS, 8);
    });
  });

  it('keeps the next stage slower than maxed while allowing previous time investment to carry forward', () => {
    [10, 12, 14, 16].forEach((stageId) => {
      const unupgradedModifiers = defaultModifiers();
      const previousStageMaxedModifiers = {
        ...defaultModifiers(),
        timeMultMult: getMaxLegacyTimeEntityMultiplierBeforeStage(stageId),
      };
      const currentStageMaxedModifiers = {
        ...defaultModifiers(),
        timeMultMult: getMaxTimeEntityMultiplierThroughStage(stageId),
      };

      const unupgradedSeconds = 100 / getCosmicTimeFillRate(40, unupgradedModifiers, 1, stageId);
      const carriedSeconds = 100 / getCosmicTimeFillRate(40, previousStageMaxedModifiers, 1, stageId);
      const maxedSeconds = 100 / getCosmicTimeFillRate(40, currentStageMaxedModifiers, 1, stageId);

      expect(unupgradedSeconds).toBeCloseTo(getUnupgradedTimeGaugeSeconds(stageId), 3);
      expect(carriedSeconds).toBeLessThan(unupgradedSeconds);
      expect(carriedSeconds).toBeGreaterThan(maxedSeconds);
      expect(maxedSeconds).toBeCloseTo(TIME_MAXED_STAGE_SECONDS, 8);
    });
  });

  it('makes every current-stage time entity purchase matter even without maxing earlier stages', () => {
    [4, 6, 10, 12, 16].forEach((stageId) => {
      const timeEntity = STAGE_ENTITIES.find((entity) => entity.stageId === stageId && entity.effect.type === 'time');
      expect(timeEntity).toBeDefined();
      if (!timeEntity) return;

      const beforeModifiers = defaultModifiers();
      const afterModifiers = {
        ...defaultModifiers(),
        timeMultMult: 1 + timeEntity.effect.value / 100,
      };

      expect(getCosmicTimeFillRate(0, afterModifiers, 1, stageId)).toBeGreaterThan(
        getCosmicTimeFillRate(0, beforeModifiers, 1, stageId),
      );
    });
  });

  it('makes each fresh late stage slower than the last even with maxed global time level', () => {
    const modifiers = defaultModifiers();

    expect(100 / getCosmicTimeFillRate(40, modifiers, 1, 11)).toBeGreaterThan(
      100 / getCosmicTimeFillRate(40, modifiers, 1, 10),
    );
    expect(100 / getCosmicTimeFillRate(40, modifiers, 1, 16)).toBeGreaterThan(
      100 / getCosmicTimeFillRate(40, modifiers, 1, 15),
    );
  });

  it('does not let late-stage Aeon Drive bypass the geometric time gate without time entities', () => {
    const modifiers = defaultModifiers();
    const stage16Level0 = 100 / getCosmicTimeFillRate(0, modifiers, 1, 16);
    const stage16Level40 = 100 / getCosmicTimeFillRate(40, modifiers, 1, 16);
    expect(stage16Level0).toBeCloseTo(getUnupgradedTimeGaugeSeconds(16), 3);
    expect(stage16Level40).toBeCloseTo(getUnupgradedTimeGaugeSeconds(16), 3);
  });

  it('preserves dramatic late-stage growth until time upgrades are heavily invested', () => {
    const modifiers = defaultModifiers();
    const stage10Level30Seconds = 100 / getCosmicTimeFillRate(30, modifiers, 1, 10);
    const stage16Level30Seconds = 100 / getCosmicTimeFillRate(30, modifiers, 1, 16);
    const stage16Level40Seconds = 100 / getCosmicTimeFillRate(40, modifiers, 1, 16);

    expect(stage16Level30Seconds).toBeGreaterThan(stage10Level30Seconds * 100);
    expect(stage16Level30Seconds).toBeGreaterThan(24 * 60 * 60);
    expect(stage16Level40Seconds).toBeCloseTo(getUnupgradedTimeGaugeSeconds(16), 3);
  });

  it('caps expected crit chance at 50 percent', () => {
    expect(getCritChance(50, 200, defaultModifiers())).toBe(0.5);
  });

  it('scales prestige rewards without a hard cap', () => {
    expect(getUniverseBoost(1e4)).toBeGreaterThan(0);
    expect(getUniverseBoost(1e40)).toBeGreaterThan(getUniverseBoost(1e10));
    expect(getCondensedMassReward(1e20, 'vacuum_decay', 1)).toBeGreaterThan(
      getCondensedMassReward(1e20, 'heat_death', 2),
    );
    expect(getEchoReward(3)).toBe(8);
  });

  it('unlocks ending options from the simplified ending conditions', () => {
    const baseState = createInitialGameState(0);
    const base = getEndingOptions(baseState, 0);
    expect(base.find((ending) => ending.id === 'heat_death')?.unlocked).toBe(true);
    expect(base.find((ending) => ending.id === 'heat_death')?.seen).toBe(false);
    expect(base.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(false);

    const bigCrunchReady = getEndingOptions({
      ...baseState,
      entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
    }, 0);
    expect(bigCrunchReady.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(true);

    const bigCrunchStage3 = getEndingOptions({
      ...baseState,
      stageIdx: 2,
      entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
    }, 0);
    expect(bigCrunchStage3.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(true);

    const bigCrunchMissed = getEndingOptions({
      ...baseState,
      stageIdx: 3,
      entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
    }, 0);
    expect(bigCrunchMissed.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(false);

    const completedBigCrunchOnly = getEndingOptions({
      ...baseState,
      stageIdx: STAGES.length - 1,
      endingsCompleted: ['big_crunch'],
    }, 0);
    expect(completedBigCrunchOnly.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(false);

    const allEntities = STAGE_ENTITIES.map((entity) => ({
      entityId: entity.id,
      count: entity.maxCount,
    }));
    const bigRipReady = getEndingOptions({ ...baseState, purchasedEntities: allEntities }, 0);
    expect(bigRipReady.find((ending) => ending.id === 'big_rip')?.unlocked).toBe(true);

    const finalNoCrit = getEndingOptions({
      ...baseState,
      stageIdx: STAGES.length - 1,
    }, 0);
    expect(finalNoCrit.find((ending) => ending.id === 'vacuum_decay')?.unlocked).toBe(true);

    const finalWithCrit = getEndingOptions({
      ...baseState,
      stageIdx: STAGES.length - 1,
      skills: { ...baseState.skills, crit: { level: 1 } },
    }, 0);
    expect(finalWithCrit.find((ending) => ending.id === 'vacuum_decay')?.unlocked).toBe(false);

    const bounceReady = getEndingOptions(
      {
        ...baseState,
        endingsCompleted: ['heat_death', 'big_crunch', 'big_rip'],
      },
      0,
    );
    expect(bounceReady.find((ending) => ending.id === 'bounce')?.unlocked).toBe(true);
    expect(bounceReady.find((ending) => ending.id === 'big_rip')?.seen).toBe(true);

    const repeatedEnding = getEndingOptions(
      {
        ...baseState,
        endingsCompleted: ['heat_death', 'heat_death', 'heat_death'],
      },
      0,
    );
    expect(repeatedEnding.find((ending) => ending.id === 'bounce')?.unlocked).toBe(false);
  });
});

describe('safeAdd', () => {
  it('adds finite numbers normally', () => {
    expect(safeAdd(1, 2)).toBe(3);
  });
  it('clamps Infinity to MAX_SAFE_QUANTA', () => {
    expect(safeAdd(Infinity, 1)).toBe(MAX_SAFE_QUANTA);
    expect(Number.isFinite(safeAdd(Infinity, 1))).toBe(true);
  });
  it('substitutes 0 when both inputs are non-finite', () => {
    expect(safeAdd(NaN, NaN)).toBe(0);
  });
  it('treats NaN as missing and returns the finite side', () => {
    expect(safeAdd(NaN, 5)).toBe(5);
  });
  it('caps sum that overflows to Infinity', () => {
    expect(safeAdd(1e300, 1e300)).toBe(MAX_SAFE_QUANTA);
  });
});
