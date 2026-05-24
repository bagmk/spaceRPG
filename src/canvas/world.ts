/**
 * Factory functions for the CanvasWorld and its primary collections.
 * Pure — no React, no DOM, no canvas ctx. Extracted from ParticleField.tsx
 * to enable unit testing and reduce that file's size.
 */

import { TUNING } from '../game/constants';
import { getMechanic } from '../game/mechanics';
import type {
  AmbientParticle,
  CanvasWorld,
  MoteCluster,
  Stage,
  Star,
} from '../game/types';

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createMoteCluster(): MoteCluster {
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

export function createStars(width: number, height: number): Star[] {
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

export function spawnParticleAtEdge(
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

export function createParticles(width: number, height: number, stage: Stage): AmbientParticle[] {
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

export function createWorld(width: number, height: number, stage: Stage): CanvasWorld {
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

/** Reset world for a new stage while preserving the rolling event ID counter. */
export function resetForStage(world: CanvasWorld, width: number, height: number, stage: Stage): CanvasWorld {
  return {
    ...createWorld(width, height, stage),
    nextId: world.nextId,
  };
}
