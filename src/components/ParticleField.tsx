import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { drawCluster } from '../canvas/drawCluster';
import { drawCore } from '../canvas/drawCore';
import { drawEffects } from '../canvas/drawEffects';
import { drawEntities, getStage11MoonScreen } from '../canvas/drawEntities';
import { drawParticles } from '../canvas/drawParticles';
import { drawRogues } from '../canvas/drawRogues';
import { drawStars } from '../canvas/drawStars';
import { drawWake } from '../canvas/drawWake';
import {
  createMoteCluster,
  createParticles,
  createStars,
  createWorld,
  randomBetween,
  resetForStage,
  spawnParticleAtEdge,
  resetParticleAtEdge,
} from '../canvas/world';
import {
  capWorldCollections,
  getBlackHoleRadius,
  getClusterTargetRadius,
  getCosmicStageProgress,
  getEffectiveMaxMass,
  getHawkingPhotonColor,
  getMoteRadius,
} from '../canvas/clusterGeom';
import {
  addMoteToCluster,
  createBaseMote,
  createBurstSet,
  createCurvedFlyer,
  createPhotonMote,
  createShockwave,
  createSurfaceMote,
  enrichExistingMote,
  pickRogueType,
  pickStageColor,
  spawnAutoMote,
  spawnMotesAtClick,
} from '../canvas/spawn';
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
import type { EntityInstance, StageEntity } from '../game/entities/types';
import { findEntityById } from '../game/entities/stageItems';

// ── Spatial rift (entity redesign): bottom-left crack that visualizes auto
// income. Emits motes shaped like the equipped entities; clicks also puff
// equipped symbols. Purely cosmetic — capped and cheap to draw.
interface RiftMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  symbol: string;
  color: string;
  born: number;
  lifeMs: number;
  seekCore: boolean;
}

interface RiftState {
  nextSpawnAt: number;
  spawnIdx: number;
  motes: RiftMote[];
}

const RIFT_MOTE_CAP = 14;

