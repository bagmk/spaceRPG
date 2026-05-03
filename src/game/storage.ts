import { STORAGE_KEYS, TUNING } from './constants';
import { getStageStartCosmicTime } from './timeFlow';
import type {
  CondenseProgressEntry,
  DailyCheckInState,
  EndingId,
  EndingProgressFlags,
  GameState,
  PersistentGameState,
  SaveState,
  SingularityUnlockId,
  UniverseAtlasEntry,
  UniverseSeed,
} from './types';
import type { SkillState } from './skills/types';
import { createInitialUniverseSeed } from './multiverse';

const LEGACY_SAVE_KEY = 'cosmic_coalescence_save_v1';
const SAVE_KEY_V2 = 'cosmic_coalescence_save_v2';
const SAVE_KEY_V3 = 'cosmic_coalescence_save_v3';
const SAVE_KEY_V4 = 'cosmic_coalescence_save_v4';

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

interface SaveStateV2 extends Omit<SaveStateV1, 'version' | 'critLevel'> {
  version: 2;
  critLevel: number;
  condensedMass: number;
  echoes: number;
  singularityUnlocks: SingularityUnlockId[];
  endingsCompleted: EndingId[];
  lastEndingId: EndingId | null;
  selectedEndingId: EndingId | null;
  lastSaveAt: number;
  stageStartedAt: number;
  cosmicClockSec: number;
  mechanicCharge: number;
  mechanicStep: number;
  mechanicTriggered: boolean;
}

interface SaveStateV3 extends Omit<SaveStateV2, 'version'> {
  version: 3;
  skills: SkillState;
  skillPoints: number;
  tutorialDone: boolean;
}

interface SaveStateV4 extends Omit<SaveStateV3, 'version'> {
  version: 4;
  cosmicHoursThisRun: number;
  dailyCheckIns: DailyCheckInState;
}

interface SaveStateV5Legacy extends Omit<SaveState, 'version'> {
  version: 5;
}

function createDefaultSkillState(): SkillState {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: [],
    ownedCrossNodes: [],
  };
}

function getUnlockedTracksForProgress(stageIdx: number, universeCount: number): SkillState['unlockedTracks'] {
  if (universeCount > 1) {
    return ['click', 'crit', 'auto', 'time'];
  }
  const stageId = stageIdx + 1;
  const unlocked: SkillState['unlockedTracks'] = [];
  if (stageId >= 2) unlocked.push('click');
  if (stageId >= 3) unlocked.push('crit');
  if (stageId >= 4) unlocked.push('auto');
  if (stageId >= 5) unlocked.push('time');
  return unlocked;
}

function mapLegacyNodeId(nodeId: string): string | null {
  const lookup: Record<string, string> = {
    click_t2_echoing: 'echoing_click',
    crit_t2_wave_collapse: 'wave_capture',
    time_t2_inflaton: 'inflaton_echo',
    click_t3_pair_production: 'pair_production',
    crit_t2_heisenberg: 'heisenberg',
    time_t3_dilation: 'dilation',
    auto_t3_filament: 'filament',
    click_t4_big_bang: 'big_bang_click',
    auto_t4_web_of_all: 'web_of_all',
    time_t4_eternal_return: 'eternal_return',
    crit_t4_schrodinger: 'cosmos_primal',
  };
  return lookup[nodeId] ?? null;
}

function normalizeSkillState(value: unknown, stageIdx: number, universeCount: number): SkillState {
  const fallback = createDefaultSkillState();
  fallback.unlockedTracks = getUnlockedTracksForProgress(stageIdx, universeCount);

  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const isNewShape =
    ['click', 'auto', 'crit', 'time'].every((trackId) => {
      const branch = record[trackId] as Record<string, unknown> | undefined;
      return !!branch && isFiniteNumber(branch.level);
    }) &&
    isStringArray(record.unlockedTracks) &&
    isStringArray(record.ownedCrossNodes);

  if (isNewShape) {
    return {
      click: { level: (record.click as Record<string, number>).level },
      auto: { level: (record.auto as Record<string, number>).level },
      crit: { level: (record.crit as Record<string, number>).level },
      time: { level: (record.time as Record<string, number>).level },
      unlockedTracks:
        (record.unlockedTracks as string[]).filter(
          (trackId): trackId is 'click' | 'auto' | 'crit' | 'time' =>
            trackId === 'click' || trackId === 'auto' || trackId === 'crit' || trackId === 'time',
        ) || fallback.unlockedTracks,
      ownedCrossNodes: record.ownedCrossNodes as string[],
    };
  }

  const isLegacyShape = ['click', 'auto', 'crit', 'time'].every((trackId) => {
    const branch = record[trackId] as Record<string, unknown> | undefined;
    return !!branch && isFiniteNumber(branch.rootLevel) && isStringArray(branch.ownedNodes);
  });

  if (!isLegacyShape) {
    return fallback;
  }

  const ownedCrossNodes = [
    ...new Set(
      ['click', 'auto', 'crit', 'time']
        .flatMap((trackId) => ((record[trackId] as Record<string, unknown>).ownedNodes as string[]))
        .map(mapLegacyNodeId)
        .filter((value): value is string => value !== null),
    ),
  ];

  return {
    click: { level: ((record.click as Record<string, number>).rootLevel ?? 0) as number },
    auto: { level: ((record.auto as Record<string, number>).rootLevel ?? 0) as number },
    crit: { level: ((record.crit as Record<string, number>).rootLevel ?? 0) as number },
    time: { level: ((record.time as Record<string, number>).rootLevel ?? 0) as number },
    unlockedTracks: getUnlockedTracksForProgress(stageIdx, universeCount),
    ownedCrossNodes,
  };
}

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
    value === 'vacuum_decay' ||
    value === 'bounce'
  );
}

