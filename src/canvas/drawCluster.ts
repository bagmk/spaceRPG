import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Mote, MoteCluster, Stage } from '../game/types';
import { drawStageSprite } from './stageSprites';

interface DrawClusterArgs {
  ctx: CanvasRenderingContext2D;
  cluster: MoteCluster;
  stage: Stage;
  cx: number;
  cy: number;
  width: number;
  height: number;
  now: number;
  progress: number;
}

export function drawCluster(args: DrawClusterArgs): void {
  switch (args.stage.clusterMode) {
    case 'lifeSurface':
      drawLifeSurface(args);
      break;
    case 'blackHole':
      drawBlackHoleScene(args);
      break;
    case 'galaxy':
      drawGalaxyDisk(args);
      break;
    case 'planetary':
      drawPlanetarySystem(args);
      break;
    case 'redGiant':
      drawRedGiantBloom(args);
      break;
    case 'remnant':
      drawRemnantCloud(args);
      break;
    case 'heatDeath':
      drawHeatDeathCloud(args);
      break;
    case 'generic':
      drawGenericMotes(args);
      break;
  }
}

function drawGenericMotes({ ctx, cluster, stage, cx, cy, now, progress }: DrawClusterArgs): void {
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius, stage.accent, 0.09 + progress * 0.06);
  for (let ring = 1; ring <= 3; ring += 1) {
    ctx.strokeStyle = hexToRgba(stage.accent, (0.055 + progress * 0.03) / ring);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, cluster.physicalRadius * (ring / 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  cluster.motes.forEach((mote) => {
    const ageAlpha = Math.min(1, mote.age / 320);
    drawStageSprite(
      ctx,
      stage.id,
      mote.x,
      mote.y,
      mote.r * 1.16,
      mote.color,
      0.86 * ageAlpha,
      now / 1000 + mote.hue * Math.PI * 2,
    );
  });
}

function drawGalaxyDisk({ ctx, cluster, stage, cx, cy, progress }: DrawClusterArgs): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.55);

  const outer = Math.max(TUNING.GALAXY_DISK_MIN_RADIUS, cluster.physicalRadius);
  const diskGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
  diskGradient.addColorStop(0, hexToRgba('#fff4d6', 0.36 + progress * 0.22));
  diskGradient.addColorStop(0.28, hexToRgba(stage.coreColor, 0.14 + progress * 0.12));
  diskGradient.addColorStop(0.72, hexToRgba(stage.accent, 0.055 + progress * 0.06));
  diskGradient.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = diskGradient;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.fill();

  for (let arm = 0; arm < TUNING.GALAXY_SPIRAL_ARMS; arm += 1) {
    ctx.strokeStyle = hexToRgba(stage.coreColor, 0.08 + progress * 0.07);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let step = 0; step < 44; step += 1) {
      const u = step / 43;
      const angle = arm * Math.PI + u * Math.PI * 2.4;
      const dist = outer * (0.18 + u * 0.82);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  for (const mote of cluster.motes) {
    const lx = mote.x - cx;
    const ly = mote.y - cy;
    const alpha = Math.min(0.95, 0.35 + mote.mass * 0.08);
    ctx.fillStyle = hexToRgba(mote.color, alpha);
    ctx.beginPath();
    ctx.arc(lx, ly, Math.max(0.7, mote.r * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }

  const bulge = ctx.createRadialGradient(0, 0, 0, 0, 0, 52);
  bulge.addColorStop(0, hexToRgba('#fff7d7', 0.85));
  bulge.addColorStop(0.4, hexToRgba(stage.coreColor, 0.42));
  bulge.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = bulge;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlanetarySystem({ ctx, cluster, stage, cx, cy, progress }: DrawClusterArgs): void {
  const orbitLimit = Math.max(TUNING.PLANETARY_ORBIT_MIN_RADIUS, cluster.physicalRadius);
  const sunR = 18 + progress * 22;
  const sun = ctx.createRadialGradient(cx - sunR * 0.35, cy - sunR * 0.35, 1, cx, cy, sunR * 2.4);
  sun.addColorStop(0, hexToRgba('#fff7cf', 0.95));
  sun.addColorStop(0.35, hexToRgba(stage.coreColor, 0.9));
  sun.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR * 2.4, 0, Math.PI * 2);
  ctx.fill();

  for (let orbit = 0; orbit < 5; orbit += 1) {
    const rx = orbitLimit * (0.34 + orbit * 0.165);
    ctx.strokeStyle = hexToRgba(stage.accent, 0.12 + progress * 0.07);
    ctx.lineWidth = orbit === 4 ? 1.2 : 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  cluster.motes.forEach((mote) => {
    const ageAlpha = Math.min(1, mote.age / 450);
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.92, mote.color, ageAlpha * 0.82, mote.orbitAngle ?? 0);
  });
}

function drawLifeSurface({ ctx, cluster, cx, cy }: DrawClusterArgs): void {
  const radius = TUNING.LIFE_SURFACE_R;
  const rotation = cluster.earthRotation ?? 0;
  const plantMass = cluster.motes.reduce(
    (sum, mote) => sum + (mote.surfaceKind === 'plant' ? mote.mass : 0),
    0,
  );
  const biomass = Math.min(0.62, plantMass / 280);
  const ocean = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.35,
    radius * 0.1,
    cx,
    cy,
    radius * 1.15,
  );
  ocean.addColorStop(0, '#70d6ff');
  ocean.addColorStop(0.48, '#246fae');
  ocean.addColorStop(1, '#08213f');
  ctx.fillStyle = ocean;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.35);
  ctx.fillStyle = hexToRgba('#46d878', biomass);
  ctx.beginPath();
  ctx.ellipse(-radius * 0.24, -radius * 0.1, radius * 0.48, radius * 0.18, -0.45, 0, Math.PI * 2);
  ctx.ellipse(radius * 0.28, radius * 0.16, radius * 0.36, radius * 0.16, 0.35, 0, Math.PI * 2);
  ctx.ellipse(radius * 0.04, -radius * 0.38, radius * 0.24, radius * 0.1, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, -0.45, Math.PI * 1.25);
  ctx.stroke();

  const visible: Array<{ mote: Mote; x: number; y: number; z: number }> = [];
  cluster.motes.forEach((mote) => {
    const lat = mote.surfaceLat ?? 0;
    const lon = (mote.surfaceLon ?? 0) + rotation;
    const sx = Math.cos(lat) * Math.sin(lon);
    const sz = Math.cos(lat) * Math.cos(lon);
    const sy = Math.sin(lat);
    if (sz < -0.04) {
      return;
    }
    visible.push({
      mote,
      x: cx + sx * radius,
      y: cy + sy * radius,
      z: sz,
    });
  });

  visible.sort((a, b) => a.z - b.z);
  visible.forEach(({ mote, x, y, z }) => {
    const ageProgress = Math.min(1, mote.age / TUNING.LIFE_FEATURE_GROW_MS);
    const size = (mote.r * 0.52 + 0.9) * ageProgress * (0.65 + z * 0.35);
    const color =
      mote.surfaceKind === 'city'
        ? '#ffeeaa'
        : mote.surfaceKind === 'water'
          ? '#9de8ff'
          : '#65e88f';
    ctx.fillStyle = hexToRgba(color, 0.86 * ageProgress * (0.55 + z * 0.45));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRedGiantBloom({ ctx, cluster, stage, cx, cy, progress, now }: DrawClusterArgs): void {
  const giantR = Math.max(48 + progress * 48, cluster.physicalRadius * 0.74);
  const pulse = Math.sin(now / 420) * 3;
  const star = ctx.createRadialGradient(cx - giantR * 0.28, cy - giantR * 0.28, 2, cx, cy, giantR + pulse);
  star.addColorStop(0, hexToRgba('#fff0c7', 0.94));
  star.addColorStop(0.4, hexToRgba(stage.coreColor, 0.9));
  star.addColorStop(1, hexToRgba('#4d0c04', 0.78));
  ctx.fillStyle = star;
  ctx.beginPath();
  ctx.arc(cx, cy, giantR + pulse, 0, Math.PI * 2);
  ctx.fill();

  cluster.motes.forEach((mote) => {
    const alpha = mote.hue < 0.5 ? 0.45 : 0.28;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.75, mote.color, alpha, mote.age / 1000);
  });
}

function drawRemnantCloud({ ctx, cluster, stage, cx, cy, progress }: DrawClusterArgs): void {
  const coldRadius = Math.max(72, cluster.physicalRadius);
  const coldGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coldRadius + progress * 32);
  coldGlow.addColorStop(0, hexToRgba(stage.coreColor, 0.22));
  coldGlow.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = coldGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, coldRadius + 28, 0, Math.PI * 2);
  ctx.fill();

  cluster.motes.forEach((mote) => {
    const alpha = 0.18 + Math.min(0.45, mote.mass * 0.05);
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.62, mote.color, alpha, mote.hue * Math.PI);
  });
}