function updateAndDrawRift(
  ctx: CanvasRenderingContext2D,
  rift: RiftState,
  equipped: StageEntity[],
  autoRate: number,
  now: number,
  dtMs: number,
  height: number,
  cx: number,
  cy: number,
  accent: string,
): void {
  const rx = 46;
  const ry = height - 84;

  if (autoRate > 0) {
    // Faster auto income → faster emission (log-scaled, clamped).
    if (now >= rift.nextSpawnAt) {
      const interval = Math.min(2200, Math.max(240, 1500 / Math.log10(10 + autoRate)));
      rift.nextSpawnAt = now + interval;
      if (rift.motes.length < RIFT_MOTE_CAP) {
        const source = equipped.length > 0 ? equipped[rift.spawnIdx++ % equipped.length] : null;
        const ang = Math.atan2(cy - ry, cx - rx) + (Math.random() - 0.5) * 0.55;
        const speed = 44 + Math.random() * 24;
        rift.motes.push({
          x: rx + (Math.random() - 0.5) * 10,
          y: ry + (Math.random() - 0.5) * 6,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          symbol: source?.visual.symbol ?? '✦',
          color: source?.visual.color ?? accent,
          born: now,
          lifeMs: 6500,
          seekCore: true,
        });
      }
    }
  }

  {
    // The crack is a permanent fixture (it opens the rift gear page) — dormant
    // and dim with no auto income, breathing bright once auto flows.
    const active = autoRate > 0;
    const intensity = active ? 1 : 0.5;
    const pulse = (0.55 + 0.3 * Math.sin(now / (active ? 310 : 620))) * intensity;
    ctx.save();
    ctx.translate(rx, ry);
    // Halo so the rift reads even on bright stages.
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    halo.addColorStop(0, `rgba(187, 140, 255, ${0.34 * pulse + 0.12})`);
    halo.addColorStop(0.55, 'rgba(140, 90, 220, 0.10)');
    halo.addColorStop(1, 'rgba(140, 90, 220, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(-0.55);
    ctx.lineCap = 'round';
    ctx.shadowColor = '#bb8cff';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(187, 140, 255, ${Math.min(1, pulse + 0.15)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-21, 2);
    ctx.lineTo(-9, -5);
    ctx.lineTo(2, 3);
    ctx.lineTo(13, -4);
    ctx.lineTo(24, 2);
    ctx.stroke();
    ctx.shadowBlur = 7;
    ctx.strokeStyle = `rgba(244, 236, 255, ${Math.min(1, pulse + 0.3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(14, -2);
    ctx.stroke();
    // Edge sparks drifting out of the tear.
    for (let k = 0; k < 3; k++) {
      const sparkA = now / 700 + k * 2.1;
      const sx = Math.cos(sparkA) * (10 + k * 5);
      const sy = Math.sin(sparkA * 1.3) * 6 - 4;
      ctx.globalAlpha = (0.4 + 0.3 * Math.sin(sparkA * 2)) * intensity;
      ctx.fillStyle = '#d9c4ff';
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.restore();
  }

  const dt = dtMs / 1000;
  for (let i = rift.motes.length - 1; i >= 0; i--) {
    const m = rift.motes[i];
    const age = now - m.born;
    if (age > m.lifeMs) {
      rift.motes.splice(i, 1);
      continue;
    }
    if (m.seekCore) {
      const dx = cx - m.x;
      const dy = cy - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 38) {
        rift.motes.splice(i, 1);
        continue;
      }
      m.vx += (dx / dist) * 64 * dt;
      m.vy += (dy / dist) * 64 * dt;
      const sp = Math.hypot(m.vx, m.vy);
      const maxSp = 115;
      if (sp > maxSp) {
        m.vx *= maxSp / sp;
        m.vy *= maxSp / sp;
      }
    } else {
      m.vx *= 0.965;
      m.vy = m.vy * 0.965 - 16 * dt;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const fade = m.seekCore
      ? Math.min(1, age / 280) * Math.min(1, (m.lifeMs - age) / 480)
      : 1 - age / m.lifeMs;
    if (fade <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 9;
    ctx.fillStyle = m.color;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.symbol, m.x, m.y);
    ctx.restore();
  }
}

interface CollisionPayload {
  x: number;
  y: number;
  bonus: number;
  entropyBonus: number;
  tier: RogueTypeKey;
  name: string;
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
  inventory: EntityInstance[];
  /** Rift gear ids — shapes the auto-income motes leaking from the rift. */
  riftSlots: string[];
  onGatherClick: (x: number, y: number, forceCrit: boolean) => void;
  /** Tapping the bottom-left spatial rift opens the rift gear page. */
  onRiftClick?: () => void;
  onCollision: (payload: CollisionPayload) => void;
}

export interface ParticleFieldHandle {
  /** Advance physics + render one frame. Driven by GameScreen's master rAF loop. */
  tick: (now: number, dt: number) => void;
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
  // Always update rotations even with no motes (black hole keeps spinning)
  cluster.diskRotation = (cluster.diskRotation ?? 0) + dt * 0.0011;
  cluster.earthRotation = (cluster.earthRotation ?? 0) + dt * TUNING.LIFE_EARTH_ROT_RATE;
  if ((cluster.moonNudgeImpulse ?? 0) > 0) {
    cluster.moonNudgeImpulse = Math.max(0, (cluster.moonNudgeImpulse ?? 0) - dt * 0.0016);
  }

  if (motes.length === 0) {
    return;
  }

  const shouldRefreshNeighbors =
    now - world.moteLastNeighborRefresh >= TUNING.MOTE_NEIGHBOR_REFRESH_MS;
  if (shouldRefreshNeighbors) {
    refreshNeighborCache(motes, world.moteNeighborCache);
    world.moteLastNeighborRefresh = now;
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
      const gravity = TUNING.MOTE_ANCHOR_GRAVITY * 1.2;
      mote.vx += nx * radial * gravity * dtScale;
      mote.vy += ny * radial * gravity * dtScale;
      // Orbital tangential force — swirl around center
      const spin = 0.32 * (35 / (dist + 8));
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
      mote.vx += -ny * 0.32 * dtScale;
      mote.vy += nx * 0.32 * dtScale;
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
      mote.vx += -ny * 0.24 * dtScale;
      mote.vy += nx * 0.24 * dtScale;
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
  const typeKey = pickRogueType();
  const type = ROGUE_TYPES[typeKey];
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const edgeDistance = Math.min(
    width / 2 / Math.max(Math.abs(cosAngle), 0.0001),
    height / 2 / Math.max(Math.abs(sinAngle), 0.0001),
  );
  const radius = edgeDistance + TUNING.ROGUE_SPAWN_EDGE_MARGIN + type.r * 0.65;
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  const targetX = cx + (Math.random() - 0.5) * width * TUNING.ROGUE_TARGET_RECT_FRAC;
  const targetY = cy + (Math.random() - 0.5) * height * TUNING.ROGUE_TARGET_RECT_FRAC;
  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
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
  const curl = field.strength * falloff * 0.22 * dtScale;
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
  inventory,
  riftSlots,
  onGatherClick,
  onRiftClick,
  onCollision,
}: ParticleFieldProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<CanvasWorld | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const riftRef = useRef<RiftState>({ nextSpawnAt: 0, spawnIdx: 0, motes: [] });
  const equippedRef = useRef<StageEntity[]>([]);
  useEffect(() => {
    equippedRef.current = riftSlots
      .map((id) => (id ? findEntityById(id) : undefined))
      .filter((e): e is StageEntity => Boolean(e));
  }, [riftSlots]);
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
      if (bounds.width <= 0 || bounds.height <= 0) return;
      // Cap DPR to 2: high-DPR phones (DPR 3) gain no visible quality for 2.25x
      // GPU/memory cost in a 2D canvas particle game.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(bounds.width * dpr));
      const pixelHeight = Math.max(1, Math.round(bounds.height * dpr));
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.setTransform(pixelWidth / bounds.width, 0, 0, pixelHeight / bounds.height, 0, 0);
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
    const frameStart = import.meta.env.DEV ? performance.now() : 0;
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
    // In-place: write-index compaction to avoid per-frame array allocation.
    {
      const arr = world.wakeTrails;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        const trail = arr[r];
        trail.x += trail.vx;
        trail.y += trail.vy;
        trail.life -= TUNING.WAKE_LIFE_DECAY * motionScale;
        if (trail.life > 0) {
          if (w !== r) arr[w] = trail;
          w++;
        }
      }
      arr.length = w;
    }

    const gravity = imploding
      ? TUNING.IMPLOSION_GRAVITY * gravityMod
      : transitionSucking
        ? TUNING.IMPLOSION_GRAVITY * 0.62 * gravityMod
        : TUNING.GRAVITY_BASE * gravityMod * (0.35 + progress * TUNING.GRAVITY_PROGRESS_SCALE);
    const captureRadius = coreRadius + (transitionSucking ? 18 : 4);
    const dampening = imploding || transitionSucking ? 0.97 : TUNING.PARTICLE_DAMPENING;

    // In-place: mutate particles instead of allocating a fresh array each frame.
    // Respawn paths use resetParticleAtEdge() to mutate the existing object.
    {
      const arr = world.particles;
      const maxVelocity = imploding ? 18 : TUNING.PARTICLE_MAX_V;
      for (let i = 0; i < arr.length; i++) {
        const particle = arr[i];
        const dx = cx - particle.x;
        const dy = cy - particle.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) {
          resetParticleAtEdge(particle, width, height);
          continue;
        }
        if (distance < captureRadius && !imploding) {
          resetParticleAtEdge(particle, width, height);
          continue;
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
          resetParticleAtEdge(particle, width, height);
        }
      }
    }

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

    {
      const arr = world.flyers;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        const flyer = arr[r];
        const speed = flyer.auto ? 0.0011 : 0.0015;
        flyer.t = Math.min(1.1, flyer.t + frameDt * speed);
        if (flyer.t >= 1) continue;
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
        if (flyer.life > 0) {
          if (w !== r) arr[w] = flyer;
          w++;
        }
      }
      arr.length = w;
    }

    {
      const arr = world.bursts;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        const burst = arr[r];
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
        if (burst.life > 0) {
          if (w !== r) arr[w] = burst;
          w++;
        }
      }
      arr.length = w;
    }

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

    // In-place: keep semantics identical (collide / expire / despawn → drop).
    // Use labeled drop blocks instead of forEach early-returns.
    {
      const arr = world.rogues;
      let w = 0;
      rogueLoop: for (let r = 0; r < arr.length; r++) {
        const rogue = arr[r];
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
          continue rogueLoop;
        }
        const onScreen = rogue.x > 0 && rogue.x < width && rogue.y > 0 && rogue.y < height;
        if (onScreen && !rogue.spotted) {
          rogue.spotted = true;
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
          continue rogueLoop;
        }
        if (!isProtected && Math.hypot(rogue.x - cx, rogue.y - cy) > Math.max(width, height) * TUNING.ROGUE_DESPAWN_DISTANCE_FRAC) {
          continue rogueLoop;
        }
        if (w !== r) arr[w] = rogue;
        w++;
      }
      arr.length = w;
    }
    {
      const arr = world.shockwaves;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        const shockwave = arr[r];
        if (now - shockwave.startedAt <= TUNING.SHOCKWAVE_FADE_MS) {
          if (w !== r) arr[w] = shockwave;
          w++;
        }
      }
      arr.length = w;
    }
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
      inventory,
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
    drawEntities(ctx, cx, cy, actualStageId, inventory, now, pointerPressure, world.cluster);
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

    // Spatial rift + equipped-shape motes (screen space, above the world layer).
    updateAndDrawRift(ctx, riftRef.current, equippedRef.current, autoRate, now, dt, height, cx, cy, stage.accent);

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
    if (import.meta.env.DEV) {
      const cost = performance.now() - frameStart;
      // @ts-expect-error dev-only diagnostic attached to window
      const stats = (window.__frameStats ??= { count: 0, heavy: 0, totalMs: 0, maxMs: 0 });
      stats.count++;
      stats.totalMs += cost;
      if (cost > stats.maxMs) stats.maxMs = cost;
      if (cost > 12) {
        stats.heavy++;
        if (cost > 25) {
          // eslint-disable-next-line no-console
          console.warn('[heavy frame]', cost.toFixed(1) + 'ms', {
            bursts: world.bursts.length,
            flyers: world.flyers.length,
            particles: world.particles.length,
            rogues: world.rogues.length,
            wakeTrails: world.wakeTrails.length,
          });
        }
      }
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
        // Tapping the spatial rift opens the rift gear page instead of gathering.
        if (onRiftClick) {
          const rawX = event.clientX - rect.left;
          const rawY = event.clientY - rect.top;
          if (Math.hypot(rawX - 46, rawY - (rect.height - 84)) <= 42) {
            onRiftClick();
            return;
          }
        }
        const { x, y, hitRogue } = applySteerNudge(rect, event.clientX, event.clientY);
        const pressureStrength = event.pointerType === 'touch' ? 1.0 : 1.05;
        updatePointerPressure(x, y, event.pointerType, pressureStrength);
        applyPointerPressureImpulse(worldRef.current, stage, x, y, event.pointerType, pressureStrength);

        // Stage 11: clicking the Moon nudges its orbit slightly and pulses its glow.
        if (stage.id === 11 && worldRef.current) {
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const moon = getStage11MoonScreen(
            cx, cy, performance.now(), worldRef.current.cluster, inventory,
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
            const moon = getStage11MoonScreen(mcx, mcy, performance.now(), worldRef.current.cluster, inventory);
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
