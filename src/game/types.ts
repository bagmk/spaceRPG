/**
 * Core game types. Import from here for anything game-engine related.
 *
 * Canvas-only types: import from './types/canvas' (or here — they're re-exported).
 * UI event types:    import from './types/events' (or here — they're re-exported).
 */

// Re-export sub-domain types so all existing imports stay unchanged.
export type * from './types/canvas';
export type * from './types/events';

// These imports let us USE the sub-domain types in interface definitions below.
import type { StageBackground, ClusterMode, Star, AmbientParticle, Flyer, Burst, WakeTrail, Rogue, Shockwave, MoteCluster } from './types/canvas';
import type { FloatingClickEvent, FloatingCollisionEvent, EncounterEvent } from './types/events';
import type { SkillState, SkillTreeId } from './skills/types';
import type { PurchasedEntityEntry } from './entities/types';

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

export interface Stage {
  id: number;
  name: string;
  resource: string;
  time: string;
  cosmicTimeSec: number;
  cosmicTimeSpanSec: number;
  realPlayTargetSec: number;
  timelinePos: number;
  threshold: number;
  clusterMode: ClusterMode;
  mechanic: StageMechanicId;
  accent: string;
  coreColor: string;
  particleColors: string[];
  background: StageBackground;
  clickUpgradeName: string;
  autoUpgradeName: string;
  quote: string;
  quoteAttr: string;
  quoteKo?: string;
  quoteAttrKo?: string;
  zoomDirection: 'in' | 'out' | 'none';
  silenceBeforeMs?: number;
  endingId?: EndingId;
}

export type StageMechanicId =
  | 'click_basic'
  | 'matter_asymmetry'
  | 'fusion_window'
  | 'recombination'
  | 'dark_age'
  | 'first_stars'
  | 'reionization'
  | 'galaxy_weaving'
  | 'planet_formation'
  | 'life_evolution'
  | 'civilization'
  | 'red_giant'
  | 'remnant_cooling'
  | 'proton_decay'
  | 'hawking_radiation'
  | 'ending_choice';

// ---------------------------------------------------------------------------
// Core value types
// ---------------------------------------------------------------------------

export type EndingId = 'heat_death' | 'big_rip' | 'big_crunch' | 'vacuum_decay' | 'bounce';

export type AnomalyType =
  | 'crystalline'
  | 'inverted_time'
  | 'high_energy'
  | 'dim'
  | 'echoing';

// ---------------------------------------------------------------------------
// Universe / multiverse
// ---------------------------------------------------------------------------

export interface UniverseSeed {
  index: number;
  gravityMod: number;
  timeMod: number;
  paletteShift: number;
  anomaly: AnomalyType | null;
  atlasName: string;
}

export interface UniverseAtlasEntry {
  universeIndex: number;
  atlasName: string;
  endingId: EndingId;
  durationMs: number;
  totalClicks: number;
  collisions: number;
  completedAt: number;
  seed: UniverseSeed;
}

// ---------------------------------------------------------------------------
// Progress / progression flags
// ---------------------------------------------------------------------------

export interface EndingProgressFlags {
  bigRipEverEligible: boolean;
  bigCrunchEligible: boolean;
  vacuumDecayEligible: boolean;
}

export interface CondenseProgressEntry {
  stageId: number;
  progressAtCondense: number;
}

// ---------------------------------------------------------------------------
// Shop boosts
// ---------------------------------------------------------------------------

export interface TimedShopBoost {
  factor: number;
  expiresAt: number;
}

export interface ShopBoost {
  id: string;
  factor: number;
  expiresAt: number;
}

export interface LegacyShopBoosts {
  timeMult?: TimedShopBoost;
  quantaMult?: TimedShopBoost;
}

// ---------------------------------------------------------------------------
// Singularity
// ---------------------------------------------------------------------------

export type SingularityUnlockId =
  | 'quark_foam'
  | 'free_combo'
  | 'stellar_memory'
  | 'hawking_echo'
  | 'inflaton_spark'
  | 'cosmic_web'
  | 'red_shift'
  | 'multiverse_lens'
  | 'vacuum_stability'
  | 'boltzmann_brain';

// ---------------------------------------------------------------------------
// Misc game objects
// ---------------------------------------------------------------------------

export interface DailyCheckInState {
  lastDayKey: string;
  streakDays: number;
}

// ---------------------------------------------------------------------------
// Canvas world (stays here because it references StageMechanicId)
// ---------------------------------------------------------------------------

export interface CanvasWorld {
  coreVX: number;
  coreVY: number;
  driftAngle: number;
  stars: Star[];
  particles: AmbientParticle[];
  flyers: Flyer[];
  bursts: Burst[];
  wakeTrails: WakeTrail[];
  rogues: Rogue[];
  shockwaves: Shockwave[];
  rogueCooldown: number;
  nextId: number;
  cluster: MoteCluster;
  moteNeighborCache: Map<number, number[]>;
  moteLastNeighborRefresh: number;
  moteLastAutoSpawnAt: number;
  mechanicState: Partial<Record<StageMechanicId, unknown>>;
}

// ---------------------------------------------------------------------------
// Save / persistent state
// ---------------------------------------------------------------------------

export type { PurchasedEntityEntry } from './entities/types';

export interface SaveState {
  version: 9;
  stageIdx: number;
  quanta: number;
  timeGauge: number;
  clickLevel: number;
  autoLevel: number;
  critLevel: number;
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
  tutorialDone: boolean;
  cosmicHoursThisRun: number;
  dailyCheckIns: DailyCheckInState;
  skillPoints: number;
  skills: SkillState;
  endingsUnlocked: EndingId[];
  endingProgressFlags: EndingProgressFlags;
  clickRateLog: number[];
  condenseProgressHistory: CondenseProgressEntry[];
  universeAtlas: UniverseAtlasEntry[];
  currentUniverseSeed: UniverseSeed;
  stageClicksAtStageStart: number;
  tutorialFlags: Record<string, boolean>;
  shopBoosts: ShopBoost[];
  totalShopSpentUSD: number;
  purchasedEntities: PurchasedEntityEntry[];
}

export type PersistentGameState = Omit<SaveState, 'version'>;

/** Full runtime state — PersistentGameState + transient UI fields (never saved). */
export interface GameState extends PersistentGameState {
  combo: number;
  lastClick: number;
  imploding: boolean;
  condenseStartedAt: number | null;
  eventCounter: number;
  lastClickEvent: FloatingClickEvent | null;
  lastCollisionEvent: FloatingCollisionEvent | null;
  lastEncounterEvent: EncounterEvent | null;
  offlineElapsedMs: number;
  offlineGained: number;
  offlineEntropyGained: number;
  offlineTimeProgressGained: number;
  endingStartedAt: number | null;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export interface UpgradeDefinition {
  label: string;
  level: number;
  cost: number;
  description: string;
  disabled: boolean;
}

export interface TimeFlow {
  cosmicTimePerRealSec: number;
  cosmicClockSec: number;
}

export interface EndingOption {
  id: EndingId;
  label: string;
  description: string;
  unlocked: boolean;
  seen: boolean;
  requirement: string;
}

export interface SingularityUnlockDefinition {
  id: SingularityUnlockId;
  label: string;
  cost: number;
  effect: string;
  description: string;
}

export interface TutorialStepState {
  active: boolean;
  step: 1 | 2 | 3;
}

export type SkillPurchaseTarget =
  | { kind: 'track'; treeId: SkillTreeId }
  | { kind: 'cross'; nodeId: string };
