import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { findTree } from '../skills/definitions';
import type { GameState } from '../types';

describe('skills reducer basics', () => {
  it('buys track levels and cross nodes with quanta', () => {
    const now = Date.now();
    const clickTree = findTree('click')!;
    let state: GameState = {
      ...createInitialGameState(now),
      quanta: 100_000,
      stageIdx: 4,
      skills: {
        ...createInitialGameState(now).skills,
        unlockedTracks: ['click', 'crit', 'auto', 'time'],
      },
    };
    state = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
    expect(state.skills.click.level).toBe(1);
    state = {
      ...state,
      skills: {
        ...state.skills,
        click: { level: 15 },
        time: { level: 10 },
      },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'echoing_click' });
    expect(state.skills.ownedCrossNodes).toContain('echoing_click');
    expect(state.quanta).toBe(100_000 - Math.ceil(clickTree.rootCostCurve(1)) - 50_000);
  });

  it('enforces root gates and node prerequisites', () => {
    const now = Date.now();
    let state = createInitialGameState(now);
    state = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
    expect(state.skills.click.level).toBe(0);

    state = {
      ...state,
      quanta: 1_000_000,
      skills: { ...state.skills, unlockedTracks: ['click', 'crit', 'auto', 'time'], click: { level: 14 }, time: { level: 10 } },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'echoing_click' });
    expect(state.skills.ownedCrossNodes).not.toContain('echoing_click');

    state = {
      ...state,
      skills: {
        ...state.skills,
        click: { level: 15 },
        crit: { level: 15 },
      },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'pair_production' });
    expect(state.skills.ownedCrossNodes).not.toContain('pair_production');
  });
});
