/** Public save/load API. Migration and validation logic lives in storage/. */

import { STORAGE_KEYS, TUNING } from './constants';
import type { GameState, PersistentGameState, SaveState } from './types';
import type { SaveStateV1, SaveStateV2, SaveStateV3, SaveStateV4, SaveStateV5Legacy, SaveStateV6Legacy } from './storage/legacyTypes';
import { migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, validateV5 } from './storage/migrate';
import { getStageStartCosmicTime } from './timeFlow';
import { STAGES } from './stages';

/** Repairs saves corrupted by past bugs (e.g. Infinity cosmicClockSec → null in JSON, or runaway accumulation). */
function repairSave(parsed: Partial<SaveState>): Partial<SaveState> {
  const stageIdx = Number.isFinite(parsed.stageIdx) ? (parsed.stageIdx as number) : 0;
  const clampedIdx = Math.max(0, Math.min(stageIdx, STAGES.length - 1));
  const maxClock = STAGES[clampedIdx].cosmicTimeSec;
  if (parsed.cosmicClockSec !== null && Number.isFinite(parsed.cosmicClockSec)) {
    if ((parsed.cosmicClockSec as number) > maxClock) {
      return { ...parsed, cosmicClockSec: maxClock };
    }
    return parsed;
  }
  return { ...parsed, cosmicClockSec: getStageStartCosmicTime(stageIdx) };
}

const LEGACY_SAVE_KEY = 'cosmic_coalescence_save_v1';
const SAVE_KEY_V2 = 'cosmic_coalescence_save_v2';
const SAVE_KEY_V3 = 'cosmic_coalescence_save_v3';
const SAVE_KEY_V4 = 'cosmic_coalescence_save_v4';
const SAVE_KEY_V5 = 'cosmic_coalescence_save_v5';
const SAVE_KEY_V6 = 'cosmic_coalescence_save_v6';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function createSaveSnapshot(state: GameState): SaveState {
  return {
    version: 8,
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
    lastSaveAt: Date.now(),
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

export function saveGame(state: GameState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(createSaveSnapshot(state)));
  } catch {
    // Storage failures are non-fatal for play.
  }
}

export function loadGame(): PersistentGameState | null {
  if (!isBrowser()) return null;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.save) ??
      localStorage.getItem(SAVE_KEY_V6) ??
      localStorage.getItem(SAVE_KEY_V5) ??
      localStorage.getItem(SAVE_KEY_V4) ??
      localStorage.getItem(SAVE_KEY_V3) ??
      localStorage.getItem(SAVE_KEY_V2) ??
      localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as
      | Partial<SaveState>
      | SaveStateV1
      | SaveStateV2
      | SaveStateV3
      | SaveStateV4
      | SaveStateV5Legacy
      | SaveStateV6Legacy;

    if ((parsed as SaveStateV1).version === 1) {
      return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed as SaveStateV1))));
    }
    if ((parsed as SaveStateV2).version === 2) {
      return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(parsed as SaveStateV2)));
    }
    if ((parsed as SaveStateV3).version === 3) {
      return migrateV4ToV5(migrateV3ToV4(parsed as SaveStateV3));
    }
    if ((parsed as { version?: number }).version === 4) {
      const candidate = parsed as Partial<SaveState>;
      return validateV5(candidate) ?? migrateV4ToV5(parsed as SaveStateV4);
    }
    if ((parsed as { version?: number }).version === 5) {
      return validateV5(parsed as Partial<SaveState>, true);
    }
    if ((parsed as { version?: number }).version === 6) {
      const migrated = validateV5(parsed as Partial<SaveState>);
      return migrated
        ? { ...migrated, skills: { ...migrated.skills, ownedCrossNodes: [] } }
        : null;
    }
    if ((parsed as { version?: number }).version === 7) {
      // v7 → v8: add purchasedEntities
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return { ...migrated, purchasedEntities: [] };
    }
    if ((parsed as { version?: number }).version === 8) {
      return validateV5(repairSave(parsed as Partial<SaveState>));
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.save);
  localStorage.removeItem(SAVE_KEY_V6);
  localStorage.removeItem(SAVE_KEY_V5);
  localStorage.removeItem(SAVE_KEY_V4);
  localStorage.removeItem(SAVE_KEY_V3);
  localStorage.removeItem(SAVE_KEY_V2);
  localStorage.removeItem(LEGACY_SAVE_KEY);
}

export function loadMutedPreference(): boolean {
  if (!isBrowser()) return TUNING.AUDIO_DEFAULT_MUTED;
  const raw = localStorage.getItem(STORAGE_KEYS.muted);
  if (raw === null) return TUNING.AUDIO_DEFAULT_MUTED;
  return raw === 'true';
}

export function saveMutedPreference(muted: boolean): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.muted, String(muted));
  } catch {
    // Ignore preference save failures.
  }
}

export function clearAllStoredState(): void {
  clearSave();
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.muted);
}
