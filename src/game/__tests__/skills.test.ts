import { describe, expect, it } from 'vitest';
import { getClickPower } from '../formulas';
import { createInitialGameState, gameReducer } from '../reducer';
import { CROSS_NODES, findTree, trackLevelCost } from '../skills/definitions';
import { getActiveModifiers } from '../skills/effects';
import type { GameState } from '../types';

describe('skills reducer basics', () => {
  it('uses base-3 and pricier base-5.25 time costs with a 1-quanta first purchase', () => {
    expect(trackLevelCost('click', 1)).toBe(1);
    expect(trackLevelCost('auto', 5)).toBe(81);   // 3^4
    expect(trackLevelCost('crit', 10)).toBe(19683); // 3^9
    expect(trackLevelCost('time', 1)).toBe(1);
    expect(trackLevelCost('time', 5)).toBe(759);  // floor(5.25^4)
  });

  it('defines one SP-purchasable cross node for every track milestone', () => {
    expect(CROSS_NODES).toHaveLength(24);
    expect(CROSS_NODES.map((node) => node.id)).toContain('click_lv5');
    expect(CROSS_NODES.map((node) => node.id)).toContain('time_lv30');
    expect(CROSS_NODES.find((node) => node.id === 'click_lv5')?.cost).toBe(0);
    expect(CROSS_NODES.find((node) => node.id === 'click_lv5')?.spCost).toBe(1);
    expect(CROSS_NODES.find((node) => node.id === 'click_lv30')?.spCost).toBe(3);
  });

  it('buys track levels and SP-only cross nodes', () => {
    const now = Date.now();
    const clickTree = findTree('click')!;
    let state: GameState = {
      ...createInitialGameState(now),
      quanta: 100_000,
      skillPoints: 4,
      stageIdx: 10,
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
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'click_lv15' });
    expect(state.skills.ownedCrossNodes).toContain('click_lv15');
    expect(state.quanta).toBe(100_000 - Math.ceil(clickTree.rootCostCurve(1)));
    expect(state.skillPoints).toBe(2);
  });

  it('does not stage-cap root purchases before The End', () => {
    const now = Date.now();
    const state: GameState = {
      ...createInitialGameState(now),
      stageIdx: 8,
      quanta: Number.MAX_SAFE_INTEGER,
      skills: {
        ...createInitialGameState(now).skills,
        click: { level: 26 },
        unlockedTracks: ['click', 'crit', 'auto', 'time'],
      },
    };

    const next = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
    expect(next.skills.click.level).toBe(27);
  });

  it('enforces node prerequisites and SP costs', () => {
    const now = Date.now();
    let state = createInitialGameState(now);
    state = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
    expect(state.skills.click.level).toBe(0);

    state = {
      ...state,
      quanta: 1_000_000,
      skillPoints: 0,
      stageIdx: 10,
      skills: { ...state.skills, unlockedTracks: ['click', 'crit', 'auto', 'time'], click: { level: 14 }, time: { level: 10 } },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'click_lv15' });
    expect(state.skills.ownedCrossNodes).not.toContain('click_lv15');

    state = {
      ...state,
      skills: {
        ...state.skills,
        click: { level: 15 },
        crit: { level: 15 },
      },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'click_lv20' });
    expect(state.skills.ownedCrossNodes).not.toContain('click_lv20');

    state = {
      ...state,
      skills: {
        ...state.skills,
        time: { level: 10 },
      },
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'click_lv15' });
    expect(state.skills.ownedCrossNodes).not.toContain('click_lv15');

    state = {
      ...state,
      skillPoints: 4,
    };
    state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'click_lv15' });
    expect(state.skills.ownedCrossNodes).toContain('click_lv15');
  });

  it('applies bought cross node effects but never grants milestone bonuses for free', () => {
    const skills = {
      ...createInitialGameState(0).skills,
      click: { level: 5 },
      ownedCrossNodes: [],
    };
    const withoutNode = getActiveModifiers(skills, { clickLevel: 5 });
    expect(withoutNode.clickEmissionCount).toBe(1);
    expect(getClickPower(withoutNode)).toBe(32);   // 2^5 (V8-B)

    const withNode = getActiveModifiers(
      { ...skills, ownedCrossNodes: ['click_lv5'] },
      { clickLevel: 5 },
    );
    expect(getClickPower(withNode)).toBeCloseTo(44.8, 5);   // 32 * x1.4 cross node
  });

  it('does not auto-unlock cross nodes when root prerequisites are reached', () => {
    let state = {
      ...createInitialGameState(0),
      quanta: 1e20,
      stageIdx: 10,
    };
    for (let index = 0; index < 15; index += 1) {
      state = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
    }
    expect(state.skills.click.level).toBe(15);
    expect(state.skills.ownedCrossNodes).not.toContain('click_lv15');
  });

  it('unlocks the final apex boost only after every cross node is owned', () => {
    const skills = {
      click: { level: 30 },
      auto: { level: 30 },
      crit: { level: 30 },
      time: { level: 30 },
      unlockedTracks: ['click', 'crit', 'auto', 'time'] as Array<'click' | 'crit' | 'auto' | 'time'>,
      ownedCrossNodes: CROSS_NODES.map((node) => node.id),
    };
    const modifiers = getActiveModifiers(skills, { clickLevel: 30 });
    expect(modifiers.apexMult).toBe(2);
    expect(modifiers.bigBangUnlocked).toBe(true);
  });
});
