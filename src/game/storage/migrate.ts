/** Migration chain: v1 → v2 → v3 → v4 → v5 (current), plus validateV5. */

import { getStageStartCosmicTime } from '../timeFlow';
import { createInitialUniverseSeed, getCurrentUniverseEndingProgressFlags } from '../multiverse';
import { createDefaultPrestigeUpgrades } from '../prestige';
import { STAGES } from '../stages';
import { findEntityById } from '../entities/stageItems';
import {
  createDefaultDailyCheckIns,
  createDefaultEndingProgressFlags,
  createDefaultUniverseAtlas,
  createDefaultCondenseProgressHistory,
} from '../defaults';
import type { EntityInstance, PersistentGameState, SaveState, SingularityUnlockId, EndingId } from '../types';
import type { SaveStateV1, SaveStateV2, SaveStateV3, SaveStateV4 } from './legacyTypes';
import {
  isFiniteNumber,
  isNullableNumber,
  isEndingId,
  isStringArray,
  isEndingProgressFlags,
  isUniverseSeed,
  isCondenseProgressEntry,
  isUniverseAtlasEntry,
  isDailyCheckInState,
  isTutorialFlags,
  isLegacyShopBoosts,
  isSkillState,
  isPurchasedEntityEntry,
  isEntityInstance,
  isAlmanacCollected,
} from './guards';
import {
  normalizeEndingProgressFlags,
  normalizeSkillState,
  normalizeShopBoosts,
  getUnlockedTracksForProgress,
} from './normalize';

// ---------------------------------------------------------------------------
// v13 → v14 (entity redesign): inventory model + entropy-gate clamp
// ---------------------------------------------------------------------------

function seedAlmanacFromInventory(inventory: EntityInstance[]): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const entry of inventory) {
    if (entry.count <= 0) continue;
    const entity = findEntityById(entry.entityId);
    if (!entity) continue;
    const list = result[entity.stageId] ?? (result[entity.stageId] = []);
    if (!list.includes(entity.id)) list.push(entity.id);
  }
  return result;
}

/**
 * Clamp pre-v14 cumulative entropy into the current stage's gate window.
 * Old saves accrued entropy at a flat 0.5/quanta — often orders of magnitude
 * above the calibrated entropyThresholds. Without this clamp a migrated save
 * would skip many stages instantly; below the floor it would owe entropy it
 * "already earned". Lands mid-window at most so the next condense still takes play.
 */
function clampEntropyForGate(entropy: number, stageIdx: number): number {
  const idx = Math.max(0, Math.min(stageIdx, STAGES.length - 1));
  const floor = idx === 0 ? 0 : STAGES[idx - 1].entropyThreshold;
  const gate = STAGES[idx].entropyThreshold;
  const midpoint = floor + (gate - floor) * 0.5;
  if (!Number.isFinite(entropy) || entropy < floor) return floor;
  return Math.min(entropy, midpoint);
}

type EntityModelFields = Pick<
  PersistentGameState,
  'inventory' | 'equippedSlots' | 'unlockedSlotCount' | 'almanacCollected' | 'entropy' | 'peakEntropy'
>;

/**
 * Derive the v14 entity-model fields from any parsed save. v14 saves pass
 * through untouched; older saves get purchasedEntities → inventory conversion,
 * almanac seeding, and the entropy clamp (peakEntropy is rebased to the new
 * scale — the old flat-rate value would distort prestige forever).
 */
