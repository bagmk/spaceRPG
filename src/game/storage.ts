import { STORAGE_KEYS, TUNING } from './constants';
import { getStageStartCosmicTime } from './timeFlow';
import type { EndingId, GameState, PersistentGameState, SaveState, SingularityUnlockId } from './types';

const LEGACY_SAVE_KEY = 'cosmic_coalescence_save_v1';

interface SaveStateV1 {
  version: 1;
  stageIdx: number;
  quanta: number;
  clickLevel: number;
  autoLevel: number;
  critLevel?: number;
  entropy: number;
  totalClicks: number;
  collisions: number;
  universeCount: number;
  cumulativeBoost: number;
  runStartTime: number;
  totalTimePlayed: number;
  pendingCondenseStageIdx: number | null;
  pendingCondenseEntropy: number;
  completedRun: boolean;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isEndingId(value: unknown): value is EndingId {
  return (
    value === 'heat_death' ||
    value === 'big_rip' ||
    value === 'big_crunch' ||
    value === 'vacuum_decay'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function createSaveSnapshot(state: GameState): SaveState {
  return {
    version: 2,
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
    lastSaveAt: Date.now(),
    stageStartedAt: state.stageStartedAt,
    cosmicClockSec: state.cosmicClockSec,
    mechanicCharge: state.mechanicCharge,
    mechanicStep: state.mechanicStep,
    mechanicTriggered: state.mechanicTriggered,
  };
}

export function saveGame(state: GameState): void {
  if (!isBrowser()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(createSaveSnapshot(state)));
  } catch {
    // Storage failures are non-fatal for play.
  }
}

function migrateV1ToV2(v1: SaveStateV1): PersistentGameState {
  return {
    stageIdx: v1.stageIdx,
    quanta: v1.quanta,
    clickLevel: v1.clickLevel,
    autoLevel: v1.autoLevel,
    critLevel: v1.critLevel ?? 0,
    entropy: v1.entropy,
    totalClicks: v1.totalClicks,
    collisions: v1.collisions,
    universeCount: v1.universeCount,
    cumulativeBoost: v1.cumulativeBoost,
    runStartTime: v1.runStartTime,
    totalTimePlayed: v1.totalTimePlayed,
    pendingCondenseStageIdx: v1.pendingCondenseStageIdx,
    pendingCondenseEntropy: v1.pendingCondenseEntropy,
    completedRun: v1.completedRun,
    condensedMass: 0,
    echoes: 0,
    singularityUnlocks: [],
    endingsCompleted: [],
    lastEndingId: null,
    selectedEndingId: null,
    lastSaveAt: Date.now(),
    stageStartedAt: v1.runStartTime,
    cosmicClockSec: getStageStartCosmicTime(v1.stageIdx),
    mechanicCharge: 0,
    mechanicStep: 0,
    mechanicTriggered: false,
  };
}

function validateV2(parsed: Partial<SaveState>): PersistentGameState | null {
  if (
    !isFiniteNumber(parsed.stageIdx) ||
    !isFiniteNumber(parsed.quanta) ||
    !isFiniteNumber(parsed.clickLevel) ||
    !isFiniteNumber(parsed.autoLevel) ||
    !isFiniteNumber(parsed.critLevel) ||
    !isFiniteNumber(parsed.entropy) ||
    !isFiniteNumber(parsed.totalClicks) ||
    !isFiniteNumber(parsed.collisions) ||
    !isFiniteNumber(parsed.universeCount) ||
    !isFiniteNumber(parsed.cumulativeBoost) ||
    !isFiniteNumber(parsed.runStartTime) ||
    !isFiniteNumber(parsed.totalTimePlayed) ||
    !isNullableNumber(parsed.pendingCondenseStageIdx) ||
    !isFiniteNumber(parsed.pendingCondenseEntropy) ||
    typeof parsed.completedRun !== 'boolean' ||
    !isFiniteNumber(parsed.condensedMass) ||
    !isFiniteNumber(parsed.echoes) ||
    !isStringArray(parsed.singularityUnlocks) ||
    !isStringArray(parsed.endingsCompleted) ||
    !(parsed.lastEndingId === null || isEndingId(parsed.lastEndingId)) ||
    !(parsed.selectedEndingId === null || isEndingId(parsed.selectedEndingId)) ||
    !isFiniteNumber(parsed.lastSaveAt) ||
    !isFiniteNumber(parsed.stageStartedAt) ||
    !isFiniteNumber(parsed.cosmicClockSec) ||
    !isFiniteNumber(parsed.mechanicCharge) ||
    !isFiniteNumber(parsed.mechanicStep) ||
    typeof parsed.mechanicTriggered !== 'boolean'
  ) {
    return null;
  }

  return {
    stageIdx: parsed.stageIdx,
    quanta: parsed.quanta,
    clickLevel: parsed.clickLevel,
    autoLevel: parsed.autoLevel,
    critLevel: parsed.critLevel,
    entropy: parsed.entropy,
    totalClicks: parsed.totalClicks,
    collisions: parsed.collisions,
    universeCount: parsed.universeCount,
    cumulativeBoost: parsed.cumulativeBoost,
    runStartTime: parsed.runStartTime,
    totalTimePlayed: parsed.totalTimePlayed,
    pendingCondenseStageIdx: parsed.pendingCondenseStageIdx,
    pendingCondenseEntropy: parsed.pendingCondenseEntropy,
    completedRun: parsed.completedRun,
    condensedMass: parsed.condensedMass,
    echoes: parsed.echoes,
    singularityUnlocks: parsed.singularityUnlocks as SingularityUnlockId[],
    endingsCompleted: parsed.endingsCompleted.filter(isEndingId),
    lastEndingId: parsed.lastEndingId,
    selectedEndingId: parsed.selectedEndingId,
    lastSaveAt: parsed.lastSaveAt,
    stageStartedAt: parsed.stageStartedAt,
    cosmicClockSec: parsed.cosmicClockSec,
    mechanicCharge: parsed.mechanicCharge,
    mechanicStep: parsed.mechanicStep,
    mechanicTriggered: parsed.mechanicTriggered,
  };
}

export function loadGame(): PersistentGameState | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.save) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SaveState> | SaveStateV1;
    if ((parsed as SaveStateV1).version === 1) {
      return migrateV1ToV2(parsed as SaveStateV1);
    }
    if ((parsed as Partial<SaveState>).version === 2) {
      return validateV2(parsed as Partial<SaveState>);
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.save);
  localStorage.removeItem(LEGACY_SAVE_KEY);
}

export function loadMutedPreference(): boolean {
  if (!isBrowser()) {
    return TUNING.AUDIO_DEFAULT_MUTED;
  }
  const raw = localStorage.getItem(STORAGE_KEYS.muted);
  if (raw === null) {
    return TUNING.AUDIO_DEFAULT_MUTED;
  }
  return raw === 'true';
}

export function saveMutedPreference(muted: boolean): void {
  if (!isBrowser()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.muted, String(muted));
  } catch {
    // Ignore preference save failures.
  }
}

export function clearAllStoredState(): void {
  clearSave();
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.muted);
}
