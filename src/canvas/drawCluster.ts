import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Mote, MoteCluster, Stage } from '../game/types';
import { drawSoftNode, drawStageSprite, drawThread, strokeLocalEllipse } from './stageSprites';

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
    case 'inflation':
      drawInflation(args);
      break;
    case 'baryogenesis':
      drawBaryogenesis(args);
      break;
    case 'qgPlasma':
      drawQGPlasma(args);
      break;
    case 'nucleosynthesis':
      drawNucleosynthesis(args);
      break;
    case 'recombination':
      drawRecombinationField(args);
      break;
    case 'darkAge':
      drawDarkAge(args);
      break;
    case 'firstStars':
      drawFirstStars(args);
      break;
    case 'reionization':
      drawReionization(args);
      break;
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
    case 'degenerate':
      drawDegenerateField(args);
      break;
    case 'heatDeath':
      drawHeatDeathCloud(args);
      break;
    default:
      // Fallback to generic motes renderer for any unhandled modes
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

// --- New per-mode drawers (concise, reuse primitives) ---
function drawInflation(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now, progress } = args;
  const t = now / 1000;
  // Bright initial flash and many outward shards
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * (1 + progress * 0.28), stage.accent, 0.18 + progress * 0.06);
  // radial flash core
  ctx.save();
  ctx.translate(cx, cy);
  const coreR = Math.max(8, cluster.physicalRadius * (0.12 + progress * 0.22));
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 3);
  coreGrad.addColorStop(0, hexToRgba('#fffaf0', 0.95));
  coreGrad.addColorStop(0.25, hexToRgba(stage.coreColor, 0.85));
  coreGrad.addColorStop(0.9, hexToRgba(stage.accent, 0.06));
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coreR * 3, 0, Math.PI * 2);
  ctx.fill();

  // shards: draw directional streaks using motes positions
  for (let i = 0; i < Math.min(80, cluster.motes.length); i += 1) {
    const mote = cluster.motes[i];
    const dx = mote.x - cx;
    const dy = mote.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = dx / dist;
    const normY = dy / dist;
    ctx.strokeStyle = hexToRgba(mote.color, 0.6 * Math.min(1, 0.35 + mote.mass * 0.02));
    ctx.lineWidth = Math.max(0.6, mote.r * 0.35);
    ctx.beginPath();
    ctx.moveTo(normX * (coreR * 0.6), normY * (coreR * 0.6));
    ctx.lineTo(normX * (coreR * 0.6 + dist * (0.6 + Math.sin(t * 6 + i) * 0.08)), normY * (coreR * 0.6 + dist * (0.6 + Math.sin(t * 6 + i) * 0.08)));
    ctx.stroke();
  }

  ctx.restore();

  // motes: bright, fast-moving sprites with radial bias
  cluster.motes.forEach((mote, idx) => {
    const ageAlpha = Math.min(1, mote.age / 200);
    const wobble = Math.sin(t * 12 + idx) * 0.9;
    drawStageSprite(ctx, stage.id, mote.x + wobble, mote.y + wobble, mote.r * (1.6 + progress * 0.8), mote.color, 0.96 * ageAlpha, t + mote.hue * Math.PI);
  });
}

function drawBaryogenesis(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now, progress } = args;
  const t = now / 1000;
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 0.98, stage.accent, 0.1 + progress * 0.04);

  // draw pair links and annihilation pulses
  for (let i = 0; i < cluster.motes.length; i += 2) {
    const a = cluster.motes[i];
    const b = cluster.motes[i + 1] ?? a;
    ctx.strokeStyle = hexToRgba(stage.coreColor, 0.06 + progress * 0.12);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // subtle connecting glow
    const midx = (a.x + b.x) / 2;
    const midy = (a.y + b.y) / 2;
    drawSoftNode(ctx, midx - cx, midy - cy, Math.max(2, Math.hypot(a.x - b.x, a.y - b.y) * 0.06), stage.coreColor, 0.12 + progress * 0.28);
  }

  // motes render with a small charge overlay (±) via sprite rotation
  cluster.motes.forEach((mote, idx) => {
    const flicker = 0.6 + Math.sin(t * 8 + idx) * 0.2;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * (1.02 + flicker * 0.18), mote.color, 0.78 + progress * 0.12, mote.age / 180 + idx);
  });
}

