/** Handlers: ADMIN_NEXT_STAGE, ADMIN_PREV_STAGE, ADMIN_SET_PROGRESS, ADMIN_RESTART_RUN, ADMIN_MAX_ENTITIES, BUY_SINGULARITY_UNLOCK, BUY_PRESTIGE_UPGRADE */

import { SINGULARITY_UNLOCK_LOOKUP } from '../constants';
import { STAGES } from '../stages';
import { getEntropyGateFloor, getSingularityEcho } from '../formulas';
import { getStageStartCosmicTime } from '../timeFlow';
import { createInitialGameState, createDefaultEndingProgressFlags } from '../defaults';
import { PRESTIGE_MAX_LEVEL, getPrestigeCost, getCondensationCoreCost, getResonanceCoreCost } from '../prestige';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { resetMechanicState, hasUnlock } from './helpers';
import { getEntitiesForStage } from '../entities/stageItems';
import { entityMatchesId } from '../entities/stageItems';
import { makeInstance } from '../entities/instances';
import { refillActiveQuests, snapshotStageQuestProgress } from '../quests';
import { joinCrewForStage } from './stage';
import { withCurrentUniverseEndingProgress } from '../multiverse';

type AdminNextStageAction = Extract<GameAction, { type: 'ADMIN_NEXT_STAGE' }>;
type AdminPrevStageAction = Extract<GameAction, { type: 'ADMIN_PREV_STAGE' }>;
type AdminSetProgressAction = Extract<GameAction, { type: 'ADMIN_SET_PROGRESS' }>;
type AdminRestartRunAction = Extract<GameAction, { type: 'ADMIN_RESTART_RUN' }>;
type BuySingularityAction = Extract<GameAction, { type: 'BUY_SINGULARITY_UNLOCK' }>;
type BuyPrestigeUpgradeAction = Extract<GameAction, { type: 'BUY_PRESTIGE_UPGRADE' }>;
type SetEchoFocusAction = Extract<GameAction, { type: 'SET_ECHO_FOCUS' }>;

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
    stageClicksAtStageStart: state.totalClicks,
    fusionsThisStage: 0,
    cometsThisStage: 0,
    comboThisStage: 0,
    condenseBurstThisStage: 0,
    // Debug stage-jump must refresh quests like the live advance (stage.ts) does — otherwise the
    // leaving stage's quest ids linger on the new stage's tab, titled with the wrong era's lore
    // (e.g. S12 "태양 소멸" showing on the S11 tab). Snapshot the era we leave + derive the new set.
    stageQuestProgress: snapshotStageQuestProgress(state, STAGES[state.stageIdx].id),
    activeQuests: refillActiveQuests(state.activeQuests, state.completedQuestIds, STAGES[nextStageIdx].id),
    // OVERHAUL5: the debug jump fires the same crew join beats as a live advance.
    ...joinCrewForStage(state, STAGES[nextStageIdx].id),
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
    stageClicksAtStageStart: state.totalClicks,
    fusionsThisStage: 0,
    cometsThisStage: 0,
    comboThisStage: 0,
    condenseBurstThisStage: 0,
    stageQuestProgress: snapshotStageQuestProgress(state, STAGES[state.stageIdx].id),
    activeQuests: refillActiveQuests(state.activeQuests, state.completedQuestIds, STAGES[prevStageIdx].id),
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
    ? { inventory: [], equippedSlots: [], riftSlots: [] }
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
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: createDefaultEndingProgressFlags(),
    clickRateLog: [],
    condenseProgressHistory: [],
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: state.currentUniverseSeed,
    stageClicksAtStageStart: 0,
    fusionsThisStage: 0,
    cometsThisStage: 0,
    comboThisStage: 0,
    condenseBurstThisStage: 0,
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    shopBoosts: state.shopBoosts,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    totalShopSpentUSD: state.totalShopSpentUSD,
    prestigeUpgrades: state.prestigeUpgrades,
    peakEntropy: state.peakEntropy,
  };
}

export function handleBuySingularityUnlock(
  state: GameState,
  action: BuySingularityAction,
): GameState {
  const unlock = SINGULARITY_UNLOCK_LOOKUP[action.unlockId];
  // Panel #7: never let condensedMass be spent on a node whose effect isn't wired
  // (the UI disables these, but guard the reducer too).
  if (!unlock || unlock.unimplemented || state.singularityUnlocks.includes(action.unlockId) || state.condensedMass < unlock.cost) {
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

  // Condensation Core: the ENDLESS off-gate sink — uncapped, bought with
  // condensedMass at a geometric cost (the other 5 are entropy-bought, Lv5-capped).
  if (action.upgradeId === 'condensation_core') {
    const massCost = getCondensationCoreCost(currentLevel);
    if (state.condensedMass < massCost) return state;
    return {
      ...state,
      condensedMass: state.condensedMass - massCost,
      prestigeUpgrades: {
        ...state.prestigeUpgrades,
        condensation_core: currentLevel + 1,
      },
    };
  }

  // P7 Resonance Core: the INFINITE compounding sink — uncapped, bought with 특이점 잔향
  // (Singularity Echo, DERIVED from peakEntropy). Spendable = getSingularityEcho(peakEntropy)
  // − echoSpent; buying increments echoSpent (the only persisted spend ledger).
  if (action.upgradeId === 'resonance_core') {
    const echoCost = getResonanceCoreCost(currentLevel);
    const spendable = getSingularityEcho(state.peakEntropy) - state.echoSpent;
    if (spendable < echoCost) return state;
    return {
      ...state,
      echoSpent: state.echoSpent + echoCost,
      prestigeUpgrades: {
        ...state.prestigeUpgrades,
        resonance_core: currentLevel + 1,
      },
    };
  }

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

/** P7: set the Resonance Core click↔auto focus (0..100). Pure re-spec — the split is
 *  geometric-mean-preserving (see getActiveModifiers), so total off-gate power is unchanged. */
export function handleSetEchoFocus(
  state: GameState,
  action: SetEchoFocusAction,
): GameState {
  const focus = Math.max(0, Math.min(100, Math.round(action.focus)));
  if (focus === (state.prestigeUpgrades.echoFocus ?? 50)) return state;
  return { ...state, prestigeUpgrades: { ...state.prestigeUpgrades, echoFocus: focus } };
}

const ADMIN_UNLIMITED_MAX = 10;

export function handleAdminMaxEntities(state: GameState): GameState {
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage) return state;

  const entities = getEntitiesForStage(currentStage.id);
  // P6: flat model — top each entity up to a few SEPARATE copies (enough to test
  // per-copy enhance/placement + a fusion trio) without bloating the array.
  const perEntity = Math.min(5, ADMIN_UNLIMITED_MAX);
  let inventory = state.inventory;
  for (const entity of entities) {
    const target = entity.maxCount > 0 ? Math.min(entity.maxCount, perEntity) : perEntity;
    const owned = inventory.reduce((s, e) => (entityMatchesId(entity, e.entityId) ? s + e.count : s), 0);
    for (let i = owned; i < target; i++) inventory = [...inventory, makeInstance(entity.id)];
  }

  return withCurrentUniverseEndingProgress({ ...state, inventory });
}
