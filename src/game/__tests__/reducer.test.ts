import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';

describe('gameReducer', () => {
  it('inherits 10% of upgrade levels on stage advance by default', () => {
    const state = {
      ...createInitialGameState(0),
      pendingCondenseStageIdx: 0,
      clickLevel: 12,
      autoLevel: 14,
      critLevel: 19,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(1);
    expect(next.clickLevel).toBe(1);
    expect(next.autoLevel).toBe(1);
    expect(next.critLevel).toBe(1);
  });

  it('inherits 25% of upgrade levels with stellar memory', () => {
    const state = {
      ...createInitialGameState(0),
      singularityUnlocks: ['stellar_memory' as const],
      pendingCondenseStageIdx: 0,
      clickLevel: 12,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.clickLevel).toBe(3);
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
