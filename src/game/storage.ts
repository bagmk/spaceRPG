/** Public save/load API. Migration and validation logic lives in storage/. */

import { STORAGE_KEYS, TUNING } from './constants';
import { ENHANCE_LEVEL_CAPS } from './balance';
import { createDefaultPrestigeUpgrades } from './prestige';
import { findEntityById } from './entities/stageItems';
import type { EntityInstance, GameState, PersistentGameState, SaveState } from './types';
import type { SaveStateV1, SaveStateV2, SaveStateV3, SaveStateV4, SaveStateV5Legacy, SaveStateV6Legacy } from './storage/legacyTypes';
import {
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  reconstructEndingProgressForCurrentRules,
  validateV5,
} from './storage/migrate';
import { getStageStartCosmicTime } from './timeFlow';
import { STAGES } from './stages';

/** Repairs saves corrupted by past bugs (e.g. Infinity cosmicClockSec → null in JSON, or runaway accumulation). */
function repairSave(parsed: Partial<SaveState>): Partial<SaveState> {
  const stageIdx = Number.isFinite(parsed.stageIdx) ? (parsed.stageIdx as number) : 0;
  const clampedIdx = Math.max(0, Math.min(stageIdx, STAGES.length - 1));
  const maxClock = STAGES[clampedIdx].cosmicTimeSec;
  const now = Date.now();
  const repairedClock = (() => {
    if (parsed.cosmicClockSec !== null && Number.isFinite(parsed.cosmicClockSec)) {
      return (parsed.cosmicClockSec as number) > maxClock ? maxClock : parsed.cosmicClockSec;
    }
    return getStageStartCosmicTime(stageIdx);
  })();
  const repairedStageStartedAt =
    Number.isFinite(parsed.stageStartedAt) && (parsed.stageStartedAt as number) > 1_500_000_000_000
      ? parsed.stageStartedAt
      : now;

  const result: Partial<SaveState> = {
    ...parsed,
    cosmicClockSec: repairedClock,
    stageStartedAt: repairedStageStartedAt,
  };

  // Final numeric sanity pass for fields that legacy bugs may have corrupted.
  for (const field of ['quanta', 'entropy', 'peakEntropy', 'condensedMass', 'echoes'] as const) {
    const v = (result as any)[field];
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) (result as any)[field] = 0;
  }
  return result;
}

/** Single source of truth for the save schema version (local + cloud). */
export const SAVE_SCHEMA_VERSION = 16;

/**
 * Entity ids were decoupled from names in v15 (canonical id is now position-only,
 * e.g. `s10_01`). Pre-v15 saves stored name-derived ids (`s10_01_sun`); those are
 * kept as aliases, so we normalize every stored id to its canonical form once on
 * load. Idempotent — a canonical id resolves to itself. Inventory entries that
 * collapse onto the same canonical id are merged (count summed, level maxed).
 */
function canonicalEntityId(id: string): string {
  return id ? findEntityById(id)?.id ?? id : id;
}

/** Sanity-clamp one inventory entry (corrupt counts/levels from past bugs). */
function clampInstance(e: EntityInstance): EntityInstance {
  const entity = findEntityById(e.entityId);
  const rawCount = Number.isFinite(e.count) ? Math.max(0, Math.floor(e.count)) : 0;
  // Collection is uncapped by design, but a runaway count (NaN math, dupe
  // bugs) gets a generous ceiling so power/UI never see absurd values.
  const countCeil = entity && entity.maxCount > 0 ? entity.maxCount * 1000 : Number.MAX_SAFE_INTEGER;
  const levelCap = entity ? ENHANCE_LEVEL_CAPS[entity.rarity] ?? 25 : 25;
  const rawLevel = Number.isFinite(e.level) ? Math.max(1, Math.floor(e.level)) : 1;
  return { ...e, count: Math.min(rawCount, countCeil), level: Math.min(rawLevel, levelCap) };
}

function normalizeSavedEntityIds(state: PersistentGameState): PersistentGameState {
  const invMap = new Map<string, EntityInstance>();
  for (const raw of state.inventory ?? []) {
    const e = clampInstance(raw);
    const id = canonicalEntityId(e.entityId);
    const existing = invMap.get(id);
    if (existing) {
      existing.count += e.count;
      existing.level = Math.max(existing.level ?? 1, e.level ?? 1);
    } else {
      invMap.set(id, { ...e, entityId: id });
    }
  }
  const almanacCollected: Record<number, string[]> = {};
  for (const [stage, ids] of Object.entries(state.almanacCollected ?? {})) {
    almanacCollected[Number(stage)] = Array.from(new Set(ids.map(canonicalEntityId)));
  }
  return {
    ...state,
    inventory: Array.from(invMap.values()),
    equippedSlots: (state.equippedSlots ?? []).map((s) => (s ? canonicalEntityId(s) : s)),
    riftSlots: (state.riftSlots ?? []).map((s) => (s ? canonicalEntityId(s) : s)),
    almanacCollected,
  };
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
    version: SAVE_SCHEMA_VERSION,
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
    almanacCollected: state.almanacCollected,
    fusionPity: state.fusionPity,
    prestigeUpgrades: state.prestigeUpgrades,
    peakEntropy: state.peakEntropy,
  };
}

export const SAVE_FAILED_EVENT = 'cc-save-failed';

