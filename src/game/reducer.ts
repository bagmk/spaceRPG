/**
 * Game reducer — action type definitions + thin routing switch.
 *
 * Logic lives in src/game/reducers/*.ts slice files.
 * Add a new action: (1) add to GameAction union, (2) add case below, (3) create handler in a slice.
 */

import type {
  EndingId,
  GameState,
  PersistentGameState,
  RogueTypeKey,
  SingularityUnlockId,
} from './types';

// Re-export so callers get everything they need from one import.
export { createInitialGameState, createDefaultSkills } from './defaults';

// Slice handlers
import {
  handleTick,
  handleClick,
  handleBuyClick,
  handleBuyAuto,
  handleBuyCrit,
  handleReportCollision,
  handleReportEncounter,
} from './reducers/gameplay';
import {
  handleStartCondense,
  handleAdvanceStage,
  handleSelectEnding,
  handleCompleteEnding,
  handlePrestige,
} from './reducers/stage';
import { handleBuyTrackLevel, handleBuyCrossNode } from './reducers/skills';
import { handlePurchaseEntity } from './reducers/entities';
import { handleBuyShopItem } from './reducers/shop';
import {
  handleAdminNextStage,
  handleAdminPrevStage,
  handleAdminSetProgress,
  handleAdminRestartRun,
  handleBuySingularityUnlock,
} from './reducers/admin';
import {
  handleHydrate,
  handleDismissOfflineModal,
  handleSetTutorialDone,
  handleAwardSkillPoints,
  handleUnlockTrack,
  handleMarkTutorialFlag,
  handleMarkTutorialStageSeen,
  handleClearClickEvent,
  handleClearCollisionEvent,
  handleClearEncounterEvent,
} from './reducers/meta';

// ---------------------------------------------------------------------------
// Action union — exhaustive type for the switch below
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'HYDRATE'; payload: PersistentGameState; now: number }
  | { type: 'TICK'; now: number; dt: number }
  | {
      type: 'CLICK';
      now: number;
      randomValue: number;
      x: number;
      y: number;
      forceCrit?: boolean;
      gainMultiplier?: number;
      gainFlat?: number;
      entropyDelta?: number;
      quantaDelta?: number;
      mechanicChargeDelta?: number;
      mechanicStep?: number;
      trigger?: boolean;
    }
  | { type: 'BUY_CLICK' }
  | { type: 'BUY_AUTO' }
  | { type: 'BUY_CRIT' }
  | { type: 'START_CONDENSE'; now: number }
  | { type: 'ADVANCE_STAGE'; now: number }
  | { type: 'ADMIN_NEXT_STAGE'; now: number }
  | { type: 'ADMIN_PREV_STAGE'; now: number }
  | { type: 'ADMIN_SET_PROGRESS'; fraction: number; now: number }
  | { type: 'ADMIN_RESTART_RUN'; now: number }
  | { type: 'SELECT_ENDING'; endingId: EndingId; now: number }
  | { type: 'COMPLETE_ENDING'; now: number }
  | { type: 'BUY_SINGULARITY_UNLOCK'; unlockId: SingularityUnlockId }
  | { type: 'DISMISS_OFFLINE_MODAL' }
  | { type: 'REPORT_ENCOUNTER'; name: string; color: string }
  | {
      type: 'REPORT_COLLISION';
      x: number;
      y: number;
      bonus: number;
      entropyBonus: number;
      tier: RogueTypeKey;
      name: string;
    }
  | { type: 'CLEAR_CLICK_EVENT'; id: number }
  | { type: 'CLEAR_COLLISION_EVENT'; id: number }
  | { type: 'CLEAR_ENCOUNTER_EVENT'; id: number }
  | { type: 'SET_TUTORIAL_DONE' }
  | { type: 'PRESTIGE'; now: number }
  | { type: 'AWARD_SKILL_POINTS'; amount: number }
  | { type: 'BUY_TRACK_LEVEL'; trackId: 'click' | 'auto' | 'crit' | 'time' }
  | { type: 'BUY_CROSS_NODE'; nodeId: string }
  | { type: 'BUY_SHOP_ITEM'; itemId: string; now: number }
  | { type: 'UNLOCK_TRACK'; trackId: 'click' | 'auto' | 'crit' | 'time' }
  | { type: 'MARK_TUTORIAL_STAGE_SEEN'; stageId: number }
  | { type: 'MARK_TUTORIAL_FLAG'; flagId: string }
  | { type: 'PURCHASE_ENTITY'; entityId: string };

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

