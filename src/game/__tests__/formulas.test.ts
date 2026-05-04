import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import {
  formatCosmicTime,
  formatWhole,
  getAutoRate,
  getClickPower,
  getCosmicTimeFillRate,
  getCondensedMassReward,
  getEchoReward,
  getTimeMultiplier,
  getUniverseBoost,
} from '../formulas';
import { getEndingOptions } from '../multiverse';
import { createInitialGameState } from '../reducer';
import { defaultModifiers, getActiveModifiers } from '../skills/effects';

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
    expect(formatCosmicTime(STAGES[14].cosmicTimeSec)).toBe('1e100yr');
  });

  it('formats the V7 initial cosmic time without a one-second baseline', () => {
    expect(formatCosmicTime(1e-34)).toBe('1e-34s');
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

  it('uses V6 logarithmic 10x scaling for roots and time', () => {
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
    expect(getClickPower(modifiers)).toBe(1e5);
    expect(getAutoRate(modifiers)).toBe(1e5);
    expect(getTimeMultiplier(skills.time.level, modifiers)).toBe(1e5);
    expect(getCosmicTimeFillRate(skills.time.level, modifiers)).toBe(1e5);
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
