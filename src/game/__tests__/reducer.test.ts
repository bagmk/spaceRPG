import { describe, expect, it } from 'vitest';
import { canCondense, getCosmicClockForGauge, getCritMultiplier, getTimeGaugeForCosmicClock } from '../formulas';
import { createInitialGameState, gameReducer } from '../reducer';
import { STAGES } from '../stages';
import { getActiveModifiers } from '../skills/effects';

describe('gameReducer', () => {
  it('carries all quanta into the next stage without resetting skill-backed levels', () => {
    const state = {
      ...createInitialGameState(0),
      pendingCondenseStageIdx: 0,
      quanta: STAGES[0].threshold * 1.2,
      timeGauge: 100,
      cosmicClockSec: STAGES[0].cosmicTimeSec,
      clickLevel: 12,
      autoLevel: 14,
      critLevel: 19,
      skillPoints: 4,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(1);
    expect(next.quanta).toBeCloseTo(STAGES[0].threshold * 1.2, 5);
    expect(next.timeGauge).toBe(getTimeGaugeForCosmicClock(1, STAGES[0].cosmicTimeSec));
    expect(next.clickLevel).toBe(12);
    expect(next.autoLevel).toBe(14);
    expect(next.critLevel).toBe(19);
    expect(next.skillPoints).toBe(5);
  });

  it('drops excess cosmic time when advancing so the next stage does not start pre-filled', () => {
    const state = {
      ...createInitialGameState(0),
      pendingCondenseStageIdx: 4,
      stageIdx: 4,
      quanta: STAGES[4].threshold,
      timeGauge: 125,
      cosmicClockSec: STAGES[6].cosmicTimeSec,
    };

    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });

    expect(next.stageIdx).toBe(5);
    expect(next.cosmicClockSec).toBe(STAGES[4].cosmicTimeSec);
    expect(next.timeGauge).toBe(getTimeGaugeForCosmicClock(5, STAGES[4].cosmicTimeSec));
  });

  it('keeps encounter rewards above the click-scaled floor without changing the SP budget', () => {
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
    expect(next.quanta).toBe(40);
    expect(next.skillPoints).toBe(0);
    expect(next.entropy).toBe(50);
  });

  it('requires both quanta and time gauge before condensing', () => {
    const stage = STAGES[0];
    const state = {
      ...createInitialGameState(0),
      quanta: stage.threshold,
      timeGauge: 0,
    };

    expect(canCondense(state)).toBe(false);
    const blocked = gameReducer(state, { type: 'START_CONDENSE', now: 1000 });
    expect(blocked.pendingCondenseStageIdx).toBeNull();

    const ready = {
      ...state,
      timeGauge: 100,
      cosmicClockSec: stage.cosmicTimeSec,
    };
    expect(canCondense(ready)).toBe(true);
    const next = gameReducer(ready, { type: 'START_CONDENSE', now: 1000 });
    expect(next.pendingCondenseStageIdx).toBe(0);
  });

  it('fills the logarithmic cosmic clock according to Aeon Drive level', () => {
    // V8-D: cosmicClockSec accumulates directly at rate = 10^aeonLevel per second
    const state = createInitialGameState(0);
    const next = gameReducer(state, { type: 'TICK', now: 1000, dt: 1000 });
    // level 0: rate = 1/s, dt=1s → cosmicClockSec ≈ 1
    expect(next.cosmicClockSec).toBeCloseTo(1, 5);
    // timeGauge is capped at 125 since rate=1 vastly overshoots the 1e-32 target
    expect(next.timeGauge).toBe(125);

    const aeonState = {
      ...state,
      skills: {
        ...state.skills,
        time: { level: 5 },
      },
    };
    const aeonNext = gameReducer(aeonState, { type: 'TICK', now: 1000, dt: 1000 });
    // level 5: rate = 10^5/s, dt=1s → cosmicClockSec ≈ 1e5
    expect(aeonNext.cosmicClockSec).toBeCloseTo(1e5, 5);
    expect(aeonNext.timeGauge).toBe(125);
  });

  it('uses the softer V5 crit multiplier at low Quantum Lens level', () => {
    const state = {
      ...createInitialGameState(0),
      skills: {
        ...createInitialGameState(0).skills,
        crit: { level: 1 },
      },
    };
    const modifiers = getActiveModifiers(state.skills, {
      stageId: 2,
      stagesCleared: 1,
      progress01: 0,
      clickLevel: 0,
    });
    expect(getCritMultiplier(1, modifiers)).toBeCloseTo(2, 5);
  });

  it('rapid reducer clicks all register', () => {
    let state = createInitialGameState(0);
    for (let index = 0; index < 100; index += 1) {
      state = gameReducer(state, {
        type: 'CLICK',
        now: index,
        randomValue: 1,
        x: 100,
        y: 100,
      });
    }
    expect(state.totalClicks).toBe(100);
  });

  it('turns clicked particle types into entropy', () => {
    const next = gameReducer(createInitialGameState(0), {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 100,
      y: 100,
    });

    expect(next.entropy).toBeGreaterThan(0);
    expect(next.lastClickEvent?.entropyGained).toBeGreaterThan(0);
    expect(next.lastClickEvent?.particleName).toBeTruthy();
  });

  it('suppresses critical hits during the first two stages', () => {
    const skilled = {
      ...createInitialGameState(0),
      skills: {
        ...createInitialGameState(0).skills,
        crit: { level: 30 },
        unlockedTracks: ['click', 'crit', 'auto', 'time'] as Array<'click' | 'crit' | 'auto' | 'time'>,
      },
    };

    const stageOne = gameReducer(skilled, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0,
      x: 100,
      y: 100,
      forceCrit: true,
    });
    expect(stageOne.lastClickEvent?.isCrit).toBe(false);

    const stageTwo = gameReducer({ ...skilled, stageIdx: 1 }, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0,
      x: 100,
      y: 100,
      forceCrit: true,
    });
    expect(stageTwo.lastClickEvent?.isCrit).toBe(false);

    const stageThree = gameReducer({ ...skilled, stageIdx: 2 }, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 100,
      y: 100,
      forceCrit: true,
    });
    expect(stageThree.lastClickEvent?.isCrit).toBe(true);
  });

  it('floors encounter rewards at a tiered multiple of current click power', () => {
    const state = createInitialGameState(0);
    const massive = gameReducer(state, {
      type: 'REPORT_COLLISION',
      x: 0,
      y: 0,
      bonus: 1,
      entropyBonus: 0,
      tier: 'massive',
      name: 'test',
    });
    expect(massive.quanta).toBe(100);
    expect(massive.entropy).toBe(200);
  });

  it('condense never decreases entropy', () => {
    const stage = STAGES[0];
    const state = {
      ...createInitialGameState(0),
      quanta: stage.threshold,
      timeGauge: 100,
      cosmicClockSec: stage.cosmicTimeSec,
      entropy: 10,
    };
    const next = gameReducer(state, { type: 'START_CONDENSE', now: 1000 });
    expect(next.entropy).toBeGreaterThanOrEqual(state.entropy);
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
    expect(next.stageIdx).toBe(0);
    expect(next.quanta).toBe(0);
    expect(next.skillPoints).toBe(0);
    expect(next.skills.click.level).toBe(0);
    expect(next.skills.ownedCrossNodes).toEqual([]);
    expect(next.cumulativeBoost).toBe(0);
    expect(next.condensedMass).toBeGreaterThan(0);
    expect(next.echoes).toBe(1);
    expect(next.endingsCompleted).toContain('heat_death');
    expect(next.lastEndingId).toBe('heat_death');
  });
});
