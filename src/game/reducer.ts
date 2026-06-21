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
import type { PrestigeUpgradeId } from './prestige';
import { TUNING } from './constants';

// Re-export so callers get everything they need from one import.
export { createInitialGameState, createDefaultSkills } from './defaults';

// Slice handlers
import {
  handleTick,
  handleClick,
  handleAbsorbComet,
  handleReportEncounter,
} from './reducers/gameplay';
import {
  handleStartCondense,
  handleAdvanceStage,
  handleSelectEnding,
  handleCompleteEnding,
  handlePrestige,
} from './reducers/stage';
import { handleBuyCopyToken, handleEnhanceEntity, handleEquipEntity, handleFuseEntities, handleFuseBatch, handlePurchaseEntity, handleToggleFavorite, handleUnequipEntity } from './reducers/entities';
import { handleClaimQuest } from './reducers/quests';
import { handleClaimAdReward, handleCompleteShopPurchase, handleResumeBoosts, handleBuyEnhanceStones, handleBuyDailyItem, handleRefreshDailyShop, handleSyncDailyShop, handleOpenGachaBox, handleClaimAttendance } from './reducers/shop';
import {
  handleAdminNextStage,
  handleAdminPrevStage,
  handleAdminSetProgress,
  handleAdminRestartRun,
  handleAdminMaxEntities,
  handleBuySingularityUnlock,
  handleBuyPrestigeUpgrade,
} from './reducers/admin';
import {
  handleHydrate,
  handleDismissOfflineModal,
  handleSetTutorialDone,
  handleMarkTutorialFlag,
  handleMarkCashShopTutorialSeen,
  handleMarkCodexSeen,
  handleMarkPanelHint,
  handleMarkTutorialStageSeen,
  handleClearClickEvent,
  handleClearFusionEvent,
  handleClearEnhanceEvent,
  handleClearQuestClaimEvent,
  handleClearGachaEvent,
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
      /** 0..1 rolls for the entity drop system — omit to disable drops (tests). */
      dropRoll?: number;
      dropPickRoll?: number;
      /** 0..1 — which stage's pool the drop comes from (absent → current stage). */
      dropStageRoll?: number;
      /** #50 — two 0..1 rolls → gaussian quality for a dropped copy (absent → neutral). */
      qualityRoll1?: number;
      qualityRoll2?: number;
    }
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
      // 🅠2: comets are absorbed by CLICKING them (was: drifting into the core).
      type: 'ABSORB_COMET';
      x: number;
      y: number;
      bonus: number;
      entropyBonus: number;
      tier: RogueTypeKey;
      name: string;
      /** 0..1 rolls for the entity drop system — omit to disable drops (tests). */
      dropRoll?: number;
      dropPickRoll?: number;
      /** 0..1 — which stage's pool the drop comes from (absent → current stage). */
      dropStageRoll?: number;
      /** #50 — two 0..1 rolls → gaussian quality for a dropped copy (absent → neutral). */
      qualityRoll1?: number;
      qualityRoll2?: number;
    }
  | { type: 'CLEAR_CLICK_EVENT'; id: number }
  | { type: 'CLEAR_COLLISION_EVENT'; id: number }
  | { type: 'CLEAR_ENCOUNTER_EVENT'; id: number }
  | { type: 'SET_TUTORIAL_DONE' }
  | { type: 'PRESTIGE'; now: number }
  | { type: 'COMPLETE_SHOP_PURCHASE'; itemId: string; now: number; viaRestore?: boolean }
  | { type: 'CLAIM_AD_REWARD'; rewardId: string; now: number }
  | { type: 'RESUME_BOOSTS'; hiddenMs: number }
  | { type: 'MARK_TUTORIAL_STAGE_SEEN'; stageId: number }
  | { type: 'MARK_TUTORIAL_FLAG'; flagId: string }
  | { type: 'MARK_CASH_SHOP_TUTORIAL_SEEN' }
  | { type: 'MARK_CODEX_SEEN' }
  | { type: 'MARK_PANEL_HINT'; hintId: string }
  | { type: 'PURCHASE_ENTITY'; entityId: string; qualityRoll1?: number; qualityRoll2?: number }
  | { type: 'EQUIP_ENTITY'; entityId: string; slot?: number; wild?: boolean }
  | { type: 'UNEQUIP_ENTITY'; slot: number; target?: 'click' | 'rift' | 'wild' }
  | { type: 'FUSE_ENTITIES'; inputEntityIds: string[]; rarityRoll: number; pickRoll: number; stageRoll?: number; qualityRoll?: number }
  // 🅠4: batch fusion — inputEntityIds is FUSION_INPUT_COUNT × rolls.length copies
  // the UI drew from inventory; one roll-set per trio. The reducer loops via fuseOnce.
  | { type: 'FUSE_BATCH'; inputEntityIds: string[]; rolls: { rarityRoll: number; pickRoll: number; stageRoll: number; qualityRoll?: number }[] }
  | { type: 'ENHANCE_ENTITY'; instanceId: string }
  | { type: 'BUY_COPY_TOKEN'; entityId: string; currency: 'matter' | 'stone' }
  | { type: 'TOGGLE_FAVORITE'; entityId: string }
  | { type: 'CLAIM_QUEST'; questId: string }
  | { type: 'CLEAR_FUSION_EVENT'; id: number }
  | { type: 'CLEAR_ENHANCE_EVENT'; id: number }
  | { type: 'CLEAR_QUEST_CLAIM_EVENT'; id: number }
  | { type: 'CLEAR_GACHA_EVENT'; id: number }
  | { type: 'ADMIN_MAX_ENTITIES' }
  | { type: 'BUY_PRESTIGE_UPGRADE'; upgradeId: PrestigeUpgradeId }
  | { type: 'BUY_ENHANCE_STONES'; count: number }
  | { type: 'CLAIM_ATTENDANCE'; now: number }
  | { type: 'BUY_DAILY_ITEM'; slot: number; now: number }
  | { type: 'REFRESH_DAILY_SHOP'; now: number }
  // #43 gacha: rolls injected at dispatch (Math.random()) so the reducer stays pure.
  | { type: 'OPEN_GACHA_BOX'; boxId: string; rolls: Array<{ rarityRoll: number; stageRoll: number; pickRoll: number; q1: number; q2: number }>; stoneRoll: number }
  | { type: 'SYNC_DAILY_SHOP'; now: number };

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

