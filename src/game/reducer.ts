import { SINGULARITY_UNLOCK_LOOKUP, TUNING } from './constants';
import {
  getAutoCost,
  getAutoRate,
  getClickCost,
  getClickPower,
  getComboMult,
  getCondensedMassReward,
  getCritChance,
  getCritCost,
  getCritMultiplier,
  getEchoReward,
  getEffectiveThreshold,
  getEntropyOnCondense,
  getLifeStep,
  getProgress,
  getUniverseBoost,
  safeAdd,
} from './formulas';
import { getMechanic } from './mechanics';
import { STAGES } from './stages';
import { getCosmicTimePerRealSec, getStageStartCosmicTime } from './timeFlow';
import type {
  EncounterEvent,
  EndingId,
  FloatingClickEvent,
  FloatingCollisionEvent,
  GameState,
  PersistentGameState,
  RogueTypeKey,
  SingularityUnlockId,
} from './types';

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
  | { type: 'ADMIN_RESTART_RUN'; now: number }
  | { type: 'SPEND_DARK_AGE_SKIP' }
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
  | { type: 'PRESTIGE'; now: number };

export function createInitialGameState(now: number): GameState {
  return {
    stageIdx: 0,
    quanta: 0,
    clickLevel: 0,
    autoLevel: 0,
    critLevel: 0,
    entropy: 0,
    totalClicks: 0,
    collisions: 0,
    universeCount: 1,
    cumulativeBoost: 0,
    runStartTime: now,
    totalTimePlayed: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    completedRun: false,
    condensedMass: 0,
    echoes: 0,
    singularityUnlocks: [],
    endingsCompleted: [],
    lastEndingId: null,
    selectedEndingId: null,
    lastSaveAt: now,
    stageStartedAt: now,
    cosmicClockSec: getStageStartCosmicTime(0),
    mechanicCharge: 0,
    mechanicStep: 0,
    mechanicTriggered: false,
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
    endingStartedAt: null,
  };
}

export function toPersistentState(state: GameState): PersistentGameState {
  return {
    stageIdx: state.stageIdx,
    quanta: state.quanta,
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
  };
}

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
    endingStartedAt: null,
  };
}

function getCurrentStage(state: GameState) {
  return STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
}

function getPreviousStage(state: GameState) {
  return state.stageIdx > 0 ? STAGES[state.stageIdx - 1] : null;
}

function nextEventId(state: GameState): number {
  return state.eventCounter + 1;
}

function createClickEvent(
  id: number,
  x: number,
  y: number,
  gained: number,
  isCrit: boolean,
  combo: number,
  comboMult: number,
): FloatingClickEvent {
  return { id, x, y, gained, isCrit, combo, comboMult };
}

function createCollisionEvent(
  id: number,
  x: number,
  y: number,
  bonus: number,
  name: string,
  tier: RogueTypeKey,
): FloatingCollisionEvent {
  return { id, x, y, bonus, name, tier };
}

function createEncounterEvent(id: number, name: string, color: string): EncounterEvent {
  return { id, name, color };
}

function hasUnlock(state: GameState, unlockId: SingularityUnlockId): boolean {
  return state.singularityUnlocks.includes(unlockId);
}

function getComboCapBonus(state: GameState): number {
  return hasUnlock(state, 'free_combo') ? 2 : 0;
}

function getLateStageCompression(state: GameState): number {
  return hasUnlock(state, 'red_shift') && state.stageIdx >= 10 && state.stageIdx <= 14 ? 1.5 : 1;
}

function getEncounterRewardMultiplier(state: GameState): number {
  return hasUnlock(state, 'cosmic_web') ? 2 : 1;
}

function getAdjustedClickPower(state: GameState): number {
  const stage = getCurrentStage(state);
  const base = getClickPower(stage, state.clickLevel, state.cumulativeBoost);
  return hasUnlock(state, 'quark_foam') ? base + state.clickLevel + 1 : base;
}

