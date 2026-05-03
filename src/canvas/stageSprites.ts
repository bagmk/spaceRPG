import { hexToRgba } from '../game/formulas';
import type { RogueTypeKey, Stage } from '../game/types';

const ROGUE_NAMES: Record<number, Record<RogueTypeKey, string>> = {
  1: { minor: 'Free Quark', major: 'Gluon Knot', massive: 'Plasma Bulge' },
  2: { minor: 'Deuterium Spark', major: 'Helium Seed', massive: 'Fusion Cluster' },
  3: { minor: 'Loose Electron', major: 'Ionized Atom', massive: 'Photon Shell' },
  4: { minor: 'Protostar', major: 'White Hot Star', massive: 'Population III Giant' },
  5: { minor: 'Star Stream', major: 'Spiral Core', massive: 'Quasar Heart' },
  6: { minor: 'Planetesimal', major: 'Young World', massive: 'Accretion Giant' },
  7: { minor: 'Living Cell', major: 'Blue World', massive: 'Civilization Ark' },
  8: { minor: 'Ash Moon', major: 'Red Giant Flare', massive: 'Scorched World' },
  9: { minor: 'Cold Ember', major: 'White Dwarf', massive: 'Iron Remnant' },
  10: { minor: 'Decay Spark', major: 'Crystal Relic', massive: 'Degenerate Core' },
  11: { minor: 'Hawking Spark', major: 'Accretion Ring', massive: 'Rogue Singularity' },
  12: { minor: 'Vacuum Ripple', major: 'Thermal Ghost', massive: 'Boltzmann Flicker' },
};

export function getStageRogueName(stageId: number, typeKey: RogueTypeKey): string {
  return ROGUE_NAMES[stageId]?.[typeKey] ?? 'Rogue Object';
}

export function getStageRogueColor(stage: Stage, typeKey: RogueTypeKey): string {
  if (typeKey === 'minor') {
    return stage.particleColors[1] ?? stage.accent;
  }
  if (typeKey === 'major') {
    return stage.coreColor;
  }
  return stage.accent;
}

export function drawStageSprite(
  ctx: CanvasRenderingContext2D,
  stageId: number,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  phase: number,
): void {
  const r = Math.max(1.2, radius);
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(phase);
  ctx.globalAlpha *= safeAlpha;

  switch (stageId) {
    case 1:
      drawQuark(ctx, r, color);
      break;
    case 2:
      drawNucleus(ctx, r, color);
      break;
    case 3:
      drawAtom(ctx, r, color, phase);
      break;
    case 4:
      drawStar(ctx, r, color);
      break;
    case 5:
      drawGalaxy(ctx, r, color);
      break;
    case 6:
      drawSolarSystem(ctx, r, color, phase);
      break;
    case 7:
      drawLivingWorld(ctx, r, color);
      break;
    case 8:
      drawRedGiantEmber(ctx, r, color);
      break;
    case 9:
      drawRemnant(ctx, r, color);
      break;
    case 10:
      drawCrystal(ctx, r, color);
      break;
    case 11:
      drawBlackHole(ctx, r, color);
      break;
    case 12:
      drawFluctuation(ctx, r, color, phase);
      break;
    default:
      drawQuark(ctx, r, color);
  }

  ctx.restore();
}

