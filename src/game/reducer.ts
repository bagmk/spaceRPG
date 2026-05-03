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
  getTimeMultiplier,
  getUniverseBoost,
  safeAdd,
} from './formulas';
import { getActiveModifiers } from './skills/effects';
import { PARTICLE_DEFINITIONS, pickParticleName } from './particles';
import { getMechanic } from './mechanics';
import { STAGES } from './stages';
import { getCosmicTimePerRealSec, getStageStartCosmicTime } from './timeFlow';
import {
  CondenseProgressEntry,
  DailyCheckInState,
  EncounterEvent,
  EndingId,
  EndingProgressFlags,
  FloatingClickEvent,
  FloatingCollisionEvent,
  GameState,
  PersistentGameState,
  RogueTypeKey,
  SingularityUnlockId,
  UniverseAtlasEntry,
  UniverseSeed,
} from './types';
import { findNode, findTree } from './skills/definitions';
import {
  ALL_ENDINGS,
  createInitialUniverseSeed,
  generateUniverseSeed,
  getEndingOptions,
  isBigCrunchEligible,
  isBigRipEligible,
  isVacuumDecayProgress,
} from './multiverse';

function createDefaultDailyCheckIns(): DailyCheckInState {
  return { lastDayKey: '', streakDays: 0 };
}

function createDefaultEndingProgressFlags(): EndingProgressFlags {
  return {
    bigRipEverEligible: false,
    bigCrunchEligible: false,
    vacuumDecayEligible: false,
  };
}

function createDefaultUniverseAtlas(): UniverseAtlasEntry[] {
  return [];
}

function createDefaultCondenseProgressHistory(): CondenseProgressEntry[] {
  return [];
}

function createDefaultUniverseSeed(): UniverseSeed {
  return createInitialUniverseSeed();
}

function createDefaultSkills() {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: [],
    ownedCrossNodes: [],
  };
}

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
  | { type: 'BUY_TRACK_LEVEL'; trackId: 'click' | 'auto' | 'crit' | 'time' }
  | { type: 'BUY_CROSS_NODE'; nodeId: string }
  | { type: 'UNLOCK_TRACK'; trackId: 'click' | 'auto' | 'crit' | 'time' }
  | { type: 'MARK_TUTORIAL_STAGE_SEEN'; stageId: number };

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
    tutorialDone: false,
    cosmicHoursThisRun: 0,
    dailyCheckIns: createDefaultDailyCheckIns(),
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
    skillPoints: 0,
    skills: createDefaultSkills(),
    endingsUnlocked: [],
    endingProgressFlags: createDefaultEndingProgressFlags(),
    clickRateLog: [],
    condenseProgressHistory: createDefaultCondenseProgressHistory(),
    universeAtlas: createDefaultUniverseAtlas(),
    currentUniverseSeed: createDefaultUniverseSeed(),
    stageClicksAtStageStart: 0,
    tutorialFlags: {},
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
  particleName: string,
): FloatingClickEvent {
  return {
    id,
    x,
    y,
    gained,
    isCrit,
    combo,
    comboMult,
    particleName,
    particleDefinition: PARTICLE_DEFINITIONS[particleName],
  };
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

function getCurrentModifiers(state: GameState) {
  return getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (state.totalTimePlayed - Math.max(0, state.stageStartedAt - state.runStartTime)) / 1000),
    stageId: getCurrentStage(state).id,
    progress01: getProgress(state.quanta, getCurrentStage(state).threshold),
    clickLevel: state.skills.click.level,
  });
}

function getAdjustedClickPower(state: GameState): number {
  const modifiers = getCurrentModifiers(state);
  const adjusted = getClickPower(modifiers);
  const unlocked = hasUnlock(state, 'quark_foam') ? adjusted + state.skills.click.level + 1 : adjusted;
  return unlocked;
}

function unlockTrackForStage(skills: GameState['skills'], stageId: number): GameState['skills'] {
  const unlockedTracks = [...skills.unlockedTracks];
  if (stageId === 2 && !unlockedTracks.includes('click')) unlockedTracks.push('click');
  if (stageId === 3 && !unlockedTracks.includes('crit')) unlockedTracks.push('crit');
  if (stageId === 4 && !unlockedTracks.includes('auto')) unlockedTracks.push('auto');
  if (stageId === 5 && !unlockedTracks.includes('time')) unlockedTracks.push('time');
  return { ...skills, unlockedTracks };
}

