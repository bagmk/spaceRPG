import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';

describe('gameReducer', () => {
  it('carries excess quanta into the next stage without resetting skill-backed levels', () => {
    const state = {
      ...createInitialGameState(0),
      pendingCondenseStageIdx: 0,
      quanta: 150,
      clickLevel: 12,
      autoLevel: 14,
      critLevel: 19,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(1);
    expect(next.quanta).toBe(100);
    expect(next.clickLevel).toBe(12);
    expect(next.autoLevel).toBe(14);
    expect(next.critLevel).toBe(19);
  });

  it('caps encounter rewards at 5% of the current stage threshold', () => {
    const state = {
      ...createInitialGameState(0),
      quanta: 0,
    };
    const next = gameReducer(state, {
      type: 'REPORT_COLLISION',
      x: 0,
      y: 0,
      bonus: 999,
      entropyBonus: 3,
      tier: 'major',
      name: 'test',
    });
    expect(next.quanta).toBe(2.5);
    expect(next.skillPoints).toBe(0);
  });

  it('preserves long-term currencies and ending history through ending completion and prestige', () => {
    const state = {
      ...createInitialGameState(0),
      selectedEndingId: 'heat_death' as const,
      singularityUnlocks: ['inflaton_spark' as const],
      entropy: 1e8,
    };
    const completed = gameReducer(state, { type: 'COMPLETE_ENDING', now: 900 });
    expect(completed.condensedMass).toBeGreaterThan(0);
    expect(completed.echoes).toBe(1);
    expect(completed.endingsCompleted).toContain('heat_death');

    const next = gameReducer(completed, { type: 'PRESTIGE', now: 1000 });
    expect(next.stageIdx).toBe(1);
    expect(next.cumulativeBoost).toBeGreaterThan(0);
    expect(next.condensedMass).toBeGreaterThan(0);
    expect(next.echoes).toBe(1);
    expect(next.endingsCompleted).toContain('heat_death');
    expect(next.lastEndingId).toBe('heat_death');
  });
});