export function drawStageCoreMotif(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  x: number,
  y: number,
  radius: number,
  progress: number,
  now: number,
): void {
  const p = clamp01(progress);
  const t = now / 1000;
  const r = Math.max(20, radius);

  ctx.save();
  ctx.translate(x, y);

  switch (stage.id) {
    case 1:
      drawCoreQuarkPlasma(ctx, stage, r, p, t);
      break;
    case 2:
      drawCoreNucleosynthesis(ctx, stage, r, p, t);
      break;
    case 3:
      drawCoreRecombination(ctx, stage, r, p, t);
      break;
    case 4:
      drawCoreFirstStars(ctx, stage, r, p, t);
      break;
    case 5:
      drawCoreGalaxy(ctx, stage, r, p, t);
      break;
    case 6:
      drawCoreSolarSystem(ctx, stage, r, p, t);
      break;
    case 7:
      drawCoreLife(ctx, stage, r, p, t);
      break;
    case 8:
      drawCoreDeathOfEarth(ctx, stage, r, p, t);
      break;
    case 9:
      drawCoreStelliferousEnd(ctx, stage, r, p, t);
      break;
    case 10:
      drawCoreDegenerateEra(ctx, stage, r, p, t);
      break;
    case 11:
      drawCoreBlackHoleEra(ctx, stage, r, p, t);
      break;
    case 12:
      drawCoreHeatDeath(ctx, stage, r, p, t);
      break;
    default:
      drawCoreQuarkPlasma(ctx, stage, r, p, t);
  }

  ctx.restore();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seededRange(seed: number, min: number, max: number): number {
  return min + seededUnit(seed) * (max - min);
}

function drawLocalGlow(
  ctx: CanvasRenderingContext2D,
  radius: number,
  innerColor: string,
  outerColor: string,
  alpha: number,
): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, hexToRgba(innerColor, alpha));
  gradient.addColorStop(0.45, hexToRgba(outerColor, alpha * 0.35));
  gradient.addColorStop(1, hexToRgba(outerColor, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  ctx.fillStyle = hexToRgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSoftNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  gradient.addColorStop(0, hexToRgba('#ffffff', alpha));
  gradient.addColorStop(0.35, hexToRgba(color, alpha * 0.8));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fill();
}

function strokeLocalEllipse(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rotation: number,
  color: string,
  alpha: number,
  lineWidth: number,
): void {
  ctx.save();
  ctx.rotate(rotation);
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawThread(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha: number,
  width: number,
): void {
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCoreQuarkPlasma(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (2.4 + p), stage.coreColor, stage.accent, 0.7);
  const count = 28;
  const collapse = easeOutCubic(p);
  const positions: Array<{ x: number; y: number; color: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const seed = i + stage.id * 31;
    const spin = seededRange(seed, -1.8, 1.8);
    const angle = seededUnit(seed + 1) * Math.PI * 2 + t * spin;
    const band = 0.45 + seededUnit(seed + 2) * 1.25;
    const turbulence = Math.sin(t * seededRange(seed + 3, 2.8, 6.4) + seed) * r * 0.12;
    const dist = r * band * (1.55 - collapse * 0.78) + turbulence;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle * 1.17) * dist * 0.82;
    const color = stage.particleColors[i % stage.particleColors.length] ?? stage.accent;
    positions.push({ x, y, color });
  }

  if (p > 0.18) {
    for (let i = 0; i < positions.length; i += 3) {
      const first = positions[i];
      const second = positions[(i + 1) % positions.length];
      const third = positions[(i + 2) % positions.length];
      drawThread(ctx, first.x, first.y, second.x, second.y, stage.coreColor, 0.08 + p * 0.18, 1 + p);
      drawThread(ctx, second.x, second.y, third.x, third.y, stage.coreColor, 0.08 + p * 0.18, 1 + p);
      drawThread(ctx, third.x, third.y, first.x, first.y, stage.accent, 0.06 + p * 0.13, 0.8 + p);
    }
  }

  positions.forEach((node, index) => {
    const pulse = 0.8 + Math.sin(t * 6 + index) * 0.2;
    drawSoftNode(ctx, node.x, node.y, Math.max(2, r * 0.035 * pulse), node.color, 0.8);
    drawLightNode(ctx, node.x, node.y, Math.max(1.8, r * 0.024 * pulse), '#ffffff', 0.72);
  });
}

function drawCoreNucleosynthesis(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (2.2 + p * 0.6), stage.coreColor, stage.accent, 0.55);
  const count = 8 + Math.floor(p * 14);
  const positions: Array<{ x: number; y: number; color: string; rr: number }> = [];

  for (let i = 0; i < count; i += 1) {
    const shell = Math.floor(Math.sqrt(i));
    const angle = i * 2.399963 + t * 0.18 * (shell % 2 === 0 ? 1 : -1);
    const target = r * (0.16 + shell * 0.18);
    const start = r * (1.65 + seededUnit(i + 40) * 0.65);
    const dist = start * (1 - easeOutCubic(p)) + target * easeOutCubic(p);
    const jitter = Math.sin(t * 7 + i) * r * 0.025;
    const x = Math.cos(angle) * (dist + jitter);
    const y = Math.sin(angle) * (dist + jitter) * 0.88;
    positions.push({
      x,
      y,
      color: i % 2 === 0 ? stage.coreColor : '#fff3cc',
      rr: r * seededRange(i + 70, 0.075, 0.11),
    });
  }

  for (let i = 1; i < positions.length; i += 1) {
    const a = positions[i - 1];
    const b = positions[i];
    if (Math.hypot(a.x - b.x, a.y - b.y) < r * 0.55) {
      drawThread(ctx, a.x, a.y, b.x, b.y, stage.accent, 0.12 + p * 0.2, 1.2 + p);
    }
  }

  positions.forEach((node) => {
    drawSoftNode(ctx, node.x, node.y, node.rr, node.color, 0.72);
    drawLightNode(ctx, node.x, node.y, node.rr * 0.72, node.color, 0.95);
  });
}

