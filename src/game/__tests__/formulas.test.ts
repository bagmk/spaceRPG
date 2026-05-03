import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import {
  formatCosmicTime,
  formatWhole,
  getAutoRate,
  getClickCost,
  getClickPower,
  getCondensedMassReward,
  getEchoReward,
  getEndingOptions,
  getUniverseBoost,
} from '../formulas';

describe('formatWhole', () => {
  it('formats small whole numbers without suffixes', () => {
    expect(formatWhole(0)).toBe('0');
    expect(formatWhole(999)).toBe('999');
  });

  it('formats threshold-scale numbers with suffixes', () => {
    expect(formatWhole(1000)).toBe('1.00K');
  });

  it('switches to scientific notation for very large values', () => {
    expect(formatWhole(1.5e36)).toMatch(/^1\.50e36$/);
  });
});

describe('formatCosmicTime', () => {
  it('formats kiloyear-scale cosmic times with readable units', () => {
    expect(formatCosmicTime(380000 * 31557600)).toBe('380.00 Kyr');
  });

  it('formats extremely large cosmic times in scientific notation', () => {
    expect(formatCosmicTime(1e100 * 31557600)).toBe('1.0e100 yr');
  });
});

describe('scaling formulas', () => {
  it('keeps click power and costs positive for every stage', () => {
    STAGES.forEach((stage) => {
      expect(getClickPower(stage, 0, 0)).toBeGreaterThan(0);
      expect(getClickCost(stage, 0)).toBeGreaterThan(0);
    });
  });

  it('keeps auto rate strictly increasing by level', () => {
    STAGES.forEach((stage) => {
      for (let level = 0; level < 200; level += 1) {
        expect(getAutoRate(stage, level + 1, 0)).toBeGreaterThan(getAutoRate(stage, level, 0));
      }
    });
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
    const base = getEndingOptions(0, 0, []);
    expect(base.find((ending) => ending.id === 'heat_death')?.unlocked).toBe(true);
    expect(base.find((ending) => ending.id === 'big_crunch')?.unlocked).toBe(false);
    const advanced = getEndingOptions(120, 1000, ['vacuum_stability']);
    expect(advanced.every((ending) => ending.unlocked)).toBe(true);
  });
});