function drawBlackHoleScene({ ctx, cluster, stage, cx, cy }: DrawClusterArgs): void {
  const diskMass = cluster.motes.reduce((sum, mote) => sum + mote.mass, 0);
  const inner = TUNING.BLACKHOLE_DISK_INNER;
  const outer = Math.min(
    TUNING.BLACKHOLE_DISK_OUTER_MAX,
    Math.max(
      cluster.physicalRadius,
      TUNING.BLACKHOLE_DISK_OUTER_BASE + diskMass * TUNING.BLACKHOLE_DISK_GROW_PER_MOTE,
    ),
  );
  const tilt = TUNING.BLACKHOLE_DISK_TILT;
  const rotation = cluster.diskRotation ?? 0;

  const lensGlow = ctx.createRadialGradient(cx, cy, inner * 0.4, cx, cy, outer * 1.18);
  lensGlow.addColorStop(0, hexToRgba('#fff3d2', 0.08));
  lensGlow.addColorStop(0.42, hexToRgba(stage.coreColor, 0.18));
  lensGlow.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = lensGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 1.18, 0, Math.PI * 2);
  ctx.fill();

  drawRelativisticJet(ctx, cx, cy, outer, stage, Math.min(0.42, diskMass / 380));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.18);
  drawLensedArc(ctx, outer * 0.96, tilt, stage, true);
  drawDiskRibbon(ctx, inner, outer, tilt, stage, true);

  const shadow = ctx.createRadialGradient(0, 0, inner * 0.2, 0, 0, inner * 1.28);
  shadow.addColorStop(0, '#000000');
  shadow.addColorStop(0.72, '#000000');
  shadow.addColorStop(1, hexToRgba('#160815', 0));
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, inner * 1.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,244,218,0.88)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, TUNING.BLACKHOLE_PHOTON_RING_R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.scale(1, Math.cos(tilt));
  cluster.motes.forEach((mote) => {
    const lx = mote.x - cx;
    const ly = mote.y - cy;
    const hotness = Math.max(0.32, Math.min(0.82, 0.28 + mote.mass * 0.06));
    ctx.fillStyle = hexToRgba(mote.color, hotness);
    ctx.beginPath();
    ctx.arc(lx, ly, Math.max(0.9, mote.r * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  drawDiskRibbon(ctx, inner, outer, tilt, stage, false);
  drawHotCrescent(ctx, inner, outer, tilt);
  drawLensedArc(ctx, outer * 1.04, tilt, stage, false);
  ctx.restore();

  ctx.strokeStyle = hexToRgba(stage.coreColor, Math.min(0.5, diskMass / 360));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 1.06, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHeatDeathCloud({ ctx, cluster, stage, cx, cy, now }: DrawClusterArgs): void {
  ctx.strokeStyle = hexToRgba(stage.coreColor, 0.06);
  ctx.lineWidth = 0.8;
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, cluster.physicalRadius * (ring / 4) + Math.sin(now / 900 + ring) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  cluster.motes.forEach((mote) => {
    const flicker = 0.12 + Math.max(0, Math.sin(now / 180 + mote.id)) * 0.36;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.45, mote.color, flicker, mote.age / 800);
  });
}

function drawClusterEnvelope(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, hexToRgba(color, alpha * 0.28));
  gradient.addColorStop(0.58, hexToRgba(color, alpha));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiskRibbon(
  ctx: CanvasRenderingContext2D,
  inner: number,
  outer: number,
  tilt: number,
  stage: Stage,
  back: boolean,
): void {
  const gradient = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  gradient.addColorStop(0, hexToRgba('#fff0c8', back ? 0.34 : 0.62));
  gradient.addColorStop(0.45, hexToRgba(stage.coreColor, back ? 0.26 : 0.52));
  gradient.addColorStop(1, hexToRgba(stage.accent, 0));

  ctx.save();
  ctx.scale(1, Math.cos(tilt));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (back) {
    ctx.arc(0, 0, outer, Math.PI, Math.PI * 2);
    ctx.arc(0, 0, inner, Math.PI * 2, Math.PI, true);
  } else {
    ctx.arc(0, 0, outer, 0, Math.PI);
    ctx.arc(0, 0, inner, Math.PI, 0, true);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHotCrescent(
  ctx: CanvasRenderingContext2D,
  inner: number,
  outer: number,
  tilt: number,
): void {
  ctx.save();
  ctx.scale(1, Math.cos(tilt));
  const gradient = ctx.createLinearGradient(-outer, 0, outer, 0);
  gradient.addColorStop(0, 'rgba(255,120,70,0.08)');
  gradient.addColorStop(0.28, 'rgba(255,186,100,0.34)');
  gradient.addColorStop(0.62, 'rgba(255,244,205,0.78)');
  gradient.addColorStop(1, 'rgba(255,130,70,0.12)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(6, (outer - inner) * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, (inner + outer) * 0.52, 0.06, Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();
}

function drawLensedArc(
  ctx: CanvasRenderingContext2D,
  radius: number,
  tilt: number,
  stage: Stage,
  back: boolean,
): void {
  ctx.save();
  ctx.scale(1, Math.cos(tilt) * (back ? 0.82 : 0.96));
  ctx.strokeStyle = hexToRgba(back ? stage.coreColor : '#fff3d2', back ? 0.16 : 0.24);
  ctx.lineWidth = back ? 1.4 : 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, back ? Math.PI * 1.08 : Math.PI * 0.02, back ? Math.PI * 1.92 : Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();
}

function drawRelativisticJet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stage: Stage,
  alpha: number,
): void {
  if (alpha <= 0.02) {
    return;
  }
  const gradient = ctx.createLinearGradient(cx, cy - radius * 1.55, cx, cy + radius * 1.55);
  gradient.addColorStop(0, hexToRgba(stage.coreColor, 0));
  gradient.addColorStop(0.28, hexToRgba(stage.coreColor, alpha * 0.28));
  gradient.addColorStop(0.5, hexToRgba('#ffffff', alpha * 0.16));
  gradient.addColorStop(0.72, hexToRgba(stage.coreColor, alpha * 0.28));
  gradient.addColorStop(1, hexToRgba(stage.coreColor, 0));
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(4, radius * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius * 1.35);
  ctx.lineTo(cx, cy + radius * 1.35);
  ctx.stroke();
}