function drawCoreRecombination(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (2 + p * 0.5), stage.coreColor, stage.accent, 0.45);

  for (let ray = 0; ray < 18; ray += 1) {
    const angle = ray * (Math.PI * 2 / 18) + t * 0.05;
    const length = r * (1.2 + p * 1.9 + seededUnit(ray + 10) * 0.6);
    ctx.strokeStyle = hexToRgba(stage.coreColor, 0.08 + p * 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.stroke();
  }

  for (let orbit = 0; orbit < 3; orbit += 1) {
    const alpha = 0.18 + p * 0.28;
    strokeLocalEllipse(
      ctx,
      r * (0.9 + orbit * 0.42),
      r * (0.35 + orbit * 0.16),
      orbit * Math.PI / 3 + t * 0.08,
      stage.accent,
      alpha,
      1 + p,
    );
    const electronAngle = t * (1.2 + orbit * 0.35) + orbit * Math.PI * 0.75;
    const capture = easeInOut(p);
    const ex = Math.cos(electronAngle) * r * (1.55 - capture * 0.26 + orbit * 0.15);
    const ey = Math.sin(electronAngle) * r * (0.58 - capture * 0.08 + orbit * 0.05);
    drawSoftNode(ctx, ex, ey, r * 0.045, stage.coreColor, 0.75);
  }

  drawSoftNode(ctx, 0, 0, r * (0.2 + p * 0.05), '#ffffff', 0.9);
  drawLightNode(ctx, 0, 0, r * (0.12 + p * 0.03), stage.coreColor, 0.9);
}

function drawCoreFirstStars(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  const collapse = easeOutCubic(p);
  drawLocalGlow(ctx, r * (2.5 + p * 1.2), stage.coreColor, stage.accent, 0.42 + p * 0.22);

  for (let i = 0; i < 70; i += 1) {
    const seed = i + 140;
    const angle = seededUnit(seed) * Math.PI * 2 + t * seededRange(seed + 1, -0.22, 0.22);
    const start = r * seededRange(seed + 2, 1.15, 2.9);
    const end = r * seededRange(seed + 3, 0.15, 0.9);
    const dist = start * (1 - collapse) + end * collapse;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist * 0.78;
    drawLightNode(ctx, x, y, seededRange(seed + 4, 0.7, 1.8), stage.particleColors[i % 3], 0.18 + p * 0.36);
  }

  for (let ray = 0; ray < 12; ray += 1) {
    const angle = ray * (Math.PI * 2 / 12) + Math.sin(t * 0.7) * 0.03;
    const length = r * (0.7 + p * 1.5) * (ray % 2 === 0 ? 1 : 0.72);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.1 + p * 0.24);
    ctx.lineWidth = 1.2 + p * 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r * 0.25, Math.sin(angle) * r * 0.25);
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.stroke();
  }

  drawSoftNode(ctx, 0, 0, r * (0.22 + p * 0.22), stage.coreColor, 0.95);
  drawLightNode(ctx, 0, 0, r * (0.1 + p * 0.1), '#ffffff', 0.9);
}

