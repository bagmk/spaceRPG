/** Canvas-only rendering types. No game logic or state here. */

export type DistantElementType =
  | 'expansion_burst'
  | 'pair_streaks'
  | 'plasma_swirl'
  | 'binding_orbits'
  | 'clearing_fog'
  | 'void'
  | 'bright_pinpoints'
  | 'ionization_bubbles'
  | 'galaxy_field'
  | 'nearby_stars'
  | 'earth_orbit'
  | 'red_shroud'
  | 'fading_stars'
  | 'dim_specks'
  | 'lensed_field'
  | 'redshifted_void';

export interface StageBackground {
  gradientTop: string;
  gradientBottom: string;
  nebulaIntensity: number;
  starDensity: number;
  starColor: string;
  distantElementColor: string;
  distantElements: DistantElementType;
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
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  targetX: number;
  targetY: number;
  t: number;
  life: number;
  auto?: boolean;
  spriteId?: number;
}

export interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn?: number;
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
  spin: number;
  spinVel: number;
}

export interface MoteCluster {
  motes: Mote[];
  nextMoteId: number;
  physicalRadius: number;
  diskTilt?: number;
  diskRotation?: number;
  earthRotation?: number;
  moonAngleOffset?: number;
  moonNudgeImpulse?: number;
}