function drawQGPlasma(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  // additive blending for plasma soup
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 1.06, stage.coreColor, 0.06);

  for (let i = 0; i < cluster.motes.length; i += 1) {
    const mote = cluster.motes[i];
    const pulse = 0.5 + Math.abs(Math.sin(t * (3 + (i % 5)))) * 0.6;
    const r = Math.max(1.4, mote.r * (1.2 + pulse * 0.45));
    ctx.fillStyle = hexToRgba(mote.color, 0.12 + pulse * 0.32);
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    drawStageSprite(ctx, stage.id, mote.x, mote.y, r, mote.color, 0.78 * pulse, mote.hue * Math.PI * 2 + t * 0.2);
  }

  // faint turbulence threads
  for (let arm = 0; arm < 24; arm += 1) {
    ctx.strokeStyle = hexToRgba(stage.accent, 0.04 + (arm % 3) * 0.02);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let s = 0; s < 12; s += 1) {
      const u = s / 11;
      const angle = u * Math.PI * 2 + arm * 0.26 + t * 0.03;
      const dist = cluster.physicalRadius * (0.22 + u * 0.9 + Math.sin(t * 0.6 + s) * 0.02);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist * 0.86;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawNucleosynthesis(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  // binding glow and small clusters of 2-4 motes
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 0.95, stage.accent, 0.12);

  // find clusters by proximity (very cheap, local grouping)
  const groups: number[][] = [];
  const used = new Set<number>();
  for (let i = 0; i < cluster.motes.length; i += 1) {
    if (used.has(i)) continue;
    const base = cluster.motes[i];
    const group = [i];
    for (let j = i + 1; j < cluster.motes.length && group.length < 4; j += 1) {
      const other = cluster.motes[j];
      if (Math.hypot(base.x - other.x, base.y - other.y) < base.r * 8) {
        group.push(j);
        used.add(j);
      }
    }
    groups.push(group);
  }

  groups.forEach((g, gi) => {
    const seed = gi + Math.floor(t * 3);
    const glowR = 6 + g.length * 3 + (Math.sin(t * 2 + gi) + 1) * 2;
    const centroid = g.reduce((acc, idx) => {
      acc.x += cluster.motes[idx].x; acc.y += cluster.motes[idx].y; return acc;
    }, { x: 0, y: 0 });
    centroid.x /= g.length; centroid.y /= g.length;
    drawSoftNode(ctx, centroid.x, centroid.y, glowR, stage.coreColor, 0.22 + g.length * 0.06);
    // small binding threads
    for (let k = 0; k < g.length; k += 1) {
      const a = cluster.motes[g[k]];
      for (let m = k + 1; m < g.length; m += 1) {
        const b = cluster.motes[g[m]];
        drawThread(ctx, a.x, a.y, b.x, b.y, stage.accent, 0.08 + g.length * 0.06, 0.8 + g.length * 0.3);
      }
    }
    // draw particles inside cluster
    g.forEach((idx) => {
      const mote = cluster.motes[idx];
      drawStageSprite(ctx, stage.id, mote.x, mote.y, Math.max(1.4, mote.r * 1.05), mote.color, 0.86, mote.hue + seed);
    });
  });
}

function drawRecombinationField(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 0.98, stage.coreColor, 0.08);

  // orbital rings and electrons
  for (let orbit = 0; orbit < 4; orbit += 1) {
    const rr = cluster.physicalRadius * (0.18 + orbit * 0.14);
    strokeLocalEllipse(ctx, rr * 1.02, rr * 0.34, orbit * 0.22 + t * 0.06, stage.accent, 0.07 + orbit * 0.02, 1 + orbit * 0.2);
  }

  cluster.motes.forEach((mote, idx) => {
    // electrons appear as small fast dots orbiting small nucleus points
    const orbitPhase = (mote.hue + t * (0.9 + (idx % 3) * 0.2));
    drawStageSprite(ctx, stage.id, mote.x + Math.cos(orbitPhase) * mote.r, mote.y + Math.sin(orbitPhase) * mote.r, mote.r * 0.9, mote.color, 0.78, orbitPhase);
    // photon streaks on occasional capture
    if (mote.age % 900 < 60) {
      ctx.strokeStyle = hexToRgba('#ffffff', 0.18 + Math.abs(Math.sin(t * 8 + idx)) * 0.36);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mote.x, mote.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
  });
}