function resetMechanicState(state: GameState): Pick<GameState, 'mechanicCharge' | 'mechanicStep' | 'mechanicTriggered'> {
  if (getCurrentStage(state).mechanic === 'remnant_cooling') {
    return { mechanicCharge: 0, mechanicStep: 0, mechanicTriggered: false };
  }
  return { mechanicCharge: 0, mechanicStep: 0, mechanicTriggered: false };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'HYDRATE':
      return withHydratedTransient(action.payload);
    case 'TICK': {
      const stage = getCurrentStage(state);
      const previousStage = getPreviousStage(state);
      const shouldEndImplosion =
        state.imploding &&
        state.condenseStartedAt !== null &&
        action.now - state.condenseStartedAt >= TUNING.CONDENSE_IMPLOSION_MS;
      const shouldClearCombo =
        state.combo > 0 && action.now - state.lastClick >= TUNING.COMBO_CLEAR_MS;
      const canAccrue =
        !state.completedRun &&
        state.pendingCondenseStageIdx === null &&
        !state.imploding &&
        state.selectedEndingId === null;
      const progress = getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost));
      const autoRate = getAutoRate(stage, state.autoLevel, state.cumulativeBoost);
      const stageAutoBonus =
        stage.mechanic === 'reionization'
          ? autoRate * state.mechanicCharge * 0.5
          : stage.mechanic === 'first_stars'
            ? autoRate * Math.min(1.5, state.mechanicCharge * 0.12)
            : 0;
      const gained = canAccrue ? ((autoRate + stageAutoBonus) * action.dt) / 1000 : 0;
      const mechanic = getMechanic(stage.mechanic);
      const tickResult =
        canAccrue && mechanic.onTick
          ? mechanic.onTick({ state, stage, now: action.now, progress01: progress })
          : null;
      const rawClockRate =
        getCosmicTimePerRealSec(stage, previousStage, progress) * getLateStageCompression(state);
      const cosmicClockSec = state.completedRun
        ? state.cosmicClockSec
        : Math.min(
            stage.cosmicTimeSec,
            safeAdd(state.cosmicClockSec, (action.dt / 1000) * rawClockRate),
          );
      return {
        ...state,
        quanta: safeAdd(state.quanta, gained + (tickResult?.quantaDelta ?? 0)),
        entropy: safeAdd(state.entropy, tickResult?.entropyDelta ?? 0),
        totalTimePlayed: state.completedRun ? state.totalTimePlayed : state.totalTimePlayed + action.dt,
        combo: shouldClearCombo ? 0 : state.combo,
        imploding: shouldEndImplosion ? false : state.imploding,
        cosmicClockSec,
        mechanicCharge: Math.max(0, state.mechanicCharge + (tickResult?.mechanicChargeDelta ?? 0)),
        mechanicStep: tickResult?.mechanicStep ?? state.mechanicStep,
        mechanicTriggered: state.mechanicTriggered || Boolean(tickResult?.trigger),
      };
    }
    case 'CLICK': {
      if (
        state.completedRun ||
        state.pendingCondenseStageIdx !== null ||
        state.imploding ||
        state.selectedEndingId !== null
      ) {
        return state;
      }
      const stage = getCurrentStage(state);
      const combo =
        action.now - state.lastClick < TUNING.COMBO_TIMEOUT_MS ? state.combo + 1 : 1;
      const clickPower = getAdjustedClickPower(state);
      const comboMult = getComboMult(combo, getComboCapBonus(state));
      const isCrit = action.forceCrit === true || action.randomValue < getCritChance(combo);
      const critMult = isCrit ? getCritMultiplier(state.critLevel) : 1;
      const gainMultiplier = action.gainMultiplier ?? 1;
      const gained = Math.floor(clickPower * comboMult * critMult * gainMultiplier + (action.gainFlat ?? 0));
      const eventId = nextEventId(state);
      const nextQuanta = safeAdd(state.quanta, gained + (action.quantaDelta ?? 0));
      const nextProgress = getProgress(nextQuanta, getEffectiveThreshold(stage, state.cumulativeBoost));
      return {
        ...state,
        quanta: nextQuanta,
        entropy: safeAdd(state.entropy, action.entropyDelta ?? 0),
        totalClicks: state.totalClicks + 1,
        combo,
        lastClick: action.now,
        eventCounter: eventId,
        lastClickEvent: createClickEvent(
          eventId,
          action.x,
          action.y,
          gained,
          isCrit,
          combo,
          comboMult,
        ),
        mechanicCharge: Math.max(0, state.mechanicCharge + (action.mechanicChargeDelta ?? 0)),
        mechanicStep: action.mechanicStep ?? (stage.mechanic === 'life_evolution' ? getLifeStep(nextProgress) : state.mechanicStep),
        mechanicTriggered: state.mechanicTriggered || Boolean(action.trigger),
      };
    }
    case 'BUY_CLICK': {
      if (
        state.completedRun ||
        state.pendingCondenseStageIdx !== null ||
        state.imploding ||
        state.selectedEndingId !== null
      ) {
        return state;
      }
      const stage = getCurrentStage(state);
      const cost = getClickCost(stage, state.clickLevel);
      if (state.quanta < cost) {
        return state;
      }
      return {
        ...state,
        quanta: state.quanta - cost,
        clickLevel: state.clickLevel + 1,
      };
    }
    case 'BUY_AUTO': {
      if (
        state.completedRun ||
        state.pendingCondenseStageIdx !== null ||
        state.imploding ||
        state.selectedEndingId !== null
      ) {
        return state;
      }
      const stage = getCurrentStage(state);
      const cost = getAutoCost(stage, state.autoLevel);
      if (state.quanta < cost) {
        return state;
      }
      return {
        ...state,
        quanta: state.quanta - cost,
        autoLevel: state.autoLevel + 1,
      };
    }
    case 'BUY_CRIT': {
      if (
        state.completedRun ||
        state.pendingCondenseStageIdx !== null ||
        state.imploding ||
        state.selectedEndingId !== null
      ) {
        return state;
      }
      const stage = getCurrentStage(state);
      const cost = getCritCost(stage, state.critLevel);
      if (state.quanta < cost) {
        return state;
      }
      return {
        ...state,
        quanta: state.quanta - cost,
        critLevel: state.critLevel + 1,
      };
    }
    case 'START_CONDENSE': {
      if (state.completedRun || state.pendingCondenseStageIdx !== null) {
        return state;
      }
      const stage = getCurrentStage(state);
      if (stage.id === STAGES.length) {
        return state;
      }
      const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
      if (state.quanta < effectiveThreshold) {
        return state;
      }
      const earned = getEntropyOnCondense(state.quanta, effectiveThreshold);
      return {
        ...state,
        entropy: state.entropy + earned,
        pendingCondenseStageIdx: state.stageIdx,
        pendingCondenseEntropy: earned,
        combo: 0,
        lastClick: 0,
        imploding: true,
        condenseStartedAt: action.now,
      };
    }
    case 'ADVANCE_STAGE': {
      if (state.pendingCondenseStageIdx === null) {
        return state;
      }
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
      const inheritFrac = hasUnlock(state, 'stellar_memory') ? 0.25 : 0.1;
      const nextStageIdx = state.stageIdx + 1;
      const nextState = {
        ...state,
        stageIdx: nextStageIdx,
        quanta: 0,
        clickLevel: Math.floor(state.clickLevel * inheritFrac),
        autoLevel: Math.floor(state.autoLevel * inheritFrac),
        critLevel: Math.floor(state.critLevel * inheritFrac),
        combo: 0,
        lastClick: 0,
        pendingCondenseStageIdx: null,
        pendingCondenseEntropy: 0,
        imploding: false,
        condenseStartedAt: null,
        stageStartedAt: action.now,
        cosmicClockSec: getStageStartCosmicTime(nextStageIdx),
      };
      return {
        ...nextState,
        ...resetMechanicState(nextState),
      };
    }
    case 'ADMIN_NEXT_STAGE': {
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
      };
      return {
        ...nextState,
        ...resetMechanicState(nextState),
      };
    }
    case 'ADMIN_RESTART_RUN': {
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
      };
    }
    case 'SPEND_DARK_AGE_SKIP': {
      const stage = getCurrentStage(state);
      if (stage.mechanic !== 'dark_age' || state.entropy < 100) {
        return state;
      }
      const span = stage.cosmicTimeSpanSec;
      return {
        ...state,
        entropy: state.entropy - 100,
        quanta: safeAdd(state.quanta, stage.threshold * 0.1),
        cosmicClockSec: Math.min(stage.cosmicTimeSec, state.cosmicClockSec + span * 0.1),
        mechanicCharge: state.mechanicCharge + 0.1,
      };
    }
    case 'SELECT_ENDING': {
      const stage = getCurrentStage(state);
      if (stage.id !== STAGES.length || state.quanta < stage.threshold) {
        return state;
      }
      return {
        ...state,
        selectedEndingId: action.endingId,
        endingStartedAt: action.now,
      };
    }
    case 'COMPLETE_ENDING':
      if (state.selectedEndingId === null) {
        return state;
      }
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
        endingsCompleted: Array.from(
          new Set([...state.endingsCompleted, state.selectedEndingId]),
        ),
        lastEndingId: state.selectedEndingId,
        selectedEndingId: null,
        endingStartedAt: null,
      };
    case 'BUY_SINGULARITY_UNLOCK': {
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
    case 'DISMISS_OFFLINE_MODAL':
      return {
        ...state,
        offlineElapsedMs: 0,
        offlineGained: 0,
      };
    case 'REPORT_ENCOUNTER': {
      if (state.pendingCondenseStageIdx !== null || state.completedRun) {
        return state;
      }
      const eventId = nextEventId(state);
      return {
        ...state,
        eventCounter: eventId,
        lastEncounterEvent: createEncounterEvent(eventId, action.name, action.color),
      };
    }
    case 'REPORT_COLLISION': {
      if (state.pendingCondenseStageIdx !== null || state.completedRun) {
        return state;
      }
      const mult = getEncounterRewardMultiplier(state);
      const eventId = nextEventId(state);
      return {
        ...state,
        quanta: safeAdd(state.quanta, action.bonus * mult),
        entropy: safeAdd(state.entropy, action.entropyBonus * mult),
        collisions: state.collisions + 1,
        eventCounter: eventId,
        lastCollisionEvent: createCollisionEvent(
          eventId,
          action.x,
          action.y,
          action.bonus * mult,
          action.name,
          action.tier,
        ),
      };
    }
    case 'CLEAR_CLICK_EVENT':
      return state.lastClickEvent?.id === action.id ? { ...state, lastClickEvent: null } : state;
    case 'CLEAR_COLLISION_EVENT':
      return state.lastCollisionEvent?.id === action.id
        ? { ...state, lastCollisionEvent: null }
        : state;
    case 'CLEAR_ENCOUNTER_EVENT':
      return state.lastEncounterEvent?.id === action.id
        ? { ...state, lastEncounterEvent: null }
        : state;
    case 'PRESTIGE': {
      const universeBoost = getUniverseBoost(state.entropy);
      const startStageIdx = hasUnlock(state, 'inflaton_spark') ? 1 : 0;
      const resetState = createInitialGameState(action.now);
      return {
        ...resetState,
        stageIdx: startStageIdx,
        cosmicClockSec: getStageStartCosmicTime(startStageIdx),
        universeCount: state.universeCount + 1,
        cumulativeBoost: state.cumulativeBoost + universeBoost,
        condensedMass: state.condensedMass,
        echoes: state.echoes,
        singularityUnlocks: state.singularityUnlocks,
        endingsCompleted: state.endingsCompleted,
        lastEndingId: state.lastEndingId,
      };
    }
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
