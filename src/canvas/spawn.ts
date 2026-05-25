/**
 * Mote / burst / shockwave / flyer creation and click/auto spawn logic.
 * Pure — no React, no DOM, no canvas ctx. Extracted from ParticleField.tsx.
 */

import { ROGUE_TYPES, TUNING } from '../game/constants';
import type {
  Burst,
  Flyer,
  Mote,
  MoteCluster,
  RogueTypeKey,
  Shockwave,
  Stage,
} from '../game/types';
import { getClusterTargetRadius, getMoteRadius } from './clusterGeom';

// ── Rogue / burst / shockwave / flyer factories (no inter-deps) ────────────

export function pickRogueType(): RogueTypeKey {
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

export function createShockwave(
  color: string,
  x?: number,
  y?: number,
  maxRadius?: number,
  lifeMs?: number,
  lineWidth?: number,
): Shockwave {
  return { startedAt: performance.now(), color, x, y, maxRadius, lifeMs, lineWidth };
}

export function createBurstSet(
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

export function createCurvedFlyer(
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

// ── Mote factories + cluster mutation helpers ──────────────────────────────

export function pickStageColor(stage: Stage): string {
  return stage.particleColors[Math.floor(Math.random() * stage.particleColors.length)] ?? stage.accent;
}

export function createBaseMote(
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

export function addMoteToCluster(cluster: MoteCluster, stage: Stage, mote: Mote, maxMassCap: number): void {
  if (cluster.motes.length >= TUNING.MOTE_MAX) {
    enrichExistingMote(cluster, stage, mote, maxMassCap);
    return;
  }
  cluster.motes.push(mote);
}

export function enrichExistingMote(cluster: MoteCluster, stage: Stage, incoming: Mote, maxMassCap: number): void {
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

export function createSurfaceMote(cluster: MoteCluster, stage: Stage, cx: number, cy: number, now: number): Mote {
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

export function createPhotonMote(
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

export function spawnMotesAtClick(
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
    const radius = clusterRadius * (0.28 + Math.random() * 1.06);
    const x = cx + Math.cos(angle) * radius + (Math.random() - 0.5) * spawnSpread;
    const y = cy + Math.sin(angle) * radius + (Math.random() - 0.5) * spawnSpread;
    const spreadAngle = Math.atan2(y - cy, x - cx);
    const mote = createBaseMote(
      cluster,
      stage,
      x,
      y,
      Math.cos(spreadAngle) * 0.45 + Math.cos(clickAngle) * 0.12 + (Math.random() - 0.5) * 0.72,
      Math.sin(spreadAngle) * 0.45 + Math.sin(clickAngle) * 0.12 + (Math.random() - 0.5) * 0.72,
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

export function spawnAutoMote(
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