function drawCoreGalaxy(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  const rotation = t * 0.12;
  const starCount = 70 + Math.floor(p * 80);
  drawLocalGlow(ctx, r * (2.4 + p * 1.4), stage.coreColor, stage.accent, 0.38 + p * 0.18);

  ctx.save();
  ctx.rotate(rotation);
  ctx.scale(1, 0.58);

  for (let arm = 0; arm < 3; arm += 1) {
    ctx.strokeStyle = hexToRgba(stage.accent, 0.08 + p * 0.1);
    ctx.lineWidth = 1.4 + p * 1.2;
    ctx.beginPath();
    for (let step = 0; step < 52; step += 1) {
      const u = step / 51;
      const dist = r * (0.2 + u * (1.2 + p * 1.45));
      const angle = arm * Math.PI * 2 / 3 + u * Math.PI * (1.15 + p * 1.15);
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

  for (let i = 0; i < starCount; i += 1) {
    const seed = i + 500;
    const arm = i % 3;
    const u = Math.pow((i + 0.5) / starCount, 0.72);
    const spread = seededRange(seed + 1, -0.32, 0.32) * (1 - u * 0.25);
    const angle = arm * Math.PI * 2 / 3 + u * Math.PI * (1.5 + p * 1.45) + spread;
    const cloud = seededRange(seed + 2, -0.16, 0.16) * r;
    const dist = r * (0.18 + u * (1.35 + p * 1.6)) + cloud;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const color = i % 6 === 0 ? '#ffffff' : stage.particleColors[i % stage.particleColors.length];
    const alpha = 0.28 + p * 0.48 + (1 - u) * 0.18;
    drawLightNode(ctx, x, y, seededRange(seed + 3, 0.65, 2.05), color, Math.min(0.95, alpha));
  }

  ctx.restore();

  drawSoftNode(ctx, 0, 0, r * (0.18 + p * 0.12), stage.coreColor, 0.92);
  drawLightNode(ctx, 0, 0, r * (0.08 + p * 0.05), '#ffffff', 0.88);
}

function drawCoreSolarSystem(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  const diskAlpha = 0.15 + p * 0.2;
  ctx.save();
  ctx.rotate(-0.25);
  ctx.scale(1, 0.38);
  for (let ring = 0; ring < 5; ring += 1) {
    ctx.strokeStyle = hexToRgba(stage.accent, diskAlpha * (1 - ring * 0.12));
    ctx.lineWidth = 2.4 - ring * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.75 + ring * 0.38 + p * 0.34), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 36; i += 1) {
    const seed = i + 820;
    const angle = seededUnit(seed) * Math.PI * 2 + t * seededRange(seed + 1, 0.2, 0.65);
    const dist = r * seededRange(seed + 2, 0.8, 2.3);
    const settle = easeOutCubic(p);
    const yScale = 0.42 + settle * 0.1;
    drawLightNode(
      ctx,
      Math.cos(angle) * dist,
      Math.sin(angle) * dist * yScale,
      seededRange(seed + 3, 0.8, 2.2),
      stage.particleColors[i % stage.particleColors.length],
      0.22 + p * 0.32,
    );
  }

  drawSoftNode(ctx, 0, 0, r * (0.2 + p * 0.16), '#ffeecc', 0.94);
  for (let planet = 0; planet < 4; planet += 1) {
    const orbit = r * (0.85 + planet * 0.42 + p * 0.25);
    const angle = t * (0.33 + planet * 0.08) + planet * Math.PI * 0.65;
    const px = Math.cos(angle) * orbit;
    const py = Math.sin(angle) * orbit * 0.44;
    strokeLocalEllipse(ctx, orbit, orbit * 0.44, 0, stage.accent, 0.12 + p * 0.08, 0.8);
    drawSoftNode(ctx, px, py, r * (0.035 + planet * 0.008), stage.particleColors[planet % 3], 0.8);
  }
}

function drawCoreLife(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (1.8 + p * 0.8), stage.coreColor, stage.accent, 0.42);
  const planetR = r * (0.55 + p * 0.28);
  const ocean = ctx.createRadialGradient(-planetR * 0.3, -planetR * 0.35, planetR * 0.2, 0, 0, planetR * 1.1);
  ocean.addColorStop(0, hexToRgba('#bfffe8', 0.92));
  ocean.addColorStop(0.42, hexToRgba(stage.coreColor, 0.85));
  ocean.addColorStop(1, hexToRgba('#134b3a', 0.95));
  ctx.fillStyle = ocean;
  ctx.beginPath();
  ctx.arc(0, 0, planetR, 0, Math.PI * 2);
  ctx.fill();

  drawContinent(ctx, -planetR * 0.28, -planetR * 0.1, planetR * 0.34, planetR * 0.17, -0.35, p);
  drawContinent(ctx, planetR * 0.3, planetR * 0.2, planetR * 0.26, planetR * 0.14, 0.52, p);
  drawContinent(ctx, planetR * 0.08, -planetR * 0.36, planetR * 0.18, planetR * 0.09, 0.1, p * 0.7);

  const cityCount = 8 + Math.floor(p * 18);
  const nodes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < cityCount; i += 1) {
    const seed = i + 1200;
    const angle = seededUnit(seed) * Math.PI * 2;
    const dist = planetR * Math.sqrt(seededUnit(seed + 1)) * 0.78;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist * 0.72;
    nodes.push({ x, y });
  }

  for (let i = 1; i < nodes.length; i += 1) {
    if (i % 3 !== 0) {
      drawThread(ctx, nodes[i - 1].x, nodes[i - 1].y, nodes[i].x, nodes[i].y, '#ffffff', p * 0.18, 0.7);
    }
  }
  nodes.forEach((node, index) => {
    drawLightNode(ctx, node.x, node.y, seededRange(index + 30, 0.75, 1.6), '#eaffff', p * 0.55);
  });

  strokeLocalEllipse(ctx, planetR * 1.35, planetR * 0.55, t * 0.08, '#ffffff', 0.12 + p * 0.15, 1);
}