export function toPersistentState(state: GameState): PersistentGameState {
  return {
    stageIdx: state.stageIdx,
    quanta: state.quanta,
    timeGauge: state.timeGauge,
    clickLevel: state.clickLevel,
    autoLevel: state.autoLevel,
    critLevel: state.critLevel,
    entropy: state.entropy,
    totalClicks: state.totalClicks,
    collisions: state.collisions,
    universeCount: state.universeCount,
    cumulativeBoost: state.cumulativeBoost,
    runStartTime: state.runStartTime,
    totalTimePlayed: state.totalTimePlayed,
    pendingCondenseStageIdx: state.pendingCondenseStageIdx,
    pendingCondenseEntropy: state.pendingCondenseEntropy,
    completedRun: state.completedRun,
    condensedMass: state.condensedMass,
    echoes: state.echoes,
    singularityUnlocks: state.singularityUnlocks,
    endingsCompleted: state.endingsCompleted,
    lastEndingId: state.lastEndingId,
    selectedEndingId: state.selectedEndingId,
    lastSaveAt: state.lastSaveAt,
    stageStartedAt: state.stageStartedAt,
    cosmicClockSec: state.cosmicClockSec,
    mechanicCharge: state.mechanicCharge,
    mechanicStep: state.mechanicStep,
    mechanicTriggered: state.mechanicTriggered,
    tutorialDone: state.tutorialDone,
    cosmicHoursThisRun: state.cosmicHoursThisRun,
    dailyCheckIns: state.dailyCheckIns,
    skillPoints: state.skillPoints,
    skills: state.skills,
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: state.endingProgressFlags,
    clickRateLog: state.clickRateLog,
    condenseProgressHistory: state.condenseProgressHistory,
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: state.currentUniverseSeed,
    stageClicksAtStageStart: state.stageClicksAtStageStart,
    tutorialFlags: state.tutorialFlags,
    shopBoosts: state.shopBoosts,
    totalShopSpentUSD: state.totalShopSpentUSD,
    purchasedEntities: state.purchasedEntities,
  };
}

// ---------------------------------------------------------------------------
// Root reducer — routes actions to slice handlers
// ---------------------------------------------------------------------------

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'HYDRATE':               return handleHydrate(state, action);
    case 'TICK':                  return handleTick(state, action);
    case 'CLICK':                 return handleClick(state, action);
    case 'BUY_CLICK':             return handleBuyClick(state, action);
    case 'BUY_AUTO':              return handleBuyAuto(state, action);
    case 'BUY_CRIT':              return handleBuyCrit(state, action);
    case 'START_CONDENSE':        return handleStartCondense(state, action);
    case 'ADVANCE_STAGE':         return handleAdvanceStage(state, action);
    case 'SELECT_ENDING':         return handleSelectEnding(state, action);
    case 'COMPLETE_ENDING':       return handleCompleteEnding(state, action);
    case 'PRESTIGE':              return handlePrestige(state, action);
    case 'BUY_TRACK_LEVEL':       return handleBuyTrackLevel(state, action);
    case 'BUY_CROSS_NODE':        return handleBuyCrossNode(state, action);
    case 'BUY_SHOP_ITEM':         return handleBuyShopItem(state, action);
    case 'ADMIN_NEXT_STAGE':      return handleAdminNextStage(state, action);
    case 'ADMIN_PREV_STAGE':      return handleAdminPrevStage(state, action);
    case 'ADMIN_SET_PROGRESS':    return handleAdminSetProgress(state, action);
    case 'ADMIN_RESTART_RUN':     return handleAdminRestartRun(state, action);
    case 'BUY_SINGULARITY_UNLOCK': return handleBuySingularityUnlock(state, action);
    case 'DISMISS_OFFLINE_MODAL': return handleDismissOfflineModal(state);
    case 'REPORT_ENCOUNTER':      return handleReportEncounter(state, action);
    case 'REPORT_COLLISION':      return handleReportCollision(state, action);
    case 'CLEAR_CLICK_EVENT':     return handleClearClickEvent(state, action);
    case 'CLEAR_COLLISION_EVENT': return handleClearCollisionEvent(state, action);
    case 'CLEAR_ENCOUNTER_EVENT': return handleClearEncounterEvent(state, action);
    case 'SET_TUTORIAL_DONE':     return handleSetTutorialDone(state);
    case 'AWARD_SKILL_POINTS':    return handleAwardSkillPoints(state, action);
    case 'UNLOCK_TRACK':          return handleUnlockTrack(state, action);
    case 'MARK_TUTORIAL_STAGE_SEEN': return handleMarkTutorialStageSeen(state, action);
    case 'MARK_TUTORIAL_FLAG':    return handleMarkTutorialFlag(state, action);
    case 'PURCHASE_ENTITY':       return handlePurchaseEntity(state, action);
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
