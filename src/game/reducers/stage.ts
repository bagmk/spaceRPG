/** Handlers: START_CONDENSE, ADVANCE_STAGE, SELECT_ENDING, COMPLETE_ENDING, PRESTIGE */

import { STAGES } from '../stages';
import {
  canCondense,
  getEffectiveThreshold,
  getEntropyOnCondense,
  getProgress,
  getTimeGaugeForCosmicClock,
  getCondensedMassReward,
  getEchoReward,
} from '../formulas';
import {
  ALL_ENDINGS,
  generateUniverseSeed,
  getEndingOptions,
  isBigCrunchEligible,
  isBigRipEligible,
  isVacuumDecayProgress,
} from '../multiverse';
import { getSkillPointsForStageAdvance } from '../skills/definitions';
import { createInitialGameState } from '../defaults';
import type { EndingId, GameState } from '../types';
import type { GameAction } from '../reducer';
import {
  getCurrentStage,
  unlockTrackForStage,
  resetMechanicState,
  recordLateStageClickRate,
  buildAtlasEntry,
  hasUnlock,
} from './helpers';
import { createDefaultEndingProgressFlags } from '../defaults';

type StartCondenseAction = Extract<GameAction, { type: 'START_CONDENSE' }>;
type AdvanceStageAction = Extract<GameAction, { type: 'ADVANCE_STAGE' }>;
type SelectEndingAction = Extract<GameAction, { type: 'SELECT_ENDING' }>;
type CompleteEndingAction = Extract<GameAction, { type: 'COMPLETE_ENDING' }>;
type PrestigeAction = Extract<GameAction, { type: 'PRESTIGE' }>;

export function handleStartCondense(state: GameState, action: StartCondenseAction): GameState {
  if (import.meta.env.DEV) {
    const _s = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
    console.debug('[transition] START_CONDENSE', {
      stageIdx: state.stageIdx, quanta: state.quanta, threshold: _s.threshold,
      cosmicClockSec: state.cosmicClockSec, required: _s.cosmicTimeSec,
      pendingCondenseStageIdx: state.pendingCondenseStageIdx, imploding: state.imploding,
    });
  }
  if (state.completedRun || state.pendingCondenseStageIdx !== null) return state;
  const stage = getCurrentStage(state);
  if (stage.id === STAGES.length) return state;
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  if (!canCondense(state)) return state;

  const earned = getEntropyOnCondense(state.quanta, effectiveThreshold);
  const progressAtCondense = getProgress(state.quanta, effectiveThreshold);
  const condenseEntry = { stageId: stage.id, progressAtCondense };
  const vacuumDecayEligible =
    state.endingProgressFlags.vacuumDecayEligible ||
    (stage.id === 14 && isVacuumDecayProgress(progressAtCondense));
  const endingsUnlocked: EndingId[] =
    vacuumDecayEligible && !state.endingsUnlocked.includes('vacuum_decay')
      ? [...state.endingsUnlocked, 'vacuum_decay']
      : state.endingsUnlocked;
  return {
    ...state,
    entropy: state.entropy + earned,
    pendingCondenseStageIdx: state.stageIdx,
    pendingCondenseEntropy: earned,
    combo: 0,
    lastClick: 0,
    imploding: true,
    condenseStartedAt: action.now,
    endingsUnlocked,
    endingProgressFlags: { ...state.endingProgressFlags, vacuumDecayEligible },
    condenseProgressHistory: [...state.condenseProgressHistory, condenseEntry].slice(-16),
  };
}

export function handleAdvanceStage(state: GameState, action: AdvanceStageAction): GameState {
  if (import.meta.env.DEV) {
    const _s = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
    console.debug('[transition] ADVANCE_STAGE', {
      stageIdx: state.stageIdx, quanta: state.quanta, threshold: _s.threshold,
      cosmicClockSec: state.cosmicClockSec, required: _s.cosmicTimeSec,
      pendingCondenseStageIdx: state.pendingCondenseStageIdx, imploding: state.imploding,
    });
  }
  if (state.pendingCondenseStageIdx === null) return state;
  if (state.stageIdx >= STAGES.length - 1) {
    return {
      ...state,
      pendingCondenseStageIdx: null,
      pendingCondenseEntropy: 0,
      imploding: false,
      condenseStartedAt: null,
      completedRun: true,
    };
  }
  const stage = getCurrentStage(state);
  const nextClickRateLog = recordLateStageClickRate(state, action.now);
  const nextStageIdx = state.stageIdx + 1;
  const nextStageId = nextStageIdx + 1;
  const nextCosmicClockSec = stage.cosmicTimeSec;
  const nextTimeGauge = getTimeGaugeForCosmicClock(nextStageIdx, nextCosmicClockSec);
  const nextState = {
    ...state,
    stageIdx: nextStageIdx,
    timeGauge: nextTimeGauge,
    cosmicClockSec: nextCosmicClockSec,
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    stageStartedAt: action.now,
    skills: unlockTrackForStage(state.skills, nextStageId),
    skillPoints: state.skillPoints + getSkillPointsForStageAdvance(stage.id),
    clickRateLog: nextClickRateLog,
    stageClicksAtStageStart: state.totalClicks,
  };
  return { ...nextState, ...resetMechanicState(nextState) };
}