export function toPersistentState(state: GameState): PersistentGameState {
  return {
    stageIdx: state.stageIdx,
    quanta: state.quanta,
    timeGauge: state.timeGauge,
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
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: state.endingProgressFlags,
    clickRateLog: state.clickRateLog.slice(-TUNING.HISTORY_CAPS.clickRateLog),
    condenseProgressHistory: state.condenseProgressHistory.slice(-TUNING.HISTORY_CAPS.condenseProgressHistory),
    universeAtlas: state.universeAtlas.slice(-TUNING.HISTORY_CAPS.universeAtlas),
    currentUniverseSeed: state.currentUniverseSeed,
    stageClicksAtStageStart: state.stageClicksAtStageStart,
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    shopBoosts: state.shopBoosts,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    totalShopSpentUSD: state.totalShopSpentUSD,
    inventory: state.inventory,
    equippedSlots: state.equippedSlots,
    unlockedSlotCount: state.unlockedSlotCount,
    riftSlots: state.riftSlots,
    unlockedRiftSlotCount: state.unlockedRiftSlotCount,
    wildSlot: state.wildSlot,
    almanacCollected: state.almanacCollected,
    prestigeUpgrades: state.prestigeUpgrades,
    peakEntropy: state.peakEntropy,
    codexSeenIds: state.codexSeenIds,
    seenPanelHints: state.seenPanelHints,
    enhanceStones: state.enhanceStones,
    activeQuests: state.activeQuests,
    completedQuestIds: state.completedQuestIds,
    favoriteEntityIds: state.favoriteEntityIds,
    attendanceStreak: state.attendanceStreak,
    attendanceClaimedDate: state.attendanceClaimedDate,
    dailyShopDateKey: state.dailyShopDateKey,
    dailyShopRefreshCount: state.dailyShopRefreshCount,
    dailyShopPurchased: state.dailyShopPurchased,
    fusionsThisStage: state.fusionsThisStage,
    cometsThisStage: state.cometsThisStage,
    comboThisStage: state.comboThisStage,
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
    case 'START_CONDENSE':        return handleStartCondense(state, action);
    case 'ADVANCE_STAGE':         return handleAdvanceStage(state, action);
    case 'SELECT_ENDING':         return handleSelectEnding(state, action);
    case 'COMPLETE_ENDING':       return handleCompleteEnding(state, action);
    case 'PRESTIGE':              return handlePrestige(state, action);
    case 'COMPLETE_SHOP_PURCHASE': return handleCompleteShopPurchase(state, action);
    case 'CLAIM_AD_REWARD':       return handleClaimAdReward(state, action);
    case 'RESUME_BOOSTS':         return handleResumeBoosts(state, action);
    case 'BUY_ENHANCE_STONES':    return handleBuyEnhanceStones(state, action);
    case 'CLAIM_ATTENDANCE':      return handleClaimAttendance(state, action);
    case 'BUY_DAILY_ITEM':        return handleBuyDailyItem(state, action);
    case 'REFRESH_DAILY_SHOP':    return handleRefreshDailyShop(state, action);
    case 'OPEN_GACHA_BOX':        return handleOpenGachaBox(state, action);
    case 'SYNC_DAILY_SHOP':       return handleSyncDailyShop(state, action);
    case 'ADMIN_NEXT_STAGE':      return handleAdminNextStage(state, action);
    case 'ADMIN_PREV_STAGE':      return handleAdminPrevStage(state, action);
    case 'ADMIN_SET_PROGRESS':    return handleAdminSetProgress(state, action);
    case 'ADMIN_RESTART_RUN':     return handleAdminRestartRun(state, action);
    case 'ADMIN_MAX_ENTITIES':    return handleAdminMaxEntities(state);
    case 'BUY_SINGULARITY_UNLOCK': return handleBuySingularityUnlock(state, action);
    case 'DISMISS_OFFLINE_MODAL': return handleDismissOfflineModal(state);
    case 'REPORT_ENCOUNTER':      return handleReportEncounter(state, action);
    case 'ABSORB_COMET':          return handleAbsorbComet(state, action);
    case 'CLEAR_CLICK_EVENT':     return handleClearClickEvent(state, action);
    case 'CLEAR_COLLISION_EVENT': return handleClearCollisionEvent(state, action);
    case 'CLEAR_ENCOUNTER_EVENT': return handleClearEncounterEvent(state, action);
    case 'SET_TUTORIAL_DONE':     return handleSetTutorialDone(state);
    case 'MARK_TUTORIAL_STAGE_SEEN': return handleMarkTutorialStageSeen(state, action);
    case 'MARK_TUTORIAL_FLAG':    return handleMarkTutorialFlag(state, action);
    case 'MARK_CASH_SHOP_TUTORIAL_SEEN': return handleMarkCashShopTutorialSeen(state);
    case 'MARK_CODEX_SEEN':       return handleMarkCodexSeen(state);
    case 'MARK_PANEL_HINT':       return handleMarkPanelHint(state, action);
    case 'PURCHASE_ENTITY':       return handlePurchaseEntity(state, action);
    case 'EQUIP_ENTITY':          return handleEquipEntity(state, action);
    case 'UNEQUIP_ENTITY':        return handleUnequipEntity(state, action);
    case 'FUSE_ENTITIES':         return handleFuseEntities(state, action);
    case 'FUSE_BATCH':            return handleFuseBatch(state, action);
    case 'CLAIM_QUEST':           return handleClaimQuest(state, action);
    case 'ENHANCE_ENTITY':        return handleEnhanceEntity(state, action);
    case 'BUY_COPY_TOKEN':        return handleBuyCopyToken(state, action);
    case 'TOGGLE_FAVORITE':       return handleToggleFavorite(state, action);
    case 'CLEAR_FUSION_EVENT':    return handleClearFusionEvent(state, action);
    case 'CLEAR_ENHANCE_EVENT':   return handleClearEnhanceEvent(state, action);
    case 'CLEAR_QUEST_CLAIM_EVENT': return handleClearQuestClaimEvent(state, action);
    case 'CLEAR_GACHA_EVENT':     return handleClearGachaEvent(state, action);
    case 'BUY_PRESTIGE_UPGRADE':  return handleBuyPrestigeUpgrade(state, action);
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