function drawCoreDeathOfEarth(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  const giantR = r * (0.58 + p * 0.9);
  drawLocalGlow(ctx, r * (2.3 + p * 1.9), '#ffaa66', stage.accent, 0.58);
  const gradient = ctx.createRadialGradient(-giantR * 0.25, -giantR * 0.28, giantR * 0.12, 0, 0, giantR);
  gradient.addColorStop(0, hexToRgba('#fff2cc', 0.95));
  gradient.addColorStop(0.42, hexToRgba(stage.coreColor, 0.9));
  gradient.addColorStop(1, hexToRgba('#5a1106', 0.92));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, giantR, 0, Math.PI * 2);
  ctx.fill();

  for (let flare = 0; flare < 14; flare += 1) {
    const angle = flare * (Math.PI * 2 / 14) + Math.sin(t * 1.1 + flare) * 0.07;
    const start = giantR * 0.82;
    const end = giantR * seededRange(flare + 60, 1.05, 1.32);
    ctx.strokeStyle = hexToRgba('#ffcc88', 0.16 + p * 0.22);
    ctx.lineWidth = 1.2 + p * 1.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
    ctx.quadraticCurveTo(
      Math.cos(angle + 0.25) * end,
      Math.sin(angle + 0.25) * end,
      Math.cos(angle + 0.42) * start,
      Math.sin(angle + 0.42) * start,
    );
    ctx.stroke();
  }

  const earthAngle = t * 0.18 + 1.2;
  const earthDist = r * (1.45 - p * 0.36);
  const ex = Math.cos(earthAngle) * earthDist;
  const ey = Math.sin(earthAngle) * earthDist * 0.52;
  drawSoftNode(ctx, ex, ey, r * 0.075, '#442019', 0.9);
  drawLightNode(ctx, ex, ey, r * 0.045, '#ff7744', 0.8);
}

