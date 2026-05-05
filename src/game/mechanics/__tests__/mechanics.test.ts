import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../reducer';
import { STAGES } from '../../stages';
import { MECHANICS } from '../index';

describe('mechanics registry', () => {
  it('smoke-tests click handlers for every registered mechanic', () => {
    const baseState = createInitialGameState(0);
    STAGES.forEach((stage) => {
      const mechanic = MECHANICS[stage.mechanic];
      expect(mechanic).toBeDefined();
      if (!mechanic.onClick) {
        return;
      }
      const result = mechanic.onClick({
        state: { ...baseState, stageIdx: stage.id - 1, totalClicks: 9, combo: 12 },
        stage,
        now: 1000,
        progress01: 0.5,
        x: 100,
        y: 100,
      });
      expect(typeof result.consumed).toBe('boolean');
    });
  });

  it('keeps baryogenesis rare-click bonuses modest', () => {
    const stage = STAGES[1];
    const result = MECHANICS.matter_asymmetry.onClick?.({
      state: { ...createInitialGameState(0), stageIdx: 1, totalClicks: 8, combo: 8 },
      stage,
      now: 1000,
      progress01: 0.5,
      x: 100,
      y: 100,
    });

    expect(result?.gainMultiplier).toBe(2.8);
    expect(result?.gainFlat ?? 0).toBe(0);
  });
});
