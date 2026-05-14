/** Handlers: HYDRATE, DISMISS_OFFLINE_MODAL, SET_TUTORIAL_DONE, MARK_TUTORIAL_FLAG,
 *  MARK_TUTORIAL_STAGE_SEEN, AWARD_SKILL_POINTS, UNLOCK_TRACK, CLEAR_*_EVENT */

import type { GameState, PersistentGameState } from '../types';
import type { GameAction } from '../reducer';
import {
  createDefaultDailyCheckIns,
  createDefaultEndingProgressFlags,
  createDefaultUniverseAtlas,
  createDefaultCondenseProgressHistory,
  createDefaultUniverseSeed,
  createDefaultSkills,
} from '../defaults';

type HydrateAction = Extract<GameAction, { type: 'HYDRATE' }>;
type AwardSkillPointsAction = Extract<GameAction, { type: 'AWARD_SKILL_POINTS' }>;
type UnlockTrackAction = Extract<GameAction, { type: 'UNLOCK_TRACK' }>;
type MarkTutorialFlagAction = Extract<GameAction, { type: 'MARK_TUTORIAL_FLAG' }>;
type MarkTutorialStageSeenAction = Extract<GameAction, { type: 'MARK_TUTORIAL_STAGE_SEEN' }>;
type ClearClickEventAction = Extract<GameAction, { type: 'CLEAR_CLICK_EVENT' }>;
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
    offlineElapsedMs: 0,
    offlineGained: 0,
    offlineEntropyGained: 0,
    offlineTimeProgressGained: 0,
    endingStartedAt: null,
    tutorialDone: payload.tutorialDone ?? false,
    cosmicHoursThisRun: payload.cosmicHoursThisRun ?? 0,
    dailyCheckIns: payload.dailyCheckIns ?? createDefaultDailyCheckIns(),
    skillPoints: payload.skillPoints ?? 0,
    skills: payload.skills ?? createDefaultSkills(),
    endingsUnlocked: payload.endingsUnlocked ?? [],
    endingProgressFlags: payload.endingProgressFlags ?? createDefaultEndingProgressFlags(),
    clickRateLog: payload.clickRateLog ?? [],
    condenseProgressHistory: payload.condenseProgressHistory ?? createDefaultCondenseProgressHistory(),
    universeAtlas: payload.universeAtlas ?? createDefaultUniverseAtlas(),
    currentUniverseSeed: payload.currentUniverseSeed ?? createDefaultUniverseSeed(),
    stageClicksAtStageStart: payload.stageClicksAtStageStart ?? payload.totalClicks ?? 0,
    tutorialFlags: payload.tutorialFlags ?? {},
    timeGauge: payload.timeGauge ?? 0,
    shopBoosts: payload.shopBoosts ?? [],
    totalShopSpentUSD: payload.totalShopSpentUSD ?? 0,
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

export function handleAwardSkillPoints(state: GameState, action: AwardSkillPointsAction): GameState {
  return { ...state, skillPoints: Math.max(0, state.skillPoints + action.amount) };
}

export function handleUnlockTrack(state: GameState, action: UnlockTrackAction): GameState {
  if (state.skills.unlockedTracks.includes(action.trackId)) return state;
  return {
    ...state,
    skills: {
      ...state.skills,
      unlockedTracks: [...state.skills.unlockedTracks, action.trackId],
    },
  };
}

export function handleMarkTutorialFlag(state: GameState, action: MarkTutorialFlagAction): GameState {
  if (state.tutorialFlags[action.flagId]) return state;
  return {
    ...state,
    tutorialFlags: { ...state.tutorialFlags, [action.flagId]: true },
  };
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