function drawDarkAge(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  // almost empty field, long trails and faint glows
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 0.92, stage.accent, 0.02);
  cluster.motes.forEach((mote, idx) => {
    const baseAlpha = 0.12 + Math.min(0.6, mote.mass * 0.04);
    // draw a long faded trail by layering translucent arcs offset by velocity
    for (let s = 0; s < 4; s += 1) {
      const decay = 1 - s / 4;
      ctx.fillStyle = hexToRgba(mote.color, baseAlpha * decay * 0.45);
      ctx.beginPath();
      ctx.ellipse(mote.x - mote.vx * s * 0.6, mote.y - mote.vy * s * 0.6, Math.max(0.6, mote.r * 0.6 * decay), Math.max(0.6, mote.r * 0.6 * decay), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawStageSprite(ctx, stage.id, mote.x, mote.y, Math.max(0.6, mote.r * 0.65), mote.color, 0.42, mote.hue + Math.sin(t * 0.4 + idx));
  });
}

function drawFirstStars(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 1.08, stage.coreColor, 0.14 + Math.sin(t / 0.8) * 0.04);

  cluster.motes.forEach((mote, idx) => {
    const temperature = 2500 + mote.mass * 600;
    const starColor = getBlackbodyColor(temperature);
    const cloudPhase = Math.min(1, mote.age / 1200);
    const supernova = mote.mass >= 60;

    if (mote.mass < 5) {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + t * 0.2 + idx * 0.1;
        const rr = mote.r * (1.8 - cloudPhase * 0.4);
        const px = mote.x + Math.cos(angle) * rr;
        const py = mote.y + Math.sin(angle) * rr * 0.7;
        ctx.fillStyle = hexToRgba('#b9c9e6', 0.55 + cloudPhase * 0.12);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.1, mote.r * 0.42), 0, Math.PI * 2);
        ctx.fill();
        if (i > 0) {
          const prevAngle = ((i - 1) / 6) * Math.PI * 2 + t * 0.2 + idx * 0.1;
          drawThread(
            ctx,
            mote.x + Math.cos(prevAngle) * rr,
            mote.y + Math.sin(prevAngle) * rr * 0.7,
            px,
            py,
            '#a8c7ff',
            0.12,
            0.8,
          );
        }
      }
      return;
    }

    const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, mote.r * 4.5);
    glow.addColorStop(0, hexToRgba('#fff6db', 0.9));
    glow.addColorStop(0.35, hexToRgba(starColor, 0.8));
    glow.addColorStop(1, hexToRgba(starColor, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = starColor;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, Math.max(2, mote.r * (mote.mass < 20 ? 1.1 : 1.55)), 0, Math.PI * 2);
    ctx.fill();

    if (supernova) {
      const ringR = mote.r * (4 + (Math.sin(t * 4 + idx) + 1) * 4);
      ctx.strokeStyle = hexToRgba('#8bfff0', 0.3);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hexToRgba('#9cff8a', 0.16);
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, ringR * 1.35, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function drawReionization(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const t = now / 1000;
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 1.02, stage.accent, 0.1);

  // expanding ionized bubbles around bright motes
  cluster.motes.forEach((mote, idx) => {
    const bubbleR = mote.r * (2.4 + Math.abs(Math.sin(t * 0.7 + idx)) * 6);
    ctx.strokeStyle = hexToRgba(stage.coreColor, 0.06 + (Math.sin(t * 1.3 + idx) + 1) * 0.04);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, bubbleR, 0, Math.PI * 2);
    ctx.stroke();
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 1.2, mote.color, 0.86, mote.hue + t * 0.14);
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
  const sunR = 22 + progress * 14;
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

  const earthOrbit = Math.min(orbitLimit * 0.86, 200);
  const earthAngle = progress * Math.PI * 4.5;
  const earthX = cx + Math.cos(earthAngle) * earthOrbit;
  const earthY = cy + Math.sin(earthAngle) * earthOrbit * 0.45;
  ctx.strokeStyle = hexToRgba('#ffffff', 0.08);
  ctx.beginPath();
  ctx.ellipse(cx, cy, earthOrbit, earthOrbit * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  drawEarthPhase(ctx, earthX, earthY, 18, progress, earthAngle);

  if (progress >= 0.22) {
    const moonAngle = earthAngle * 5;
    const moonOrbit = 24;
    const moonX = earthX + Math.cos(moonAngle) * moonOrbit;
    const moonY = earthY + Math.sin(moonAngle) * moonOrbit * 0.65;
    ctx.strokeStyle = hexToRgba('#b7c3da', 0.15);
    ctx.beginPath();
    ctx.ellipse(earthX, earthY, moonOrbit, moonOrbit * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d7dbe4';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 3.8, 0, Math.PI * 2);
    ctx.fill();
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

  const planets = [
    { name: 'Mercury', orbit: 56, consumeAt: 0.05, color: '#b29a7d' },
    { name: 'Venus', orbit: 78, consumeAt: 0.12, color: '#e0b882' },
    { name: 'Earth', orbit: 102, consumeAt: 0.25, color: '#5ea4ff' },
    { name: 'Mars', orbit: 126, consumeAt: 0.38, color: '#c96f4c' },
    { name: 'Jupiter', orbit: 168, consumeAt: 0.55, color: '#d9b08b' },
    { name: 'Saturn', orbit: 212, consumeAt: 0.68, color: '#ecd8a4' },
    { name: 'Uranus', orbit: 248, consumeAt: 0.78, color: '#b8f1ea' },
    { name: 'Neptune', orbit: 286, consumeAt: 0.87, color: '#5f8eff' },
    { name: 'Pluto', orbit: 322, consumeAt: 0.95, color: '#d2d0c8' },
  ];

  planets.forEach((planet, index) => {
    if (progress >= planet.consumeAt) {
      return;
    }
    const angle = now / 2400 + index * 0.72;
    const x = cx + Math.cos(angle) * planet.orbit;
    const y = cy + Math.sin(angle) * planet.orbit * 0.35;
    ctx.strokeStyle = hexToRgba(planet.color, 0.08);
    ctx.beginPath();
    ctx.ellipse(cx, cy, planet.orbit, planet.orbit * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = planet.color;
    ctx.beginPath();
    ctx.arc(x, y, index < 4 ? 4 + index * 0.5 : 6 + index * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });

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

function drawDegenerateField({ ctx, cluster, stage, cx, cy, now }: DrawClusterArgs): void {
  const pulse = Math.sin(now / 240) * 0.5 + 0.5;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cluster.physicalRadius * 1.3);
  gradient.addColorStop(0, hexToRgba(stage.coreColor, 0.18));
  gradient.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, cluster.physicalRadius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  cluster.motes.forEach((mote, index) => {
    const flash = index % 11 === 0 ? 0.4 + pulse * 0.4 : 0.18 + pulse * 0.08;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.58, mote.color, flash, now / 1000 + index);
  });
}

function drawBlackHoleScene({ ctx, cluster, stage, cx, cy }: DrawClusterArgs): void {
  const progress = arguments[0].progress as number;
  const diskMass = cluster.motes.reduce((sum, mote) => sum + mote.mass, 0);
  const maxField = Math.min(arguments[0].width, arguments[0].height) * 0.15;
  const inner = maxField * (1 - progress) + 5 * progress;
  const outer = Math.min(
    TUNING.BLACKHOLE_DISK_OUTER_MAX,
    Math.max(
      inner * 1.65,
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

function getBlackbodyColor(temperature: number): string {
  if (temperature < 2500) return 'rgb(120, 30, 0)';
  if (temperature < 4000) return 'rgb(255, 100, 60)';
  if (temperature < 5800) return 'rgb(255, 180, 100)';
  if (temperature < 8000) return 'rgb(255, 235, 200)';
  if (temperature < 12000) return 'rgb(220, 240, 255)';
  return 'rgb(170, 200, 255)';
}

function drawEarthPhase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  progress: number,
  t: number,
): void {
  if (progress < 0.1) {
    drawLavaPlanet(ctx, x, y, r, 0.2 + progress * 3);
    for (let i = 0; i < 5; i += 1) {
      const a = t * 1.8 + i * 1.2;
      const px = x + Math.cos(a) * (26 + i * 4);
      const py = y + Math.sin(a) * (18 + i * 3);
      ctx.fillStyle = i % 2 === 0 ? '#b78546' : '#7b6556';
      ctx.beginPath();
      ctx.arc(px, py, 1.8 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (progress < 0.2) {
    drawLavaPlanet(ctx, x, y, r, 0.65);
    return;
  }
  if (progress < 0.25) {
    drawLavaPlanet(ctx, x, y, r, 0.7);
    const mx = x - 32 + (progress - 0.2) * 600;
    const my = y - 18 + (progress - 0.2) * 240;
    ctx.fillStyle = '#f0c18a';
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (progress < 0.4) {
    drawCoolingPlanet(ctx, x, y, r, (progress - 0.25) / 0.15);
    return;
  }
  if (progress < 0.55) {
    drawWaterPlanet(ctx, x, y, r, (progress - 0.4) / 0.15);
    return;
  }
  if (progress < 0.65) {
    drawContinentPlanet(ctx, x, y, r, (progress - 0.55) / 0.1);
    return;
  }
  if (progress < 0.75) {
    drawPlantPlanet(ctx, x, y, r, (progress - 0.65) / 0.1);
    return;
  }
  if (progress < 0.85) {
    drawLifePlanet(ctx, x, y, r, (progress - 0.75) / 0.1, t);
    return;
  }
  if (progress < 0.92) {
    drawCityPlanet(ctx, x, y, r, (progress - 0.85) / 0.07, t);
    return;
  }
  if (progress < 0.95) {
    drawMeteorImpact(ctx, x, y, r, (progress - 0.92) / 0.03, t);
    return;
  }
  drawMarsLike(ctx, x, y, r, (progress - 0.95) / 0.05);
}

function drawPlanetBase(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colorA: string, colorB: string): void {
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r * 1.2);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLavaPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, intensity: number): void {
  drawPlanetBase(ctx, x, y, r, '#ffcf7d', '#74160a');
  ctx.fillStyle = hexToRgba('#ff5a22', 0.38 + intensity * 0.3);
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(i) * r * 0.35, y + Math.sin(i * 1.7) * r * 0.28, r * (0.18 + i * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoolingPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  drawPlanetBase(ctx, x, y, r, '#d88453', '#342320');
  ctx.fillStyle = hexToRgba('#4f3a32', 0.35 + progress * 0.3);
  ctx.fillRect(x - r * 0.55, y - r * 0.08, r * 0.7, r * 0.18);
}

function drawWaterPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  drawPlanetBase(ctx, x, y, r, '#86d4ff', '#185c8d');
  ctx.fillStyle = hexToRgba('#1f2b33', 0.18 + progress * 0.22);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.18, y - r * 0.05, r * 0.3, r * 0.15, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.22, y + r * 0.18, r * 0.2, r * 0.12, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawContinentPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  drawWaterPlanet(ctx, x, y, r, progress);
  ctx.fillStyle = '#876a42';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.22, y - r * 0.1, r * 0.24, r * 0.13, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.16, y + r * 0.15, r * 0.18, r * 0.1, 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlantPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  drawContinentPlanet(ctx, x, y, r, progress);
  ctx.fillStyle = hexToRgba('#4dc76a', 0.45 + progress * 0.25);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.18, y - r * 0.08, r * 0.18, r * 0.09, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.14, y + r * 0.16, r * 0.12, r * 0.07, 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawLifePlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number, t: number): void {
  drawPlantPlanet(ctx, x, y, r, progress);
  ctx.fillStyle = hexToRgba('#d5ff9f', 0.22);
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(t * 2 + i) * r * 0.48, y + Math.sin(t * 2.3 + i) * r * 0.32, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCityPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number, t: number): void {
  drawLifePlanet(ctx, x, y, r, progress, t);
  ctx.fillStyle = '#ffd77a';
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(i * 0.52 + t) * r * 0.42, y + Math.sin(i * 0.73 + t) * r * 0.28, 1.1 + ((i % 3) === 0 ? 0.5 : 0), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMeteorImpact(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number, t: number): void {
  drawLavaPlanet(ctx, x, y, r, 0.9);
  const mx = x - r * 2.4 + progress * r * 3.1;
  const my = y - r * 1.2 + progress * r * 1.1;
  ctx.fillStyle = '#f0c18a';
  ctx.beginPath();
  ctx.arc(mx, my, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffe6aa', 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx - 16, my - 8);
  ctx.lineTo(mx, my);
  ctx.stroke();
}

function drawMarsLike(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number): void {
  drawPlanetBase(ctx, x, y, r, '#d37e55', '#6e2416');
  ctx.fillStyle = hexToRgba('#8b3b21', 0.28 + progress * 0.2);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.22, y - r * 0.08, r * 0.22, r * 0.1, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.18, y + r * 0.15, r * 0.16, r * 0.08, 0.35, 0, Math.PI * 2);
  ctx.fill();
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
