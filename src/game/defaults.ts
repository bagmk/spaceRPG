/**
 * Default value creators for GameState fields.
 * Shared between reducer.ts and storage.ts to avoid duplication.
 */

import { createInitialUniverseSeed } from './multiverse';
import { getStageStartCosmicTime } from './timeFlow';
import { createDefaultPrestigeUpgrades } from './prestige';
import type {
  CondenseProgressEntry,
  DailyCheckInState,
  EndingProgressFlags,
  EntityInstance,
  GameState,
  UniverseAtlasEntry,
  UniverseSeed,
} from './types';
import type { SkillState } from './skills/types';

export function createDefaultDailyCheckIns(): DailyCheckInState {
  return { lastDayKey: '', streakDays: 0 };
}

export function createDefaultEndingProgressFlags(): EndingProgressFlags {
  return {
    bigCrunchEligible: false,
    criticalUpgradedThisUniverse: false,
    bigRipEverEligible: false,
    vacuumDecayEligible: false,
  };
}

export function createDefaultUniverseAtlas(): UniverseAtlasEntry[] {
  return [];
}

export function createDefaultCondenseProgressHistory(): CondenseProgressEntry[] {
  return [];
}

export function createDefaultUniverseSeed(): UniverseSeed {
  return createInitialUniverseSeed();
}

export function createDefaultSkills(): SkillState {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: ['click'],
    ownedCrossNodes: [],
  };
}

export function createDefaultInventory(): EntityInstance[] {
  return [];
}

export function createDefaultAlmanacCollected(): Record<number, string[]> {
  return {};
}

export function createInitialGameState(now: number): GameState {
  return {
    stageIdx: 0,
    quanta: 0,
    timeGauge: 0,
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
    lastFusionEvent: null,
    offlineElapsedMs: 0,
    offlineGained: 0,
    offlineEntropyGained: 0,
    offlineTimeProgressGained: 0,
    endingStartedAt: null,
    endingsUnlocked: [],
    endingProgressFlags: createDefaultEndingProgressFlags(),
    clickRateLog: [],
    condenseProgressHistory: createDefaultCondenseProgressHistory(),
    universeAtlas: createDefaultUniverseAtlas(),
    currentUniverseSeed: createDefaultUniverseSeed(),
    stageClicksAtStageStart: 0,
    tutorialFlags: {},
    hasSeenCashShopTutorial: false,
    shopBoosts: [],
    hasOfflineStorageUpgrade: false,
    totalShopSpentUSD: 0,
    inventory: createDefaultInventory(),
    equippedSlots: [],
    unlockedSlotCount: 1,
    riftSlots: [],
    unlockedRiftSlotCount: 1,
    almanacCollected: createDefaultAlmanacCollected(),
    fusionPity: 0,
    prestigeUpgrades: createDefaultPrestigeUpgrades(),
    peakEntropy: 0,
  };
}