export function handleSelectEnding(state: GameState, action: SelectEndingAction): GameState {
  const stage = getCurrentStage(state);
  if (
    stage.id !== STAGES.length ||
    state.quanta < stage.threshold ||
    state.cosmicClockSec < stage.cosmicTimeSec
  ) {
    return state;
  }
  const options = getEndingOptions(state, action.now);
  const selectedOption = options.find((o) => o.id === action.endingId);
  if (!selectedOption?.unlocked) return state;

  const nextClickRateLog = recordLateStageClickRate(state, action.now);
  const bigCrunchEligible = isBigCrunchEligible(
    { ...state, clickRateLog: nextClickRateLog },
    action.now,
  );
  const endingsUnlocked = new Set(state.endingsUnlocked);
  if (bigCrunchEligible) endingsUnlocked.add('big_crunch');
  if (isBigRipEligible(state)) endingsUnlocked.add('big_rip');
  if (state.endingProgressFlags.vacuumDecayEligible) endingsUnlocked.add('vacuum_decay');
  return {
    ...state,
    selectedEndingId: action.endingId,
    endingStartedAt: action.now,
    clickRateLog: nextClickRateLog,
    endingsUnlocked: Array.from(endingsUnlocked) as EndingId[],
    endingProgressFlags: {
      ...state.endingProgressFlags,
      bigCrunchEligible,
      bigRipEverEligible: state.endingProgressFlags.bigRipEverEligible || isBigRipEligible(state),
    },
  };
}

export function handleCompleteEnding(state: GameState, action: CompleteEndingAction): GameState {
  if (state.selectedEndingId === null) return state;
  const completedEndings = Array.from(
    new Set([...state.endingsCompleted, state.selectedEndingId]),
  );
  const atlasEntry = buildAtlasEntry(state, action.now);
  const universeAtlas = atlasEntry ? [...state.universeAtlas, atlasEntry] : state.universeAtlas;
  const permanentUnlocks: EndingId[] =
    state.selectedEndingId === 'bounce' || completedEndings.includes('bounce')
      ? ALL_ENDINGS
      : (Array.from(new Set([...state.endingsUnlocked, state.selectedEndingId])) as EndingId[]);
  return {
    ...state,
    completedRun: true,
    condensedMass:
      state.condensedMass +
      getCondensedMassReward(state.entropy, state.selectedEndingId, state.universeCount),
    echoes:
      state.echoes +
      (state.endingsCompleted.includes(state.selectedEndingId)
        ? 0
        : getEchoReward(state.endingsCompleted.length)),
    endingsCompleted: completedEndings,
    endingsUnlocked: permanentUnlocks,
    lastEndingId: state.selectedEndingId,
    selectedEndingId: null,
    endingStartedAt: null,
    universeAtlas,
  };
}

export function handlePrestige(state: GameState, action: PrestigeAction): GameState {
  const resetState = createInitialGameState(action.now);
  const nextSeed = generateUniverseSeed(state.universeCount);
  return {
    ...resetState,
    universeCount: state.universeCount + 1,
    cumulativeBoost: state.cumulativeBoost,
    condensedMass: state.condensedMass,
    echoes: state.echoes,
    singularityUnlocks: state.singularityUnlocks,
    endingsCompleted: state.endingsCompleted,
    lastEndingId: state.lastEndingId,
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: createDefaultEndingProgressFlags(),
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: nextSeed,
    tutorialFlags: state.tutorialFlags,
    totalShopSpentUSD: state.totalShopSpentUSD,
  };
}
