import { describe, expect, it } from 'vitest';
import { canCondense, getCosmicClockForGauge, getCritMultiplier, getTimeGaugeForCosmicClock, getEntropyGateFloor, getEntropyGateSpan, getGateIncomeSpanCap } from '../formulas';
import { createInitialGameState, gameReducer } from '../reducer';
import { getEntityCost } from '../entities/types';
import { getComboCapBonus } from '../reducers/helpers';
import { getSetKey, getEquipSetKey } from '../entities/effects';
import { getEntitiesForStage, STAGE_ENTITIES } from '../entities/stageItems';
import { isCrewId } from '../crew/roster';
import { BIG_CRUNCH_ENTROPY_THRESHOLD_KB } from '../multiverse';
import { STAGES } from '../stages';
import { getActiveModifiers } from '../skills/effects';
import { getCondensationCoreCost, getResonanceCoreCost } from '../prestige';
import { getSingularityEcho } from '../formulas';
import { ENTROPY_THRESHOLDS, COLLISION_ENTROPY_SPAN_CAP, ENTROPY_W_CLICK, FUSION_BURST_SPAN_CAP, FUSION_BATCH_BURST_SPAN_CAP, ENTITY_COST_ANCHORS, CONDENSE_COST_FRAC, CONDENSE_SPAN_FRAC, CONDENSE_STAGE_CAP } from '../balance';
import { COMBO_CAP_PER_STAGE, COMBO_CAP_SINGULARITY } from '../balance';

