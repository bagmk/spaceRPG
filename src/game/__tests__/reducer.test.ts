import { describe, expect, it } from 'vitest';
import { canCondense, getCosmicClockForGauge, getCritMultiplier, getTimeGaugeForCosmicClock } from '../formulas';
import { createInitialGameState, gameReducer } from '../reducer';
import { getEntityCost } from '../entities/types';
import { getEntitiesForStage } from '../entities/stageItems';
import { BIG_CRUNCH_ENTROPY_THRESHOLD_KB } from '../multiverse';
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
    // Reward = min(rawBonus, cap) where
    //   rawBonus = max(action.bonus, clickScaledBonus)
    //   cap     = max(stage.threshold * 0.02 * tierCapMult, scaledClickBonus)
    // For stage 0 (threshold=2000, tierCapMult=2 for major) the cap is 80.
    // Floor invariant: result >= clickScaledBonus (= clickPower 1 * majorMult 40 = 40).
    // 80 > 40, so floor still holds.
    expect(next.quanta).toBe(80);
    expect(next.skillPoints).toBe(0);
    // entropy = boostedBonus*0.5 + max(action.entropyBonus, tierFloor=50) * mult
    //         = 80*0.5 + 50*1 = 90
    expect(next.entropy).toBe(90);
  });

  it('gates condensing on the cumulative entropy threshold (D1)', () => {
    const stage = STAGES[0];
    // Quanta and time alone no longer open the gate.
    const state = {
      ...createInitialGameState(0),
      quanta: stage.threshold,
      timeGauge: 100,
      cosmicClockSec: stage.cosmicTimeSec,
      entropy: stage.entropyThreshold * 0.9,
    };

    expect(canCondense(state)).toBe(false);
    const blocked = gameReducer(state, { type: 'START_CONDENSE', now: 1000 });
    expect(blocked.pendingCondenseStageIdx).toBeNull();

    const ready = {
      ...state,
      entropy: stage.entropyThreshold,
    };
    expect(canCondense(ready)).toBe(true);
    const next = gameReducer(ready, { type: 'START_CONDENSE', now: 1000 });
    expect(next.pendingCondenseStageIdx).toBe(0);
  });

  it('fills the logarithmic cosmic clock according to Aeon Drive level', () => {
    // Stage 1 baseline is a three-minute clock before Aeon Drive scaling.
    const state = createInitialGameState(0);
    const next = gameReducer(state, { type: 'TICK', now: 1000, dt: 1000 });
    expect(next.timeGauge).toBeCloseTo(0.56, 1);
    // cosmic clock advances slightly from 1e-34
    expect(next.cosmicClockSec).toBeGreaterThan(1e-34);
    expect(next.cosmicClockSec).toBeLessThan(2e-34);

    const aeonState = {
      ...state,
      skills: {
        ...state.skills,
        time: { level: 5 },
      },
    };
    const aeonNext = gameReducer(aeonState, { type: 'TICK', now: 1000, dt: 1000 });
    expect(aeonNext.timeGauge).toBeGreaterThan(next.timeGauge);
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
      gateProgress01: 0,
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

  it('turns equipped auto-entity matter gain into entropy over time', () => {
    const entity = getEntitiesForStage(1).find((candidate) => candidate.effect.type === 'auto');
    expect(entity).toBeDefined();
    if (!entity) return;

    const funded = {
      ...createInitialGameState(0),
      quanta: getEntityCost(entity, 0, 1) * 10,
    };
    const purchased = gameReducer(funded, { type: 'PURCHASE_ENTITY', entityId: entity.id });
    // Phase 2: owning an entity is not enough — it must be equipped.
    const equipped = gameReducer(purchased, { type: 'EQUIP_ENTITY', entityId: entity.id });
    const ticked = gameReducer(equipped, { type: 'TICK', now: 30_000, dt: 30_000 });

    expect(ticked.entropy).toBeGreaterThan(equipped.entropy);
  });

  it('applies equipped click entities to click gains (and not unequipped ones)', () => {
    const entity = getEntitiesForStage(1).find((candidate) => candidate.effect.type === 'click');
    expect(entity).toBeDefined();
    if (!entity) return;

    const funded = {
      ...createInitialGameState(0),
      quanta: getEntityCost(entity, 0, 1) * 10,
    };
    const baseline = gameReducer(funded, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 100,
      y: 100,
    });
    const purchased = gameReducer(funded, { type: 'PURCHASE_ENTITY', entityId: entity.id });
    const unequippedClick = gameReducer(purchased, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 100,
      y: 100,
    });
    const equipped = gameReducer(purchased, { type: 'EQUIP_ENTITY', entityId: entity.id });
    const boosted = gameReducer(equipped, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 100,
      y: 100,
    });

    expect(purchased.inventory).toEqual([{ entityId: entity.id, count: 1, level: 1 }]);
    // Absorption (Phase 2): unequipped ownership gives no passive click bonus.
    expect(unequippedClick.lastClickEvent?.gained).toBe(baseline.lastClickEvent?.gained);
    // CHECKPOINT: equipping changes click output.
    expect(boosted.lastClickEvent?.gained).toBeGreaterThan(baseline.lastClickEvent?.gained ?? 0);
  });

  it('applies equipped crit entities to critical hit chance before the crit track unlocks', () => {
    const entity = getEntitiesForStage(1).find((candidate) => candidate.effect.type === 'crit');
    expect(entity).toBeDefined();
    if (!entity) return;

    const funded = {
      ...createInitialGameState(0),
      quanta: getEntityCost(entity, 0, 1) * 10,
    };
    const baseline = gameReducer(funded, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0.004,
      x: 100,
      y: 100,
    });
    const purchased = gameReducer(funded, { type: 'PURCHASE_ENTITY', entityId: entity.id });
    const equipped = gameReducer(purchased, { type: 'EQUIP_ENTITY', entityId: entity.id });
    const boosted = gameReducer(equipped, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0.004,
      x: 100,
      y: 100,
    });

    expect(baseline.lastClickEvent?.isCrit).toBe(false);
    expect(boosted.lastClickEvent?.isCrit).toBe(true);
  });

  it('suppresses forced critical hits during the first two stages without a crit source', () => {
    const state = createInitialGameState(0);

    const stageOne = gameReducer(state, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0,
      x: 100,
      y: 100,
      forceCrit: true,
    });
    expect(stageOne.lastClickEvent?.isCrit).toBe(false);

    const stageTwo = gameReducer({ ...state, stageIdx: 1 }, {
      type: 'CLICK',
      now: 1000,
      randomValue: 0,
      x: 100,
      y: 100,
      forceCrit: true,
    });
    expect(stageTwo.lastClickEvent?.isCrit).toBe(false);

    const stageThree = gameReducer({ ...state, stageIdx: 2 }, {
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
    expect(massive.entropy).toBe(250);
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

  it('keeps Big Crunch available if the entropy threshold is reached by Stage 3', () => {
    const belowStageThree = {
      ...createInitialGameState(0),
      stageIdx: 1,
      entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
    };
    const marked = gameReducer(belowStageThree, { type: 'TICK', now: 1000, dt: 1000 });
    expect(marked.endingProgressFlags.bigCrunchEligible).toBe(true);

    const advanced = gameReducer(
      {
        ...marked,
        pendingCondenseStageIdx: 1,
        quanta: STAGES[1].threshold,
        timeGauge: 100,
        cosmicClockSec: STAGES[1].cosmicTimeSec,
      },
      { type: 'ADVANCE_STAGE', now: 2000 },
    );
    expect(advanced.stageIdx).toBe(2);
    expect(advanced.endingProgressFlags.bigCrunchEligible).toBe(true);
  });

  it('does not unlock Big Crunch if entropy threshold is reached after Stage 3', () => {
    const afterStageThree = {
      ...createInitialGameState(0),
      stageIdx: 3,
      entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
    };
    const marked = gameReducer(afterStageThree, { type: 'TICK', now: 1000, dt: 1000 });
    expect(marked.endingProgressFlags.bigCrunchEligible).toBe(false);
  });

  it('tracks Critical purchases for the current universe and resets that flag on prestige', () => {
    const purchased = gameReducer(
      {
        ...createInitialGameState(0),
        quanta: 1e9,
      },
      { type: 'BUY_CRIT' },
    );
    expect(purchased.endingProgressFlags.criticalUpgradedThisUniverse).toBe(true);

    const completed = gameReducer(
      { ...purchased, selectedEndingId: 'heat_death' as const },
      { type: 'COMPLETE_ENDING', now: 900 },
    );
    const next = gameReducer(completed, { type: 'PRESTIGE', now: 1000 });
    expect(next.endingProgressFlags.criticalUpgradedThisUniverse).toBe(false);
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
    expect(next.lastEndingId).toBeNull();
  });
});
