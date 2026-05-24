import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { drawCluster } from '../canvas/drawCluster';
import { drawCore } from '../canvas/drawCore';
import { drawEffects } from '../canvas/drawEffects';
import { drawEntities, getStage11MoonScreen } from '../canvas/drawEntities';
import { drawParticles } from '../canvas/drawParticles';
import { drawRogues } from '../canvas/drawRogues';
import { drawStars } from '../canvas/drawStars';
import { drawWake } from '../canvas/drawWake';
import { ROGUE_TYPES, TUNING } from '../game/constants';
import { getProgress } from '../game/formulas';
import { getMechanic } from '../game/mechanics';
import { STAGES } from '../game/stages';
import { getStageRogueColor, getStageRogueName } from '../canvas/stageSprites';
import type {
  AnomalyType,
  AmbientParticle,
  Burst,
  CanvasWorld,
  Flyer,
  FloatingClickEvent,
  Mote,
  MoteCluster,
  Rogue,
  RogueTypeKey,
  Shockwave,
  Stage,
  Star,
  WakeTrail,
} from '../game/types';
import type { PurchasedEntityEntry } from '../game/entities/types';

interface CollisionPayload {
  x: number;
  y: number;
  bonus: number;
  entropyBonus: number;
  tier: RogueTypeKey;
  name: string;
}

interface EncounterPayload {
  name: string;
  color: string;
}

interface ParticleFieldProps {
  stage: Stage;
  actualStageId: number;
  quanta: number;
  autoRate: number;
  timeMult: number;
  cosmicClockSec: number;
  effectiveThreshold: number;
  totalClicks: number;
  imploding: boolean;
  interactionLocked: boolean;
  lastClickEvent: FloatingClickEvent | null;
  stageTransitionStartedAt: number | null;
  clickEmissionCount: number;
  clickVfxScale: number;
  gravityMod: number;
  anomaly: AnomalyType | null;
  purchasedEntities: PurchasedEntityEntry[];
  onGatherClick: (x: number, y: number, forceCrit: boolean) => void;
  onEncounter: (payload: EncounterPayload) => void;
  onCollision: (payload: CollisionPayload) => void;
}

export interface ParticleFieldHandle {
  /** Advance physics + render one frame. Driven by GameScreen's master rAF loop. */
  tick: (now: number, dt: number) => void;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createWorld(width: number, height: number, stage: Stage): CanvasWorld {
  const world: CanvasWorld = {
    coreVX: 0,
    coreVY: 0,
    driftAngle: Math.random() * Math.PI * 2,
    stars: createStars(width, height),
    particles: createParticles(width, height, stage),
    flyers: [],
    bursts: [],
    wakeTrails: [],
    rogues: [],
    shockwaves: [],
    rogueCooldown: TUNING.FIRST_ENCOUNTER_DELAY_MS,
    nextId: 1,
    cluster: createMoteCluster(),
    moteNeighborCache: new Map<number, number[]>(),
    moteLastNeighborRefresh: 0,
    moteLastAutoSpawnAt: 0,
    mechanicState: {},
  };
  getMechanic(stage.mechanic).init?.(world);
  return world;
}

function createMoteCluster(): MoteCluster {
  return {
    motes: [],
    nextMoteId: 1,
    physicalRadius: TUNING.MOTE_CLUSTER_MIN_RADIUS,
    diskTilt: TUNING.BLACKHOLE_DISK_TILT,
    diskRotation: 0,
    earthRotation: 0,
    moonAngleOffset: 0,
    moonNudgeImpulse: 0,
  };
}

function createStars(width: number, height: number): Star[] {
  return TUNING.STAR_LAYERS.flatMap((layer) =>
    Array.from({ length: layer.count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: randomBetween(layer.rMin, layer.rMax),
      a: randomBetween(layer.alphaMin, layer.alphaMax),
      depth: layer.depth,
      twinkle: Math.random() * Math.PI * 2,
    })),
  );
}

function spawnParticleAtEdge(
  particle: AmbientParticle,
  width: number,
  height: number,
): AmbientParticle {
  const cx = width / 2;
  const cy = height / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius =
    Math.max(width, height) * TUNING.PARTICLE_EDGE_RADIUS_FRAC +
    Math.random() * TUNING.PARTICLE_EDGE_VARIANCE;
  const tangentialVelocity = 0.9 + Math.random() * 0.7;
  const direction = Math.random() < 0.5 ? 1 : -1;
  return {
    ...particle,
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    vx: -Math.sin(angle) * tangentialVelocity * direction,
    vy: Math.cos(angle) * tangentialVelocity * direction,
  };
}

function createParticles(width: number, height: number, stage: Stage): AmbientParticle[] {
  return Array.from({ length: TUNING.AMBIENT_PARTICLE_COUNT }, () => {
    const particle = spawnParticleAtEdge(
      {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        r: Math.random() * 2 + 0.5,
        color: stage.particleColors[Math.floor(Math.random() * stage.particleColors.length)],
        phase: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.5 + 0.4,
      },
      width,
      height,
    );
    return {
      ...particle,
      x: Math.random() * width,
      y: Math.random() * height,
    };
  });
}

function pickRogueType(): RogueTypeKey {
  const keys = Object.keys(ROGUE_TYPES) as RogueTypeKey[];
  const totalWeight = keys.reduce((sum, key) => sum + ROGUE_TYPES[key].weight, 0);
  let roll = Math.random() * totalWeight;
  for (const key of keys) {
    roll -= ROGUE_TYPES[key].weight;
    if (roll <= 0) {
      return key;
    }
  }
  return 'minor';
}

function createShockwave(
  color: string,
  x?: number,
  y?: number,
  maxRadius?: number,
  lifeMs?: number,
  lineWidth?: number,
): Shockwave {
  return { startedAt: performance.now(), color, x, y, maxRadius, lifeMs, lineWidth };
}

function createBurstSet(
  x: number,
  y: number,
  count: number,
  color: string,
  speedBase: number,
  stageId?: number,
  radiusScale = 1,
): Burst[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed = speedBase + Math.random() * 3;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      turn: (Math.random() < 0.5 ? -1 : 1) * (0.012 + Math.random() * 0.018),
      r: (2 + Math.random() * 2.5) * radiusScale,
      life: 1,
      color,
      spriteId: stageId,
    };
  });
}

function createCurvedFlyer(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  isAuto: boolean,
  spriteId: number,
): Flyer {
  const midX = (startX + targetX) / 2;
  const midY = (startY + targetY) / 2;
  const offsetMagnitude = Math.hypot(targetX - startX, targetY - startY) * 0.4;
  const offsetAngle = Math.atan2(targetY - startY, targetX - startX) + Math.PI / 2;
  const sign = Math.random() < 0.5 ? 1 : -1;
  return {
    x: startX,
    y: startY,
    startX,
    startY,
    controlX: midX + Math.cos(offsetAngle) * offsetMagnitude * sign,
    controlY: midY + Math.sin(offsetAngle) * offsetMagnitude * sign,
    targetX,
    targetY,
    t: 0,
    life: 1,
    auto: isAuto,
    spriteId,
  };
}

function getCosmicStageProgress(stage: Stage, cosmicClockSec: number): number {
  const stageStart = STAGES[stage.id - 2]?.cosmicTimeSec ?? 1e-34;
  if (cosmicClockSec <= stageStart) return 0;
  const startLog = Math.log10(stageStart);
  const endLog = Math.log10(stage.cosmicTimeSec);
  const span = endLog - startLog;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (Math.log10(cosmicClockSec) - startLog) / span));
}

function getMoteRadius(mass: number): number {
  return TUNING.MOTE_BASE_RADIUS + Math.sqrt(mass) * TUNING.MOTE_RADIUS_PER_MASS;
}