describe('gameReducer', () => {
  it('carries all quanta into the next stage without resetting skill-backed levels', () => {
    const state = {
      ...createInitialGameState(0),
      pendingCondenseStageIdx: 0,
      quanta: STAGES[0].threshold * 1.2,
      timeGauge: 100,
      cosmicClockSec: STAGES[0].cosmicTimeSec,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(1);
    expect(next.quanta).toBeCloseTo(STAGES[0].threshold * 1.2, 5);
    expect(next.timeGauge).toBe(getTimeGaugeForCosmicClock(1, STAGES[0].cosmicTimeSec));
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
      type: 'ABSORB_COMET',
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
    // entropy = min(rawGain, entropySpan × tierSpanCap). raw = boostedBonus*W_CLICK
    // + max(entropyBonus, tierFloor=50)*mult = 80*0.6 + 50 = 98; the comet burst is
    // capped to a fraction of the stage's entropy span (#3), so it scales WITH the
    // calibrated thresholds — compute it from constants, don't hardcode.
    const rawGain = 80 * ENTROPY_W_CLICK + 50;
    const span = Math.max(1, STAGES[0].entropyThreshold - getEntropyGateFloor(0));
    expect(next.entropy).toBeCloseTo(Math.min(rawGain, span * COLLISION_ENTROPY_SPAN_CAP.major), 2);
  });

  it('Overhaul-3: a single fusion burst is capped to a fraction of the stage entropy span', () => {
    // The burst rides live (enhancement-inflated) click power; without a clamp one
    // fuse could dump most of a stage's gate. Mirror of the comet cap.
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const input = commons[0];
    const state = {
      ...createInitialGameState(0),
      quanta: 1e9, // far more than the fuse cost — burst must NOT scale with the bank
      inventory: [{ entityId: input.id, count: 3, level: 1 }],
    };
    const next = gameReducer(state, {
      type: 'FUSE_ENTITIES', inputEntityIds: [input.id, input.id, input.id], rarityRoll: 0.99, pickRoll: 0.1,
    });
    const span = Math.max(1, STAGES[0].entropyThreshold - getEntropyGateFloor(0));
    expect(next.lastFusionEvent!.entropyBurst).toBeGreaterThan(0);
    expect(next.lastFusionEvent!.entropyBurst).toBeLessThanOrEqual(span * FUSION_BURST_SPAN_CAP + 1e-6);
  });

  it('Overhaul-3: a fuse batch is capped in aggregate to the batch span fraction', () => {
    const commons = getEntitiesForStage(1).filter((e) => e.rarity === 'common');
    const input = commons[0];
    const trios = 12;
    const ids: string[] = [];
    for (let i = 0; i < trios * 3; i++) ids.push(input.id);
    const rolls = Array.from({ length: trios }, () => ({ rarityRoll: 0.99, pickRoll: 0.1, stageRoll: 0 }));
    const state = {
      ...createInitialGameState(0),
      quanta: 1e12,
      inventory: [{ entityId: input.id, count: trios * 3, level: 1 }],
    };
    const next = gameReducer(state, { type: 'FUSE_BATCH', inputEntityIds: ids, rolls });
    const span = Math.max(1, STAGES[0].entropyThreshold - getEntropyGateFloor(0));
    expect(next.lastFusionEvent!.batchCount).toBeGreaterThan(0);
    expect(next.lastFusionEvent!.entropyBurst).toBeLessThanOrEqual(span * FUSION_BATCH_BURST_SPAN_CAP + 1e-6);
  });

  it('분사 (CONDENSE_BURST): adds a span-capped entropy burst, spends a wallet fraction, tracks the per-stage budget', () => {
    const stageIdx = 5; // stage 6
    const span = getEntropyGateSpan(stageIdx);
    const perFire = span * CONDENSE_SPAN_FRAC;
    const state = {
      ...createInitialGameState(0),
      stageIdx,
      entropy: getEntropyGateFloor(stageIdx) + 1, // well below the gate
      quanta: 1000,
      condenseBurstThisStage: 0,
    };
    const next = gameReducer(state, { type: 'CONDENSE_BURST' });
    // 2026-06-28: 분사 is CLICK-charged (UI-side) and condenses a slice of the wallet into the gate.
    // Entropy gets exactly one per-fire span fraction (below the cap); quanta drops by COST_FRAC.
    expect(next.quanta).toBeCloseTo(state.quanta * (1 - CONDENSE_COST_FRAC), 2);
    expect(next.entropy - state.entropy).toBeCloseTo(perFire, 2);
    expect(next.condenseBurstThisStage).toBeCloseTo(perFire, 2);
    expect(next.peakEntropy).toBeGreaterThanOrEqual(next.entropy);
  });

  it('분사 (CONDENSE_BURST): is bounded by CONDENSE_STAGE_CAP × span per stage (no gate-skip)', () => {
    const stageIdx = 5;
    const stage = STAGES[stageIdx];
    const span = getEntropyGateSpan(stageIdx);
    const cost = Math.ceil(ENTITY_COST_ANCHORS[stage.id as keyof typeof ENTITY_COST_ANCHORS] * CONDENSE_COST_FRAC);
    const stageBudget = span * CONDENSE_STAGE_CAP;
    // Already at the cap → the per-stage budget is exhausted, button is a no-op.
    const atCap = {
      ...createInitialGameState(0),
      stageIdx,
      entropy: getEntropyGateFloor(stageIdx) + 1,
      quanta: cost * 100,
      condenseBurstThisStage: stageBudget,
    };
    expect(gameReducer(atCap, { type: 'CONDENSE_BURST' })).toBe(atCap); // no-op (returns same state)
    // One step below the cap → the actual add is clamped to the REMAINING budget (< per-fire).
    const perFire = span * CONDENSE_SPAN_FRAC;
    const nearCap = { ...atCap, condenseBurstThisStage: stageBudget - perFire * 0.25 };
    const fired = gameReducer(nearCap, { type: 'CONDENSE_BURST' });
    expect(fired.condenseBurstThisStage).toBeCloseTo(stageBudget, 2); // capped exactly at the budget
    expect(fired.entropy - nearCap.entropy).toBeCloseTo(perFire * 0.25, 2); // only the remainder
  });

  it('분사 (CONDENSE_BURST): no-op guard — already at/over the gate (charge-funded, no matter guard)', () => {
    const stageIdx = 5;
    const stage = STAGES[stageIdx];
    // Already at/over the gate → 분사 funds progress TO the gate, never past it → no-op.
    const atGate = {
      ...createInitialGameState(0),
      stageIdx,
      entropy: stage.entropyThreshold,
      quanta: 0,
      condenseBurstThisStage: 0,
    };
    expect(gameReducer(atGate, { type: 'CONDENSE_BURST' })).toBe(atGate);
  });

  it('Overhaul-3: advancing a stage parks entropy at the new gate floor (no condense overshoot carry)', () => {
    // The condense bonus (quanta × 0.1) is wallet-inflated and used to CARRY past
    // the next gate, chain-jumping stages. Advancing must reset to the floor.
    const state = {
      ...createInitialGameState(0),
      stageIdx: 4,
      pendingCondenseStageIdx: 4,
      entropy: ENTROPY_THRESHOLDS[16] * 1000, // absurd overshoot
      quanta: STAGES[4].threshold,
    };
    const next = gameReducer(state, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(next.stageIdx).toBe(5);
    expect(next.entropy).toBe(getEntropyGateFloor(5));
    expect(canCondense(next)).toBe(false); // cannot immediately re-condense
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

  });

  it('crit multiplier is gear-driven (base 1.5 × gear critMultMult)', () => {
    const modifiers = getActiveModifiers({
      stageId: 2,
      gateProgress01: 0,
      stagesCleared: 1,
      progress01: 0,
    });
    expect(getCritMultiplier(modifiers)).toBeCloseTo(1.5, 5);
    expect(getCritMultiplier({ ...modifiers, critMultMult: 2 })).toBeCloseTo(3, 5);
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

  it('🅠3: TICK emits a throttled auto-income float for the primary equipped rift entity', () => {
    // OVERHAUL5 v2: the rift lane is crewed by LINES — s1_03 (급팽창의 유산,
    // auto_mult) joins at stage 1, so it equips by its own id.
    const entity = getEntitiesForStage(1).find((candidate) => candidate.id === 's1_03');
    expect(entity).toBeDefined();
    if (!entity) return;
    const funded = { ...createInitialGameState(0), quanta: 1e9 };
    const equipped = gameReducer(funded, { type: 'EQUIP_ENTITY', entityId: entity.id });
    // P6: slots store the equipped copy's instanceId (resolves back to the entity).
    expect(equipped.riftSlots[0]).toBeTruthy();

    // First tick (t=1000, gap from t0=0 ≥ 1s) emits for the equipped rift entity.
    const t1 = gameReducer({ ...equipped, lastAutoIncomeEvent: null }, { type: 'TICK', now: 1000, dt: 1000 });
    expect(t1.lastAutoIncomeEvent).not.toBeNull();
    expect(t1.lastAutoIncomeEvent!.entityId).toBe(entity.id);
    expect(t1.lastAutoIncomeEvent!.gained).toBeGreaterThan(0);
    expect(t1.lastAutoIncomeEvent!.t).toBe(1000);

    // A tick 100ms later is throttled — no re-emit (same event id).
    const t2 = gameReducer(t1, { type: 'TICK', now: 1100, dt: 100 });
    expect(t2.lastAutoIncomeEvent!.id).toBe(t1.lastAutoIncomeEvent!.id);

    // A tick ≥1s after the last emission re-emits (new id).
    const t3 = gameReducer(t2, { type: 'TICK', now: 2200, dt: 1100 });
    expect(t3.lastAutoIncomeEvent!.id).not.toBe(t1.lastAutoIncomeEvent!.id);
  });

  it('base auto income: auto-income float fires even with no rift entity (gearless, entityId "")', () => {
    // Overhaul-2 follow-up: base auto income (AUTO_RATE_BASE) flows with no gear,
    // so the float now emits with an empty entityId (renders as a plain "+N/s").
    const base = { ...createInitialGameState(0), lastAutoIncomeEvent: null };
    const ticked = gameReducer(base, { type: 'TICK', now: 1000, dt: 1000 });
    expect(ticked.lastAutoIncomeEvent).not.toBeNull();
    expect(ticked.lastAutoIncomeEvent?.entityId).toBe('');
    expect(ticked.lastAutoIncomeEvent?.gained ?? 0).toBeGreaterThan(0);
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

    // OVERHAUL5 (v33): the purchase lands as a CODEX CARD (s1_01 is also a joined
    // starter crew — cards fuel it, they don't stack copies).
    expect(purchased.cardInventory[entity.id]).toBe(1);
    expect(purchased.inventory).toHaveLength(0);
    // Absorption (Phase 2): unequipped ownership gives no passive click bonus.
    expect(unequippedClick.lastClickEvent?.gained).toBe(baseline.lastClickEvent?.gained);
    // CHECKPOINT: equipping (the crew, by its own id) changes click output.
    expect(boosted.lastClickEvent?.gained).toBeGreaterThan(baseline.lastClickEvent?.gained ?? 0);
  });

  it('GATE income cap: one over-geared click cannot overfill the gate (instant-advance fix)', () => {
    const state = { ...createInitialGameState(0), stageIdx: 4 }; // stage 5
    // A click carrying an absurd entropyDelta (stand-in for end-game gear at an early stage).
    const next = gameReducer(state, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0, entropyDelta: 1e30 });
    const span = getEntropyGateSpan(4);
    const cap = getGateIncomeSpanCap(4); // stage 5 is tighter than the base 0.25 (ramps from stage 4)
    const gained = next.entropy - state.entropy;
    // Capped to a fraction of the stage span — NOT the full 1e30 → can't 1-tap the gate.
    expect(gained).toBeLessThanOrEqual(span * cap + 1);
    expect(gained).toBeGreaterThan(span * cap * 0.9); // the huge delta saturates it
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
      type: 'ABSORB_COMET',
      x: 0,
      y: 0,
      bonus: 1,
      entropyBonus: 0,
      tier: 'massive',
      name: 'test',
    });
    expect(massive.quanta).toBe(100);
    // Raw gain = 100 × W_CLICK(0.6) + tier floor 200 = 260, BUT a comet's entropy
    // is capped to a fraction of the CURRENT stage's gate span. After the #39/#40
    // recalibration the stage-1 gate shrank, so the span cap now binds below 260.
    const span = ENTROPY_THRESHOLDS[1];
    const expected = Math.min(260, span * COLLISION_ENTROPY_SPAN_CAP.massive);
    expect(massive.entropy).toBeCloseTo(expected, 2);
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

  it('tracks Critical gear equips for the current universe and resets that flag on prestige', () => {
    // Equipping crit-flavored gear marks the universe (vacuum decay in gear terms).
    // OVERHAUL5 v2: stage-1's static crit entity (s1_03) is now an auto_mult LINE,
    // so use a NON-line crit item (s2_03 Electron) through the legacy copy path.
    const critEntity = getEntitiesForStage(2).find((e) => e.effect.type === 'crit' && !isCrewId(e.id))!;
    const purchased = gameReducer(
      {
        ...createInitialGameState(0),
        quanta: 1e9,
        inventory: [{ entityId: critEntity.id, instanceId: 'c1', count: 1, level: 1 }],
      },
      { type: 'EQUIP_ENTITY', entityId: critEntity.id },
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
    expect(next.cumulativeBoost).toBe(0);
    expect(next.condensedMass).toBeGreaterThan(0);
    expect(next.echoes).toBe(1);
    expect(next.endingsCompleted).toContain('heat_death');
    expect(next.lastEndingId).toBeNull();
  });

  // The 4 formerly-`unimplemented` endgame nodes (stellar_memory, multiverse_lens,
  // vacuum_stability, boltzmann_brain) are now WIRED to off-gate effects (2026-06-24),
  // so they are purchasable like any other node. The reducer's `unimplemented` guard
  // stays as defensive code for any FUTURE stub.
  it('allows buying a now-wired endgame singularity node (vacuum_stability)', () => {
    const state = { ...createInitialGameState(0), condensedMass: 1e6 };
    const next = gameReducer(state, { type: 'BUY_SINGULARITY_UNLOCK', unlockId: 'vacuum_stability' });
    expect(next.condensedMass).toBeLessThan(1e6);
    expect(next.singularityUnlocks).toContain('vacuum_stability');
  });

  it('still allows buying a wired singularity node', () => {
    const state = { ...createInitialGameState(0), condensedMass: 1e6 };
    const next = gameReducer(state, { type: 'BUY_SINGULARITY_UNLOCK', unlockId: 'quark_foam' });
    expect(next.singularityUnlocks).toContain('quark_foam');
    expect(next.condensedMass).toBeLessThan(1e6);
  });

  // Condensation Core — the ENDLESS off-gate sink. Bought with condensedMass at a
  // geometric cost, uncapped (well past PRESTIGE_MAX_LEVEL), no save migration.
  it('Condensation Core: condensedMass buy, geometric cost, uncapped past Lv5', () => {
    let state = { ...createInitialGameState(0), condensedMass: 1e9, entropy: 0 };
    expect(state.prestigeUpgrades.condensation_core).toBe(0);
    const firstCost = getCondensationCoreCost(0);
    const next = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'condensation_core' });
    expect(next.prestigeUpgrades.condensation_core).toBe(1);
    expect(next.condensedMass).toBeCloseTo(1e9 - firstCost, 6);
    // entropy is untouched (this sink spends condensedMass, not entropy).
    expect(next.entropy).toBe(0);
    // Costs rise geometrically.
    expect(getCondensationCoreCost(1)).toBeGreaterThan(getCondensationCoreCost(0));
    // Uncapped: buy 12 levels in a row (past the Lv5 cap on the entropy upgrades).
    state = next;
    for (let i = 0; i < 11; i++) {
      state = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'condensation_core' });
    }
    expect(state.prestigeUpgrades.condensation_core).toBe(12);
  });

  it('Condensation Core: rejects the buy when condensedMass is short', () => {
    const state = { ...createInitialGameState(0), condensedMass: 0 };
    const next = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'condensation_core' });
    expect(next.prestigeUpgrades.condensation_core).toBe(0);
    expect(next.condensedMass).toBe(0);
  });

  // P7 Resonance Core — infinite echo sink. Echo is DERIVED from peakEntropy; only
  // echoSpent persists, and spendable = getSingularityEcho(peakEntropy) − echoSpent.
  it('P7 Resonance Core: peakEntropy mints spendable echo; buying raises echoSpent + level, uncapped', () => {
    let state = { ...createInitialGameState(0), peakEntropy: 1e9, echoSpent: 0 };
    const total = getSingularityEcho(1e9);
    expect(total).toBeGreaterThan(0); // floor(1e9^0.3) ≈ 501
    expect(state.prestigeUpgrades.resonance_core).toBe(0);

    const firstCost = getResonanceCoreCost(0);
    const next = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'resonance_core' });
    expect(next.prestigeUpgrades.resonance_core).toBe(1);
    expect(next.echoSpent).toBe(firstCost);               // spend ledger advanced
    expect(next.peakEntropy).toBe(1e9);                   // earn source untouched
    // spendable shrank by exactly the cost
    expect(getSingularityEcho(next.peakEntropy) - next.echoSpent).toBe(total - firstCost);
    // uncapped: keep buying past Lv5 while echo lasts
    state = next;
    for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'resonance_core' });
    expect(state.prestigeUpgrades.resonance_core).toBe(7);
  });

  it('P7 Resonance Core: rejects the buy when echo (peakEntropy-derived) is short', () => {
    const state = { ...createInitialGameState(0), peakEntropy: 1, echoSpent: 0 }; // echo = floor(1^0.3)=1, cost 5
    const next = gameReducer(state, { type: 'BUY_PRESTIGE_UPGRADE', upgradeId: 'resonance_core' });
    expect(next.prestigeUpgrades.resonance_core).toBe(0);
    expect(next.echoSpent).toBe(0);
  });

  it('P7 SET_ECHO_FOCUS: clamps to 0..100', () => {
    const state = createInitialGameState(0);
    expect(state.prestigeUpgrades.echoFocus).toBe(50);
    expect(gameReducer(state, { type: 'SET_ECHO_FOCUS', focus: 80 }).prestigeUpgrades.echoFocus).toBe(80);
    expect(gameReducer(state, { type: 'SET_ECHO_FOCUS', focus: 999 }).prestigeUpgrades.echoFocus).toBe(100);
    expect(gameReducer(state, { type: 'SET_ECHO_FOCUS', focus: -5 }).prestigeUpgrades.echoFocus).toBe(0);
  });
});

