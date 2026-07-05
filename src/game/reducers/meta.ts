/** Handlers: HYDRATE, DISMISS_OFFLINE_MODAL, SET_TUTORIAL_DONE, MARK_TUTORIAL_FLAG,
 *  MARK_CASH_SHOP_TUTORIAL_SEEN, MARK_TUTORIAL_STAGE_SEEN, AWARD_SKILL_POINTS,
 *  UNLOCK_TRACK, CLEAR_*_EVENT */

import type { GameState, PersistentGameState } from '../types';
import type { GameAction } from '../reducer';
import { getClaimableCodexSubsetIds } from '../entities/effects';
import { CODEX_SETS } from '../entities/codexSets';
import { findEntityById } from '../entities/stageItems';
import { addToAlmanac } from '../entities/drops';
import { nextEventId } from './helpers';
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
  // Codex repair: a card you OWN but whose discovery was never recorded showed as
  // collected in the panel (it counts ownership: `collectedSet.has(id) || countOf>0`) yet
  // would not complete/claim and its bonus would not apply (the claim gate + applyCollection
  // Rewards count almanacCollected only). Backfill the almanac from inventory so
  // "owning ⟹ discovered" — idempotent, self-heals existing saves on load.
  let almanacCollected = payload.almanacCollected ?? {};
  for (const inst of payload.inventory ?? []) {
    const ent = findEntityById(inst.entityId);
    if (ent) almanacCollected = addToAlmanac(almanacCollected, ent.stageId, ent.id);
  }
  return {
    ...payload,
    almanacCollected,
    combo: 0,
    lastClick: 0,
    imploding: false,
    condenseStartedAt: null,
    eventCounter: 0,
    lastClickEvent: null,
    lastAutoIncomeEvent: null,
    questProgress: {},
    lastCollisionEvent: null,
    lastEncounterEvent: null,
    lastFusionEvent: null,
    lastEnhanceEvent: null,
    lastQuestClaimEvent: null,
    lastGachaEvent: null,
    lastCrewPromoteEvent: null,
    lastDropEvent: null,
    lastCodexClaimEvent: null,
    offlineElapsedMs: 0,
    offlineGained: 0,
    offlineEntropyGained: 0,
    offlineTimeProgressGained: 0,
    offlineDailyStonesGained: 0,
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
    riftSlots: payload.riftSlots ?? [],
    unlockedRiftSlotCount: payload.unlockedRiftSlotCount ?? 1,
    codexSeenIds: payload.codexSeenIds ?? [],
    seenPanelHints: payload.seenPanelHints ?? [],
    enhanceStones: payload.enhanceStones ?? 0,
    // v30 강화 보호 charges — PERSISTED; ?? 0 guards a hand-built/pre-v30 payload.
    enhanceProtectCharges: payload.enhanceProtectCharges ?? 0,
    // v29 past-stage quest snapshots — PERSISTED, carried verbatim (default {}
    // only guards a hand-built payload that predates the field).
    stageQuestProgress: payload.stageQuestProgress ?? {},
    // v32 (P7) — PERSISTED; ?? 0 guards a hand-built/pre-v32 payload.
    echoSpent: payload.echoSpent ?? 0,
    fusionsSinceMythic: payload.fusionsSinceMythic ?? 0,
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
    offlineDailyStonesGained: 0,
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

type ClaimCodexSubsetAction = Extract<GameAction, { type: 'CLAIM_CODEX_SUBSET' }>;

/** #2 (v28): activate a COMPLETE codex subset's reward (click-to-claim). No-op if
 *  already claimed or not actually complete (defends against a stale UI click).
 *  Persona L: a successful claim fires the transient lastCodexClaimEvent (the
 *  collection-peak celebration), flagging isFullSet when this claim completed
 *  every subset of its parent set. Uses its own event id (nextEventId), mirroring
 *  the lastDropEvent reveal — transient, never persisted. */
export function handleClaimCodexSubset(state: GameState, action: ClaimCodexSubsetAction): GameState {
  if (state.claimedCodexSubsetIds.includes(action.subsetId)) return state;
  if (!getClaimableCodexSubsetIds(state.almanacCollected, state.claimedCodexSubsetIds).includes(action.subsetId)) {
    return state;
  }
  const claimed = [...state.claimedCodexSubsetIds, action.subsetId];
  // isFullSet: find the set owning this subset, then check every sibling subset
  // is now claimed (the claim above already includes this one). Subset ids are
  // globally unique across CODEX_SETS, so the first owning set is the only one.
  const parentSet = CODEX_SETS.find((set) => set.subsets.some((sub) => sub.id === action.subsetId));
  const isFullSet = parentSet ? parentSet.subsets.every((sub) => claimed.includes(sub.id)) : false;
  const eventId = nextEventId(state);
  return {
    ...state,
    claimedCodexSubsetIds: claimed,
    eventCounter: eventId,
    lastCodexClaimEvent: { id: eventId, subsetId: action.subsetId, isFullSet },
  };
}

type ClearCodexClaimEventAction = Extract<GameAction, { type: 'CLEAR_CODEX_CLAIM_EVENT' }>;
export function handleClearCodexClaimEvent(state: GameState, action: ClearCodexClaimEventAction): GameState {
  return state.lastCodexClaimEvent?.id === action.id ? { ...state, lastCodexClaimEvent: null } : state;
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

type ClearEnhanceEventAction = Extract<GameAction, { type: 'CLEAR_ENHANCE_EVENT' }>;
export function handleClearEnhanceEvent(state: GameState, action: ClearEnhanceEventAction): GameState {
  return state.lastEnhanceEvent?.id === action.id ? { ...state, lastEnhanceEvent: null } : state;
}

type ClearQuestClaimEventAction = Extract<GameAction, { type: 'CLEAR_QUEST_CLAIM_EVENT' }>;
export function handleClearQuestClaimEvent(state: GameState, action: ClearQuestClaimEventAction): GameState {
  return state.lastQuestClaimEvent?.id === action.id ? { ...state, lastQuestClaimEvent: null } : state;
}

type ClearGachaEventAction = Extract<GameAction, { type: 'CLEAR_GACHA_EVENT' }>;
export function handleClearGachaEvent(state: GameState, action: ClearGachaEventAction): GameState {
  return state.lastGachaEvent?.id === action.id ? { ...state, lastGachaEvent: null } : state;
}

type ClearDropEventAction = Extract<GameAction, { type: 'CLEAR_DROP_EVENT' }>;
export function handleClearDropEvent(state: GameState, action: ClearDropEventAction): GameState {
  return state.lastDropEvent?.id === action.id ? { ...state, lastDropEvent: null } : state;
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