function getClusterTargetRadius(stage: Stage, moteCount: number, progress: number): number {
  const growth = Math.sqrt(Math.max(1, moteCount));
  switch (stage.clusterMode) {
    case 'galaxy':
      return Math.min(
        TUNING.GALAXY_DISK_MAX_RADIUS,
        TUNING.GALAXY_DISK_MIN_RADIUS +
          growth * TUNING.GALAXY_DISK_GROW_PER_SQRT_MOTE +
          progress * 42,
      );
    case 'planetary':
      return Math.min(
        TUNING.PLANETARY_ORBIT_MAX_RADIUS,
        TUNING.PLANETARY_ORBIT_MIN_RADIUS +
          growth * TUNING.PLANETARY_ORBIT_GROW_PER_SQRT_MOTE +
          progress * 30,
      );
    case 'redGiant':
      return Math.min(
        TUNING.MOTE_CLUSTER_MAX_RADIUS + 48,
        58 + growth * (TUNING.MOTE_CLUSTER_GROW_PER_SQRT_MOTE + 2.4) + progress * 76,
      );
    case 'remnant':
      return Math.min(136, 32 + growth * 5.8 + progress * 20);
    case 'heatDeath':
      return Math.min(TUNING.MOTE_CLUSTER_MAX_RADIUS + 70, 48 + growth * 9.4 + progress * 55);
    case 'blackHole':
      return Math.min(
        TUNING.BLACKHOLE_DISK_OUTER_MAX,
        TUNING.BLACKHOLE_DISK_OUTER_BASE + moteCount * TUNING.BLACKHOLE_DISK_GROW_PER_MOTE,
      );
    case 'lifeSurface':
      return TUNING.LIFE_SURFACE_R;
    case 'inflation':
    case 'baryogenesis':
    case 'qgPlasma':
    case 'nucleosynthesis':
    case 'recombination':
    case 'darkAge':
    case 'firstStars':
    case 'reionization':
      return Math.min(
        TUNING.MOTE_CLUSTER_MAX_RADIUS,
        TUNING.MOTE_CLUSTER_MIN_RADIUS +
          growth * TUNING.MOTE_CLUSTER_GROW_PER_SQRT_MOTE +
          progress * 28,
      );
    default:
      return Math.min(
        TUNING.MOTE_CLUSTER_MAX_RADIUS,
        TUNING.MOTE_CLUSTER_MIN_RADIUS +
          growth * TUNING.MOTE_CLUSTER_GROW_PER_SQRT_MOTE +
          progress * 28,
      );
  }
}

function pickStageColor(stage: Stage): string {
  return stage.particleColors[Math.floor(Math.random() * stage.particleColors.length)] ?? stage.accent;
}

function createBaseMote(
  cluster: MoteCluster,
  stage: Stage,
  x: number,
  y: number,
  vx: number,
  vy: number,
  now: number,
): Mote {
  const hue = Math.random();
  return {
    id: cluster.nextMoteId++,
    x,
    y,
    vx,
    vy,
    mass: TUNING.MOTE_BASE_MASS,
    r: getMoteRadius(TUNING.MOTE_BASE_MASS),
    color: pickStageColor(stage),
    hue,
    age: 0,
    bornAt: now,
    spin: Math.random() * Math.PI * 2,
    spinVel: (Math.random() - 0.5) * 0.08,
  };
}

function addMoteToCluster(cluster: MoteCluster, _stage: Stage, mote: Mote, _maxMassCap: number): void {
  if (cluster.motes.length >= TUNING.MOTE_MAX) {
    enrichExistingMote(cluster, _stage, mote, _maxMassCap);
    return;
  }
  cluster.motes.push(mote);
}

function enrichExistingMote(cluster: MoteCluster, stage: Stage, incoming: Mote, maxMassCap: number): void {
  if (cluster.motes.length === 0) {
    cluster.motes.push(incoming);
    return;
  }

  let target =
    stage.clusterMode === 'lifeSurface'
      ? cluster.motes[Math.floor(Math.random() * cluster.motes.length)]
      : cluster.motes[0];

  if (stage.clusterMode !== 'lifeSurface') {
    let bestDistance = Number.POSITIVE_INFINITY;
    cluster.motes.forEach((mote) => {
      const dx = mote.x - incoming.x;
      const dy = mote.y - incoming.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        target = mote;
      }
    });
  }

  const totalMass = Math.min(maxMassCap, target.mass + incoming.mass * 0.55);
  const blend = incoming.mass / Math.max(target.mass + incoming.mass, 1);
  target.x += (incoming.x - target.x) * blend * 0.25;
  target.y += (incoming.y - target.y) * blend * 0.25;
  target.vx += incoming.vx * 0.35;
  target.vy += incoming.vy * 0.35;
  target.mass = totalMass;
  target.r = getMoteRadius(totalMass);
  target.age = Math.max(target.age, incoming.age);

  if (stage.clusterMode === 'lifeSurface') {
    if (incoming.surfaceLat !== undefined && Math.random() < 0.35) {
      target.surfaceLat = incoming.surfaceLat;
      target.surfaceLon = incoming.surfaceLon;
    }
    if (Math.random() < 0.7) {
      target.surfaceKind = 'plant';
      target.color = '#65e88f';
    }
  }
}

function getEffectiveMaxMass(progress01: number): number {
  return 12 + Math.floor(progress01 * 100);
}

function createSurfaceMote(cluster: MoteCluster, stage: Stage, cx: number, cy: number, now: number): Mote {
  const count = cluster.motes.length;
  const roll = Math.random();
  const surfaceKind: Mote['surfaceKind'] =
    count > 90 && roll > 0.78 ? 'city' : count > 38 && roll > 0.86 ? 'water' : 'plant';
  return {
    ...createBaseMote(cluster, stage, cx, cy, 0, 0, now),
    surfaceLat: (Math.random() - 0.5) * Math.PI * 0.86,
    surfaceLon: Math.random() * Math.PI * 2,
    surfaceKind,
    color:
      surfaceKind === 'city'
        ? '#ffeeaa'
        : surfaceKind === 'water'
          ? '#9de8ff'
          : '#65e88f',
  };
}

function createPhotonMote(
  cluster: MoteCluster,
  stage: Stage,
  cx: number,
  cy: number,
  now: number,
  clickX?: number,
  clickY?: number,
): Mote {
  const clickAngle = Math.atan2((clickY ?? cy) - cy, (clickX ?? cx + 1) - cx);
  const angle =
    Math.random() < 0.45
      ? clickAngle + (Math.random() - 0.5) * 1.6
      : Math.random() * Math.PI * 2;
  const outer = Math.max(TUNING.BLACKHOLE_DISK_OUTER_BASE, cluster.physicalRadius);
  const spawnR = outer * (0.78 + Math.random() * 0.38);
  const x = cx + Math.cos(angle) * spawnR;
  const y = cy + Math.sin(angle) * spawnR;
  const mote = createBaseMote(
    cluster,
    stage,
    x,
    y,
    -Math.sin(angle) * 1.4,
    Math.cos(angle) * 1.4,
    now,
  );
  mote.color = Math.random() > 0.42 ? stage.coreColor : '#fff0c8';
  mote.orbitRadius = Math.random() * Math.max(36, outer - TUNING.BLACKHOLE_DISK_INNER);
  mote.orbitAngle = angle;
  mote.spiralPhase = Math.random() * Math.PI * 2;
  return mote;
}

function spawnMotesAtClick(
  cluster: MoteCluster,
  stage: Stage,
  clickX: number,
  clickY: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
  isCrit: boolean,
  clickEmissionCount: number,
  maxMassCap: number,
  now: number,
): void {
  const count =
    ((isCrit ? TUNING.MOTE_PER_CLICK * 2 : TUNING.MOTE_PER_CLICK) + (isCrit ? 1 : 0)) *
    Math.max(1, clickEmissionCount);
  for (let i = 0; i < count; i += 1) {
    if (stage.clusterMode === 'lifeSurface') {
      // Spawn motes OUTSIDE earth radius so they're visible
      const earthR = TUNING.LIFE_SURFACE_R;
      const spawnAngle = Math.atan2(clickY - cy, clickX - cx) + (Math.random() - 0.5) * 1.2;
      const spawnR = earthR * (1.15 + Math.random() * 0.6);
      const mx = cx + Math.cos(spawnAngle) * spawnR;
      const my = cy + Math.sin(spawnAngle) * spawnR;
      const mote = createBaseMote(cluster, stage, mx, my,
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, now);
      mote.color = `hsl(${190 + Math.random() * 30}, ${60 + Math.random() * 20}%, ${75 + Math.random() * 15}%)`;
      mote.surfaceKind = 'water';
      addMoteToCluster(cluster, stage, mote, maxMassCap);
      continue;
    }
    if (stage.clusterMode === 'blackHole') {
      addMoteToCluster(
        cluster,
        stage,
        createPhotonMote(cluster, stage, cx, cy, now, clickX, clickY),
        maxMassCap,
      );
      continue;
    }

    const clickAngle = Math.atan2(clickY - cy, clickX - cx);
    const angle =
      Math.random() < 0.32
        ? clickAngle + (Math.random() - 0.5) * Math.PI * 1.35
        : Math.random() * Math.PI * 2;
    const clusterRadius = Math.max(TUNING.MOTE_CLUSTER_MIN_RADIUS, cluster.physicalRadius);
    const spawnSpread = Math.max(8, Math.max(width, height) * TUNING.MOTE_SPAWN_RADIUS_FRAC * 0.05);
    const radius = clusterRadius * (0.16 + Math.random() * 0.94);
    const x = cx + Math.cos(angle) * radius + (Math.random() - 0.5) * spawnSpread;
    const y = cy + Math.sin(angle) * radius + (Math.random() - 0.5) * spawnSpread;
    const mote = createBaseMote(
      cluster,
      stage,
      x,
      y,
      Math.cos(clickAngle) * 0.28 + (Math.random() - 0.5) * 0.9,
      Math.sin(clickAngle) * 0.28 + (Math.random() - 0.5) * 0.9,
      now,
    );
    if (stage.clusterMode === 'planetary') {
      const growthRadius = getClusterTargetRadius(stage, cluster.motes.length + 1, 0);
      mote.orbitRadius = 48 + Math.random() * Math.max(38, growthRadius - 36);
      mote.orbitAngle = Math.atan2(y - cy, x - cx);
    }
    if (stage.clusterMode === 'galaxy') {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.max(1, Math.hypot(dx, dy));
      mote.vx += (-dy / d) * 1.15;
      mote.vy += (dx / d) * 1.15;
      mote.orbitRadius = 28 + Math.random() * getClusterTargetRadius(stage, cluster.motes.length + 1, 0);
      mote.spiralPhase = Math.random() * Math.PI * 2;
    }
    addMoteToCluster(cluster, stage, mote, maxMassCap);
  }
}