function isEndingProgressFlags(value: unknown): value is EndingProgressFlags {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as EndingProgressFlags).bigRipEverEligible === 'boolean' &&
    typeof (value as EndingProgressFlags).bigCrunchEligible === 'boolean' &&
    typeof (value as EndingProgressFlags).vacuumDecayEligible === 'boolean'
  );
}

function isUniverseSeed(value: unknown): value is UniverseSeed {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as UniverseSeed).index) &&
    isFiniteNumber((value as UniverseSeed).gravityMod) &&
    isFiniteNumber((value as UniverseSeed).timeMod) &&
    isFiniteNumber((value as UniverseSeed).paletteShift) &&
    (typeof (value as UniverseSeed).anomaly === 'string' || (value as UniverseSeed).anomaly === null) &&
    typeof (value as UniverseSeed).atlasName === 'string'
  );
}

function isCondenseProgressEntry(value: unknown): value is CondenseProgressEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as CondenseProgressEntry).stageId) &&
    isFiniteNumber((value as CondenseProgressEntry).progressAtCondense)
  );
}

function isUniverseAtlasEntry(value: unknown): value is UniverseAtlasEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as UniverseAtlasEntry).universeIndex) &&
    typeof (value as UniverseAtlasEntry).atlasName === 'string' &&
    isEndingId((value as UniverseAtlasEntry).endingId) &&
    isFiniteNumber((value as UniverseAtlasEntry).durationMs) &&
    isFiniteNumber((value as UniverseAtlasEntry).totalClicks) &&
    isFiniteNumber((value as UniverseAtlasEntry).collisions) &&
    isFiniteNumber((value as UniverseAtlasEntry).completedAt) &&
    isUniverseSeed((value as UniverseAtlasEntry).seed)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSkillState(value: unknown): value is SkillState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    ['click', 'auto', 'crit', 'time'].every((treeId) => {
      const branch = record[treeId] as Record<string, unknown> | undefined;
      return !!branch && (isFiniteNumber(branch.level) || isFiniteNumber(branch.rootLevel));
    }) &&
    (record.unlockedTracks === undefined || isStringArray(record.unlockedTracks)) &&
    (record.ownedCrossNodes === undefined || isStringArray(record.ownedCrossNodes))
  );
}

function isDailyCheckInState(value: unknown): value is DailyCheckInState {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as DailyCheckInState).lastDayKey === 'string' &&
    isFiniteNumber((value as DailyCheckInState).streakDays)
  );
}

function isTutorialFlags(value: unknown): value is Record<number, boolean> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'boolean')
  );
}

export function createSaveSnapshot(state: GameState): SaveState {
  return {
    version: 4,
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

function migrateV1ToV2(v1: SaveStateV1): SaveStateV2 {
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

function migrateV2ToV3(v2: SaveStateV2): SaveStateV3 {
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

function migrateV3ToV4(v3: SaveStateV3): SaveStateV4 {
  return {
    ...v3,
    version: 4,
    tutorialDone: v3.tutorialDone,
    cosmicHoursThisRun: 0,
    dailyCheckIns: createDefaultDailyCheckIns(),
  };
}

function migrateV4ToV5(v4: SaveStateV4 | PersistentGameState): PersistentGameState {
  return {
    ...v4,
    endingsUnlocked: [...new Set(v4.endingsCompleted)],
    endingProgressFlags: createDefaultEndingProgressFlags(),
    clickRateLog: [],
    condenseProgressHistory: createDefaultCondenseProgressHistory(),
    universeAtlas: createDefaultUniverseAtlas(),
    currentUniverseSeed: createDefaultUniverseSeed(),
    stageClicksAtStageStart: v4.totalClicks,
    tutorialFlags: {},
  };
}

function validateV5(parsed: Partial<SaveState>): PersistentGameState | null {
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
    !isTutorialFlags(parsed.tutorialFlags)
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
    tutorialDone: parsed.tutorialDone,
    cosmicHoursThisRun: parsed.cosmicHoursThisRun,
    dailyCheckIns: parsed.dailyCheckIns,
    skillPoints: parsed.skillPoints,
    skills: normalizeSkillState(parsed.skills, parsed.stageIdx, parsed.universeCount),
    endingsUnlocked: parsed.endingsUnlocked.filter(isEndingId),
    endingProgressFlags: parsed.endingProgressFlags,
    clickRateLog: parsed.clickRateLog,
    condenseProgressHistory: parsed.condenseProgressHistory,
    universeAtlas: parsed.universeAtlas,
    currentUniverseSeed: parsed.currentUniverseSeed,
    stageClicksAtStageStart: parsed.stageClicksAtStageStart,
    tutorialFlags: parsed.tutorialFlags,
  };
}

export function loadGame(): PersistentGameState | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.save) ??
      localStorage.getItem(SAVE_KEY_V4) ??
      localStorage.getItem(SAVE_KEY_V3) ??
      localStorage.getItem(SAVE_KEY_V2) ??
      localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as
      | Partial<SaveState>
      | SaveStateV1
      | SaveStateV2
      | SaveStateV3
      | SaveStateV4
      | SaveStateV5Legacy;
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
      return validateV5(parsed as Partial<SaveState>);
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
  localStorage.removeItem(SAVE_KEY_V4);
  localStorage.removeItem(SAVE_KEY_V3);
  localStorage.removeItem(SAVE_KEY_V2);
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
