/**
 * Geometry helpers and per-frame collection caps for the canvas world.
 * Pure — no React, no DOM. Extracted from ParticleField.tsx.
 */

import { TUNING } from '../game/constants';
import { STAGES } from '../game/stages';
import type { CanvasWorld, Stage } from '../game/types';

export function getCosmicStageProgress(stage: Stage, cosmicClockSec: number): number {
  const stageStart = STAGES[stage.id - 2]?.cosmicTimeSec ?? 1e-34;
  if (cosmicClockSec <= stageStart) return 0;
  const startLog = Math.log10(stageStart);
  const endLog = Math.log10(stage.cosmicTimeSec);
  const span = endLog - startLog;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (Math.log10(cosmicClockSec) - startLog) / span));
}

export function getMoteRadius(mass: number): number {
  return TUNING.MOTE_BASE_RADIUS + Math.sqrt(mass) * TUNING.MOTE_RADIUS_PER_MASS;
}

export function getClusterTargetRadius(stage: Stage, moteCount: number, progress: number): number {
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

export function getEffectiveMaxMass(progress01: number): number {
  return 12 + Math.floor(progress01 * 100);
}

export function capWorldCollections(world: CanvasWorld): void {
  world.bursts = world.bursts.slice(-TUNING.BURST_MAX);
  world.flyers = world.flyers.slice(-TUNING.FLYER_MAX);
  world.wakeTrails = world.wakeTrails.slice(-TUNING.WAKE_TRAIL_MAX);
  world.shockwaves = world.shockwaves.slice(-TUNING.SHOCKWAVE_MAX);
  // Rogues are managed by expire/despawn/collision logic, not capped here.
}

export function getBlackHoleRadius(width: number, height: number, progress: number): number {
  const initialRadius = Math.min(width, height) * 0.3;
  return initialRadius * Math.pow(1 - progress, 0.7) + 5 * Math.pow(progress, 1.5);
}

export function getHawkingPhotonColor(progress: number): string {
  if (progress > 0.85) return '#fff7db';
  if (progress > 0.55) return '#ffd8a0';
  return '#bba3ff';
}