function trySave(state: GameState, aggressive = false): boolean {
  try {
    const snapshot = createSaveSnapshot(state);
    if (aggressive) {
      // Halve historical arrays as last-ditch trim.
      snapshot.universeAtlas = snapshot.universeAtlas.slice(-Math.floor(TUNING.HISTORY_CAPS.universeAtlas / 2));
      snapshot.clickRateLog = snapshot.clickRateLog.slice(-Math.floor(TUNING.HISTORY_CAPS.clickRateLog / 2));
      snapshot.condenseProgressHistory = snapshot.condenseProgressHistory.slice(
        -Math.floor(TUNING.HISTORY_CAPS.condenseProgressHistory / 2),
      );
    }
    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function saveGame(state: GameState): void {
  if (!isBrowser()) return;
  if (trySave(state, false)) return;
  // First attempt failed — likely quota. Retry with aggressive trim.
  if (trySave(state, true)) {
    console.warn('[storage] Save succeeded after aggressive history trim.');
    return;
  }
  // Both failed — notify UI.
  console.error('[storage] Save failed twice; possible quota exhaustion.');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAVE_FAILED_EVENT));
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
    return migrateToCurrent(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Migrate any historical save shape to the current schema. Shared by local
 * loads AND cloud pulls (sync.ts) so both paths get identical id
 * normalization, clamps and version steps.
 */
export function migrateToCurrent(parsedUnknown: unknown): PersistentGameState | null {
  if (!parsedUnknown || typeof parsedUnknown !== 'object') return null;
  const sourceVersion = (parsedUnknown as { version?: number }).version ?? 0;
  const migrated = migrateByVersion(parsedUnknown as Partial<SaveState>);
  if (!migrated) return null;
  const normalized = normalizeSavedEntityIds(migrated);
  // v15 → v16 (Phase 4-1 gear power rebuff): reset the offline window once so
  // the new player-stage power curve doesn't retroactively pay out a giant
  // offline windfall on the first post-update load.
  if (sourceVersion < 16) {
    return { ...normalized, lastSaveAt: Date.now() };
  }
  return normalized;
}

function migrateByVersion(
  parsed:
    | Partial<SaveState>
    | SaveStateV1
    | SaveStateV2
    | SaveStateV3
    | SaveStateV4
    | SaveStateV5Legacy
    | SaveStateV6Legacy,
): PersistentGameState | null {
  try {
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
      // v7 → v8: add purchasedEntities (now inventory)
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return { ...migrated, inventory: [], almanacCollected: {} };
    }
    if ((parsed as { version?: number }).version === 8) {
      // v8 → v9: entity IDs changed format (0-indexed → 1-indexed zero-padded, names changed)
      // reset entity stacks so stale IDs don't ghost as 0-count cards
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return { ...migrated, inventory: [], almanacCollected: {} };
    }
    if ((parsed as { version?: number }).version === 9) {
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      return migrated ? reconstructEndingProgressForCurrentRules(migrated) : null;
    }
    if ((parsed as { version?: number }).version === 10) {
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      return migrated ? reconstructEndingProgressForCurrentRules(migrated) : null;
    }
    if ((parsed as { version?: number }).version === 11) {
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return { ...migrated, prestigeUpgrades: (migrated as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades() };
    }
    if ((parsed as { version?: number }).version === 12) {
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      const withPrestige = { ...migrated, prestigeUpgrades: (migrated as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades() };
      return { ...withPrestige, peakEntropy: (withPrestige as any).peakEntropy ?? withPrestige.entropy ?? 0 };
    }
    if ((parsed as { version?: number }).version === 13) {
      // v13 → v14: validateV5 converts purchasedEntities → inventory, seeds the
      // almanac, and clamps entropy into the new gate window (entity redesign).
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return {
        ...migrated,
        prestigeUpgrades: (migrated as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades(),
      };
    }
    const v = (parsed as { version?: number }).version;
    if (v === 14 || v === 15 || v === 16) {
      // v14..v16 share a schema. v15 decoupled entity ids from names
      // (normalizeSavedEntityIds rewrites ids); v16 re-anchored gear power to
      // the player stage (migrateToCurrent resets the offline window once).
      const migrated = validateV5(repairSave(parsed as Partial<SaveState>));
      if (!migrated) return null;
      return {
        ...migrated,
        prestigeUpgrades: (migrated as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades(),
      };
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

export function loadSfxMuted(): boolean {
  if (!isBrowser()) return false;
  const raw = localStorage.getItem('cc_sfx_muted');
  if (raw === null) return false;
  return raw === 'true';
}

export function saveSfxMuted(v: boolean): void {
  if (!isBrowser()) return;
  try { localStorage.setItem('cc_sfx_muted', String(v)); } catch { /* noop */ }
}

export function loadMusicMuted(): boolean {
  if (!isBrowser()) return false; // music defaults to ON; drone defaults to muted
  const raw = localStorage.getItem('cc_music_muted');
  if (raw === null) return false;
  return raw === 'true';
}

export function saveMusicMuted(v: boolean): void {
  if (!isBrowser()) return;
  try { localStorage.setItem('cc_music_muted', String(v)); } catch { /* noop */ }
}

export function loadMusicVolume(): number {
  if (!isBrowser()) return 0.8;
  const raw = localStorage.getItem('cc_music_volume');
  if (raw === null) return 0.8;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0.8;
  return Math.max(0, Math.min(1, n));
}

export function saveMusicVolume(v: number): void {
  if (!isBrowser()) return;
  try { localStorage.setItem('cc_music_volume', String(v)); } catch { /* noop */ }
}

export function loadLanguage(): 'en' | 'ko' {
  if (!isBrowser()) return 'en';
  const raw = localStorage.getItem('cc_language');
  if (raw === 'ko') return 'ko';
  return 'en';
}

export function saveLanguage(lang: 'en' | 'ko'): void {
  if (!isBrowser()) return;
  try { localStorage.setItem('cc_language', lang); } catch { /* noop */ }
}

export function clearAllStoredState(): void {
  clearSave();
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.muted);
}
