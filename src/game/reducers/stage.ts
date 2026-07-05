/** Handlers: START_CONDENSE, ADVANCE_STAGE, SELECT_ENDING, COMPLETE_ENDING, PRESTIGE */

import { STAGES } from '../stages';
import {
  canCondense,
  getEffectiveThreshold,
  getEntropyGateFloor,
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
import { pickActiveQuests, refillActiveQuests, snapshotStageQuestProgress } from '../quests';
import { CREW_ROSTER } from '../crew/roster';
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

// Panel #7 (A): computeCarriedInventory was removed — prestige RESETS the inventory
// (handlePrestige below), so computing "carried items" was dead + powered a false
// "장비 이월" promise on the FinalScreen. Only bonuses carry across prestige.

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
  const effectiveThreshold = getEffectiveThreshold(stage);
  if (!canCondense(state)) return state;

  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Span-bounded condense award (was 10% of the runaway matter wallet → "+24.75 GB").
  const earned = getEntropyOnCondense(state.quanta, state.stageIdx) * entropyEchoMult;
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
  // v29: FREEZE the leaving stage's active-quest progress BEFORE the per-stage
  // counters reset below — so a past-stage tab can show "{snap}/{target}" and a
  // quest that hit its target but wasn't claimed stays claimable later. The
  // leaving stage's id = current stageIdx + 1.
  const leavingStageId = progressedState.stageIdx + 1;
  const stageQuestProgress = snapshotStageQuestProgress(progressedState, leavingStageId);
  const nextCosmicClockSec = stage.cosmicTimeSec;
  const nextTimeGauge = getTimeGaugeForCosmicClock(nextStageIdx, nextCosmicClockSec);
  const nextState = {
    ...progressedState,
    stageIdx: nextStageIdx,
    // Overhaul-3 pacing fix: park cumulative entropy at the NEW stage's gate floor
    // (= the stage we just cleared's threshold), exactly as the debug NEXT_STAGE
    // path does (admin.ts). Previously the condense bonus (getEntropyOnCondense =
    // quanta × 0.1, wallet-inflated to ~1e13+ late-game) was added at START_CONDENSE
    // and CARRIED here — overshooting every remaining gate at once, so one condense
    // chain-jumped to the end. Resetting to the floor means each stage's gate is
    // filled only by in-stage gameplay income (what the sim calibrates), and the
    // next gate starts at 0%.
    entropy: getEntropyGateFloor(nextStageIdx),
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
    fusionsThisStage: 0,
    cometsThisStage: 0,
    comboThisStage: 0,
    condenseBurstThisStage: 0,
    // v29: carry the frozen snapshot of the stage we just left.
    stageQuestProgress,
    // 🅠5: top up the active quest set with any quests newly eligible at this stage.
    activeQuests: refillActiveQuests(progressedState.activeQuests, progressedState.completedQuestIds, nextStageId),
    // OVERHAUL5: crew scheduled for the NEW stage join (free, at common), and
    // their join beats queue for the dialogue bubble — every stage opens with
    // new companions instead of a reskinned item template.
    ...joinCrewForStage(progressedState, nextStageId),
  };
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({ ...nextState, ...resetMechanicState(nextState) }));
}

/**
 * OVERHAUL5: crew + join-beat queue updates when the player reaches `stageId`.
 * Crew scheduled for THIS stage join with a dialogue beat; any stragglers from
 * earlier stages (multi-stage debug jumps) catch up silently.
 */
export function joinCrewForStage(
  state: GameState,
  stageId: number,
): Pick<GameState, 'crew' | 'pendingCrewJoinIds'> {
  const joining = CREW_ROSTER.filter((c) => c.joinStage <= stageId && !state.crew[c.id]);
  if (joining.length === 0) return { crew: state.crew, pendingCrewJoinIds: state.pendingCrewJoinIds };
  const crew = { ...state.crew };
  for (const def of joining) crew[def.id] = { tier: 'common', level: 1 };
  const beats = joining.filter((c) => c.joinStage === stageId).map((c) => c.id);
  return {
    crew,
    pendingCrewJoinIds: beats.length > 0 ? [...state.pendingCrewJoinIds, ...beats] : state.pendingCrewJoinIds,
  };
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
    // S fix (user: "다음 빅뱅이라 기억 제거 — 아이템 들고가면 안 되지, 들고가는 건 보너스만"):
    // INVENTORY now RESETS — items do NOT carry. Only BONUSES carry: prestige upgrades +
    // the codex/almanac collection bonuses (almanac survives, those completion modifiers ARE
    // the "bonuses"). Equip slots stay empty (resetState).
    almanacCollected: state.almanacCollected,
    inventory: resetState.inventory,
    // 🅠5: completed quests are once-only (survive prestige); active quests reset
    // to a fresh stage-1 set (excluding the carried completed ones).
    completedQuestIds: state.completedQuestIds,
    favoriteEntityIds: resetState.favoriteEntityIds, // item-tied → reset with the inventory
    claimedCodexSubsetIds: state.claimedCodexSubsetIds,
    attendanceStreak: state.attendanceStreak,
    attendanceClaimedDate: state.attendanceClaimedDate,
    activeQuests: pickActiveQuests(state.completedQuestIds, 1),
    tutorialFlags: state.tutorialFlags,
    hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
    hasOfflineStorageUpgrade: state.hasOfflineStorageUpgrade,
    shopBoosts: state.shopBoosts,
    totalShopSpentUSD: state.totalShopSpentUSD,
    prestigeUpgrades: state.prestigeUpgrades,
    // P7: 특이점 잔향 SPEND and the mythic pity counter are cross-prestige metas — the
    // resetState spread zeros them, so carry EXPLICITLY (echoSpent wipe would silently
    // refund every Resonance Core level; pity is a standard gacha global).
    echoSpent: state.echoSpent,
    fusionsSinceMythic: state.fusionsSinceMythic,
    // OVERHAUL5: crew are THE persistent layer ("크루는 프레스티지에도 생존" — the
    // attachment anchor; items reset, companions don't). Cards are collection
    // meta like the almanac, so they carry too. No join-beat replays (crew
    // already joined — resetState's stage-1 beats would double-greet).
    crew: state.crew,
    cardInventory: state.cardInventory,
    pendingCrewJoinIds: [],
    // Daily shop is a real-calendar-day construct, not run-scoped — carry it so
    // prestige can't be used to re-roll/re-buy the day's offers.
    dailyShopDateKey: state.dailyShopDateKey,
    dailyShopRefreshCount: state.dailyShopRefreshCount,
    dailyShopPurchased: state.dailyShopPurchased,
  };
}