function resetMechanicState(state: GameState): Pick<GameState, 'mechanicCharge' | 'mechanicStep' | 'mechanicTriggered'> {
  if (getCurrentStage(state).mechanic === 'remnant_cooling') {
    return { mechanicCharge: 0, mechanicStep: 0, mechanicTriggered: false };
  }
  return { mechanicCharge: 0, mechanicStep: 0, mechanicTriggered: false };
}

function recordLateStageClickRate(state: GameState, now: number): number[] {
  const stage = getCurrentStage(state);
  if (stage.id < 13 || stage.id > 16) {
    return state.clickRateLog;
  }
  const elapsedSec = Math.max(1, (now - state.stageStartedAt) / 1000);
  const clickRate = Math.max(0, state.totalClicks - state.stageClicksAtStageStart) / elapsedSec;
  return [...state.clickRateLog, clickRate].slice(-4);
}

function buildAtlasEntry(state: GameState, now: number): UniverseAtlasEntry | null {
  const endingId = state.selectedEndingId ?? state.lastEndingId;
  if (!endingId) {
    return null;
  }
  return {
    universeIndex: state.universeCount,
    atlasName: state.currentUniverseSeed.atlasName,
    endingId,
    durationMs: state.totalTimePlayed,
    totalClicks: state.totalClicks,
    collisions: state.collisions,
    completedAt: now,
    seed: state.currentUniverseSeed,
  };
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
      const modifiers = getActiveModifiers(state.skills, {
        currentQuanta: state.quanta,
        stagesCleared: state.stageIdx,
        secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
        stageId: stage.id,
        progress01: getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost)),
        clickLevel: state.skills.click.level,
      });
      const shouldClearCombo =
        state.combo > 0 && action.now - state.lastClick >= modifiers.comboTimeoutMs;
      const canAccrue =
        !state.completedRun &&
        state.pendingCondenseStageIdx === null &&
        !state.imploding &&
        state.selectedEndingId === null;
      const progress = getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost));
      const baseAuto = getAutoRate(modifiers);
      const timeMult = getTimeMultiplier(modifiers);
      const autoRate = baseAuto * timeMult;
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
        getCosmicTimePerRealSec(stage, previousStage, timeMult) *
        getLateStageCompression(state) *
        state.currentUniverseSeed.timeMod;
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
      const modifiers = getActiveModifiers(state.skills, {
        currentQuanta: state.quanta,
        stagesCleared: state.stageIdx,
        secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
        stageId: stage.id,
        progress01: getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost)),
        clickLevel: state.skills.click.level,
      });
      const combo =
        action.now - state.lastClick < modifiers.comboTimeoutMs ? state.combo + 1 : 1;
      const clickPower = getAdjustedClickPower(state);
      const comboMult = getComboMult(combo, getComboCapBonus(state));
      const isCrit = action.forceCrit === true || action.randomValue < getCritChance(combo, modifiers);
      const critMult = isCrit ? getCritMultiplier(modifiers) : 1;
      const gainMultiplier = action.gainMultiplier ?? 1;
      const gained = Math.floor(clickPower * comboMult * critMult * gainMultiplier + (action.gainFlat ?? 0));
      const eventId = nextEventId(state);
      const nextQuanta = safeAdd(state.quanta, gained + (action.quantaDelta ?? 0));
      const nextProgress = getProgress(nextQuanta, getEffectiveThreshold(stage, state.cumulativeBoost));
      const particleName = pickParticleName(stage.id);
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
          particleName,
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
      const progressAtCondense = getProgress(state.quanta, effectiveThreshold);
      const condenseEntry = { stageId: stage.id, progressAtCondense };
      const vacuumDecayEligible =
        state.endingProgressFlags.vacuumDecayEligible ||
        (stage.id === 14 && isVacuumDecayProgress(progressAtCondense));
      const endingsUnlocked: EndingId[] =
        vacuumDecayEligible && !state.endingsUnlocked.includes('vacuum_decay')
          ? [...state.endingsUnlocked, 'vacuum_decay']
          : state.endingsUnlocked;
      return {
        ...state,
        entropy: state.entropy + earned,
        pendingCondenseStageIdx: state.stageIdx,
        pendingCondenseEntropy: earned,
        combo: 0,
        lastClick: 0,
        imploding: true,
        condenseStartedAt: action.now,
        endingsUnlocked,
        endingProgressFlags: {
          ...state.endingProgressFlags,
          vacuumDecayEligible,
        },
        condenseProgressHistory: [...state.condenseProgressHistory, condenseEntry].slice(-16),
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
      const stage = getCurrentStage(state);
      const nextClickRateLog = recordLateStageClickRate(state, action.now);
      const excess = Math.max(0, state.quanta - getEffectiveThreshold(stage, state.cumulativeBoost));
      const nextStageIdx = state.stageIdx + 1;
      const nextStageId = nextStageIdx + 1;
      const nextState = {
        ...state,
        stageIdx: nextStageIdx,
        quanta: excess,
        combo: 0,
        lastClick: 0,
        pendingCondenseStageIdx: null,
        pendingCondenseEntropy: 0,
        imploding: false,
        condenseStartedAt: null,
        stageStartedAt: action.now,
        cosmicClockSec: getStageStartCosmicTime(nextStageIdx),
        skills: unlockTrackForStage(state.skills, nextStageId),
        clickRateLog: nextClickRateLog,
        stageClicksAtStageStart: state.totalClicks,
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
        tutorialDone: true,
        skills: unlockTrackForStage(state.skills, nextStageIdx + 1),
        stageClicksAtStageStart: state.totalClicks,
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
        skills:
          state.universeCount > 1
            ? { ...state.skills, unlockedTracks: ['click', 'crit', 'auto', 'time'] }
            : state.skills,
      };
    }
    case 'SELECT_ENDING': {
      const stage = getCurrentStage(state);
      if (stage.id !== STAGES.length || state.quanta < stage.threshold) {
        return state;
      }
      const options = getEndingOptions(state, action.now);
      const selectedOption = options.find((option) => option.id === action.endingId);
      if (!selectedOption?.unlocked) {
        return state;
      }
      const nextClickRateLog = recordLateStageClickRate(state, action.now);
      const bigCrunchEligible = isBigCrunchEligible(
        { ...state, clickRateLog: nextClickRateLog },
        action.now,
      );
      const endingsUnlocked = new Set(state.endingsUnlocked);
      if (bigCrunchEligible) endingsUnlocked.add('big_crunch');
      if (isBigRipEligible(state)) endingsUnlocked.add('big_rip');
      if (state.endingProgressFlags.vacuumDecayEligible) endingsUnlocked.add('vacuum_decay');
      return {
        ...state,
        selectedEndingId: action.endingId,
        endingStartedAt: action.now,
        clickRateLog: nextClickRateLog,
        endingsUnlocked: Array.from(endingsUnlocked) as EndingId[],
        endingProgressFlags: {
          ...state.endingProgressFlags,
          bigCrunchEligible,
          bigRipEverEligible: state.endingProgressFlags.bigRipEverEligible || isBigRipEligible(state),
        },
      };
    }
    case 'COMPLETE_ENDING':
      if (state.selectedEndingId === null) {
        return state;
      }
      {
        const completedEndings = Array.from(
          new Set([...state.endingsCompleted, state.selectedEndingId]),
        );
        const atlasEntry = buildAtlasEntry(state, action.now);
        const universeAtlas = atlasEntry ? [...state.universeAtlas, atlasEntry] : state.universeAtlas;
        const permanentUnlocks: EndingId[] =
          state.selectedEndingId === 'bounce' || completedEndings.includes('bounce')
            ? ALL_ENDINGS
            : (Array.from(new Set([...state.endingsUnlocked, state.selectedEndingId])) as EndingId[]);
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
          endingsCompleted: completedEndings,
          endingsUnlocked: permanentUnlocks,
          lastEndingId: state.selectedEndingId,
          selectedEndingId: null,
          endingStartedAt: null,
          universeAtlas,
        };
      }
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
      const stage = getCurrentStage(state);
      const modifiers = getCurrentModifiers(state);
      const mult = getEncounterRewardMultiplier(state);
      const cappedBonus = Math.min(action.bonus * mult, stage.threshold * 0.05 * modifiers.manyWorldsCapMult);
      const eventId = nextEventId(state);
      return {
        ...state,
        quanta: safeAdd(state.quanta, cappedBonus),
        entropy: safeAdd(state.entropy, action.entropyBonus * mult),
        collisions: state.collisions + 1,
        eventCounter: eventId,
        lastCollisionEvent: createCollisionEvent(
          eventId,
          action.x,
          action.y,
          cappedBonus,
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
    case 'SET_TUTORIAL_DONE':
      return { ...state, tutorialDone: true };
    case 'PRESTIGE': {
      const universeBoost = getUniverseBoost(state.entropy);
      const startStageIdx = hasUnlock(state, 'inflaton_spark') ? 1 : 0;
      const resetState = createInitialGameState(action.now);
      const nextSeed = generateUniverseSeed(state.universeCount);
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
        tutorialDone: state.tutorialDone,
        cosmicHoursThisRun: 0,
        dailyCheckIns: state.dailyCheckIns,
        skillPoints: state.skillPoints,
        endingsUnlocked: state.endingsUnlocked,
        endingProgressFlags: createDefaultEndingProgressFlags(),
        clickRateLog: [],
        condenseProgressHistory: [],
        universeAtlas: state.universeAtlas,
        currentUniverseSeed: nextSeed,
        stageClicksAtStageStart: 0,
        tutorialFlags: state.tutorialFlags,
        skills: { ...state.skills, unlockedTracks: ['click', 'crit', 'auto', 'time'] },
      };
    }
    case 'BUY_TRACK_LEVEL': {
      const treeId = action.trackId;
      const treeDef = findTree(treeId);
      if (!treeDef) return state;
      if (!state.skills.unlockedTracks.includes(treeId)) return state;
      const branch = state.skills[treeId];
      const nextLevel = branch.level + 1;
      if (nextLevel > treeDef.rootMaxLevel) return state;
      const cost = Math.ceil(treeDef.rootCostCurve(nextLevel));
      if (state.quanta < cost) return state;
      const nextSkills = {
        ...state.skills,
        [treeId]: { ...branch, level: nextLevel },
      };
      const bigRipEverEligible =
        state.endingProgressFlags.bigRipEverEligible ||
        (treeId === 'time' &&
          nextLevel >= 30 &&
          nextSkills.ownedCrossNodes.includes('inflaton_echo'));
      const endingsUnlocked: EndingId[] =
        bigRipEverEligible && !state.endingsUnlocked.includes('big_rip')
          ? [...state.endingsUnlocked, 'big_rip']
          : state.endingsUnlocked;
      return {
        ...state,
        quanta: state.quanta - cost,
        clickLevel: treeId === 'click' ? nextLevel : state.clickLevel,
        autoLevel: treeId === 'auto' ? nextLevel : state.autoLevel,
        critLevel: treeId === 'crit' ? nextLevel : state.critLevel,
        skills: nextSkills,
        endingsUnlocked,
        endingProgressFlags: {
          ...state.endingProgressFlags,
          bigRipEverEligible,
        },
      };
    }
    case 'BUY_CROSS_NODE': {
      const { nodeId } = action;
      const nodeDef = findNode(nodeId);
      if (!nodeDef) return state;
      if (state.skills.ownedCrossNodes.includes(nodeId)) return state;
      const meetsRequirements = Object.entries(nodeDef.requires).every(([trackId, requiredLevel]) => {
        const branch = state.skills[trackId as 'click' | 'auto' | 'crit' | 'time'];
        return branch.level >= (requiredLevel ?? 0);
      });
      if (!meetsRequirements || state.quanta < nodeDef.cost) return state;
      const nextSkills = {
        ...state.skills,
        ownedCrossNodes: [...state.skills.ownedCrossNodes, nodeId],
      };
      const bigRipEverEligible =
        state.endingProgressFlags.bigRipEverEligible ||
        (nodeId === 'inflaton_echo' && state.skills.time.level >= 30);
      const endingsUnlocked: EndingId[] =
        bigRipEverEligible && !state.endingsUnlocked.includes('big_rip')
          ? [...state.endingsUnlocked, 'big_rip']
          : state.endingsUnlocked;
      return {
        ...state,
        quanta: state.quanta - nodeDef.cost,
        skills: nextSkills,
        endingsUnlocked,
        endingProgressFlags: {
          ...state.endingProgressFlags,
          bigRipEverEligible,
        },
      };
    }
    case 'UNLOCK_TRACK':
      return state.skills.unlockedTracks.includes(action.trackId)
        ? state
        : { ...state, skills: { ...state.skills, unlockedTracks: [...state.skills.unlockedTracks, action.trackId] } };
    case 'MARK_TUTORIAL_STAGE_SEEN':
      return state.tutorialFlags[action.stageId]
        ? state
        : {
            ...state,
            tutorialFlags: {
              ...state.tutorialFlags,
              [action.stageId]: true,
            },
          };
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