function convertEntityModelV14(record: Partial<SaveState>): EntityModelFields {
  const rawInventory = (record as { inventory?: unknown }).inventory;
  const hasV14Inventory = Array.isArray(rawInventory) && rawInventory.every(isEntityInstance);
  const legacyEntries = Array.isArray((record as { purchasedEntities?: unknown }).purchasedEntities)
    ? ((record as { purchasedEntities?: unknown[] }).purchasedEntities as unknown[]).filter(isPurchasedEntityEntry)
    : [];
  const inventory: EntityInstance[] = hasV14Inventory
    ? (rawInventory as EntityInstance[])
    : legacyEntries.map((e) => ({ entityId: e.entityId, count: e.count, level: 1 }));
  const almanacCollected = isAlmanacCollected(record.almanacCollected)
    ? record.almanacCollected
    : seedAlmanacFromInventory(inventory);
  const stageIdx = isFiniteNumber(record.stageIdx) ? record.stageIdx : 0;
  const rawEntropy = isFiniteNumber(record.entropy) ? record.entropy : 0;
  const entropy = hasV14Inventory ? rawEntropy : clampEntropyForGate(rawEntropy, stageIdx);
  const rawPeak = isFiniteNumber(record.peakEntropy) ? record.peakEntropy : entropy;
  const peakEntropy = hasV14Inventory ? Math.max(rawPeak, entropy) : entropy;
  const unlockedSlotCount = isFiniteNumber(record.unlockedSlotCount)
    ? Math.max(1, Math.min(3, Math.floor(record.unlockedSlotCount)))
    : 1;
  const equippedSlots = isStringArray(record.equippedSlots)
    ? record.equippedSlots.slice(0, unlockedSlotCount)
    : [];
  return { inventory, equippedSlots, unlockedSlotCount, almanacCollected, entropy, peakEntropy };
}

function createDefaultSkillState() {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: ['click'] as Array<'click' | 'auto' | 'crit' | 'time'>,
    ownedCrossNodes: [] as string[],
  };
}

