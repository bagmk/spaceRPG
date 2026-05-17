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
import { getPrestigeMultiplier } from '../prestige';
import {
  generateUniverseSeed,
  getEndingOptions,
  withCurrentUniverseEndingProgress,
} from '../multiverse';
import { getSkillPointsForStageAdvance } from '../skills/definitions';
import { createInitialGameState } from '../defaults';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import {
  getCurrentStage,
  unlockTrackForStage,
  resetMechanicState,
  recordLateStageClickRate,
  buildAtlasEntry,
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
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  if (!canCondense(state)) return state;

  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  const earned = getEntropyOnCondense(state.quanta, effectiveThreshold) * entropyEchoMult;
  const progressAtCondense = getProgress(state.quanta, effectiveThreshold);
  const condenseEntry = { stageId: stage.id, progressAtCondense };
  return withCurrentUniverseEndingProgress({
    ...state,
    entropy: state.entropy + earned,
    pendingCondenseStageIdx: state.stageIdx,
    pendingCondenseEntropy: earned,
    combo: 0,
    lastClick: 0,
    imploding: true,
    condenseStartedAt: action.now,
    condenseProgressHistory: [...state.condenseProgressHistory, condenseEntry].slice(-16),
  });
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
  const progressedState = withCurrentUniverseEndingProgress(state);
  const stage = getCurrentStage(progressedState);
  const nextClickRateLog = recordLateStageClickRate(progressedState, action.now);
  const nextStageIdx = progressedState.stageIdx + 1;
  const nextStageId = nextStageIdx + 1;
  const nextCosmicClockSec = stage.cosmicTimeSec;
  const nextTimeGauge = getTimeGaugeForCosmicClock(nextStageIdx, nextCosmicClockSec);
  const nextState = {
    ...progressedState,
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
    skills: unlockTrackForStage(progressedState.skills, nextStageId),
    skillPoints: progressedState.skillPoints + getSkillPointsForStageAdvance(stage.id),
    clickRateLog: nextClickRateLog,
    stageClicksAtStageStart: progressedState.totalClicks,
  };
  return withCurrentUniverseEndingProgress({ ...nextState, ...resetMechanicState(nextState) });
}

export function handleSelectEnding(state: GameState, action: SelectEndingAction): GameState {
  if (!state.completedRun) {
    const stage = getCurrentStage(state);
    const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
    if (
      stage.id !== STAGES.length ||
      state.quanta < effectiveThreshold ||
      state.cosmicClockSec < stage.cosmicTimeSec
    ) {
      return state;
    }
  }
  const progressedState = withCurrentUniverseEndingProgress(state);
  const options = getEndingOptions(progressedState, action.now);
  const selectedOption = options.find((o) => o.id === action.endingId);
  if (!selectedOption?.unlocked) return state;

  return {
    ...progressedState,
    selectedEndingId: action.endingId,
    endingStartedAt: action.now,
  };
}

export function handleCompleteEnding(state: GameState, action: CompleteEndingAction): GameState {
  if (state.selectedEndingId === null) return state;
  const completedEndings = Array.from(
    new Set([...state.endingsCompleted, state.selectedEndingId]),
  );
  const atlasEntry = buildAtlasEntry(state, action.now);
  const universeAtlas = atlasEntry ? [...state.universeAtlas, atlasEntry] : state.universeAtlas;
  const permanentUnlocks = Array.from(new Set([...state.endingsUnlocked, state.selectedEndingId]));
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
    lastEndingId: null,
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: createDefaultEndingProgressFlags(),
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: nextSeed,
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    shopBoosts: state.shopBoosts,
    totalShopSpentUSD: state.totalShopSpentUSD,
    prestigeUpgrades: state.prestigeUpgrades,
  };
}