function drawCoreStelliferousEnd(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (1.8 + p * 0.6), stage.coreColor, stage.accent, 0.28);
  for (let i = 0; i < 46; i += 1) {
    const seed = i + 1500;
    const angle = seededUnit(seed) * Math.PI * 2 + t * seededRange(seed + 1, -0.05, 0.05);
    const dist = r * seededRange(seed + 2, 0.45, 2.4) * (1.05 - p * 0.28);
    const alpha = (0.28 - p * 0.12) * seededRange(seed + 3, 0.45, 1);
    drawLightNode(
      ctx,
      Math.cos(angle) * dist,
      Math.sin(angle) * dist * 0.72,
      seededRange(seed + 4, 0.55, 1.6),
      i % 5 === 0 ? '#ddddee' : stage.accent,
      alpha,
    );
  }

  for (let remnant = 0; remnant < 5; remnant += 1) {
    const angle = remnant * Math.PI * 2 / 5 + t * 0.07;
    const dist = r * (0.35 + remnant * 0.14);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist * 0.6;
    drawSoftNode(ctx, x, y, r * (0.045 + remnant * 0.005), '#cfd2ff', 0.52 + p * 0.12);
  }
}

function drawCoreDegenerateEra(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (1.8 + p * 0.6), stage.coreColor, stage.accent, 0.34);
  const spacing = r * (0.28 - p * 0.045);
  const nodes: Array<{ x: number; y: number }> = [];

  for (let row = -4; row <= 4; row += 1) {
    for (let col = -4; col <= 4; col += 1) {
      const x = (col + (row % 2) * 0.5) * spacing;
      const y = row * spacing * 0.82;
      if (Math.hypot(x, y) < r * (1.12 + p * 0.25)) {
        nodes.push({ x, y });
      }
    }
  }

  nodes.forEach((node, index) => {
    if (index > 0) {
      const prev = nodes[index - 1];
      if (Math.hypot(node.x - prev.x, node.y - prev.y) < spacing * 1.35) {
        drawThread(ctx, prev.x, prev.y, node.x, node.y, stage.accent, 0.1 + p * 0.12, 0.8);
      }
    }
  });

  nodes.forEach((node, index) => {
    const pulse = 0.8 + Math.sin(t * 2.2 + index) * 0.2;
    drawLightNode(ctx, node.x, node.y, r * 0.025 * pulse, index % 2 === 0 ? stage.coreColor : '#ffffff', 0.55 + p * 0.25);
  });

  for (let spark = 0; spark < 8; spark += 1) {
    const angle = spark * Math.PI * 2 / 8 + t * 0.35;
    const dist = r * (0.9 + seededUnit(spark + 20) * 0.55);
    drawLightNode(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist, 1.2, '#e6ccff', 0.18 + Math.sin(t * 3 + spark) * 0.08);
  }
}

