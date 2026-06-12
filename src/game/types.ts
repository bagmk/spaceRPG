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
import type { FloatingClickEvent, FloatingCollisionEvent, EncounterEvent, FusionEvent } from './types/events';
import type { SkillState, SkillTreeId } from './skills/types';
import type { EntityInstance } from './entities/types';
import type { PrestigeUpgradeLevels } from './prestige';

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
  /** Stage-advance gate: cumulative entropy required to condense out of this stage (D1). */
  entropyThreshold: number;
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
  /** Label for the Condense button when leaving this stage. Overrides the generic "Condense". */
  condenseLabel?: string;
  condenseLabelKo?: string;
  /** Visual flavor for the stage-exit transition (controls shake + wash colors). */
  transitionStyle?: TransitionStyle;
}

export type TransitionStyle =
  | 'bang'        // 1→2: Big Bang - sharp white expansion
  | 'condense'    // 2→3: matter wins, plasma settles
  | 'forge'       // 3→4: hadrons forge into nuclei
  | 'cool'        // 4→5: hot plasma cools
  | 'release'     // 5→6: light freed, expanding ring
  | 'ignite'      // 6→7: first star pop, warm flash
  | 'bloom'       // 7→8: UV blooms across cosmos
  | 'weave'       // 8→9: web/filaments spin out
  | 'kindle'      // 9→10: small warm spark
  | 'bloom-blue'  // 10→11: blue-green life blossom
  | 'swansong'    // 11→12: red giant swell + soft fade
  | 'fade-red'    // 12→13: last red dwarf fades
  | 'fade-dark'   // 13→14: stars gone, dim
  | 'pull-in'    // 14→15: collapse inward to BH era
  | 'evaporate'   // 15→16: hawking dissolve outward
  | 'final';      // 16: ending

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
  entropy?: number;
}

// ---------------------------------------------------------------------------
// Progress / progression flags
// ---------------------------------------------------------------------------

export interface EndingProgressFlags {
  /** Current-universe flag: reached the Big Crunch entropy threshold before entering Stage 3. */
  bigCrunchEligible: boolean;
  /** Current-universe flag: any Critical/Quantum Lens upgrade was purchased this universe. */
  criticalUpgradedThisUniverse: boolean;
  /** Legacy/current diagnostic: all Entity Lab upgrades have been maxed this universe. */
  bigRipEverEligible: boolean;
  /** Legacy/current diagnostic: the no-Critical Vacuum Decay path is eligible at the ending stage. */
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

export type ShopBoostCategory = 'time' | 'matter';

export interface ShopBoost {
  id: string;
  category: ShopBoostCategory;
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

export type { PurchasedEntityEntry, EntityInstance } from './entities/types';

export interface SaveState {
  version: 16;
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
  hasSeenCashShopTutorial: boolean;
  shopBoosts: ShopBoost[];
  hasOfflineStorageUpgrade: boolean;
  totalShopSpentUSD: number;
  /** Owned entity stacks — purchases + drops (replaces purchasedEntities in v14). */
  inventory: EntityInstance[];
  /** Click-gear entity ids equipped into slots (Phase 2 — effects move here). */
  equippedSlots: string[];
  /** How many click-gear slots are unlocked (1..3). */
  unlockedSlotCount: number;
  /** Rift (auto-gear) entity ids — equipped via the spatial rift. */
  riftSlots: string[];
  /** How many rift slots are unlocked (1..3). */
  unlockedRiftSlotCount: number;
  /** Almanac collection grid: stageId → entity ids ever collected. Survives prestige (D2). */
  almanacCollected: Record<number, string[]>;
  /** Consecutive fusions without a rarity upgrade — D4 pity counter. */
  fusionPity: number;
  prestigeUpgrades: PrestigeUpgradeLevels;
  peakEntropy: number;
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
  lastFusionEvent: FusionEvent | null;
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
