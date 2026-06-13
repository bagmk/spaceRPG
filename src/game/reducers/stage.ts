/** Handlers: START_CONDENSE, ADVANCE_STAGE, SELECT_ENDING, COMPLETE_ENDING, PRESTIGE */

import { STAGES } from '../stages';
import {
  canCondense,
  getEffectiveThreshold,
  getEntropyOnCondense,
  getProgress,
  getTimeGaugeForCosmicClock,
  getCodexMassBonusFactor,
  getCondensedMassReward,
  getEchoReward,
} from '../formulas';
import { getPrestigeMultiplier } from '../prestige';
import {
  generateUniverseSeed,
  getEndingOptions,
  withCurrentUniverseEndingProgress,
} from '../multiverse';
import { createInitialGameState } from '../defaults';
import { findEntityById } from '../entities/stageItems';
import { getEquipCategory, type EntityInstance, type EntityRarity } from '../entities/types';
import { PRESTIGE_CARRY_COUNT_CAP } from '../balance';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import {
  getCurrentStage,
  resetMechanicState,
  recordLateStageClickRate,
  buildAtlasEntry,
} from './helpers';
import { createDefaultEndingProgressFlags } from '../defaults';
import { syncSlotUnlocks } from './entities';

const RARITY_RANK: Record<EntityRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/**
 * Prestige carry (Phase 4-3 D2): keep the single best click-gear item AND the
 * single best rift-gear item across prestige (highest rarity, ties by level
 * then count). Matches the fresh universe's 1+1 starting slots so nothing is
 * wasted. The carried stack keeps its LEVEL but its power is stripped to the
 * player's stage (carried:true → getGearPowerExponent), so it's a head start,
 * never an origin-stage cudgel. Count is clamped and the id canonicalized here
 * (this bypasses the load-time normalize/clamp passes). Equip/rift slots are
 * NOT carried — re-equipping is a deliberate player action.
 */
export function computeCarriedInventory(inventory: EntityInstance[]): EntityInstance[] {
  type Candidate = { entry: EntityInstance; rank: number };
  let bestClick: Candidate | null = null;
  let bestRift: Candidate | null = null;
  for (const entry of inventory) {
    if (entry.count <= 0) continue;
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;
    const rank = RARITY_RANK[entity.rarity] ?? 0;
    const isRift = getEquipCategory(entity) === 'rift';
    const cur: Candidate | null = isRift ? bestRift : bestClick;
    const better =
      cur === null ||
      rank > cur.rank ||
      (rank === cur.rank && entry.level > cur.entry.level) ||
      (rank === cur.rank && entry.level === cur.entry.level && entry.count > cur.entry.count);
    if (better) {
      const winner: Candidate = { entry, rank };
      if (isRift) bestRift = winner; else bestClick = winner;
    }
  }
  const carried: EntityInstance[] = [];
  for (const best of [bestClick, bestRift]) {
    if (!best) continue;
    const canonicalId = findEntityById(best.entry.entityId)?.id ?? best.entry.entityId;
    carried.push({
      entityId: canonicalId,
      count: Math.min(best.entry.count, PRESTIGE_CARRY_COUNT_CAP),
      level: best.entry.level,
      carried: true,
    });
  }
  return carried;
}

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
    clickRateLog: nextClickRateLog,
    stageClicksAtStageStart: progressedState.totalClicks,
  };
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({ ...nextState, ...resetMechanicState(nextState) }));
}

export function handleSelectEnding(state: GameState, action: SelectEndingAction): GameState {
  if (!state.completedRun) {
    const stage = getCurrentStage(state);
    // Entropy gate (D1): the final stage's ending unlocks like any other condense.
    if (stage.id !== STAGES.length || state.entropy < stage.entropyThreshold) {
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
  const massEarned = getCondensedMassReward(
    state.entropy, state.selectedEndingId, state.universeCount, state.almanacCollected,
  );
  return {
    ...state,
    completedRun: true,
    condensedMass: state.condensedMass + massEarned,
    // Transient display breakdown for the final screen (base × codex = total).
    lastCondensedMassEarned: massEarned,
    lastCodexMassBonus: getCodexMassBonusFactor(state.almanacCollected),
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
    totalClicks: state.totalClicks,
    totalTimePlayed: state.totalTimePlayed,
    peakEntropy: state.peakEntropy,
    singularityUnlocks: state.singularityUnlocks,
    endingsCompleted: state.endingsCompleted,
    lastEndingId: null,
    endingsUnlocked: state.endingsUnlocked,
    endingProgressFlags: createDefaultEndingProgressFlags(),
    universeAtlas: state.universeAtlas,
    currentUniverseSeed: nextSeed,
    // Almanac survives prestige (D2); the best click + rift item carry over
    // (power stripped to the player's stage). Equip slots stay empty.
    almanacCollected: state.almanacCollected,
    inventory: computeCarriedInventory(state.inventory),
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    shopBoosts: state.shopBoosts,
    totalShopSpentUSD: state.totalShopSpentUSD,
    prestigeUpgrades: state.prestigeUpgrades,
  };
}