describe('P5: combo cap growth (R10) + set-key split (R8)', () => {
  it('combo cap bonus grows with stage progression', () => {
    const base = createInitialGameState(0);
    const delta = getComboCapBonus({ ...base, stageIdx: 5 }) - getComboCapBonus({ ...base, stageIdx: 0 });
    expect(delta).toBeCloseTo(5 * COMBO_CAP_PER_STAGE);
  });

  it('free_combo singularity adds to the combo cap bonus', () => {
    const base = createInitialGameState(0);
    const boosted = { ...base, singularityUnlocks: ['free_combo'] as typeof base.singularityUnlocks };
    expect(getComboCapBonus(boosted) - getComboCapBonus(base)).toBeCloseTo(COMBO_CAP_SINGULARITY);
  });

  it('prestige resets the per-stage combo ramp but keeps the singularity term', () => {
    const before = { ...createInitialGameState(0), stageIdx: 5, completedRun: true, selectedEndingId: null,
      singularityUnlocks: ['free_combo'] as ReturnType<typeof createInitialGameState>['singularityUnlocks'] };
    const prestiged = gameReducer(before, { type: 'PRESTIGE', now: 1000 });
    expect(prestiged.stageIdx).toBe(0);
    // stage ramp gone (stageIdx 0), but the free_combo singularity persists.
    expect(getComboCapBonus(prestiged)).toBeCloseTo(COMBO_CAP_SINGULARITY);
    expect(getComboCapBonus(prestiged)).toBeLessThan(getComboCapBonus(before));
  });

  it('R8: equip set bonus keys on codex subset; fusion family bias stays glyph', () => {
    const e = STAGE_ENTITIES.find((x) => getEquipSetKey(x) !== null)!;
    expect(e).toBeDefined();
    expect(getSetKey(e)).toBe(e.visual.glyph);            // fusion same-family bias unchanged
    expect(getEquipSetKey(e)).not.toBe(getSetKey(e));     // equip set re-keyed (codex subset id)
  });
});
