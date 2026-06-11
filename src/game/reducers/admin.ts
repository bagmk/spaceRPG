/** Handlers: ADMIN_NEXT_STAGE, ADMIN_PREV_STAGE, ADMIN_SET_PROGRESS, ADMIN_RESTART_RUN, ADMIN_MAX_ENTITIES, BUY_SINGULARITY_UNLOCK, BUY_PRESTIGE_UPGRADE */

import { SINGULARITY_UNLOCK_LOOKUP } from '../constants';
import { STAGES } from '../stages';
import { getEntropyGateFloor } from '../formulas';
import { getStageStartCosmicTime } from '../timeFlow';
import { createInitialGameState, createDefaultEndingProgressFlags } from '../defaults';
import { PRESTIGE_MAX_LEVEL, getPrestigeCost } from '../prestige';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { unlockTrackForStage, resetMechanicState, hasUnlock } from './helpers';
import { getEntitiesForStage } from '../entities/stageItems';
import { entityMatchesId } from '../entities/stageItems';
import { withCurrentUniverseEndingProgress } from '../multiverse';

type AdminNextStageAction = Extract<GameAction, { type: 'ADMIN_NEXT_STAGE' }>;
type AdminPrevStageAction = Extract<GameAction, { type: 'ADMIN_PREV_STAGE' }>;
type AdminSetProgressAction = Extract<GameAction, { type: 'ADMIN_SET_PROGRESS' }>;
type AdminRestartRunAction = Extract<GameAction, { type: 'ADMIN_RESTART_RUN' }>;
type BuySingularityAction = Extract<GameAction, { type: 'BUY_SINGULARITY_UNLOCK' }>;
type BuyPrestigeUpgradeAction = Extract<GameAction, { type: 'BUY_PRESTIGE_UPGRADE' }>;

export function handleAdminNextStage(state: GameState, action: AdminNextStageAction): GameState {
  if (state.stageIdx >= STAGES.length - 1) {
    return {
      ...state,
      completedRun: true,
      pendingCondenseStageIdx: null,
      pendingCondenseEntropy: 0,
      imploding: false,
      condenseStartedAt: null,
      selectedEndingId: null,
      endingStartedAt: null,
    };
  }
  const nextStageIdx = state.stageIdx + 1;
  const nextState: GameState = {
    ...state,
    stageIdx: nextStageIdx,
    quanta: 0,
    // Park cumulative entropy at the new stage's gate floor so the gate window starts at 0%.
    entropy: getEntropyGateFloor(nextStageIdx),
    peakEntropy: Math.max(state.peakEntropy, getEntropyGateFloor(nextStageIdx)),
    timeGauge: 0,
    clickLevel: 0,
    autoLevel: 0,
    critLevel: 0,
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    selectedEndingId: null,
    endingStartedAt: null,
    completedRun: false,
    stageStartedAt: action.now,
    cosmicClockSec: getStageStartCosmicTime(nextStageIdx),
    tutorialDone: true,
    skills: unlockTrackForStage(state.skills, nextStageIdx + 1),
    stageClicksAtStageStart: state.totalClicks,
  };
  return { ...nextState, ...resetMechanicState(nextState) };
}

export function handleAdminPrevStage(state: GameState, action: AdminPrevStageAction): GameState {
  if (state.stageIdx <= 0) return state;
  const prevStageIdx = state.stageIdx - 1;
  const prevState: GameState = {
    ...state,
    stageIdx: prevStageIdx,
    quanta: 0,
    entropy: getEntropyGateFloor(prevStageIdx),
    timeGauge: 0,
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    selectedEndingId: null,
    endingStartedAt: null,
    completedRun: false,
    stageStartedAt: action.now,
    cosmicClockSec: getStageStartCosmicTime(prevStageIdx),
    skills: unlockTrackForStage(state.skills, prevStageIdx + 1),
    stageClicksAtStageStart: state.totalClicks,
  };
  return { ...prevState, ...resetMechanicState(prevState) };
}