function spawnAutoMote(
  cluster: MoteCluster,
  stage: Stage,
  cx: number,
  cy: number,
  maxMassCap: number,
  now: number,
): void {
  if (stage.clusterMode === 'lifeSurface') {
    const earthR = TUNING.LIFE_SURFACE_R;
    const angle = Math.random() * Math.PI * 2;
    const spawnR = earthR * (1.1 + Math.random() * 0.5);
    const mx = cx + Math.cos(angle) * spawnR;
    const my = cy + Math.sin(angle) * spawnR;
    const mote = createBaseMote(cluster, stage, mx, my,
      (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, now);
    mote.color = `hsl(${190 + Math.random() * 30}, ${60 + Math.random() * 20}%, ${75 + Math.random() * 15}%)`;
    mote.surfaceKind = 'water';
    addMoteToCluster(cluster, stage, mote, maxMassCap);
    return;
  }
  if (stage.clusterMode === 'blackHole') {
    addMoteToCluster(cluster, stage, createPhotonMote(cluster, stage, cx, cy, now), maxMassCap);
    return;
  }
  const angle = Math.random() * Math.PI * 2;
  const radius = 28 + Math.random() * 86;
  const mote = createBaseMote(
    cluster,
    stage,
    cx + Math.cos(angle) * radius,
    cy + Math.sin(angle) * radius,
    -Math.sin(angle) * 0.7,
    Math.cos(angle) * 0.7,
    now,
  );
  if (stage.clusterMode === 'planetary') {
    const growthRadius = getClusterTargetRadius(stage, cluster.motes.length + 1, 0);
    mote.orbitRadius = 48 + Math.random() * Math.max(38, growthRadius - 36);
    mote.orbitAngle = angle;
  }
  if (stage.clusterMode === 'galaxy') {
    mote.orbitRadius = 28 + Math.random() * getClusterTargetRadius(stage, cluster.motes.length + 1, 0);
  }
  addMoteToCluster(cluster, stage, mote, maxMassCap);
}

function resetForStage(world: CanvasWorld, width: number, height: number, stage: Stage): CanvasWorld {
  const nextWorld = {
    ...createWorld(width, height, stage),
    nextId: world.nextId,
  };
  return nextWorld;
}

function capWorldCollections(world: CanvasWorld): void {
  world.bursts = world.bursts.slice(-TUNING.BURST_MAX);
  world.flyers = world.flyers.slice(-TUNING.FLYER_MAX);
  world.wakeTrails = world.wakeTrails.slice(-TUNING.WAKE_TRAIL_MAX);
  world.shockwaves = world.shockwaves.slice(-TUNING.SHOCKWAVE_MAX);
  // Don't cap rogues — they're managed by expire/despawn/collision logic
}

function getBlackHoleRadius(width: number, height: number, progress: number): number {
  const initialRadius = Math.min(width, height) * 0.3;
  return initialRadius * Math.pow(1 - progress, 0.7) + 5 * Math.pow(progress, 1.5);
}

function getHawkingPhotonColor(progress: number): string {
  if (progress > 0.85) return '#fff7db';
  if (progress > 0.55) return '#ffd8a0';
  return '#bba3ff';
}

function stepClusterPhysics(
  world: CanvasWorld,
  stage: Stage,
  cx: number,
  cy: number,
  dt: number,
  now: number,
  progress: number,
): void {
  const cluster = world.cluster;
  const motes = cluster.motes;
  const effectiveMaxMass = getEffectiveMaxMass(progress);
  if (motes.length === 0) {
    return;
  }

  const shouldRefreshNeighbors =
    now - world.moteLastNeighborRefresh >= TUNING.MOTE_NEIGHBOR_REFRESH_MS;
  if (shouldRefreshNeighbors) {
    refreshNeighborCache(motes, world.moteNeighborCache);
    world.moteLastNeighborRefresh = now;
  }

  cluster.diskRotation = (cluster.diskRotation ?? 0) + dt * 0.0011;
  cluster.earthRotation = (cluster.earthRotation ?? 0) + dt * TUNING.LIFE_EARTH_ROT_RATE;
  // Moon nudge impulse decays back to zero over ~700ms so the user sees a
  // bright flash on click that fades smoothly.
  if ((cluster.moonNudgeImpulse ?? 0) > 0) {
    cluster.moonNudgeImpulse = Math.max(0, (cluster.moonNudgeImpulse ?? 0) - dt * 0.0016);
  }

  const dtScale = Math.min(2.2, Math.max(0.2, dt / 16.67));
  const clusterMass = motes.reduce((sum, mote) => sum + mote.mass, 0);
  const targetClusterRadius = getClusterTargetRadius(stage, Math.max(motes.length, clusterMass), progress);
  cluster.physicalRadius += (targetClusterRadius - cluster.physicalRadius) * 0.045 * dtScale;
  const moteById = new Map(motes.map((mote) => [mote.id, mote]));

  motes.forEach((mote) => {
    applyAnchorForce(mote, stage, cx, cy, cluster.physicalRadius, dtScale);
    applyMoteWander(mote, stage, cx, cy, now, dtScale);
    const neighbors = world.moteNeighborCache.get(mote.id) ?? [];
    const isInflation = stage.clusterMode === 'inflation';
    neighbors.forEach((neighborId) => {
      const neighbor = moteById.get(neighborId);
      if (!neighbor) {
        return;
      }
      const dx = neighbor.x - mote.x;
      const dy = neighbor.y - mote.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const preferredDistance = mote.r + neighbor.r + TUNING.MOTE_REPULSION_DISTANCE;
      const repulsionMult = isInflation ? 4.0 : 1.0;
      if (d < preferredDistance) {
        const pressure = ((preferredDistance - d) / preferredDistance) * TUNING.MOTE_REPULSION_STRENGTH * repulsionMult * dtScale;
        mote.vx -= (dx / d) * pressure;
        mote.vy -= (dy / d) * pressure;
      }
      const dSq = d * d + 25;
      const peerGravityMult = isInflation ? 3.5 : 1.0;
      const force = (TUNING.MOTE_PEER_GRAVITY * peerGravityMult * neighbor.mass * dtScale) / dSq;
      mote.vx += dx * force;
      mote.vy += dy * force;
    });

    mote.vx *= TUNING.MOTE_DAMPENING;
    mote.vy *= TUNING.MOTE_DAMPENING;
    const speed = Math.hypot(mote.vx, mote.vy);
    if (speed > TUNING.MOTE_MAX_SPEED) {
      mote.vx = (mote.vx / speed) * TUNING.MOTE_MAX_SPEED;
      mote.vy = (mote.vy / speed) * TUNING.MOTE_MAX_SPEED;
    }
    mote.x += mote.vx * dtScale;
    mote.y += mote.vy * dtScale;
    mote.spin += mote.spinVel * dtScale;
    mote.spinVel += (speed * 0.002 - mote.spinVel * 0.02) * dtScale;
    mote.age += dt;
    mote.orbitAngle = Math.atan2(mote.y - cy, mote.x - cx);
  });

  // Remove motes that exceeded their lifetime (click to replenish)
  const lifetime = TUNING.MOTE_LIFETIME_MS;
  for (let i = motes.length - 1; i >= 0; i--) {
    if (motes[i].age > lifetime) {
      motes.splice(i, 1);
    }
  }
}

function refreshNeighborCache(motes: Mote[], cache: Map<number, number[]>): void {
  cache.clear();
  motes.forEach((mote) => {
    const neighbors = motes
      .filter((other) => other.id !== mote.id)
      .map((other) => {
        const dx = other.x - mote.x;
        const dy = other.y - mote.y;
        return { id: other.id, distanceSq: dx * dx + dy * dy };
      })
      .sort((a, b) => a.distanceSq - b.distanceSq)
      .slice(0, TUNING.MOTE_NEIGHBOR_K)
      .map((entry) => entry.id);
    cache.set(mote.id, neighbors);
  });
}

function applyAnchorForce(
  mote: Mote,
  stage: Stage,
  cx: number,
  cy: number,
  clusterRadius: number,
  dtScale: number,
): void {
  const dx = cx - mote.x;
  const dy = cy - mote.y;
  const dist = Math.hypot(dx, dy) + 1;
  const nx = dx / dist;
  const ny = dy / dist;

  switch (stage.clusterMode) {
    case 'inflation': {
      // Stage 1: stronger pull toward center + orbital spin + bouncy repulsion
      const targetR = clusterRadius * Math.pow(mote.hue, 1.75) * 0.7;
      const radial = (dist - targetR) / Math.max(targetR, 16);
      const gravity = TUNING.MOTE_ANCHOR_GRAVITY * 1.6;
      mote.vx += nx * radial * gravity * dtScale;
      mote.vy += ny * radial * gravity * dtScale;
      // Orbital tangential force — swirl around center
      const spin = 0.55 * (35 / (dist + 8));
      mote.vx += -ny * spin * dtScale;
      mote.vy += nx * spin * dtScale;
      break;
    }
    case 'baryogenesis':
    case 'qgPlasma':
    case 'nucleosynthesis':
    case 'recombination':
    case 'darkAge':
    case 'firstStars':
    case 'reionization': {
      const targetR = clusterRadius * Math.pow(mote.hue, 1.75) * 0.96;
      const radial = (dist - targetR) / Math.max(targetR, 20);
      mote.vx += nx * radial * TUNING.MOTE_ANCHOR_GRAVITY * 0.82 * dtScale;
      mote.vy += ny * radial * TUNING.MOTE_ANCHOR_GRAVITY * 0.82 * dtScale;
      break;
    }
    case 'galaxy': {
      const targetR = Math.min(clusterRadius, (mote.orbitRadius ?? clusterRadius * mote.hue) + clusterRadius * 0.18);
      const radial = (dist - targetR) / Math.max(targetR, 34);
      mote.vx += nx * radial * TUNING.MOTE_ANCHOR_GRAVITY * 0.74 * dtScale;
      mote.vy += ny * radial * TUNING.MOTE_ANCHOR_GRAVITY * 0.74 * dtScale;
      mote.vx += -ny * TUNING.GALAXY_TANGENTIAL_BOOST * (50 / dist) * dtScale;
      mote.vy += nx * TUNING.GALAXY_TANGENTIAL_BOOST * (50 / dist) * dtScale;
      mote.vy *= TUNING.GALAXY_FLAT_BIAS;
      mote.y += (cy + (mote.y - cy) * 0.58 - mote.y) * 0.018 * dtScale;
      break;
    }
    case 'planetary': {
      const orbitGrowth = Math.max(0, clusterRadius - TUNING.PLANETARY_ORBIT_MIN_RADIUS);
      const targetR = Math.min(
        TUNING.PLANETARY_ORBIT_MAX_RADIUS,
        (mote.orbitRadius ?? 88) + orbitGrowth * (0.22 + mote.hue * 0.58),
      );
      const radial = (dist - targetR) / targetR;
      mote.vx += nx * radial * TUNING.PLANETARY_ORBIT_LOCK * dtScale;
      mote.vy += ny * radial * TUNING.PLANETARY_ORBIT_LOCK * dtScale;
      mote.vx += -ny * 0.42 * dtScale;
      mote.vy += nx * 0.42 * dtScale;
      break;
    }
    case 'lifeSurface': {
      // Orbit around the earth instead of snapping to center
      const earthR = TUNING.LIFE_SURFACE_R;
      const orbitR = earthR * (1.2 + mote.hue * 0.6);
      const radial = (dist - orbitR) / Math.max(orbitR, 20);
      mote.vx += nx * radial * 0.6 * dtScale;
      mote.vy += ny * radial * 0.6 * dtScale;
      // Tangential orbit
      mote.vx += -ny * 0.35 * dtScale;
      mote.vy += nx * 0.35 * dtScale;
      break;
    }
    case 'redGiant': {
      const targetR = clusterRadius * (mote.hue < 0.5 ? 0.34 + mote.hue * 0.48 : 0.85 + mote.hue * 0.36);
      const radial = (dist - targetR) / Math.max(targetR, 32);
      const strength = mote.hue < 0.5 ? 0.54 : 0.36;
      mote.vx += nx * radial * strength * dtScale;
      mote.vy += ny * radial * strength * dtScale;
      break;
    }
    case 'remnant': {
      const targetR = clusterRadius * (0.12 + mote.hue * 0.5);
      const radial = (dist - targetR) / Math.max(targetR, 36);
      mote.vx += nx * radial * 0.22 * dtScale;
      mote.vy += ny * radial * 0.22 * dtScale;
      break;
    }
    case 'blackHole': {
      const inner = TUNING.BLACKHOLE_DISK_INNER;
      if (dist > inner * 1.45) {
        const force = 2.5 / Math.max(dist, 30);
        mote.vx += nx * force * 30 * dtScale;
        mote.vy += ny * force * 30 * dtScale;
        mote.vx += -ny * 1.2 * (60 / dist) * dtScale;
        mote.vy += nx * 1.2 * (60 / dist) * dtScale;
      } else {
        const targetR = Math.min(clusterRadius * 0.94, inner * 1.08 + (mote.orbitRadius ?? 0));
        const radial = (dist - targetR) / targetR;
        mote.vx += nx * radial * 1.2 * dtScale;
        mote.vy += ny * radial * 1.2 * dtScale;
        mote.vx += -ny * 1.65 * dtScale;
        mote.vy += nx * 1.65 * dtScale;
      }
      break;
    }
    case 'heatDeath':
      mote.vx += (Math.random() - 0.5) * 0.24 * dtScale;
      mote.vy += (Math.random() - 0.5) * 0.24 * dtScale;
      if (dist < clusterRadius * (0.35 + mote.hue * 0.62)) {
        mote.vx -= nx * 0.035 * dtScale;
        mote.vy -= ny * 0.035 * dtScale;
      }
      break;
  }
}

function applyMoteWander(
  mote: Mote,
  stage: Stage,
  cx: number,
  cy: number,
  now: number,
  dtScale: number,
): void {
  if (stage.clusterMode === 'planetary') {
    return;
  }

  const dx = mote.x - cx;
  const dy = mote.y - cy;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / dist;
  const ny = dy / dist;
  const waveA = Math.sin(now * 0.0011 + mote.id * 1.731);
  const waveB = Math.cos(now * 0.00083 + mote.id * 2.417);

  switch (stage.clusterMode) {
    case 'inflation':
    case 'baryogenesis':
    case 'qgPlasma':
    case 'nucleosynthesis':
    case 'recombination':
    case 'darkAge':
    case 'firstStars':
    case 'reionization':
      mote.vx += (-ny * 0.026 + nx * waveA * 0.012 + waveB * 0.006) * dtScale;
      mote.vy += (nx * 0.026 + ny * waveB * 0.012 - waveA * 0.006) * dtScale;
      break;
    case 'galaxy':
      mote.vx += (-ny * 0.018 + waveB * 0.004) * dtScale;
      mote.vy += (nx * 0.018 + waveA * 0.004) * dtScale;
      break;
    case 'redGiant':
      mote.vx += (nx * waveA * 0.032 - ny * 0.012) * dtScale;
      mote.vy += (ny * waveB * 0.032 + nx * 0.012) * dtScale;
      break;
    case 'remnant':
      mote.vx += waveA * 0.004 * dtScale;
      mote.vy += waveB * 0.004 * dtScale;
      break;
    case 'lifeSurface':
      mote.vx += (-ny * 0.015 + waveA * 0.003) * dtScale;
      mote.vy += (nx * 0.015 + waveB * 0.003) * dtScale;
      break;
    case 'blackHole':
      mote.vx += -ny * 0.04 * dtScale;
      mote.vy += nx * 0.04 * dtScale;
      break;
    case 'heatDeath':
      break;
  }
}

function mergeCloseMotes(cluster: MoteCluster, neighborCache: Map<number, number[]>, maxMassCap: number): void {
  const byId = new Map(cluster.motes.map((mote) => [mote.id, mote]));
  const removed = new Set<number>();

  cluster.motes.forEach((mote) => {
    if (removed.has(mote.id) || mote.mass >= maxMassCap) {
      return;
    }
    const neighbors = neighborCache.get(mote.id) ?? [];
    const neighbor = neighbors
      .map((id) => byId.get(id))
      .find((candidate): candidate is Mote => {
        if (!candidate || removed.has(candidate.id) || candidate.mass >= maxMassCap) {
          return false;
        }
        return Math.hypot(candidate.x - mote.x, candidate.y - mote.y) <= TUNING.MOTE_MERGE_DISTANCE + (mote.r + candidate.r) * 0.18;
      });
    if (!neighbor) {
      return;
    }

    const totalMass = Math.min(maxMassCap, mote.mass + neighbor.mass);
    const blend = neighbor.mass / (mote.mass + neighbor.mass);
    mote.x += (neighbor.x - mote.x) * blend;
    mote.y += (neighbor.y - mote.y) * blend;
    mote.vx += (neighbor.vx - mote.vx) * blend;
    mote.vy += (neighbor.vy - mote.vy) * blend;
    mote.mass = totalMass;
    mote.r = getMoteRadius(totalMass);
    removed.add(neighbor.id);
  });

  if (removed.size > 0) {
    cluster.motes = cluster.motes.filter((mote) => !removed.has(mote.id));
  }
}

function createRogue(world: CanvasWorld, stage: Stage, width: number, height: number): Rogue {
  const cx = width / 2;
  const cy = height / 2;
  const speed = Math.hypot(world.coreVX, world.coreVY);
  const angle =
    speed > 0.3 && Math.random() < TUNING.TRAVEL_DIRECTION_BIAS
      ? Math.atan2(world.coreVY, world.coreVX) + (Math.random() - 0.5) * 1.2
      : Math.random() * Math.PI * 2;
  const radius = Math.max(width, height) * TUNING.ROGUE_SPAWN_RADIUS_FRAC;
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  const targetX = cx + (Math.random() - 0.5) * width * TUNING.ROGUE_TARGET_RECT_FRAC;
  const targetY = cy + (Math.random() - 0.5) * height * TUNING.ROGUE_TARGET_RECT_FRAC;
  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const typeKey = pickRogueType();
  const type = ROGUE_TYPES[typeKey];
  const moveSpeed = randomBetween(TUNING.ROGUE_SPEED_MIN, TUNING.ROGUE_SPEED_MAX);
  const id = world.nextId + 1;
  world.nextId = id;

  return {
    id,
    stageId: stage.id,
    typeKey,
    x,
    y,
    vx: (dx / distance) * moveSpeed,
    vy: (dy / distance) * moveSpeed,
    r: type.r,
    color: getStageRogueColor(stage, typeKey),
    glowColor: stage.coreColor,
    name: getStageRogueName(stage.id, typeKey),
    bonus: Math.floor(stage.threshold * type.bonusMultiplier * (0.3 + Math.random() * 0.3)),
    entropyBonus: type.entropyBonus,
    age: 0,
    spotted: false,
    rotation: 0,
  };
}

interface PointerPressureSource {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  updatedAt: number;
  active: boolean;
  intensity: number;
  pointerType: string;
}

interface PointerPressureField {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

const POINTER_PRESSURE_LINGER_MS = 380;
const POINTER_PRESSURE_MOUSE_RADIUS = 145;
const POINTER_PRESSURE_TOUCH_RADIUS = 122;
const POINTER_ROGUE_ATTRACTION_RADIUS_MULT = 1.35;

function getPointerPressureField(source: PointerPressureSource | null, now: number): PointerPressureField | null {
  if (!source) return null;
  const ageMs = Math.max(0, now - source.updatedAt);
  const fade = source.active ? 1 : Math.max(0, 1 - ageMs / POINTER_PRESSURE_LINGER_MS);
  if (fade <= 0) return null;
  const touchSized = source.pointerType === 'touch' || source.pointerType === 'pen';
  return {
    x: source.x,
    y: source.y,
    radius: touchSized ? POINTER_PRESSURE_TOUCH_RADIUS : POINTER_PRESSURE_MOUSE_RADIUS,
    strength: source.intensity * fade,
  };
}

function pressureDirection(dx: number, dy: number, fallbackAngle: number): { nx: number; ny: number; distance: number } {
  const distance = Math.hypot(dx, dy);
  if (distance > 0.001) {
    return { nx: dx / distance, ny: dy / distance, distance };
  }
  return { nx: Math.cos(fallbackAngle), ny: Math.sin(fallbackAngle), distance: 0 };
}

function applyPointerPressureToAmbientParticle(
  particle: AmbientParticle,
  field: PointerPressureField,
  dtScale: number,
): void {
  const { nx, ny, distance } = pressureDirection(
    particle.x - field.x,
    particle.y - field.y,
    particle.phase,
  );
  if (distance > field.radius) return;
  const falloff = 1 - distance / field.radius;
  const push = field.strength * (falloff * falloff) * 5.1 * dtScale;
  const curl = field.strength * falloff * 0.38 * dtScale;
  particle.vx += nx * push - ny * curl;
  particle.vy += ny * push + nx * curl;
}

function applyPointerPressureToMote(
  mote: Mote,
  stage: Stage,
  field: PointerPressureField,
  dtScale: number,
): void {
  if (stage.clusterMode === 'lifeSurface') return;
  const radius = TUNING.MOTE_POINTER_PUSH_RADIUS;
  const { nx, ny, distance } = pressureDirection(
    mote.x - field.x,
    mote.y - field.y,
    mote.id * 1.73,
  );
  if (distance > radius) return;
  const falloff = 1 - distance / radius;
  const push = field.strength * (falloff * falloff) * TUNING.MOTE_POINTER_PUSH_STRENGTH * dtScale;
  const curl = field.strength * falloff * 0.35 * dtScale;
  mote.vx += nx * push - ny * curl;
  mote.vy += ny * push + nx * curl;
  mote.spinVel += (nx > 0 ? 1 : -1) * push * 0.06;

  const speed = Math.hypot(mote.vx, mote.vy);
  const maxSpeed = TUNING.MOTE_MAX_SPEED * 2.0;
  if (speed > maxSpeed) {
    mote.vx = (mote.vx / speed) * maxSpeed;
    mote.vy = (mote.vy / speed) * maxSpeed;
  }
}

function applyPointerPressureImpulse(
  world: CanvasWorld,
  stage: Stage,
  x: number,
  y: number,
  pointerType: string,
  strengthMultiplier: number,
): void {
  const touchSized = pointerType === 'touch' || pointerType === 'pen';
  const field: PointerPressureField = {
    x,
    y,
    radius: (touchSized ? POINTER_PRESSURE_TOUCH_RADIUS : POINTER_PRESSURE_MOUSE_RADIUS) * 0.95,
    strength: 1.35 * strengthMultiplier,
  };

  world.particles.forEach((particle) => {
    const { nx, ny, distance } = pressureDirection(
      particle.x - field.x,
      particle.y - field.y,
      particle.phase,
    );
    if (distance > field.radius) return;
    const falloff = 1 - distance / field.radius;
    const impulse = field.strength * falloff * falloff;
    particle.x += nx * impulse * 3;
    particle.y += ny * impulse * 3;
    particle.vx += nx * impulse * 6 - ny * impulse * 0.8;
    particle.vy += ny * impulse * 6 + nx * impulse * 0.8;
  });

  if (stage.clusterMode === 'lifeSurface') return;

  world.cluster.motes.forEach((mote) => {
    const moteRadius = field.radius;
    const { nx, ny, distance } = pressureDirection(
      mote.x - field.x,
      mote.y - field.y,
      mote.id * 1.73,
    );
    if (distance > moteRadius) return;
    const falloff = 1 - distance / moteRadius;
    const impulse = field.strength * falloff * falloff;
    mote.x += nx * impulse * 1.5;
    mote.y += ny * impulse * 1.5;
    mote.vx += nx * impulse * 3 - ny * impulse * 0.45;
    mote.vy += ny * impulse * 3 + nx * impulse * 0.45;
  });
}

function applyPointerAttractionToRogue(
  rogue: Rogue,
  field: PointerPressureField,
  dtScale: number,
): void {
  const attractionRadius = field.radius * POINTER_ROGUE_ATTRACTION_RADIUS_MULT;
  const dx = field.x - rogue.x;
  const dy = field.y - rogue.y;
  const distance = Math.hypot(dx, dy);
  if (distance > attractionRadius) return;

  // Tier-based: minor=nimble, major=steady, massive=heavy
  const tierFriction = rogue.typeKey === 'minor' ? 0.995 : rogue.typeKey === 'major' ? 0.985 : 0.97;
  const tierMaxSpeed = rogue.typeKey === 'minor' ? 1.8 : rogue.typeKey === 'major' ? 1.3 : 0.9;

  const nx = distance > 0.001 ? dx / distance : 0;
  const ny = distance > 0.001 ? dy / distance : 0;
  const falloff = 1 - distance / attractionRadius;
  const pull = field.strength * falloff * falloff * 2.5 * dtScale;

  // Dampen original velocity so pointer pull dominates
  const dampStrength = 0.92 - falloff * 0.15; // closer = more dampening
  rogue.vx *= dampStrength;
  rogue.vy *= dampStrength;

  rogue.vx += nx * pull;
  rogue.vy += ny * pull;

  rogue.vx *= tierFriction;
  rogue.vy *= tierFriction;

  const speed = Math.hypot(rogue.vx, rogue.vy);
  if (speed > tierMaxSpeed) {
    rogue.vx = (rogue.vx / speed) * tierMaxSpeed;
    rogue.vy = (rogue.vy / speed) * tierMaxSpeed;
  }
}

const ParticleFieldInner = forwardRef<ParticleFieldHandle, ParticleFieldProps>(function ParticleFieldInner({
  stage,
  actualStageId,
  quanta,
  autoRate,
  timeMult,
  cosmicClockSec,
  effectiveThreshold,
  totalClicks,
  imploding,
  interactionLocked,
  lastClickEvent,
  stageTransitionStartedAt,
  clickEmissionCount,
  clickVfxScale,
  gravityMod,
  anomaly,
  purchasedEntities,
  onGatherClick,
  onEncounter,
  onCollision,
}: ParticleFieldProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<CanvasWorld | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const lastStageId = useRef(stage.id);
  const lastClickId = useRef<number | null>(null);
  const transitionExplosionAt = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const pointerPressureRef = useRef<PointerPressureSource | null>(null);

  const updatePointerPressure = (
    x: number,
    y: number,
    pointerType: string,
    strengthMultiplier: number,
  ) => {
    const now = performance.now();
    const previous = pointerPressureRef.current;
    const elapsedMs = previous ? Math.max(1, now - previous.updatedAt) : 16;
    const moveSpeed = previous ? Math.hypot(x - previous.x, y - previous.y) / elapsedMs : 0;
    const intensity = Math.min(1.55, Math.max(0.55, strengthMultiplier * (0.72 + moveSpeed * 0.2)));
    pointerPressureRef.current = {
      x,
      y,
      lastX: previous?.x ?? x,
      lastY: previous?.y ?? y,
      updatedAt: now,
      active: true,
      intensity,
      pointerType,
    };
  };

  const releasePointerPressure = () => {
    const previous = pointerPressureRef.current;
    if (!previous) return;
    pointerPressureRef.current = {
      ...previous,
      active: false,
      updatedAt: performance.now(),
      intensity: previous.intensity * 0.62,
    };
  };

  const applySteerNudge = (
    rect: DOMRect,
    clientX: number,
    clientY: number,
    strengthMultiplier = 1,
  ) => {
    const world = worldRef.current;
    if (!world) {
      return { x: 0, y: 0, hitRogue: false };
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.hypot(dx, dy);
    const hitRogue = world.rogues.some((rogue) => {
      const hitDistance = Math.hypot(x - rogue.x, y - rogue.y);
      return hitDistance <= rogue.r + 10;
    });
    if (distance > 0) {
      world.coreVX += (dx / distance) * TUNING.CLICK_NUDGE_STRENGTH * strengthMultiplier;
      world.coreVY += (dy / distance) * TUNING.CLICK_NUDGE_STRENGTH * strengthMultiplier;
      world.driftAngle = Math.atan2(dy, dx);
    }
    return { x, y, hitRogue };
  };

  useEffect(() => {
    if (stageTransitionStartedAt === null) {
      transitionExplosionAt.current = null;
    }
  }, [stageTransitionStartedAt]);

  useEffect(() => {
    if (!interactionLocked) return;
    dragPointerId.current = null;
    releasePointerPressure();
  }, [interactionLocked]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      // Cap DPR to 2: high-DPR phones (DPR 3) gain no visible quality for 2.25x
      // GPU/memory cost in a 2D canvas particle game.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = bounds.width * dpr;
      canvas.height = bounds.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: bounds.width, height: bounds.height };
      if (!worldRef.current) {
        worldRef.current = createWorld(bounds.width, bounds.height, stage);
      } else {
        worldRef.current.stars = createStars(bounds.width, bounds.height);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [stage]);

  useEffect(() => {
    const size = sizeRef.current;
    if (!size.width || !size.height) {
      return;
    }
    if (!worldRef.current) {
      worldRef.current = createWorld(size.width, size.height, stage);
      lastStageId.current = stage.id;
      return;
    }
    if (lastStageId.current !== stage.id) {
      worldRef.current = resetForStage(worldRef.current, size.width, size.height, stage);
      lastStageId.current = stage.id;
    }
  }, [stage]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      const world = worldRef.current;
      if (!world) return;
      console.debug('[perf]', {
        stageId: stage.id,
        bursts: world.bursts.length,
        flyers: world.flyers.length,
        rogues: world.rogues.length,
        wakeTrails: world.wakeTrails.length,
        shockwaves: world.shockwaves.length,
        motes: world.cluster.motes.length,
        mechanicStates: Object.keys(world.mechanicState ?? {}).length,
      });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [stage.id]);

  useEffect(() => {
    if (!lastClickEvent || !worldRef.current || lastClickId.current === lastClickEvent.id) {
      return;
    }
    lastClickId.current = lastClickEvent.id;
    if (lastClickEvent.isCrit && 'vibrate' in navigator) {
      try { navigator.vibrate(35); } catch {}
    }
    const { width, height } = sizeRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const maxMassCap = getEffectiveMaxMass(getProgress(quanta, effectiveThreshold));
    spawnMotesAtClick(
      worldRef.current.cluster,
      stage,
      lastClickEvent.x,
      lastClickEvent.y,
      cx,
      cy,
      width,
      height,
      lastClickEvent.isCrit,
      clickEmissionCount,
      maxMassCap,
      performance.now(),
    );
    for (let index = 0; index < clickEmissionCount; index += 1) {
      const angle = (index / Math.max(1, clickEmissionCount)) * Math.PI * 2;
      const radius = clickEmissionCount > 1 ? 4 + clickEmissionCount : 0;
      worldRef.current.flyers.push(
        createCurvedFlyer(
          lastClickEvent.x + Math.cos(angle) * radius,
          lastClickEvent.y + Math.sin(angle) * radius,
          cx,
          cy,
          false,
          stage.id,
        ),
      );
    }
    worldRef.current.bursts.push(
      ...createBurstSet(
        lastClickEvent.x,
        lastClickEvent.y,
        Math.max(
          1,
          Math.floor(
            (lastClickEvent.isCrit ? TUNING.CRIT_BURST_COUNT : TUNING.CLICK_BURST_COUNT) *
              Math.max(1, clickEmissionCount) *
              0.55,
          ),
        ),
        lastClickEvent.isCrit ? '#ffffff' : stage.coreColor,
        (lastClickEvent.isCrit ? 4.5 : 2.8) * clickVfxScale,
        stage.id,
        lastClickEvent.isCrit ? 1.0 : 0.8,
      ),
    );
    if (stage.clusterMode === 'blackHole') {
      const angle = Math.atan2(lastClickEvent.y - cy, lastClickEvent.x - cx);
      const blackHoleRadius = getBlackHoleRadius(width, height, getProgress(quanta, effectiveThreshold));
      worldRef.current.bursts.push({
        x: cx + Math.cos(angle) * blackHoleRadius * 1.5,
        y: cy + Math.sin(angle) * blackHoleRadius * 1.5,
        vx: Math.cos(angle) * 6,
        vy: Math.sin(angle) * 6,
        turn: 0.018,
        r: 1.5,
        life: 1,
        color: getHawkingPhotonColor(getProgress(quanta, effectiveThreshold)),
        spriteId: stage.id,
      });
    }
    if (clickEmissionCount >= 4) {
      worldRef.current.shockwaves.push(
        createShockwave(
          clickEmissionCount >= 5 ? '#ffbf6b' : stage.accent,
          lastClickEvent.x,
          lastClickEvent.y,
          30 + clickEmissionCount * 5,
          clickEmissionCount >= 5 ? 760 : 620,
          clickEmissionCount >= 6 ? 3 : 2,
        ),
      );
    }
  }, [clickEmissionCount, clickVfxScale, effectiveThreshold, lastClickEvent, quanta, stage]);

  const tickFrame = (now: number, dt: number) => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { width, height } = sizeRef.current;
    if (!width || !height) {
      return;
    }
    const motionScale = anomaly === 'high_energy' ? 1.5 : 1;
    const frameDt = dt * motionScale;
    const physicsDtScale = Math.min(2.2, Math.max(0.3, frameDt / 16.67));
    const pointerPressure = getPointerPressureField(pointerPressureRef.current, now);
    if (!pointerPressure && pointerPressureRef.current && !pointerPressureRef.current.active) {
      pointerPressureRef.current = null;
    }
    const progress = getProgress(quanta, effectiveThreshold);
    // V9: visual progress requires BOTH quanta and cosmic time to advance
    const quantaProgress = progress;
    const timeProgress = getCosmicStageProgress(stage, cosmicClockSec);
    const visualProgress = Math.min(quantaProgress, timeProgress);
    const cx = width / 2;
    const cy = height / 2;
    const coreRadius = TUNING.CORE_BASE_RADIUS + progress * TUNING.CORE_PROGRESS_RADIUS;
    const transitionElapsed =
      stageTransitionStartedAt === null
        ? null
        : now - stageTransitionStartedAt;
    const transitionSucking = false;
    const transitionActive =
      transitionElapsed !== null && transitionElapsed < TUNING.STAGE_TRANSITION_REVEAL_MS;
    world.driftAngle += frameDt * TUNING.CAMERA_DRIFT_ROTATION;
    world.coreVX += Math.cos(world.driftAngle) * TUNING.CAMERA_AMBIENT_DRIFT;
    world.coreVY += Math.sin(world.driftAngle) * TUNING.CAMERA_AMBIENT_DRIFT;
    world.coreVX *= TUNING.CAMERA_DAMPENING;
    world.coreVY *= TUNING.CAMERA_DAMPENING;
    const velocity = Math.hypot(world.coreVX, world.coreVY);
    if (velocity > TUNING.CAMERA_MAX_VELOCITY) {
      world.coreVX = (world.coreVX / velocity) * TUNING.CAMERA_MAX_VELOCITY;
      world.coreVY = (world.coreVY / velocity) * TUNING.CAMERA_MAX_VELOCITY;
    }

    world.stars.forEach((star) => {
      star.x -= world.coreVX * star.depth;
      star.y -= world.coreVY * star.depth;
      star.twinkle += frameDt * 0.002;
      if (star.x < -TUNING.STAR_WRAP_MARGIN) {
        star.x = width + TUNING.STAR_WRAP_MARGIN;
      }
      if (star.x > width + TUNING.STAR_WRAP_MARGIN) {
        star.x = -TUNING.STAR_WRAP_MARGIN;
      }
      if (star.y < -TUNING.STAR_WRAP_MARGIN) {
        star.y = height + TUNING.STAR_WRAP_MARGIN;
      }
      if (star.y > height + TUNING.STAR_WRAP_MARGIN) {
        star.y = -TUNING.STAR_WRAP_MARGIN;
      }
    });

    if (velocity > TUNING.WAKE_MIN_SPEED && world.wakeTrails.length < TUNING.WAKE_TRAIL_MAX) {
      if (Math.random() < velocity * TUNING.WAKE_SPAWN_CHANCE_MULT) {
        world.wakeTrails.push({
          x: cx - (world.coreVX / velocity) * coreRadius + (Math.random() - 0.5) * coreRadius,
          y: cy - (world.coreVY / velocity) * coreRadius + (Math.random() - 0.5) * coreRadius,
          vx: -world.coreVX * (0.4 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.3,
          vy: -world.coreVY * (0.4 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.3,
          r: 1.5 + Math.random() * 1.5,
          life: 1,
          color: stage.coreColor,
        });
      }
    }
    world.wakeTrails = world.wakeTrails.filter((trail) => {
      trail.x += trail.vx;
      trail.y += trail.vy;
      trail.life -= TUNING.WAKE_LIFE_DECAY * motionScale;
      return trail.life > 0;
    });

    const gravity = imploding
      ? TUNING.IMPLOSION_GRAVITY * gravityMod
      : transitionSucking
        ? TUNING.IMPLOSION_GRAVITY * 0.62 * gravityMod
        : TUNING.GRAVITY_BASE * gravityMod * (0.35 + progress * TUNING.GRAVITY_PROGRESS_SCALE);
    const captureRadius = coreRadius + (transitionSucking ? 18 : 4);
    const dampening = imploding || transitionSucking ? 0.97 : TUNING.PARTICLE_DAMPENING;

    world.particles = world.particles.map((particle) => {
      const dx = cx - particle.x;
      const dy = cy - particle.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) {
        return spawnParticleAtEdge(particle, width, height);
      }
      if (distance < captureRadius && !imploding) {
        return spawnParticleAtEdge(particle, width, height);
      }
      const softenedDistance = Math.max(distance, TUNING.PARTICLE_CAPTURE_SOFTENING);
      const force = gravity / (softenedDistance * 0.3 + 8);
      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
      if (pointerPressure) {
        applyPointerPressureToAmbientParticle(particle, pointerPressure, physicsDtScale);
      }
      particle.vx *= dampening;
      particle.vy *= dampening;
      const particleSpeed = Math.hypot(particle.vx, particle.vy);
      const maxVelocity = imploding ? 18 : TUNING.PARTICLE_MAX_V;
      if (particleSpeed > maxVelocity) {
        particle.vx = (particle.vx / particleSpeed) * maxVelocity;
        particle.vy = (particle.vy / particleSpeed) * maxVelocity;
      }
      particle.x += particle.vx * motionScale;
      particle.y += particle.vy * motionScale;
      particle.phase += frameDt * 0.0015;
      if (
        particle.x < -TUNING.PARTICLE_RESPAWN_MARGIN ||
        particle.x > width + TUNING.PARTICLE_RESPAWN_MARGIN ||
        particle.y < -TUNING.PARTICLE_RESPAWN_MARGIN ||
        particle.y > height + TUNING.PARTICLE_RESPAWN_MARGIN
      ) {
        return spawnParticleAtEdge(particle, width, height);
      }
      return particle;
    });

    if (
      !interactionLocked &&
      autoRate > 0 &&
      now - world.moteLastAutoSpawnAt >= TUNING.MOTE_AUTO_SPAWN_INTERVAL_MS
    ) {
      const effectiveMaxMass = getEffectiveMaxMass(progress);
      for (let i = 0; i < TUNING.MOTE_PER_AUTO_TICK; i += 1) {
        spawnAutoMote(world.cluster, stage, cx, cy, effectiveMaxMass, now);
      }
      world.moteLastAutoSpawnAt = now;
    }

    stepClusterPhysics(world, stage, cx, cy, frameDt, now, progress);
    if (pointerPressure) {
      world.cluster.motes.forEach((mote) => applyPointerPressureToMote(mote, stage, pointerPressure, physicsDtScale));
    }

    world.flyers = world.flyers.filter((flyer) => {
      const speed = flyer.auto ? 0.0011 : 0.0015;
      flyer.t = Math.min(1.1, flyer.t + frameDt * speed);
      if (flyer.t >= 1) {
        return false;
      }
      const oneMinusT = 1 - flyer.t;
      flyer.x =
        oneMinusT * oneMinusT * flyer.startX +
        2 * oneMinusT * flyer.t * flyer.controlX +
        flyer.t * flyer.t * flyer.targetX;
      flyer.y =
        oneMinusT * oneMinusT * flyer.startY +
        2 * oneMinusT * flyer.t * flyer.controlY +
        flyer.t * flyer.t * flyer.targetY;
      flyer.life -=
        (flyer.auto ? TUNING.FLYER_AUTO_LIFE_DECAY : TUNING.FLYER_CLICK_LIFE_DECAY) * motionScale;
      return flyer.life > 0;
    });

    world.bursts = world.bursts.filter((burst) => {
      if (burst.turn) {
        const vx = burst.vx;
        const vy = burst.vy;
        burst.vx = vx * Math.cos(burst.turn) - vy * Math.sin(burst.turn);
        burst.vy = vx * Math.sin(burst.turn) + vy * Math.cos(burst.turn);
      }
      burst.x += burst.vx;
      burst.y += burst.vy;
      burst.vx *= TUNING.BURST_VELOCITY_DECAY;
      burst.vy *= TUNING.BURST_VELOCITY_DECAY;
      burst.life -= TUNING.BURST_DECAY * motionScale;
      return burst.life > 0;
    });

    if (
      transitionElapsed !== null &&
      transitionElapsed >= 0 &&
      transitionExplosionAt.current !== stageTransitionStartedAt
    ) {
      transitionExplosionAt.current = stageTransitionStartedAt;
      world.bursts.push(
        ...createBurstSet(
          cx,
          cy,
          Math.floor(TUNING.STAGE_TRANSITION_BURST_COUNT * 0.28),
          stage.accent,
          3.2,
          stage.id,
        ),
      );
      world.shockwaves.push(createShockwave(stage.accent));
    }

    if (!interactionLocked) {
      const encounterTimeScale = Math.min(2.5, Math.sqrt(Math.max(1, timeMult)));
      const earlyStage = stage.id <= 2;
      const rogueMax = earlyStage ? 4 : TUNING.ROGUE_MAX;
      const intervalMin = earlyStage ? 4000 : TUNING.ENCOUNTER_INTERVAL_MIN_MS;
      const intervalMax = earlyStage ? 12000 : TUNING.ENCOUNTER_INTERVAL_MAX_MS;
      world.rogueCooldown -= frameDt * encounterTimeScale;
      if (world.rogueCooldown <= 0 && world.rogues.length < rogueMax) {
        world.rogues.push(createRogue(world, stage, width, height));
        world.rogueCooldown = intervalMin + Math.random() * (intervalMax - intervalMin);
      }
    }

    const nextRogues: Rogue[] = [];
    world.rogues.forEach((rogue) => {
      if (pointerPressure) {
        applyPointerAttractionToRogue(rogue, pointerPressure, physicsDtScale);
      }
      rogue.x += rogue.vx - world.coreVX;
      rogue.y += rogue.vy - world.coreVY;
      rogue.age += frameDt;
      rogue.rotation += frameDt * 0.001;
      const dx = cx - rogue.x;
      const dy = cy - rogue.y;
      const distance = Math.hypot(dx, dy);
      if (distance < coreRadius + rogue.r) {
        const burstCount =
          rogue.typeKey === 'massive'
            ? TUNING.MASSIVE_COLLISION_BURST_COUNT
            : rogue.typeKey === 'major'
              ? TUNING.MAJOR_COLLISION_BURST_COUNT
              : TUNING.MINOR_COLLISION_BURST_COUNT;
        world.bursts.push(
          ...createBurstSet(cx, cy, burstCount, rogue.color, rogue.typeKey === 'massive' ? 7 : 4, stage.id),
        );
        world.shockwaves.push(createShockwave(stage.accent));
        onCollision({
          x: cx,
          y: cy - 20,
          bonus: rogue.bonus,
          entropyBonus: rogue.entropyBonus,
          tier: rogue.typeKey,
          name: rogue.name,
        });
        return;
      }
      const onScreen = rogue.x > 0 && rogue.x < width && rogue.y > 0 && rogue.y < height;
      if (onScreen && !rogue.spotted) {
        rogue.spotted = true;
        onEncounter({ name: rogue.name, color: rogue.color });
      }
      // Once pointer attracts a rogue, keep it alive much longer
      const attractDist = pointerPressure
        ? Math.hypot(rogue.x - pointerPressure.x, rogue.y - pointerPressure.y)
        : Infinity;
      const inRange = pointerPressure && attractDist < pointerPressure.radius * POINTER_ROGUE_ATTRACTION_RADIUS_MULT;
      if (inRange) {
        (rogue as any)._attracted = true;
        (rogue as any)._lastAttractTime = now;
      }
      const wasAttracted = (rogue as any)._attracted;
      const gracePeriod = wasAttracted ? 8000 : 0; // 8s grace after last attraction
      const timeSinceAttract = now - ((rogue as any)._lastAttractTime ?? 0);
      const isProtected = wasAttracted && timeSinceAttract < gracePeriod;
      if (!isProtected && rogue.age > TUNING.ROGUE_EXPIRE_MS) {
        return;
      }
      if (!isProtected && Math.hypot(rogue.x - cx, rogue.y - cy) > Math.max(width, height) * TUNING.ROGUE_DESPAWN_DISTANCE_FRAC) {
        return;
      }
      nextRogues.push(rogue);
    });
    world.rogues = nextRogues;
    world.shockwaves = world.shockwaves.filter(
      (shockwave) => now - shockwave.startedAt <= TUNING.SHOCKWAVE_FADE_MS,
    );
    capWorldCollections(world);

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    drawStars(ctx, world.stars, world.coreVX, world.coreVY, stage, width, height, now);
    drawWake(ctx, world.wakeTrails as WakeTrail[]);
    drawCore({
      ctx,
      stage,
      width,
      height,
      progress,
      showThresholdRing: quanta >= effectiveThreshold && !interactionLocked,
      now,
      idlePulse: totalClicks === 0,
    });
    drawCluster({
      ctx,
      cluster: world.cluster,
      stage,
      purchasedEntities,
      cx,
      cy,
      width,
      height,
      now,
      progress: visualProgress,
      pointerPressure,
    });
    if (stage.clusterMode !== 'lifeSurface') {
      drawParticles({ ctx, stage, particles: world.particles, flyers: world.flyers, bursts: world.bursts });
    }
    drawEntities(ctx, cx, cy, actualStageId, purchasedEntities, now, pointerPressure, world.cluster);
    if (stage.clusterMode === 'lifeSurface') {
      drawParticles({ ctx, stage, particles: world.particles, flyers: world.flyers, bursts: world.bursts });
    }
    drawRogues(ctx, world.rogues, width, height, now, pointerPressure);
    drawEffects({
      ctx,
      width,
      height,
      now,
      color: stage.accent,
      rogues: world.rogues,
      shockwaves: world.shockwaves,
    });
    getMechanic(stage.mechanic).draw?.(
      ctx,
      { state: null, stage, now, progress01: visualProgress },
      world,
      width,
      height,
    );
    ctx.restore();

    if (transitionActive && transitionElapsed !== null) {
      const washOpacity = Math.max(
        0,
        0.6 - (transitionElapsed / TUNING.STAGE_TRANSITION_REVEAL_MS) * 0.6,
      );
      const flare = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.42);
      flare.addColorStop(0, `rgba(255,255,255,${Math.min(1, washOpacity * 1.4)})`);
      flare.addColorStop(0.32, `rgba(255,255,255,${washOpacity * 0.9})`);
      flare.addColorStop(0.55, `rgba(255,255,255,${washOpacity * 0.28})`);
      flare.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = flare;
      ctx.fillRect(0, 0, width, height);
    }
  };

  // Latest-closure ref: tickFrame is recreated each render with fresh props;
  // the imperative handle always invokes the newest one (no stale closures).
  const tickRef = useRef(tickFrame);
  tickRef.current = tickFrame;
  useImperativeHandle(ref, () => ({ tick: (now, dt) => tickRef.current(now, dt) }), []);

  return (
    <div
      className="game-canvas-hitbox"
      onPointerDown={(event) => {
        if (interactionLocked || !worldRef.current) {
          return;
        }
        event.preventDefault();
        dragPointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        const { x, y, hitRogue } = applySteerNudge(rect, event.clientX, event.clientY);
        const pressureStrength = event.pointerType === 'touch' ? 1.0 : 1.05;
        updatePointerPressure(x, y, event.pointerType, pressureStrength);
        applyPointerPressureImpulse(worldRef.current, stage, x, y, event.pointerType, pressureStrength);

        // Stage 11: clicking the Moon nudges its orbit slightly and pulses its glow.
        if (stage.id === 11 && worldRef.current) {
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const moon = getStage11MoonScreen(
            cx, cy, performance.now(), worldRef.current.cluster, purchasedEntities,
          );
          if (moon.visible) {
            const dist = Math.hypot(x - moon.moonX, y - moon.moonY);
            if (dist <= moon.moonR * 1.8) {
              const cluster = worldRef.current.cluster;
              cluster.moonAngleOffset =
                (cluster.moonAngleOffset ?? 0) + (event.pointerType === 'touch' ? 0.06 : 0.04);
              cluster.moonNudgeImpulse = Math.min(1, (cluster.moonNudgeImpulse ?? 0) + 0.3);
            }
          }
        }

        if (event.button !== 1) {
          onGatherClick(x, y, hitRogue);
        }
      }}
      onPointerMove={(event) => {
        if (interactionLocked || !worldRef.current) {
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const isMouseHover = event.pointerType === 'mouse' && event.buttons === 0;
        if (isMouseHover) {
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          updatePointerPressure(x, y, event.pointerType, 0.72);
          // Moon hover wiggle
          if (worldRef.current && stage.id === 11) {
            const mcx = sizeRef.current.width / 2;
            const mcy = sizeRef.current.height / 2;
            const moon = getStage11MoonScreen(mcx, mcy, performance.now(), worldRef.current.cluster, purchasedEntities);
            if (moon.visible) {
              const dist = Math.hypot(x - moon.moonX, y - moon.moonY);
              if (dist <= moon.moonR * 2.5) {
                const proximity = 1 - dist / (moon.moonR * 2.5);
                const cluster = worldRef.current.cluster;
                cluster.moonAngleOffset =
                  (cluster.moonAngleOffset ?? 0) + proximity * 0.006;
                cluster.moonNudgeImpulse = Math.min(0.4, Math.max(cluster.moonNudgeImpulse ?? 0, proximity * 0.25));
              }
            }
          }
          return;
        }
        if (dragPointerId.current !== event.pointerId) {
          return;
        }
        event.preventDefault();
        const strength = (event.buttons & 4) !== 0 ? 0.95 : 0.78;
        const { x, y } = applySteerNudge(rect, event.clientX, event.clientY, strength);
        updatePointerPressure(x, y, event.pointerType, strength);
      }}
      onPointerEnter={(event) => {
        if (interactionLocked || event.pointerType !== 'mouse') {
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        updatePointerPressure(event.clientX - rect.left, event.clientY - rect.top, event.pointerType, 0.72);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          releasePointerPressure();
        }
      }}
      onPointerUp={(event) => {
        if (dragPointerId.current === event.pointerId) {
          dragPointerId.current = null;
          releasePointerPressure();
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        if (dragPointerId.current === event.pointerId) {
          dragPointerId.current = null;
          releasePointerPressure();
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      role="presentation"
      aria-label={totalClicks > 0 ? `${stage.name} field` : `${stage.name} field, click to gather`}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        style={{
          filter: anomaly === 'dim' ? 'brightness(0.72)' : undefined,
          imageRendering: anomaly === 'crystalline' ? 'pixelated' : 'auto',
        }}
        aria-hidden="true"
      />
    </div>
  );
});

export const ParticleField = memo(ParticleFieldInner);
