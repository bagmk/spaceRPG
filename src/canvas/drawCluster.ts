import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Mote, MoteCluster, Stage } from '../game/types';
import type { PurchasedEntityEntry } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount } from '../game/entities/stageItems';
import { drawSoftNode, drawStageSprite, drawThread, strokeLocalEllipse } from './stageSprites';

// ── V9 animation helpers ────────────────────────────────────────────────────
function rangeT(progress: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}
function easeIO(t: number): number {
  return t * t * (3 - 2 * t);
}
function drawMilestoneFlash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  progress: number,
  color: string,
  milestones = [0.1, 0.25, 0.5, 0.75, 0.9],
): void {
  for (const m of milestones) {
    const delta = progress - m;
    if (delta >= 0 && delta < 0.04) {
      const t = 1 - delta / 0.04;
      ctx.strokeStyle = hexToRgba(color, t * 0.45);
      ctx.lineWidth = 2 * t;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + (1 - t) * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// V9 planet formation: each planet appears individually from dust → proto → sphere → final
function drawFormingPlanet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bodyIdx: number,
  localT: number,
  now: number,
): void {
  const body = SOLAR_BODIES[bodyIdx];
  const angle = now / (1400 + bodyIdx * 190) + bodyIdx * 0.72;
  const px = cx + Math.cos(angle) * body.orbit;
  const py = cy + Math.sin(angle) * body.orbit * 0.42;

  ctx.strokeStyle = hexToRgba(body.color, easeIO(Math.min(1, localT * 3)) * 0.1);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, body.orbit, body.orbit * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (localT < 0.25) {
    const a = easeIO(localT / 0.25) * 0.6;
    for (let i = 0; i < 7; i += 1) {
      const da = (i / 7) * Math.PI * 2 + now / (600 + bodyIdx * 80);
      const dr = body.r * (0.55 + Math.sin(now / 280 + i + bodyIdx) * 0.35);
      ctx.fillStyle = hexToRgba(body.color, a);
      ctx.beginPath();
      ctx.arc(px + Math.cos(da) * dr, py + Math.sin(da) * dr * 0.42, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (localT < 0.5) {
    const t2 = easeIO((localT - 0.25) / 0.25);
    const r = Math.max(1.2, body.r * (0.3 + t2 * 0.5));
    if (bodyIdx === 2) drawLavaPlanet(ctx, px, py, r, 0.8);
    else drawPlanetBase(ctx, px, py, r, body.color, '#1d1a21');
    if (Math.sin(now / 210 + bodyIdx * 7) > 0.55) {
      const sa = now / (420 + bodyIdx * 50);
      ctx.fillStyle = hexToRgba('#ffcc88', 0.65);
      ctx.beginPath();
      ctx.arc(px + Math.cos(sa) * r * 0.9, py + Math.sin(sa) * r * 0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (localT < 0.75) {
    const t3 = easeIO((localT - 0.5) / 0.25);
    const r = Math.max(1.2, body.r * (0.8 + t3 * 0.2));
    if (bodyIdx === 2) drawLavaPlanet(ctx, px, py, r, 0.5 - t3 * 0.3);
    else drawPlanetBase(ctx, px, py, r, body.color, '#1d1a21');
  } else {
    if (bodyIdx === 2) drawPlanetBase(ctx, px, py, body.r, '#8f4b33', '#2a120f');
    else drawPlanetBase(ctx, px, py, body.r, body.color, '#1d1a21');
    if ('rings' in body && body.rings) {
      ctx.strokeStyle = hexToRgba('#fff0c4', 0.5 * ((localT - 0.75) / 0.25));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px, py, body.r * 1.7, body.r * 0.62, -0.24, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

interface DrawClusterArgs {
  ctx: CanvasRenderingContext2D;
  cluster: MoteCluster;
  stage: Stage;
  purchasedEntities: PurchasedEntityEntry[];
  cx: number;
  cy: number;
  width: number;
  height: number;
  now: number;
  progress: number;
  pointerPressure?: PointerPressureVisualField | null;
}

interface PointerPressureVisualField {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

function applyPointerVisualDisplacement(
  x: number,
  y: number,
  field: PointerPressureVisualField | null | undefined,
  amount = 12,
): { x: number; y: number; falloff: number } {
  if (!field || field.strength <= 0) return { x, y, falloff: 0 };
  const dx = x - field.x;
  const dy = y - field.y;
  const distance = Math.hypot(dx, dy);
  if (distance > field.radius) return { x, y, falloff: 0 };
  const nx = distance > 0.001 ? dx / distance : 1;
  const ny = distance > 0.001 ? dy / distance : 0;
  const falloff = Math.pow(1 - distance / field.radius, 2);
  const offset = amount * field.strength * falloff;
  return {
    x: x + nx * offset,
    y: y + ny * offset,
    falloff,
  };
}

function linkedEntityCount(args: DrawClusterArgs, entityName: string): number {
  const entity = getEntitiesForStage(args.stage.id).find((candidate) => candidate.name === entityName);
  if (!entity) return 0;
  return getPurchasedEntityCount(args.purchasedEntities, entity);
}

function linkedEntityRatio(args: DrawClusterArgs, entityName: string): number {
  const entity = getEntitiesForStage(args.stage.id).find((candidate) => candidate.name === entityName);
  if (!entity || entity.maxCount <= 0) return 0;
  return Math.min(1, getPurchasedEntityCount(args.purchasedEntities, entity) / entity.maxCount);
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

function drawGenericMotes({ ctx, cluster, stage, cx, cy, now, progress, pointerPressure }: DrawClusterArgs): void {
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
    const pushed = applyPointerVisualDisplacement(mote.x, mote.y, pointerPressure, 12);
    drawStageSprite(
      ctx,
      stage.id,
      pushed.x,
      pushed.y,
      mote.r * 1.16,
      mote.color,
      0.86 * ageAlpha,
      mote.spin,
    );
  });
}

// --- New per-mode drawers (concise, reuse primitives) ---
function drawInflation(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now, progress, pointerPressure } = args;
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
    const pushed = applyPointerVisualDisplacement(mote.x + wobble, mote.y + wobble, pointerPressure, 13);
    drawStageSprite(ctx, stage.id, pushed.x, pushed.y, mote.r * (1.6 + progress * 0.8), mote.color, 0.96 * ageAlpha, mote.spin);
  });
}

function drawBaryogenesis(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now, progress, pointerPressure } = args;
  const t = now / 1000;
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 0.98, stage.accent, 0.1 + progress * 0.04);

  // motes render with a small charge overlay (±) via sprite rotation
  cluster.motes.forEach((mote, idx) => {
    const flicker = 0.6 + Math.sin(t * 8 + idx) * 0.2;
    const pushed = applyPointerVisualDisplacement(mote.x, mote.y, pointerPressure, 12);
    drawStageSprite(ctx, stage.id, pushed.x, pushed.y, mote.r * (1.02 + flicker * 0.18), mote.color, 0.78 + progress * 0.12, mote.spin);
  });
}

function drawQGPlasma(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now, pointerPressure } = args;
  const t = now / 1000;
  // additive blending for plasma soup
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawClusterEnvelope(ctx, cx, cy, cluster.physicalRadius * 1.06, stage.coreColor, 0.06);

  for (let i = 0; i < cluster.motes.length; i += 1) {
    const mote = cluster.motes[i];
    const pushed = applyPointerVisualDisplacement(mote.x, mote.y, pointerPressure, 13);
    const pulse = 0.5 + Math.abs(Math.sin(t * (3 + (i % 5)))) * 0.6;
    const r = Math.max(1.4, mote.r * (1.2 + pulse * 0.45));
    ctx.fillStyle = hexToRgba(mote.color, 0.12 + pulse * 0.32);
    ctx.beginPath();
    ctx.arc(pushed.x, pushed.y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    drawStageSprite(ctx, stage.id, pushed.x, pushed.y, r, mote.color, 0.78 * pulse, mote.spin);
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

    ctx.fillStyle = hexToRgba(starColor, 0.15);
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba('#fff6db', 0.55);
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * 1.5, 0, Math.PI * 2);
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

function drawGalaxyDisk({ ctx, cluster, stage, cx, cy, progress, pointerPressure }: DrawClusterArgs): void {
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
    const pushed = applyPointerVisualDisplacement(mote.x, mote.y, pointerPressure, 13);
    const lx = pushed.x - cx;
    const ly = pushed.y - cy;
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

// V9: planet formation windows — each planet forms within its own progress window
const V9_PLANET_WINDOWS = [
  { start: 0.32, end: 0.40 }, // Mercury
  { start: 0.40, end: 0.48 }, // Venus
  { start: 0.48, end: 0.58 }, // Earth (molten proto-planet)
  { start: 0.58, end: 0.66 }, // Mars
  { start: 0.66, end: 0.74 }, // Jupiter
  { start: 0.74, end: 0.80 }, // Saturn
  { start: 0.80, end: 0.86 }, // Uranus
  { start: 0.86, end: 0.91 }, // Neptune
  { start: 0.91, end: 0.95 }, // Pluto
] as const;

function drawPlanetarySystem(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, progress, now, pointerPressure } = args;
  const sunLevel = linkedEntityCount(args, 'Sun');
  const rockyPlanetLevel = linkedEntityCount(args, 'Rocky Planet');
  const sunT = Math.min(1, sunLevel / 20);

  // Layer 1: molecular cloud / nebula haze (0–16%)
  const hazeAlpha = easeIO(rangeT(progress, 0, 0.08)) * (1 - easeIO(rangeT(progress, 0.10, 0.22)));
  if (hazeAlpha > 0.005) {
    drawClusterEnvelope(ctx, cx, cy, 160, stage.accent, 0.14 * hazeAlpha);
    for (let arm = 0; arm < 6; arm += 1) {
      ctx.strokeStyle = hexToRgba(stage.accent, 0.07 * hazeAlpha);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let step = 0; step < 24; step += 1) {
        const u = step / 23;
        const angle = arm + u * Math.PI * 1.3 + now / 2400;
        const r = 28 + u * 150;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * 0.48;
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // (Dust is drawn after the sun — see Layer 5b below)

  // Layer 3: accretion disk rings (16–32%)
  const diskT = easeIO(rangeT(progress, 0.16, 0.32));
  if (diskT > 0.005) {
    for (let ring = 0; ring < 5; ring += 1) {
      const rr = 56 + ring * 38;
      ctx.strokeStyle = hexToRgba(stage.accent, 0.06 * diskT * (1 - ring / 5));
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Layer 4: planetesimal swarm (24–40%)
  const planT = easeIO(rangeT(progress, 0.24, 0.32)) * (1 - easeIO(rangeT(progress, 0.36, 0.50)));
  if (planT > 0.005) {
    for (let i = 0; i < 16; i += 1) {
      const angle = now / 900 + i * 0.72;
      const orbit = 64 + (i % 6) * 22;
      const baseX = cx + Math.cos(angle) * orbit;
      const baseY = cy + Math.sin(angle) * orbit * 0.42;
      const pushed = applyPointerVisualDisplacement(baseX, baseY, pointerPressure, 14);
      const x = pushed.x;
      const y = pushed.y;
      ctx.fillStyle = hexToRgba(i % 3 === 0 ? '#f0c18a' : '#8e806d', 0.55 * planT);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (i % 4) * 0.4, 0, Math.PI * 2);
      ctx.fill();
      if (i % 5 === 0) {
        ctx.strokeStyle = hexToRgba('#ffe0a6', 0.3 * planT);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 14, y - 6);
        ctx.lineTo(x + 6, y + 3);
        ctx.stroke();
      }
    }
  }

  // Layer 5: proto-sun and stable sun — grows linearly with purchases
  if (sunT > 0) {
    const sunR = 8 + sunT * 28;
    drawSolarSun(ctx, stage, cx, cy, sunR, 0.75 + sunT * 0.2, now, sunLevel);
  }

  // Layer 5b: accretion dust — glowing sparks orbiting outside the sun
  const sunVisualR = sunT > 0 ? (8 + sunT * 28) * 2.5 : 0; // sun corona radius
  const dustAlpha = 0.9 * (1 - rangeT(progress, 0.45, 0.88));
  if (dustAlpha > 0.005 && cluster.motes.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    cluster.motes.forEach((mote) => {
      const pushed = applyPointerVisualDisplacement(mote.x, mote.y, pointerPressure, 13);
      const dist = Math.hypot(cx - pushed.x, cy - pushed.y);
      // Skip dust inside the sun corona — it wouldn't be visible anyway
      if (dist < sunVisualR) return;
      const nx = dist > 0.1 ? (cx - pushed.x) / dist : 0;
      const ny = dist > 0.1 ? (cy - pushed.y) / dist : 0;

      // Outer glow halo
      const sparkle = 0.6 + Math.sin(now * 0.003 + mote.id * 2.3) * 0.4;
      ctx.fillStyle = hexToRgba('#ffd880', dustAlpha * 0.2 * sparkle);
      ctx.beginPath();
      ctx.arc(pushed.x, pushed.y, mote.r * 4 + 2, 0, Math.PI * 2);
      ctx.fill();

      // Bright particle core
      ctx.fillStyle = hexToRgba('#ffe8b0', dustAlpha * 0.85 * sparkle);
      ctx.beginPath();
      ctx.arc(pushed.x, pushed.y, mote.r * 1.5 + 1, 0, Math.PI * 2);
      ctx.fill();

      // White hot center
      ctx.fillStyle = hexToRgba('#ffffff', dustAlpha * 0.55 * sparkle);
      ctx.beginPath();
      ctx.arc(pushed.x, pushed.y, mote.r * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Motion streak toward sun
      const streakLen = Math.min(14, dist * 0.12);
      ctx.strokeStyle = hexToRgba('#ffc860', dustAlpha * 0.4);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pushed.x, pushed.y);
      ctx.lineTo(pushed.x + nx * streakLen, pushed.y + ny * streakLen);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Layer 6: individual planet formation and stable orbits
  SOLAR_BODIES.forEach((body, idx) => {
    if (sunLevel <= 0) return;
    if (idx >= rockyPlanetLevel) return;
    const win = V9_PLANET_WINDOWS[idx];
    const localT = Math.max(0.18, rangeT(progress, win.start, win.end));
    if (localT < 1.0) {
      drawFormingPlanet(ctx, cx, cy, idx, localT, now);
    } else {
      // Stable: draw orbit ring + final planet
      ctx.strokeStyle = hexToRgba(body.color, 0.08);
      ctx.lineWidth = idx === 2 ? 1.2 : 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, body.orbit, body.orbit * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      const angle = now / (1400 + idx * 190) + idx * 0.72;
      const basePx = cx + Math.cos(angle) * body.orbit;
      const basePy = cy + Math.sin(angle) * body.orbit * 0.42;
      const pushed = applyPointerVisualDisplacement(basePx, basePy, pointerPressure, 14);
      const px = pushed.x;
      const py = pushed.y;
      if (idx === 2) {
        // Earth in solar system: water by 95%, city by 98%
        if (progress >= 0.98) drawSolarEarth(ctx, px, py, body.r, 'city', now / 900);
        else if (progress >= 0.95) drawSolarEarth(ctx, px, py, body.r, 'water', now / 900);
        else drawPlanetBase(ctx, px, py, body.r, '#8f4b33', '#2a120f');

        // Moon orbiting Earth + shadow on Earth
        const moonLevel = linkedEntityCount(args, 'Moon');
        if (moonLevel > 0) {
          const moonOrbit = body.r * 2.2;
          const moonAngle = now / 2200;
          const moonR = 2.5;
          const mx = px + Math.cos(moonAngle) * moonOrbit;
          const my = py + Math.sin(moonAngle) * moonOrbit * 0.45;
          // Moon body
          ctx.fillStyle = '#d0cdc4';
          ctx.beginPath();
          ctx.arc(mx, my, moonR, 0, Math.PI * 2);
          ctx.fill();
          // Shadow on Earth when moon is in front (sin < 0 = closer to viewer)
          if (Math.sin(moonAngle) < 0.2) {
            const shadowX = px + Math.cos(moonAngle) * body.r * 0.5;
            const shadowY = py + Math.sin(moonAngle) * body.r * 0.2;
            const shadowAlpha = 0.2 * (1 - Math.max(0, Math.sin(moonAngle)) / 0.2);
            ctx.fillStyle = hexToRgba('#000000', Math.min(0.2, shadowAlpha));
            ctx.beginPath();
            ctx.arc(shadowX, shadowY, body.r * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        drawPlanetBase(ctx, px, py, body.r, body.color, '#1d1a21');
      }
      if ('rings' in body && body.rings) {
        ctx.strokeStyle = hexToRgba('#fff0c4', 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(px, py, body.r * 1.7, body.r * 0.62, -0.24, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  drawMilestoneFlash(ctx, cx, cy, progress, stage.accent);
}

function drawSolarDust({ ctx, cluster, stage, now }: DrawClusterArgs, alpha = 0.68): void {
  const t = now / 1000;
  cluster.motes.forEach((mote, index) => {
    const shimmer = 0.54 + Math.sin(t * 2 + index) * 0.18;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * shimmer, mote.color, alpha * shimmer, mote.orbitAngle ?? 0);
  });
}

function drawSolarSun(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  cx: number,
  cy: number,
  radius: number,
  flare = 1,
  now = 0,
  sunLevel = 0,
): void {
  const t = now / 1000;
  const maturity = Math.min(1, sunLevel / 20);

  // Corona glow — grows with maturity
  const coronaR = radius * (2.2 + maturity * 1.2) * flare;
  ctx.fillStyle = hexToRgba(stage.accent, 0.08 + maturity * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
  ctx.fill();

  // Inner glow
  const glowR = radius * (1.6 + maturity * 0.5);
  ctx.fillStyle = hexToRgba(stage.coreColor, 0.2 + maturity * 0.15);
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Sun body — brighter with maturity
  const bodyColor = maturity < 0.3 ? '#c4885a' : maturity < 0.7 ? '#f0b858' : '#ffe39b';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Highlight spot
  ctx.fillStyle = hexToRgba('#fffff0', 0.25 + maturity * 0.2);
  ctx.beginPath();
  ctx.arc(cx - radius * 0.28, cy - radius * 0.28, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Surface convection cells — appear after level 2
  if (sunLevel >= 2) {
    const cellCount = 5 + sunLevel;
    for (let i = 0; i < cellCount; i++) {
      const angle = (i / cellCount) * Math.PI * 2 + t * 0.15;
      const dist = radius * (0.3 + (i % 3) * 0.18);
      const cellX = cx + Math.cos(angle) * dist;
      const cellY = cy + Math.sin(angle) * dist;
      const cellR = 1.5 + (i % 3);
      const pulse = 0.6 + Math.sin(t * 2.5 + i * 1.7) * 0.3;
      ctx.fillStyle = hexToRgba('#fff8e0', 0.18 * pulse);
      ctx.beginPath();
      ctx.arc(cellX, cellY, cellR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Solar flares — appear after level 3
  if (sunLevel >= 3) {
    for (let f = 0; f < 3; f++) {
      const flareAngle = t * 0.3 + f * 2.1;
      const flareLen = radius * (0.6 + Math.sin(t * 1.8 + f * 3.1) * 0.35);
      const fx = cx + Math.cos(flareAngle) * radius;
      const fy = cy + Math.sin(flareAngle) * radius;
      const ex = cx + Math.cos(flareAngle) * (radius + flareLen);
      const ey = cy + Math.sin(flareAngle) * (radius + flareLen);
      ctx.strokeStyle = hexToRgba('#ffcc44', 0.25 + Math.sin(t * 3 + f) * 0.1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      const cpx = (fx + ex) / 2 + Math.sin(t * 2 + f) * 8;
      const cpy = (fy + ey) / 2 + Math.cos(t * 2.3 + f) * 8;
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.stroke();
    }
  }
}

const SOLAR_BODIES = [
  { name: 'Mercury', orbit: 54, r: 4.5, color: '#b7a28a', showAt: 0.28 },
  { name: 'Venus', orbit: 76, r: 7.0, color: '#e7bb79', showAt: 0.36 },
  { name: 'Earth', orbit: 100, r: 7.8, color: '#5aa7ff', showAt: 0.44 },
  { name: 'Mars', orbit: 124, r: 6.0, color: '#cf7655', showAt: 0.52 },
  { name: 'Jupiter', orbit: 162, r: 14.0, color: '#d7a77e', showAt: 0.6 },
  { name: 'Saturn', orbit: 196, r: 12.0, color: '#ead09a', showAt: 0.68, rings: true },
  { name: 'Uranus', orbit: 226, r: 9.0, color: '#a9efe9', showAt: 0.76 },
  { name: 'Neptune', orbit: 254, r: 8.5, color: '#5b86ff', showAt: 0.84 },
  { name: 'Pluto', orbit: 282, r: 3.5, color: '#d8d2c6', showAt: 0.92 },
];


function drawSolarEarth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mode: 'plain' | 'bombarded' | 'water' | 'city',
  t: number,
): void {
  if (mode === 'water' || mode === 'city') {
    drawWaterPlanet(ctx, x, y, r, 1);
  } else if (mode === 'bombarded') {
    drawLavaPlanet(ctx, x, y, r, 0.72);
  } else {
    drawPlanetBase(ctx, x, y, r, '#77b7ff', '#153d7d');
  }
  if (mode === 'city') {
    drawCityPlanet(ctx, x, y, r, 1, t);
  }
}



// NOTE: Stage 11's Earth/Moon/biosphere is drawn entirely from purchased
// entities in drawEntities.ts (`drawLifeEarthEntities`). The cluster pass
// for `lifeSurface` only emits the milestone flash. The earlier
// progression-driven Pangaea/drift/civilisation rendering has been removed.
function drawLifeSurface({ ctx, cx, cy, stage, progress }: DrawClusterArgs): void {
  drawMilestoneFlash(ctx, cx, cy, progress, stage.accent);
}

/* removed: legacy progression-driven Earth renderer.
   Stage 11 now draws everything from purchased entities in drawEntities.ts.
function _unusedLifeSurfaceLegacy({ ctx, cluster, stage, cx, cy, progress, now }: DrawClusterArgs): void {
  // V9 continent layout used by the removed renderer. Kept inside the dead
  // function so it tree-shakes alongside the rest of this block.
  const CONTINENTS = [
    { p: [0.05, -0.04], m: [0.28, -0.20], w: 0.50, h: 0.25, a: 0.15 },
    { p: [0.07, 0.15], m: [0.24, 0.24], w: 0.18, h: 0.35, a: 0.06 },
    { p: [-0.04, -0.06], m: [-0.38, -0.14], w: 0.30, h: 0.27, a: -0.18 },
    { p: [0.02, 0.17], m: [-0.26, 0.30], w: 0.16, h: 0.32, a: 0.08 },
    { p: [0.06, 0.28], m: [0.46, 0.36], w: 0.18, h: 0.12, a: -0.08 },
    { p: [0.00, 0.52], m: [0.00, 0.57], w: 0.44, h: 0.11, a: 0.00 },
  ] as const;
  const radius = TUNING.LIFE_SURFACE_R;
  const t = now / 1000;

  // ── Phase 1: Molten (0–10%) ─────────────────────────────────────────────
  if (progress < 0.10) {
    drawLavaPlanet(ctx, cx, cy, radius, 0.7 + rangeT(progress, 0, 0.10) * 0.3);
    for (let i = 0; i < 5; i += 1) {
      const a = t * 0.8 + i * 1.26;
      ctx.fillStyle = hexToRgba('#ffcc44', 0.5);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (radius + 8 + i * 4), cy + Math.sin(a) * (radius + 5 + i * 3), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawMilestoneFlash(ctx, cx, cy, progress, stage.accent);
    return;
  }

  // ── Phase 2: Steam/Cooling (10–20%) ────────────────────────────────────
  if (progress < 0.20) {
    const steamT = rangeT(progress, 0.10, 0.20);
    drawLavaPlanet(ctx, cx, cy, radius, 0.7 - steamT * 0.55);
    ctx.fillStyle = hexToRgba('#b8c8d8', 0.42 * steamT);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    drawMilestoneFlash(ctx, cx, cy, progress, stage.accent);
    return;
  }

  // ── Phase 3–8: Realistic Earth (20–100%) ───────────────────────────────
  // Sub-progress values
  const driftT = easeIO(rangeT(progress, 0.20, 0.75));   // Pangaea → modern continents
  const vegT   = easeIO(rangeT(progress, 0.45, 0.72));   // vegetation spread
  const civT   = easeIO(rangeT(progress, 0.72, 0.82));   // civilisation / city lights
  const iceT   = easeIO(rangeT(progress, 0.22, 0.45));   // ice caps appear

  // ── Sphere clip ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // Ocean base ─────────────────────────────────────────────────────────────
  const oceanGrad = ctx.createRadialGradient(cx - radius * 0.28, cy - radius * 0.28, 1, cx, cy, radius * 1.08);
  oceanGrad.addColorStop(0, '#2086c2');
  oceanGrad.addColorStop(0.5, '#0d5a8a');
  oceanGrad.addColorStop(1, '#072c4a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Continents with Pangaea → drift ─────────────────────────────────────────
  CONTINENTS.forEach((c, i) => {
    const dx = c.p[0] + (c.m[0] - c.p[0]) * driftT;
    const dy = c.p[1] + (c.m[1] - c.p[1]) * driftT;
    const x = cx + dx * radius;
    const y = cy + dy * radius;
    const w = c.w * radius;
    const h = c.h * radius;

    // Base rock — warm brown for Pangaea, cooler as they drift
    const baseHeat = 1 - driftT * 0.55;
    ctx.fillStyle = `rgb(${Math.round(125 + baseHeat * 30)},${Math.round(80 + baseHeat * 12)},${Math.round(48 + baseHeat * 4)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, c.a, 0, Math.PI * 2);
    ctx.fill();

    // Interior shadow variation
    ctx.fillStyle = hexToRgba('#4a2e14', 0.28);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.12, y + h * 0.08, w * 0.52, h * 0.55, c.a + 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Desert/arid band (after drift stabilises)
    if (driftT > 0.45 && i < 2) {
      ctx.fillStyle = hexToRgba('#c4975a', 0.38);
      ctx.beginPath();
      ctx.ellipse(x - w * 0.04, y + h * 0.06, w * 0.3, h * 0.22, c.a + 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vegetation — does not appear on Antarctica (i=5)
    if (vegT > 0 && i < 5) {
      const vegBias = [0.62, 0.42, 0.72, 0.82, 0.22][i] ?? 0.5;
      ctx.fillStyle = hexToRgba('#2d7030', vegT * vegBias * 0.68);
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.74, h * 0.68, c.a, 0, Math.PI * 2);
      ctx.fill();
      // Tropical forest pocket (denser green near equator)
      if (vegT > 0.45 && i < 4) {
        ctx.fillStyle = hexToRgba('#1d5522', vegT * 0.38);
        ctx.beginPath();
        ctx.ellipse(x - w * 0.14, y + h * 0.14, w * 0.24, h * 0.18, c.a - 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // Ice caps ────────────────────────────────────────────────────────────────
  if (iceT > 0.05) {
    ctx.fillStyle = hexToRgba('#d8eeff', 0.9 * iceT);
    ctx.beginPath();
    ctx.ellipse(cx, cy - radius * 0.82, radius * 0.30 * iceT, radius * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba('#eaf5ff', 0.92 * iceT);
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.84, radius * 0.36 * iceT, radius * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cloud layer (slowly counter-rotating, always present from 20%+) ─────────
  const cloudRot = now / 15000;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cloudRot);
  ctx.fillStyle = hexToRgba('#ffffff', 0.24);
  ctx.beginPath();
  ctx.ellipse(-radius * 0.04, -radius * 0.30, radius * 0.50, radius * 0.082, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(radius * 0.26, radius * 0.09, radius * 0.36, radius * 0.068, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba('#ffffff', 0.17);
  ctx.beginPath();
  ctx.ellipse(-radius * 0.22, radius * 0.24, radius * 0.28, radius * 0.062, 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(radius * 0.05, -radius * 0.64, radius * 0.40, radius * 0.095, 0.0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Civilisation — night-side terminator + city lights ──────────────────────
  if (civT > 0) {
    const nightGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius * 0.18, cy);
    nightGrad.addColorStop(0, hexToRgba('#000000', 0.62));
    nightGrad.addColorStop(0.58, hexToRgba('#000000', 0.26));
    nightGrad.addColorStop(1, hexToRgba('#000000', 0));
    ctx.fillStyle = nightGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const cities = [
      { x: -0.38, y: -0.18 }, { x: -0.46, y: 0.08 }, { x: -0.26, y: 0.28 },
      { x: -0.14, y: -0.29 }, { x: -0.52, y: -0.05 }, { x: -0.22, y: 0.11 },
      { x: -0.34, y: 0.01 }, { x: -0.42, y: 0.24 },
    ];
    cities.forEach(({ x, y }) => {
      const pulse = 0.82 + Math.sin(now / 1500 + x * 9) * 0.18;
      ctx.fillStyle = hexToRgba('#ffeaa0', 0.70 * civT * pulse);
      ctx.beginPath();
      ctx.arc(cx + x * radius, cy + y * radius, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexToRgba('#ffd060', 0.18 * civT);
      ctx.beginPath();
      ctx.arc(cx + x * radius, cy + y * radius, 3.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore(); // end sphere clip ────────────────────────────────────────────

  // Limb darkening (3-D sphere depth)
  const limb = ctx.createRadialGradient(cx, cy, radius * 0.54, cx, cy, radius);
  limb.addColorStop(0, hexToRgba('#000000', 0));
  limb.addColorStop(0.70, hexToRgba('#000000', 0));
  limb.addColorStop(1, hexToRgba('#000000', 0.65));
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Atmosphere glow (blue rim)
  const atm = ctx.createRadialGradient(cx, cy, radius * 0.84, cx, cy, radius * 1.20);
  atm.addColorStop(0, hexToRgba('#4dc8ff', 0));
  atm.addColorStop(0.42, hexToRgba('#3aaff0', 0.16));
  atm.addColorStop(1, hexToRgba('#2288cc', 0));
  ctx.fillStyle = atm;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.20, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight (top-left)
  ctx.fillStyle = hexToRgba('#ffffff', 0.08);
  ctx.beginPath();
  ctx.ellipse(cx - radius * 0.30, cy - radius * 0.32, radius * 0.30, radius * 0.17, -0.55, 0, Math.PI * 2);
  ctx.fill();

  // Surface motes (small — gameplay feedback only)
  const rotation = cluster.earthRotation ?? 0;
  const visible: Array<{ mote: Mote; x: number; y: number; z: number }> = [];
  cluster.motes.forEach((mote) => {
    const lat = mote.surfaceLat ?? 0;
    const lon = (mote.surfaceLon ?? 0) + rotation;
    const sx = Math.cos(lat) * Math.sin(lon);
    const sz = Math.cos(lat) * Math.cos(lon);
    const sy = Math.sin(lat);
    if (sz < -0.04) return;
    visible.push({ mote, x: cx + sx * radius, y: cy + sy * radius, z: sz });
  });
  visible.sort((a, b) => a.z - b.z);
  visible.forEach(({ mote, x, y, z }) => {
    const ageProgress = Math.min(1, mote.age / TUNING.LIFE_FEATURE_GROW_MS);
    const size = (mote.r * 0.38 + 0.7) * ageProgress * (0.6 + z * 0.4);
    const color = mote.surfaceKind === 'city' ? '#ffeeaa' : mote.surfaceKind === 'water' ? '#9de8ff' : '#65e88f';
    ctx.fillStyle = hexToRgba(color, 0.55 * ageProgress * (0.5 + z * 0.5));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Space Age: satellites (82–90%)
  // Megastructures (90–97%)
  drawMilestoneFlash(ctx, cx, cy, progress, stage.accent);
}
*/

function drawRedGiantBloom(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, now } = args;
  const progress = Math.max(args.progress, linkedEntityRatio(args, 'Red Giant Envelope') * 0.88);
  // V9: gradual red giant expansion with per-planet consumption
  const giantPhase = easeIO(rangeT(progress, 0.10, 0.88));
  const giantR = 30 + giantPhase * 130;
  const pulse = Math.sin(now / 420) * 3;

  // Envelope ejection shell (88–96%)
  const ejectT = rangeT(progress, 0.88, 0.96);
  if (ejectT > 0) {
    const shellR = 30 + ejectT * 200;
    ctx.strokeStyle = hexToRgba('#ff9966', 0.38 * (1 - ejectT));
    ctx.lineWidth = 4 + ejectT * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, shellR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba('#ffddaa', 0.18 * (1 - ejectT));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, shellR * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    // Planetary nebula glow
    const nebulaGlow = ctx.createRadialGradient(cx, cy, shellR * 0.6, cx, cy, shellR * 1.3);
    nebulaGlow.addColorStop(0, hexToRgba('#ff7733', 0.08 * (1 - ejectT)));
    nebulaGlow.addColorStop(1, hexToRgba('#aa2200', 0));
    ctx.fillStyle = nebulaGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, shellR * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // White dwarf remnant (96–100%)
  const wdT = rangeT(progress, 0.96, 1.0);
  if (wdT > 0) {
    const wdR = Math.max(6, giantR * (1 - wdT));
    const wd = ctx.createRadialGradient(cx, cy, 0, cx, cy, wdR * 3.5);
    wd.addColorStop(0, hexToRgba('#ffffff', 0.95));
    wd.addColorStop(0.25, hexToRgba('#aaccff', 0.5 * wdT));
    wd.addColorStop(1, hexToRgba('#2244aa', 0));
    ctx.fillStyle = wd;
    ctx.beginPath();
    ctx.arc(cx, cy, wdR * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, wdR * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  // Main star body (fades out after envelope ejection)
  if (progress < 0.96) {
    const starAlpha = 1 - ejectT;
    const outerColor = progress < 0.20 ? '#aa5500' : '#4d0c04';
    const star = ctx.createRadialGradient(cx - giantR * 0.28, cy - giantR * 0.28, 2, cx, cy, giantR + pulse);
    star.addColorStop(0, hexToRgba('#fff0c7', 0.94 * starAlpha));
    star.addColorStop(0.4, hexToRgba(stage.coreColor, 0.90 * starAlpha));
    star.addColorStop(1, hexToRgba(outerColor, 0.78 * starAlpha));
    ctx.fillStyle = star;
    ctx.beginPath();
    ctx.arc(cx, cy, giantR + pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Planets survive until consumed
  const planets = [
    { orbit: 56, consumeAt: 0.20, color: '#b29a7d', r: 3.5 },
    { orbit: 78, consumeAt: 0.32, color: '#e0b882', r: 4.8 },
    { orbit: 102, consumeAt: 0.44, color: '#5ea4ff', r: 5.8 },
    { orbit: 126, consumeAt: 0.56, color: '#c96f4c', r: 4.4 },
    { orbit: 168, consumeAt: 0.66, color: '#d9b08b', r: 9.0 },
    { orbit: 212, consumeAt: 0.78, color: '#ecd8a4', r: 7.8 },
    { orbit: 248, consumeAt: 0.87, color: '#b8f1ea', r: 5.8 },
    { orbit: 286, consumeAt: 0.95, color: '#5f8eff', r: 5.5 },
    { orbit: 322, consumeAt: 0.98, color: '#d2d0c8', r: 2.4 },
  ];

  planets.forEach((planet, index) => {
    if (progress >= planet.consumeAt) return;
    const angle = now / 2400 + index * 0.72;
    const x = cx + Math.cos(angle) * planet.orbit;
    const y = cy + Math.sin(angle) * planet.orbit * 0.35;
    // Orbit line fades as giant grows
    const orbitAlpha = Math.max(0, 0.10 - giantPhase * 0.09);
    ctx.strokeStyle = hexToRgba(planet.color, orbitAlpha);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, planet.orbit, planet.orbit * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Planet heats as giant nears (redden near consumeAt)
    const heatT = rangeT(progress, planet.consumeAt - 0.08, planet.consumeAt);
    const drawColor = heatT > 0 ? '#ff6633' : planet.color;
    ctx.fillStyle = hexToRgba(drawColor, 1 - heatT * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, planet.r, 0, Math.PI * 2);
    ctx.fill();
  });

  cluster.motes.forEach((mote) => {
    const alpha = mote.hue < 0.5 ? 0.45 : 0.28;
    drawStageSprite(ctx, stage.id, mote.x, mote.y, mote.r * 0.75, mote.color, alpha, mote.age / 1000);
  });

  drawMilestoneFlash(ctx, cx, cy, progress, '#ff7744');
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

function drawBlackHoleScene(args: DrawClusterArgs): void {
  const { ctx, cluster, stage, cx, cy, width, height, now, pointerPressure } = args;
  const evaporationLink = Math.min(
    1,
    linkedEntityRatio(args, 'Stellar BH Evaporation') * 0.62 +
      linkedEntityRatio(args, 'Supermassive Evaporation') * 0.27 +
      linkedEntityRatio(args, 'Final Evaporation Flash') * 0.11,
  );
  const progress = Math.max(args.progress, evaporationLink);
  const diskMass = cluster.motes.reduce((sum, mote) => sum + mote.mass, 0);
  const initialRadius = Math.min(width, height) * 0.3;
  const inner = initialRadius * Math.pow(1 - progress, 0.7) + 5 * Math.pow(progress, 1.5);
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

  ctx.strokeStyle = `rgba(255,244,218,${0.58 + 0.34 * Math.sin(now / 600)})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, inner * 1.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.scale(1, Math.cos(tilt));
  cluster.motes.forEach((mote) => {
    const angle = Math.atan2(mote.y - cy, mote.x - cx) + now * 0.00025 * (0.6 + mote.hue);
    const orbitR = inner * (1.18 + mote.hue * 0.18);
    const baseScreenX = cx + Math.cos(rotation * 0.18) * Math.cos(angle) * orbitR - Math.sin(rotation * 0.18) * Math.sin(angle) * orbitR * Math.cos(tilt);
    const baseScreenY = cy + Math.sin(rotation * 0.18) * Math.cos(angle) * orbitR + Math.cos(rotation * 0.18) * Math.sin(angle) * orbitR * Math.cos(tilt);
    const pushed = applyPointerVisualDisplacement(baseScreenX, baseScreenY, pointerPressure, 15);
    const dx = pushed.x - cx;
    const dy = pushed.y - cy;
    const rot = -rotation * 0.18;
    const lx = Math.cos(rot) * dx - Math.sin(rot) * dy;
    const ly = (Math.sin(rot) * dx + Math.cos(rot) * dy) / Math.max(0.2, Math.cos(tilt));
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

  if (progress > 0.99) {
    const flashProgress = (progress - 0.99) / 0.01;
    const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.45);
    flash.addColorStop(0, hexToRgba('#ffffff', 0.5 * flashProgress));
    flash.addColorStop(0.35, hexToRgba(stage.coreColor, 0.24 * flashProgress));
    flash.addColorStop(1, hexToRgba(stage.accent, 0));
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, width, height);
  }
}

function getBlackbodyColor(temperature: number): string {
  if (temperature < 2500) return '#781e00';
  if (temperature < 4000) return '#ff643c';
  if (temperature < 5800) return '#ffb464';
  if (temperature < 8000) return '#ffebc8';
  if (temperature < 12000) return '#dcf0ff';
  return '#aac8ff';
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

function drawHeatDeathCloud({ ctx, cluster, stage, cx, cy, progress, now }: DrawClusterArgs): void {
  ctx.strokeStyle = hexToRgba(stage.coreColor, 0.06);
  ctx.lineWidth = 0.8;
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, cluster.physicalRadius * (ring / 4) + Math.sin(now / 900 + ring) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // V9: memory echo silhouettes (72–88%) — poetic, not physical
  const echoT = rangeT(progress, 0.72, 0.88);
  if (echoT > 0 && echoT < 1) {
    const echoAlpha = Math.sin(echoT * Math.PI) * 0.10;
    // Galaxy echo
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42);
    ctx.strokeStyle = hexToRgba('#aaaacc', echoAlpha);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Earth silhouette drifting slowly
    const ex = cx + Math.sin(now / 3200) * 22;
    const ey = cy + Math.cos(now / 3200) * 14;
    ctx.strokeStyle = hexToRgba('#5588bb', echoAlpha * 1.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.stroke();
    // Orbital ring echo
    ctx.strokeStyle = hexToRgba('#886633', echoAlpha * 0.9);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 14, 5, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    // City lights hint
    for (let i = 0; i < 5; i += 1) {
      const la = i * 1.26 + now / 6000;
      ctx.fillStyle = hexToRgba('#ffeeaa', echoAlpha * 0.6);
      ctx.beginPath();
      ctx.arc(ex + Math.cos(la) * 5, ey + Math.sin(la) * 3, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
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