function drawCoreBlackHoleEra(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  const horizon = r * (0.38 + p * 0.22);
  drawLocalGlow(ctx, r * (2.2 + p), stage.coreColor, stage.accent, 0.28);

  ctx.save();
  ctx.rotate(t * 0.18);
  ctx.scale(1, 0.36);
  const disk = ctx.createLinearGradient(-r * 2.3, 0, r * 2.3, 0);
  disk.addColorStop(0, hexToRgba(stage.accent, 0));
  disk.addColorStop(0.25, hexToRgba(stage.coreColor, 0.48));
  disk.addColorStop(0.5, hexToRgba('#ffffff', 0.18));
  disk.addColorStop(0.75, hexToRgba(stage.accent, 0.5));
  disk.addColorStop(1, hexToRgba(stage.accent, 0));
  ctx.strokeStyle = disk;
  ctx.lineWidth = r * (0.16 + p * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.1 + p * 0.34), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, horizon * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#dacbff', 0.22 + p * 0.2);
  ctx.lineWidth = 1.2 + p;
  ctx.beginPath();
  ctx.arc(0, 0, horizon * 1.25, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 18; i += 1) {
    const angle = seededUnit(i + 2300) * Math.PI * 2 + t * seededRange(i + 2310, 0.12, 0.4);
    const dist = r * seededRange(i + 2320, 0.75, 1.75);
    drawLightNode(
      ctx,
      Math.cos(angle) * dist,
      Math.sin(angle) * dist * 0.8,
      seededRange(i + 2330, 0.55, 1.4),
      i % 3 === 0 ? '#ffffff' : stage.coreColor,
      0.22 + p * 0.3,
    );
  }
}

function drawCoreHeatDeath(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  r: number,
  p: number,
  t: number,
): void {
  drawLocalGlow(ctx, r * (1.6 + p * 0.5), stage.coreColor, stage.accent, 0.16 + p * 0.1);
  for (let wave = 1; wave <= 5; wave += 1) {
    const breathing = Math.sin(t * 0.9 + wave) * r * 0.04;
    strokeLocalEllipse(
      ctx,
      r * (0.34 + wave * 0.26) + breathing,
      r * (0.34 + wave * 0.26) + breathing,
      0,
      wave % 2 === 0 ? stage.coreColor : stage.accent,
      0.05 + p * 0.06,
      0.8,
    );
  }

  for (let i = 0; i < 28; i += 1) {
    const seed = i + 2600;
    const angle = seededUnit(seed) * Math.PI * 2;
    const dist = r * seededRange(seed + 1, 0.15, 1.7);
    const flicker = 0.14 + Math.max(0, Math.sin(t * seededRange(seed + 2, 1.4, 5.5) + seed)) * 0.32;
    drawLightNode(
      ctx,
      Math.cos(angle) * dist,
      Math.sin(angle) * dist,
      seededRange(seed + 3, 0.45, 1.3),
      i % 7 === 0 ? '#ffffff' : stage.coreColor,
      flicker * (0.5 + p * 0.5),
    );
  }

  drawSoftNode(ctx, Math.sin(t * 1.7) * r * 0.08, Math.cos(t * 1.3) * r * 0.08, r * (0.035 + p * 0.035), '#ffffff', 0.42 + p * 0.22);
}

