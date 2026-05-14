import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import {
  formatCosmicTime,
  formatCosmicTimeProgressPair,
  formatProgressNumberPair,
  formatWhole,
  getAutoRate,
  getClickPower,
  getCosmicTimeFillRate,
  getCondensedMassReward,
  getCritChance,
  getEchoReward,
  getTimeMultiplier,
  getUniverseBoost,
} from '../formulas';
import { getEndingOptions } from '../multiverse';
import { createInitialGameState } from '../reducer';
import { defaultModifiers, getActiveModifiers } from '../skills/effects';
import { SKILL_TIME_RATE_BASE, TIME_MIN_STAGE_SECONDS } from '../balance';

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

describe('compact HUD progress formatting', () => {
  it('shares the target exponent for large matter progress', () => {
    expect(formatProgressNumberPair(1.2e9, 2e9)).toBe('1.2000/2E+9Q');
    expect(formatProgressNumberPair(8.1e18, 9e18)).toBe('8.1000/9E+18Q');
  });

  it('keeps every stage matter threshold display clean after threshold rounding', () => {
    const labels = STAGES.map((stage) => formatProgressNumberPair(0, stage.threshold));

    expect(labels).toEqual([
      '0.0000/2E+3Q',
      '0.0000/28E+3Q',
      '0.0000/390E+3Q',
      '0.0000/6E+6Q',
      '0.0000/80E+6Q',
      '0.0000/2E+9Q',
      '0.0000/18E+9Q',
      '0.0000/280E+9Q',
      '0.0000/5E+12Q',
      '0.0000/75E+12Q',
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
      '0.0000/180S',
      '0.0000/300E+3YR',
      '0.3000/100E+6YR',
      '100.0000/200E+6YR',
      '200.0000/600E+6YR',
      '0.6000/1E+9YR',
      '1.0000/10E+9YR',
      '10.0000/14E+9YR',
      '14.0000/19E+9YR',
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
    expect(getClickPower(modifiers)).toBe(32);   // 2^5
    expect(getAutoRate(modifiers)).toBe(32);      // 2^5
    expect(getTimeMultiplier(skills.time.level, modifiers)).toBeCloseTo(Math.pow(SKILL_TIME_RATE_BASE, 5), 10);
    expect(getCosmicTimeFillRate(skills.time.level, modifiers, 1, 5)).toBeCloseTo(
      (100 / (5 ** 2 * 600)) * Math.pow(SKILL_TIME_RATE_BASE, 5),
      10,
    );
  });

  it('makes late-stage Aeon Drive levels reduce time without going instant', () => {
    const modifiers = defaultModifiers();
    const stage16Level0 = getCosmicTimeFillRate(0, modifiers, 1, 16);
    const stage16Level10 = getCosmicTimeFillRate(10, modifiers, 1, 16);
    const stage16Level40 = getCosmicTimeFillRate(40, modifiers, 1, 16);
    expect(stage16Level10).toBeGreaterThan(stage16Level0);
    expect(100 / stage16Level10).toBeLessThan(100 / stage16Level0);
    expect(stage16Level40).toBeLessThanOrEqual(100 / TIME_MIN_STAGE_SECONDS);
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

  it('unlocks ending options according to progression', () => {
    const baseState = createInitialGameState(0);
    const base = getEndingOptions(baseState, 0);
    expect(base.find((ending) => ending.id === 'heat_death')?.unlocked).toBe(true);
    expect(base.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(false);
    const advanced = getEndingOptions(
      {
        ...baseState,
        universeCount: 5,
        endingsCompleted: ['heat_death', 'big_crunch', 'big_rip', 'vacuum_decay'],
      },
      0,
    );
    expect(advanced.every((ending) => ending.unlocked)).toBe(true);
  });
});