export function migrateV1ToV2(v1: SaveStateV1): SaveStateV2 {
  return {
    version: 2,
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

export function migrateV2ToV3(v2: SaveStateV2): SaveStateV3 {
  return {
    ...v2,
    version: 3,
    skills: {
      ...createDefaultSkillState(),
      click: { level: v2.clickLevel },
      auto: { level: v2.autoLevel },
      crit: { level: v2.critLevel },
      time: { level: 0 },
      unlockedTracks: getUnlockedTracksForProgress(v2.stageIdx, v2.universeCount),
    },
    skillPoints: 0,
    tutorialDone: v2.totalClicks > 0,
  };
}

export function migrateV3ToV4(v3: SaveStateV3): SaveStateV4 {
  return {
    ...v3,
    version: 4,
    cosmicHoursThisRun: 0,
    dailyCheckIns: createDefaultDailyCheckIns(),
  };
}

export function migrateV4ToV5(v4: SaveStateV4 | Partial<SaveState>): PersistentGameState {
  const record = v4 as Partial<SaveState>;
  return {
    stageIdx: v4.stageIdx ?? 0,
    quanta: v4.quanta ?? 0,
    timeGauge: 0,
    clickLevel: v4.clickLevel ?? 0,
    autoLevel: v4.autoLevel ?? 0,
    critLevel: v4.critLevel ?? 0,
    // entropy/peakEntropy come from convertEntityModelV14 below.
    totalClicks: v4.totalClicks ?? 0,
    collisions: v4.collisions ?? 0,
    universeCount: v4.universeCount ?? 1,
    cumulativeBoost: v4.cumulativeBoost ?? 0,
    runStartTime: v4.runStartTime ?? Date.now(),
    totalTimePlayed: v4.totalTimePlayed ?? 0,
    pendingCondenseStageIdx: v4.pendingCondenseStageIdx ?? null,
    pendingCondenseEntropy: v4.pendingCondenseEntropy ?? 0,
    completedRun: v4.completedRun ?? false,
    condensedMass: v4.condensedMass ?? 0,
    echoes: v4.echoes ?? 0,
    singularityUnlocks: v4.singularityUnlocks ?? [],
    endingsCompleted: (v4.endingsCompleted ?? []).filter(isEndingId),
    lastEndingId: v4.lastEndingId ?? null,
    selectedEndingId: v4.selectedEndingId ?? null,
    lastSaveAt: v4.lastSaveAt ?? Date.now(),
    stageStartedAt: v4.stageStartedAt ?? v4.runStartTime ?? Date.now(),
    cosmicClockSec: v4.cosmicClockSec ?? getStageStartCosmicTime(v4.stageIdx ?? 0),
    mechanicCharge: v4.mechanicCharge ?? 0,
    mechanicStep: v4.mechanicStep ?? 0,
    mechanicTriggered: v4.mechanicTriggered ?? false,
    tutorialDone: v4.tutorialDone ?? false,
    cosmicHoursThisRun: v4.cosmicHoursThisRun ?? 0,
    dailyCheckIns: v4.dailyCheckIns ?? createDefaultDailyCheckIns(),
    skillPoints: 0,
    skills: normalizeSkillState(v4.skills, v4.stageIdx ?? 0, v4.universeCount ?? 1),
    endingsUnlocked: ((record.endingsUnlocked ?? v4.endingsCompleted ?? []) as unknown[]).filter(isEndingId),
    endingProgressFlags: normalizeEndingProgressFlags(
      isEndingProgressFlags(record.endingProgressFlags)
        ? record.endingProgressFlags
        : createDefaultEndingProgressFlags(),
      {
        critLevel: v4.critLevel ?? 0,
        skills: normalizeSkillState(v4.skills, v4.stageIdx ?? 0, v4.universeCount ?? 1),
      },
    ),
    clickRateLog: Array.isArray(record.clickRateLog) ? record.clickRateLog.filter(isFiniteNumber) : [],
    condenseProgressHistory: Array.isArray(record.condenseProgressHistory)
      ? record.condenseProgressHistory.filter(isCondenseProgressEntry)
      : createDefaultCondenseProgressHistory(),
    universeAtlas: Array.isArray(record.universeAtlas)
      ? record.universeAtlas.filter(isUniverseAtlasEntry)
      : createDefaultUniverseAtlas(),
    currentUniverseSeed: isUniverseSeed(record.currentUniverseSeed)
      ? record.currentUniverseSeed
      : createInitialUniverseSeed(),
    stageClicksAtStageStart: record.stageClicksAtStageStart ?? v4.totalClicks ?? 0,
    tutorialFlags: v4.universeCount && v4.universeCount > 1 ? { allDismissed: true } : {},
    hasSeenCashShopTutorial: Boolean(record.hasSeenCashShopTutorial),
    shopBoosts: normalizeShopBoosts(record.shopBoosts),
    hasOfflineStorageUpgrade: Boolean(record.hasOfflineStorageUpgrade),
    totalShopSpentUSD: 0,
    prestigeUpgrades: (record as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades(),
    ...convertEntityModelV14(record),
  };
}

export function validateV5(
  parsed: Partial<SaveState>,
  forceReconstructedUnlocks = false,
): PersistentGameState | null {
  // Sanitize numeric fields that could carry Infinity/NaN from earlier bugs.
  const NUMERIC_FIELDS: (keyof Pick<SaveState,
    'quanta' | 'entropy' | 'peakEntropy' | 'condensedMass' | 'echoes'>)[] =
    ['quanta', 'entropy', 'peakEntropy', 'condensedMass', 'echoes'];

  for (const field of NUMERIC_FIELDS) {
    const value = (parsed as any)[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      (parsed as any)[field] = 0;
    }
  }

  if (
    !isFiniteNumber(parsed.stageIdx) ||
    !isFiniteNumber(parsed.quanta) ||
    !isFiniteNumber(parsed.timeGauge) ||
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
    typeof parsed.mechanicTriggered !== 'boolean' ||
    typeof parsed.tutorialDone !== 'boolean' ||
    !isFiniteNumber(parsed.cosmicHoursThisRun) ||
    !isDailyCheckInState(parsed.dailyCheckIns) ||
    !isFiniteNumber(parsed.skillPoints) ||
    !isSkillState(parsed.skills) ||
    !isStringArray(parsed.endingsUnlocked) ||
    !isEndingProgressFlags(parsed.endingProgressFlags) ||
    !(Array.isArray(parsed.clickRateLog) && parsed.clickRateLog.every(isFiniteNumber)) ||
    !(Array.isArray(parsed.condenseProgressHistory) && parsed.condenseProgressHistory.every(isCondenseProgressEntry)) ||
    !(Array.isArray(parsed.universeAtlas) && parsed.universeAtlas.every(isUniverseAtlasEntry)) ||
    !isUniverseSeed(parsed.currentUniverseSeed) ||
    !isFiniteNumber(parsed.stageClicksAtStageStart) ||
    !isTutorialFlags(parsed.tutorialFlags) ||
    (parsed.hasSeenCashShopTutorial !== undefined && typeof parsed.hasSeenCashShopTutorial !== 'boolean') ||
    !(Array.isArray(parsed.shopBoosts) || isLegacyShopBoosts(parsed.shopBoosts)) ||
    (parsed.hasOfflineStorageUpgrade !== undefined && typeof parsed.hasOfflineStorageUpgrade !== 'boolean') ||
    !isFiniteNumber(parsed.totalShopSpentUSD)
  ) {
    return null;
  }

  return {
    stageIdx: parsed.stageIdx,
    quanta: parsed.quanta,
    timeGauge: parsed.timeGauge,
    clickLevel: parsed.clickLevel,
    autoLevel: parsed.autoLevel,
    critLevel: parsed.critLevel,
    // entropy/peakEntropy come from convertEntityModelV14 below.
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
    tutorialDone: parsed.tutorialDone,
    cosmicHoursThisRun: parsed.cosmicHoursThisRun,
    dailyCheckIns: parsed.dailyCheckIns,
    skillPoints: parsed.skillPoints,
    skills: normalizeSkillState(parsed.skills, parsed.stageIdx, parsed.universeCount, forceReconstructedUnlocks),
    endingsUnlocked: parsed.endingsUnlocked.filter(isEndingId) as EndingId[],
    endingProgressFlags: normalizeEndingProgressFlags(parsed.endingProgressFlags, {
      critLevel: parsed.critLevel,
      skills: normalizeSkillState(parsed.skills, parsed.stageIdx, parsed.universeCount, forceReconstructedUnlocks),
    }),
    clickRateLog: parsed.clickRateLog,
    condenseProgressHistory: parsed.condenseProgressHistory,
    universeAtlas: parsed.universeAtlas,
    currentUniverseSeed: parsed.currentUniverseSeed,
    stageClicksAtStageStart: parsed.stageClicksAtStageStart,
    tutorialFlags: parsed.tutorialFlags,
    hasSeenCashShopTutorial: parsed.hasSeenCashShopTutorial ?? false,
    shopBoosts: normalizeShopBoosts(parsed.shopBoosts),
    hasOfflineStorageUpgrade: parsed.hasOfflineStorageUpgrade ?? false,
    totalShopSpentUSD: parsed.totalShopSpentUSD,
    prestigeUpgrades: (parsed as any).prestigeUpgrades ?? createDefaultPrestigeUpgrades(),
    ...convertEntityModelV14(parsed),
  };
}

export function reconstructEndingProgressForCurrentRules(
  state: PersistentGameState,
): PersistentGameState {
  const baselineFlags = createDefaultEndingProgressFlags();
  const normalizedState = {
    ...state,
    endingProgressFlags: normalizeEndingProgressFlags(baselineFlags, {
      critLevel: state.critLevel,
      skills: state.skills,
    }),
  };

  return {
    ...normalizedState,
    endingsUnlocked: state.endingsCompleted.filter(isEndingId),
    endingProgressFlags: getCurrentUniverseEndingProgressFlags(normalizedState),
  };
}