function drawContinent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = hexToRgba('#1d6a42', 0.35 + alpha * 0.45);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(rx * 0.45, -ry * 0.15, rx * 0.5, ry * 0.62, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQuark(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.95);
  ctx.shadowBlur = r * 2.5;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const a = i * (Math.PI * 2 / 3);
    const x = Math.cos(a) * r * 1.7;
    const y = Math.sin(a) * r * 1.7;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawNucleus(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const offsets = [[0, 0], [1, 0.2], [-0.65, 0.72], [-0.35, -0.85]];
  offsets.forEach(([ox, oy], index) => {
    ctx.fillStyle = hexToRgba(index % 2 === 0 ? color : '#ffffff', index % 2 === 0 ? 0.88 : 0.72);
    ctx.beginPath();
    ctx.arc(ox * r, oy * r, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAtom(ctx: CanvasRenderingContext2D, r: number, color: string, phase: number): void {
  ctx.strokeStyle = hexToRgba(color, 0.72);
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  for (let orbit = 0; orbit < 3; orbit += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * orbit);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.92);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.4, r * 0.65), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba(color, 0.95);
  for (let electron = 0; electron < 3; electron += 1) {
    const angle = phase * 2 + electron * ((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 2.6, Math.sin(angle) * r * 1.1, Math.max(1.2, r * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.95);
  ctx.shadowBlur = r * 3;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = (point / 10) * Math.PI * 2;
    const length = point % 2 === 0 ? r * 2.7 : r;
    const px = Math.cos(angle) * length;
    const py = Math.sin(angle) * length;
    if (point === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = hexToRgba('#ffffff', 0.85);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r * 0.75), 0, Math.PI * 2);
  ctx.fill();
}

function drawGalaxy(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.strokeStyle = hexToRgba(color, 0.85);
  ctx.lineWidth = Math.max(1, r * 0.18);
  for (let arm = 0; arm < 2; arm += 1) {
    ctx.beginPath();
    for (let i = 0; i < 28; i += 1) {
      const t = i / 27;
      const angle = arm * Math.PI + t * Math.PI * 1.9;
      const dist = r * 0.25 + t * r * 3;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist * 0.55;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.4, r * 0.72), 0, Math.PI * 2);
  ctx.fill();
}

function drawSolarSystem(ctx: CanvasRenderingContext2D, r: number, color: string, phase: number): void {
  ctx.strokeStyle = hexToRgba(color, 0.42);
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  for (let orbit = 1; orbit <= 2; orbit += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * orbit * 1.55, r * orbit * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffeecc', 0.95);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r * 0.75), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba(color, 0.9);
  for (let planet = 0; planet < 2; planet += 1) {
    const angle = phase * (planet + 1) + planet * Math.PI;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * (planet + 1) * 1.55, Math.sin(angle) * r * (planet + 1) * 0.78, Math.max(1.2, r * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLivingWorld(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.92);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba('#1b5a43', 0.86);
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.2, r * 0.48, r * 0.25, -0.4, 0, Math.PI * 2);
  ctx.ellipse(r * 0.35, r * 0.18, r * 0.38, r * 0.22, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffffff', 0.3);
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0.15, Math.PI * 1.2);
  ctx.stroke();
}

function drawRedGiantEmber(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 2);
  gradient.addColorStop(0, hexToRgba('#fff0cc', 0.95));
  gradient.addColorStop(0.42, hexToRgba(color, 0.92));
  gradient.addColorStop(1, hexToRgba('#441006', 0.8));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffaa66', 0.7);
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.1, 0.3, Math.PI * 1.6);
  ctx.stroke();
}

function drawRemnant(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.72);
  ctx.beginPath();
  ctx.moveTo(-r * 1.4, -r * 0.5);
  ctx.lineTo(r * 0.2, -r * 1.5);
  ctx.lineTo(r * 1.45, r * 0.2);
  ctx.lineTo(-r * 0.3, r * 1.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffffff', 0.34);
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.stroke();
}

function drawCrystal(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.74);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.8);
  ctx.lineTo(r * 1.25, 0);
  ctx.lineTo(0, r * 1.8);
  ctx.lineTo(-r * 1.25, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffffff', 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.8);
  ctx.lineTo(0, r * 1.8);
  ctx.stroke();
}

function drawBlackHole(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.save();
  ctx.scale(1, 0.42);
  ctx.strokeStyle = hexToRgba(color, 0.86);
  ctx.lineWidth = Math.max(1.4, r * 0.3);
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = hexToRgba('#000000', 0.96);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba('#ffffff', 0.2);
  ctx.stroke();
}

function drawFluctuation(ctx: CanvasRenderingContext2D, r: number, color: string, phase: number): void {
  ctx.strokeStyle = hexToRgba(color, 0.7);
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  for (let wave = 1; wave <= 3; wave += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, r * wave * 0.95 + Math.sin(phase + wave) * r * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.65);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, r * 0.45), 0, Math.PI * 2);
  ctx.fill();
}
