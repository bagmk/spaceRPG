/** Handlers: HYDRATE, DISMISS_OFFLINE_MODAL, SET_TUTORIAL_DONE, MARK_TUTORIAL_FLAG,
 *  MARK_CASH_SHOP_TUTORIAL_SEEN, MARK_TUTORIAL_STAGE_SEEN, AWARD_SKILL_POINTS,
 *  UNLOCK_TRACK, CLEAR_*_EVENT */

import type { GameState, PersistentGameState } from '../types';
import type { GameAction } from '../reducer';
import {
  createDefaultDailyCheckIns,
  createDefaultEndingProgressFlags,
  createDefaultUniverseAtlas,
  createDefaultCondenseProgressHistory,
  createDefaultUniverseSeed,
} from '../defaults';
import { createDefaultPrestigeUpgrades } from '../prestige';

type HydrateAction = Extract<GameAction, { type: 'HYDRATE' }>;
type MarkTutorialFlagAction = Extract<GameAction, { type: 'MARK_TUTORIAL_FLAG' }>;
type MarkTutorialStageSeenAction = Extract<GameAction, { type: 'MARK_TUTORIAL_STAGE_SEEN' }>;
type ClearClickEventAction = Extract<GameAction, { type: 'CLEAR_CLICK_EVENT' }>;
type ClearFusionEventAction = Extract<GameAction, { type: 'CLEAR_FUSION_EVENT' }>;
type ClearCollisionEventAction = Extract<GameAction, { type: 'CLEAR_COLLISION_EVENT' }>;
type ClearEncounterEventAction = Extract<GameAction, { type: 'CLEAR_ENCOUNTER_EVENT' }>;

function withHydratedTransient(payload: PersistentGameState): GameState {
  return {
    ...payload,
    combo: 0,
    lastClick: 0,
    imploding: false,
    condenseStartedAt: null,
    eventCounter: 0,
    lastClickEvent: null,
    lastCollisionEvent: null,
    lastEncounterEvent: null,
    lastFusionEvent: null,
    offlineElapsedMs: 0,
    offlineGained: 0,
    offlineEntropyGained: 0,
    offlineTimeProgressGained: 0,
    endingStartedAt: null,
    lastCondensedMassEarned: 0,
    lastCodexMassBonus: 0,
    tutorialDone: payload.tutorialDone ?? false,
    cosmicHoursThisRun: payload.cosmicHoursThisRun ?? 0,
    dailyCheckIns: payload.dailyCheckIns ?? createDefaultDailyCheckIns(),
    endingsUnlocked: payload.endingsUnlocked ?? [],
    endingProgressFlags: payload.endingProgressFlags ?? createDefaultEndingProgressFlags(),
    clickRateLog: payload.clickRateLog ?? [],
    condenseProgressHistory: payload.condenseProgressHistory ?? createDefaultCondenseProgressHistory(),
    universeAtlas: payload.universeAtlas ?? createDefaultUniverseAtlas(),
    currentUniverseSeed: payload.currentUniverseSeed ?? createDefaultUniverseSeed(),
    stageClicksAtStageStart: payload.stageClicksAtStageStart ?? payload.totalClicks ?? 0,
    tutorialFlags: payload.tutorialFlags ?? {},
    hasSeenCashShopTutorial: payload.hasSeenCashShopTutorial ?? false,
    timeGauge: payload.timeGauge ?? 0,
    shopBoosts: payload.shopBoosts ?? [],
    hasOfflineStorageUpgrade: payload.hasOfflineStorageUpgrade ?? false,
    totalShopSpentUSD: payload.totalShopSpentUSD ?? 0,
    prestigeUpgrades: payload.prestigeUpgrades ?? createDefaultPrestigeUpgrades(),
    peakEntropy: payload.peakEntropy ?? payload.entropy ?? 0,
    fusionPity: payload.fusionPity ?? 0,
    riftSlots: payload.riftSlots ?? [],
    unlockedRiftSlotCount: payload.unlockedRiftSlotCount ?? 1,
    codexSeenIds: payload.codexSeenIds ?? [],
    seenPanelHints: payload.seenPanelHints ?? [],
  };
}

export function handleHydrate(_state: GameState, action: HydrateAction): GameState {
  return withHydratedTransient(action.payload);
}

export function handleDismissOfflineModal(state: GameState): GameState {
  return {
    ...state,
    offlineElapsedMs: 0,
    offlineGained: 0,
    offlineEntropyGained: 0,
    offlineTimeProgressGained: 0,
  };
}

export function handleSetTutorialDone(state: GameState): GameState {
  return { ...state, tutorialDone: true };
}

export function handleMarkTutorialFlag(state: GameState, action: MarkTutorialFlagAction): GameState {
  if (state.tutorialFlags[action.flagId]) return state;
  return {
    ...state,
    tutorialFlags: { ...state.tutorialFlags, [action.flagId]: true },
  };
}

export function handleMarkCashShopTutorialSeen(state: GameState): GameState {
  if (state.hasSeenCashShopTutorial) return state;
  return { ...state, hasSeenCashShopTutorial: true };
}

type MarkPanelHintAction = Extract<GameAction, { type: 'MARK_PANEL_HINT' }>;

/** Snapshot every collected entity id as "seen" (clears the codex NEW badge). */
export function handleMarkCodexSeen(state: GameState): GameState {
  const seen = new Set<string>(state.codexSeenIds);
  for (const ids of Object.values(state.almanacCollected)) {
    for (const id of ids) seen.add(id);
  }
  if (seen.size === state.codexSeenIds.length) return state;
  return { ...state, codexSeenIds: [...seen] };
}

/** Record a first-visit panel hint as shown (idempotent). */
export function handleMarkPanelHint(state: GameState, action: MarkPanelHintAction): GameState {
  if (state.seenPanelHints.includes(action.hintId)) return state;
  return { ...state, seenPanelHints: [...state.seenPanelHints, action.hintId] };
}

export function handleMarkTutorialStageSeen(
  state: GameState,
  action: MarkTutorialStageSeenAction,
): GameState {
  if (state.tutorialFlags[action.stageId]) return state;
  return {
    ...state,
    tutorialFlags: { ...state.tutorialFlags, [action.stageId]: true },
  };
}

export function handleClearClickEvent(state: GameState, action: ClearClickEventAction): GameState {
  return state.lastClickEvent?.id === action.id ? { ...state, lastClickEvent: null } : state;
}

export function handleClearFusionEvent(state: GameState, action: ClearFusionEventAction): GameState {
  return state.lastFusionEvent?.id === action.id ? { ...state, lastFusionEvent: null } : state;
}

export function handleClearCollisionEvent(
  state: GameState,
  action: ClearCollisionEventAction,
): GameState {
  return state.lastCollisionEvent?.id === action.id
    ? { ...state, lastCollisionEvent: null }
    : state;
}

export function handleClearEncounterEvent(
  state: GameState,
  action: ClearEncounterEventAction,
): GameState {
  return state.lastEncounterEvent?.id === action.id
    ? { ...state, lastEncounterEvent: null }
    : state;
}
