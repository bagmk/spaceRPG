import type { SkillState, SkillTreeId } from './skills/types';

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
  clickUpgradeName: string;
  autoUpgradeName: string;
  quote: string;
  quoteAttr: string;
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

export type EndingId = 'heat_death' | 'big_rip' | 'big_crunch' | 'vacuum_decay' | 'bounce';

export type AnomalyType =
  | 'crystalline'
  | 'inverted_time'
  | 'high_energy'
  | 'dim'
  | 'echoing';

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

export interface EndingProgressFlags {
  bigRipEverEligible: boolean;
  bigCrunchEligible: boolean;
  vacuumDecayEligible: boolean;
}

export interface CondenseProgressEntry {
  stageId: number;
  progressAtCondense: number;
}

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

export interface FloatingClickEvent {
  id: number;
  x: number;
  y: number;
  gained: number;
  isCrit: boolean;
  combo: number;
  comboMult: number;
  particleName: string;
  particleDefinition?: string;
}

export interface FloatingCollisionEvent {
  id: number;
  x: number;
  y: number;
  bonus: number;
  name: string;
  tier: RogueTypeKey;
}

export interface EncounterEvent {
  id: number;
  name: string;
  color: string;
}

export interface DailyCheckInState {
  lastDayKey: string;
  streakDays: number;
}

export interface SaveState {
  version: 4;
  stageIdx: number;
  quanta: number;
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
  tutorialFlags: Record<number, boolean>;
}

export type PersistentGameState = Omit<SaveState, 'version'>;

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
  endingStartedAt: number | null;
}

export type RogueTypeKey = 'minor' | 'major' | 'massive';

export interface RogueTypeDefinition {
  weight: number;
  r: number;
  bonusMultiplier: number;
  entropyBonus: number;
  color: string;
  glowColor: string;
  name: string;
}

export interface Rogue {
  id: number;
  stageId: number;
  typeKey: RogueTypeKey;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  glowColor: string;
  name: string;
  bonus: number;
  entropyBonus: number;
  age: number;
  spotted: boolean;
  rotation: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  depth: number;
  twinkle: number;
}

export interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  phase: number;
  alpha: number;
}

export interface Flyer {
  x: number;
  y: number;
  life: number;
  auto?: boolean;
  spriteId?: number;
}

export interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  color: string;
  spriteId?: number;
}

export interface WakeTrail {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  color: string;
}

export interface Shockwave {
  startedAt: number;
  color: string;
  x?: number;
  y?: number;
  maxRadius?: number;
  lifeMs?: number;
  lineWidth?: number;
}

export type ClusterMode =
  | 'inflation'
  | 'baryogenesis'
  | 'qgPlasma'
  | 'nucleosynthesis'
  | 'recombination'
  | 'darkAge'
  | 'firstStars'
  | 'reionization'
  | 'galaxy'
  | 'planetary'
  | 'lifeSurface'
  | 'redGiant'
  | 'remnant'
  | 'degenerate'
  | 'blackHole'
  | 'heatDeath';

export interface Mote {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  r: number;
  color: string;
  hue: number;
  age: number;
  bornAt: number;
  temperature?: number;
  surfaceLat?: number;
  surfaceLon?: number;
  surfaceKind?: 'plant' | 'city' | 'water';
  orbitAngle?: number;
  orbitRadius?: number;
  spiralPhase?: number;
}

export interface MoteCluster {
  motes: Mote[];
  nextMoteId: number;
  physicalRadius: number;
  diskTilt?: number;
  diskRotation?: number;
  earthRotation?: number;
}

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