export function handleAdminSetProgress(state: GameState, action: AdminSetProgressAction): GameState {
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  const targetQuanta = Math.floor(stage.threshold * action.fraction);
  const gateFloor = getEntropyGateFloor(state.stageIdx);
  const targetEntropy = gateFloor + (stage.entropyThreshold - gateFloor) * action.fraction;
  const targetCosmicSec =
    getStageStartCosmicTime(state.stageIdx) +
    (stage.cosmicTimeSec - getStageStartCosmicTime(state.stageIdx)) * action.fraction;
  const reset = action.fraction === 0
    ? { inventory: [], equippedSlots: [], clickLevel: 0, autoLevel: 0, critLevel: 0 }
    : {};
  return {
    ...state,
    quanta: targetQuanta,
    entropy: action.fraction === 0 ? gateFloor : targetEntropy,
    peakEntropy: Math.max(state.peakEntropy, targetEntropy),
    cosmicClockSec: targetCosmicSec,
    ...reset,
  };
}

export function handleAdminRestartRun(state: GameState, action: AdminRestartRunAction): GameState {
  const startStageIdx = hasUnlock(state, 'inflaton_spark') ? 1 : 0;
  const resetState = createInitialGameState(action.now);
  return {
    ...resetState,
    stageIdx: startStageIdx,
    cosmicClockSec: getStageStartCosmicTime(startStageIdx),
    universeCount: state.universeCount,
    cumulativeBoost: state.cumulativeBoost,
    condensedMass: state.condensedMass,
    echoes: state.echoes,
    singularityUnlocks: state.singularityUnlocks,
    endingsCompleted: state.endingsCompleted,
    lastEndingId: state.lastEndingId,
    tutorialDone: state.tutorialDone,
    cosmicHoursThisRun: state.cosmicHoursThisRun,
    dailyCheckIns: state.dailyCheckIns,
    skillPoints: state.skillPoints,
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: createDefaultEndingProgressFlags(),
    clickRateLog: [],
    condenseProgressHistory: [],
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: state.currentUniverseSeed,
    stageClicksAtStageStart: 0,
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    shopBoosts: state.shopBoosts,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    totalShopSpentUSD: state.totalShopSpentUSD,
    skills:
      state.universeCount > 1
        ? { ...state.skills, unlockedTracks: ['click', 'crit', 'auto', 'time'] }
        : state.skills,
    prestigeUpgrades: state.prestigeUpgrades,
    peakEntropy: state.peakEntropy,
  };
}

export function handleBuySingularityUnlock(
  state: GameState,
  action: BuySingularityAction,
): GameState {
  const unlock = SINGULARITY_UNLOCK_LOOKUP[action.unlockId];
  if (!unlock || state.singularityUnlocks.includes(action.unlockId) || state.condensedMass < unlock.cost) {
    return state;
  }
  return {
    ...state,
    condensedMass: state.condensedMass - unlock.cost,
    singularityUnlocks: [...state.singularityUnlocks, action.unlockId],
  };
}

export function handleBuyPrestigeUpgrade(
  state: GameState,
  action: BuyPrestigeUpgradeAction,
): GameState {
  const currentLevel = state.prestigeUpgrades[action.upgradeId] ?? 0;
  if (currentLevel >= PRESTIGE_MAX_LEVEL) return state;
  const cost = getPrestigeCost(currentLevel);
  if (cost === null || state.entropy < cost) return state;
  return {
    ...state,
    entropy: state.entropy - cost,
    prestigeUpgrades: {
      ...state.prestigeUpgrades,
      [action.upgradeId]: currentLevel + 1,
    },
  };
}

const ADMIN_UNLIMITED_MAX = 10;

export function handleAdminMaxEntities(state: GameState): GameState {
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage) return state;

  const entities = getEntitiesForStage(currentStage.id);
  const updatedEntities = state.inventory.map((e) => ({ ...e }));

  for (const entity of entities) {
    const targetCount = entity.maxCount > 0 ? entity.maxCount : ADMIN_UNLIMITED_MAX;
    const existing = updatedEntities.find((e) => entityMatchesId(entity, e.entityId));
    if (existing) {
      existing.count = Math.max(existing.count, targetCount);
    } else {
      updatedEntities.push({ entityId: entity.id, count: targetCount, level: 1 });
    }
  }

  return withCurrentUniverseEndingProgress({ ...state, inventory: updatedEntities });
}
