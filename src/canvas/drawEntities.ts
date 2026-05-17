import { hexToRgba } from '../game/formulas';
import { TUNING } from '../game/constants';
import type { EntityEffectType, EntityGlyph, EntityRarity, PurchasedEntityEntry, StageEntity } from '../game/entities/types';
import { findEntityById } from '../game/entities/stageItems';

const ICON_SIZE: Record<EntityRarity, number> = {
  common: 7,
  rare: 9,
  epic: 12,
  legendary: 17,
};

const GLOW_RADIUS: Record<EntityRarity, number> = {
  common: 9,
  rare: 13,
  epic: 18,
  legendary: 28,
};

const MAX_VISIBLE_PER_ENTITY = 10;
const MAX_TOTAL_ENTITY_DRAW = 32;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface EntityDrawItem {
  id: string;
  name: string;
  formula: string;
  color: string;
  glowColor: string;
  glyph: EntityGlyph;
  rarity: EntityRarity;
  effectType: EntityEffectType;
  ownedCount: number;
  maxCount: number;
  copyIndex: number;
  orderIndex: number;
  sourceIndex: number;
  seed: number;
}

interface ActiveEntity {
  entity: StageEntity;
  count: number;
  sourceIndex: number;
}

interface EntityPosition {
  item: EntityDrawItem;
  x: number;
  y: number;
  size: number;
  glowRadius: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function rarityRadiusOffset(rarity: EntityRarity): number {
  switch (rarity) {
    case 'legendary':
      return 44;
    case 'epic':
      return 25;
    case 'rare':
      return 12;
    case 'common':
    default:
      return 0;
  }
}

function raritySpeed(rarity: EntityRarity): number {
  switch (rarity) {
    case 'legendary':
      return 0.000055;
    case 'epic':
      return 0.00009;
    case 'rare':
      return 0.00013;
    case 'common':
    default:
      return 0.00018;
  }
}

function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRays(ctx: CanvasRenderingContext2D, size: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * size * 0.55, Math.sin(angle) * size * 0.55);
    ctx.lineTo(Math.cos(angle) * size * 1.15, Math.sin(angle) * size * 1.15);
    ctx.stroke();
  }
}

function itemText(item: Pick<EntityDrawItem, 'name' | 'formula' | 'glyph' | 'effectType'>): string {
  return `${item.name} ${item.formula} ${item.glyph} ${item.effectType}`.toLowerCase();
}

function textHas(text: string, ...needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function entityStrength(entity: StageEntity, count: number): number {
  const cap = entity.maxCount > 0 ? entity.maxCount : 10;
  return Math.min(1, Math.max(0.15, count / Math.max(1, cap)));
}

function drawMagneticLoops(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const wobble = Math.sin(now * 0.0009) * 0.12;
  const lines = 5 + Math.floor(strength * 7);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wobble);
  ctx.lineCap = 'round';
  for (let i = 0; i < lines; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const band = (i - (lines - 1) / 2) / Math.max(1, lines);
    const spread = radius * (0.38 + Math.abs(band) * 0.85);
    const yBend = band * radius * 0.28;
    const alpha = (0.035 + strength * 0.09) * (1 - Math.abs(band) * 0.45);
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 0.7 + strength * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.42);
    ctx.bezierCurveTo(side * spread, -radius * 0.56 + yBend, side * spread, radius * 0.56 + yBend, 0, radius * 0.42);
    ctx.stroke();

    const sparkT = (now * 0.00022 * (1 + strength) + i * 0.17) % 1;
    const py = -radius * 0.42 + sparkT * radius * 0.84;
    const px = side * Math.sin(sparkT * Math.PI) * spread;
    ctx.fillStyle = hexToRgba('#ffffff', 0.22 + strength * 0.25);
    fillCircle(ctx, px, py, 0.9 + strength * 1.1);
  }
  ctx.restore();
}

function drawBlackHoleLens(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now * 0.00008);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i += 1) {
    const phase = now * 0.001 + i * 1.4;
    const r = radius * (0.58 + i * 0.18 + Math.sin(phase) * 0.015);
    ctx.strokeStyle = hexToRgba(color, (0.035 + strength * 0.055) / (i * 0.45 + 1));
    ctx.lineWidth = 0.7 + strength * 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1.18 + Math.sin(phase) * 0.04), r * (0.42 + Math.cos(phase) * 0.02), Math.sin(phase) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#02030a', 0.08 + strength * 0.08);
  fillCircle(ctx, 0, 0, radius * (0.12 + strength * 0.06));
  ctx.restore();
}

function drawQuasarJets(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const angle = now * 0.00011 + strength * 0.7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  for (const dir of [-1, 1]) {
    const beam = ctx.createLinearGradient(0, 0, dir * radius, 0);
    beam.addColorStop(0, hexToRgba('#ffffff', 0.15 + strength * 0.2));
    beam.addColorStop(0.35, hexToRgba(color, 0.12 + strength * 0.16));
    beam.addColorStop(1, hexToRgba(color, 0));
    ctx.strokeStyle = beam;
    ctx.lineWidth = 2 + strength * 5;
    ctx.beginPath();
    ctx.moveTo(dir * radius * 0.12, 0);
    ctx.lineTo(dir * radius, Math.sin(now * 0.003) * radius * 0.03);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.45 + strength * 0.25);
  fillCircle(ctx, 0, 0, 2 + strength * 4);
  ctx.restore();
}

function drawIonizationBubbles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const count = 6 + Math.floor(strength * 10);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i += 1) {
    const phase = unit(i + 17, 2) * Math.PI * 2;
    const orbit = radius * (0.18 + unit(i + 3, 4) * 0.85);
    const x = cx + Math.cos(phase + now * 0.00007) * orbit;
    const y = cy + Math.sin(phase * 1.6 + now * 0.000085) * orbit * 0.78;
    const r = radius * (0.06 + unit(i + 9, 3) * 0.16) * (1 + Math.sin(now * 0.0014 + i) * 0.18);
    ctx.strokeStyle = hexToRgba(color, 0.035 + strength * 0.09);
    ctx.lineWidth = 0.7 + strength * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // inner glow for larger bubbles
    if (r > radius * 0.1) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 0.85);
      grad.addColorStop(0, hexToRgba(color, 0.012 + strength * 0.022));
      grad.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLivingNetwork(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const nodes = 5 + Math.floor(strength * 8);
  const points = Array.from({ length: nodes }, (_, i) => {
    const angle = (i / nodes) * Math.PI * 2 + now * 0.00008;
    const dist = radius * (0.28 + unit(i + 23, 5) * 0.72);
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle * 1.35) * dist * 0.72,
    };
  });

  ctx.strokeStyle = hexToRgba(color, 0.035 + strength * 0.075);
  ctx.lineWidth = 0.7 + strength * 0.8;
  for (let i = 1; i < points.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.quadraticCurveTo(cx, cy, points[i].x, points[i].y);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba(color, 0.12 + strength * 0.16);
  for (const point of points) {
    fillCircle(ctx, point.x, point.y, 1.1 + strength * 1.4);
  }
}

function drawWaterRipples(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  for (let i = 0; i < 4; i += 1) {
    const r = radius * (0.24 + i * 0.18 + ((now * 0.00008 + i * 0.17) % 0.16));
    ctx.strokeStyle = hexToRgba(color, (0.035 + strength * 0.06) / (i + 0.8));
    ctx.lineWidth = 0.8 + strength * 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.28, r * 0.46, Math.sin(now * 0.0003) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawWebField(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const count = 6 + Math.floor(strength * 7);
  const points = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.sin(now * 0.00018 + i) * 0.08;
    const r = radius * (0.35 + unit(i + 31, 8) * 0.8);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.76 };
  });

  ctx.strokeStyle = hexToRgba(color, 0.025 + strength * 0.055);
  ctx.lineWidth = 0.65 + strength * 0.55;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 2) % points.length];
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  }
}

function drawQuantumFoam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  const count = 20 + Math.floor(strength * 28);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Interference wave rings — whole canvas undulation
  const waveCount = 2 + Math.floor(strength * 4);
  for (let w = 0; w < waveCount; w++) {
    const waveSpeed = 0.00025 + w * 0.00015;
    const wavePhase = w * 1.8 + seed * 0.01;
    const ringCount = 5 + Math.floor(strength * 4);
    for (let r = 0; r < ringCount; r++) {
      const rr = radius * (0.1 + r * 0.1) + Math.sin(now * waveSpeed + wavePhase + r * 0.7) * radius * 0.04;
      ctx.strokeStyle = hexToRgba(color, (0.012 + strength * 0.022) * (1 - r / (ringCount + 2)));
      ctx.lineWidth = 0.5 + strength * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Foam particles
  for (let i = 0; i < count; i += 1) {
    const localSeed = seed + i * 13;
    const angle = unit(localSeed, 11) * Math.PI * 2 + Math.sin(now * 0.0008 + i) * 0.22;
    const dist = radius * (0.06 + unit(localSeed, 12) * 0.94);
    const flicker = (Math.sin(now * 0.004 + i * 1.7 + seed) + 1) / 2;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle * 1.3) * dist * 0.78;
    ctx.fillStyle = hexToRgba(i % 4 === 0 ? '#ffffff' : color, 0.03 + flicker * (0.07 + strength * 0.14));
    fillCircle(ctx, x, y, 0.5 + unit(localSeed, 13) * (1.2 + strength * 2.2));
    if (i % 3 === 0) {
      ctx.strokeStyle = hexToRgba(color, 0.015 + flicker * strength * 0.08);
      ctx.lineWidth = 0.5;
      strokeCircle(ctx, x, y, 3.5 + unit(localSeed, 14) * radius * 0.1);
    }
  }
  ctx.restore();
}

function drawVacuumBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Scattered expanding bubbles — count scales with strength
  const bubbleCount = 4 + Math.floor(strength * 16);
  for (let i = 0; i < bubbleCount; i += 1) {
    const bx = i < 4 ? cx : cx + (unit(seed + i, 201) - 0.5) * radius * 1.8;
    const by = i < 4 ? cy : cy + (unit(seed + i, 202) - 0.5) * radius * 1.4;
    const phase = (now * (0.00009 + unit(seed + i, 203) * 0.00006) + i * 0.31 + seed * 0.0003) % 1;
    const baseR = i < 4
      ? radius * (0.22 + i * 0.15)
      : radius * (0.08 + unit(seed + i, 204) * 0.28);
    const r = baseR + phase * baseR * 0.4;
    const alpha = (0.04 + strength * 0.07) / Math.max(1, i * 0.18 + 0.7) * (1 - phase * 0.6);
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 0.7 + strength * 0.7 * (1 - phase * 0.5);
    ctx.beginPath();
    ctx.ellipse(
      bx, by,
      r * (1.04 + Math.sin(now * 0.001 + i) * 0.06),
      r * (0.76 + Math.sin(now * 0.0007 + i * 0.9) * 0.05),
      Math.sin(now * 0.00035 + i * 0.7) * 0.4, 0, Math.PI * 2,
    );
    ctx.stroke();
  }
  // Wobbling outline
  ctx.strokeStyle = hexToRgba('#ffffff', 0.04 + strength * 0.07);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const a = t * Math.PI * 2 + now * 0.00018 + seed;
    const r = radius * (0.42 + Math.sin(i * 1.7 + now * 0.001) * 0.06 + strength * 0.08);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.72;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawColorCharge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const colorCharges = ['#ff5c55', '#57d77a', '#5aa7ff'];
  const spin = now * 0.0008;
  const points = colorCharges.map((chargeColor, i) => {
    const angle = spin + (i / 3) * Math.PI * 2;
    return {
      color: chargeColor,
      x: cx + Math.cos(angle) * radius * 0.28,
      y: cy + Math.sin(angle) * radius * 0.22,
    };
  });

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.9 + strength * 0.9;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    ctx.strokeStyle = hexToRgba(color, 0.08 + strength * 0.11);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.quadraticCurveTo(cx, cy, next.x, next.y);
    ctx.stroke();
  }
  for (const point of points) {
    ctx.fillStyle = hexToRgba(point.color, 0.35 + strength * 0.3);
    fillCircle(ctx, point.x, point.y, 1.4 + strength * 2.3);
  }
  ctx.restore();
}

function drawNuclearCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  const nucleons = 4 + Math.floor(strength * 6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexToRgba(color, 0.055 + strength * 0.075);
  ctx.lineWidth = 0.8 + strength * 0.7;
  strokeCircle(ctx, cx, cy, radius * (0.28 + Math.sin(now * 0.001 + seed) * 0.018));
  for (let i = 0; i < nucleons; i += 1) {
    const angle = (i / nucleons) * Math.PI * 2 + now * 0.00035 + seed;
    const dist = radius * (0.06 + unit(seed + i, 21) * 0.2);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle * 1.2) * dist;
    ctx.fillStyle = hexToRgba(i % 2 === 0 ? '#ffffff' : color, 0.18 + strength * 0.18);
    fillCircle(ctx, x, y, 1.4 + strength * 2.1);
  }
  ctx.strokeStyle = hexToRgba('#ffffff', 0.045 + strength * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (0.42 + ((now * 0.00018 + seed) % 0.16)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNebulaCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const blobCount = 8 + Math.floor(strength * 8);
  for (let i = 0; i < blobCount; i += 1) {
    const angle = unit(seed + i, 31) * Math.PI * 2 + Math.sin(now * 0.0002 + i) * 0.3;
    // scatter blobs more broadly across canvas
    const dist = radius * (0.04 + unit(seed + i, 32) * 0.78);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.82;
    const r = radius * (0.14 + unit(seed + i, 33) * 0.28 + strength * 0.08) * (1 + Math.sin(now * 0.0009 + i) * 0.1);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, hexToRgba(color, 0.03 + strength * 0.09));
    grad.addColorStop(0.6, hexToRgba(color, 0.01 + strength * 0.03));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDiskSwarm(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now * 0.00018 + seed);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = hexToRgba(color, (0.04 + strength * 0.06) / (i + 1));
    ctx.lineWidth = 0.8 + strength * 0.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (0.32 + i * 0.17), radius * (0.12 + i * 0.06), i * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  const rocks = 5 + Math.floor(strength * 6);
  for (let i = 0; i < rocks; i += 1) {
    const ring = 0.28 + unit(seed + i, 41) * 0.42;
    const angle = now * (0.00028 + unit(seed + i, 42) * 0.00025) + unit(seed + i, 43) * Math.PI * 2;
    ctx.fillStyle = hexToRgba(i % 3 === 0 ? '#ffffff' : color, 0.16 + strength * 0.16);
    fillCircle(ctx, Math.cos(angle) * radius * ring, Math.sin(angle) * radius * ring * 0.32, 0.9 + strength * 1.3);
  }
  ctx.restore();
}

function drawEntropyFragments(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  // More fragments slowly dispersing into darkness
  const count = 12 + Math.floor(strength * 18);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i += 1) {
    const drift = (now * (0.00005 + unit(seed + i, 51) * 0.00006) + unit(seed + i, 55)) % 1;
    const angle = unit(seed + i, 52) * Math.PI * 2;
    const dist = radius * (0.08 + drift * 0.94);
    const alpha = (1 - drift) * (0.07 + strength * 0.16);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle * 1.35) * dist * 0.82;
    ctx.fillStyle = hexToRgba(i % 5 === 0 ? '#ffffff' : color, alpha);
    fillCircle(ctx, x, y, 0.6 + unit(seed + i, 53) * (1.5 + strength * 1.6));
  }
  // Dashed boundary ring
  ctx.strokeStyle = hexToRgba(color, 0.022 + strength * 0.038);
  ctx.lineWidth = 0.65;
  ctx.setLineDash([2, 8]);
  strokeCircle(ctx, cx, cy, radius * (0.48 + strength * 0.1));
  ctx.setLineDash([]);
  // Very faint outer shell
  ctx.strokeStyle = hexToRgba(color, 0.012 + strength * 0.02);
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1, 12]);
  strokeCircle(ctx, cx, cy, radius * (0.76 + strength * 0.14));
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRiftLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i += 1) {
    const x = cx + (unit(seed + i, 61) - 0.5) * radius * 1.6;
    const y = cy + (unit(seed + i, 62) - 0.5) * radius * 1.05;
    const len = radius * (0.22 + unit(seed + i, 63) * 0.2);
    const tilt = unit(seed + i, 64) * Math.PI;
    ctx.strokeStyle = hexToRgba(color, 0.035 + strength * 0.075);
    ctx.lineWidth = 0.7 + strength * 0.9;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(tilt) * len, y - Math.sin(tilt) * len);
    ctx.lineTo(x + Math.cos(tilt) * len * (0.25 + Math.sin(now * 0.001 + i) * 0.1), y + Math.sin(tilt) * len * 0.25);
    ctx.lineTo(x + Math.cos(tilt) * len, y + Math.sin(tilt) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBounceEcho(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i += 1) {
    const phase = (Math.sin(now * 0.0011 + i * 0.8) + 1) / 2;
    const r = radius * (0.2 + phase * 0.48 + i * 0.06);
    ctx.strokeStyle = hexToRgba(color, (0.04 + strength * 0.07) / (i + 0.7));
    ctx.lineWidth = 0.8 + strength * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.25, Math.PI * 1.82);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.08 + strength * 0.11);
  fillCircle(ctx, cx, cy, 1.3 + strength * 2.5);
  ctx.restore();
}

function drawPulsarBeacon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
  seed = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now * 0.001 + seed);
  ctx.globalCompositeOperation = 'lighter';
  for (const dir of [-1, 1]) {
    const beam = ctx.createLinearGradient(0, 0, dir * radius, 0);
    beam.addColorStop(0, hexToRgba('#ffffff', 0.12 + strength * 0.12));
    beam.addColorStop(0.5, hexToRgba(color, 0.08 + strength * 0.14));
    beam.addColorStop(1, hexToRgba(color, 0));
    ctx.strokeStyle = beam;
    ctx.lineWidth = 1.2 + strength * 2.4;
    ctx.beginPath();
    ctx.moveTo(dir * radius * 0.1, 0);
    ctx.lineTo(dir * radius * 0.82, Math.sin(now * 0.002 + seed) * radius * 0.04);
    ctx.stroke();
  }
  ctx.strokeStyle = hexToRgba(color, 0.12 + strength * 0.11);
  ctx.lineWidth = 0.8;
  strokeCircle(ctx, 0, 0, radius * 0.18);
  ctx.restore();
}

// ── New stage-specific ambient helpers ──────────────────────────────────────

/** Stage 2/3: QGP plasma turbulence — swirling color-charged sea */
function drawPlasmaSea(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  const count = 14 + Math.floor(strength * 22);
  const rgbColors = ['#ff5c55', '#57d77a', '#5aa7ff'];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const c = rgbColors[i % 3];
    const angle = unit(seed + i, 91) * Math.PI * 2 + now * (0.00018 + unit(seed + i, 92) * 0.00035);
    const dist = radius * (0.06 + unit(seed + i, 93) * 0.92);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle * 1.15) * dist * 0.78;
    const flicker = (Math.sin(now * 0.006 + i * 2.1 + seed) + 1) / 2;
    ctx.fillStyle = hexToRgba(c, 0.025 + flicker * strength * 0.1);
    fillCircle(ctx, x, y, 1.0 + unit(seed + i, 94) * (2.2 + strength * 4.5));
  }
  // Gluon flux lines
  const lines = 5 + Math.floor(strength * 8);
  ctx.lineWidth = 0.55;
  for (let i = 0; i < lines; i++) {
    const a1 = unit(seed + i, 95) * Math.PI * 2 + now * 0.00009;
    const a2 = a1 + 1.1 + unit(seed + i, 96) * Math.PI;
    const r1 = radius * (0.18 + unit(seed + i, 97) * 0.72);
    const r2 = radius * (0.18 + unit(seed + i, 98) * 0.72);
    ctx.strokeStyle = hexToRgba(color, 0.02 + strength * 0.038);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.78);
    ctx.quadraticCurveTo(cx, cy, cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

/** Stage 4: Nucleosynthesis fusion flashes across the canvas */
function drawFusionBursts(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  const bursts = 3 + Math.floor(strength * 7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Warm background glow
  const bg = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * (0.85 + strength * 0.25));
  bg.addColorStop(0, hexToRgba(color, 0.012 + strength * 0.022));
  bg.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (0.85 + strength * 0.25), 0, Math.PI * 2);
  ctx.fill();
  // Flash events
  for (let i = 0; i < bursts; i++) {
    const cycle = (now * (0.00055 + unit(seed + i, 101) * 0.00035) + unit(seed + i, 102) * 5) % 3;
    if (cycle > 1) continue;
    const bx = cx + (unit(seed + i, 103) - 0.5) * radius * 1.55;
    const by = cy + (unit(seed + i, 104) - 0.5) * radius * 1.15;
    const flashR = radius * (0.03 + (1 - cycle) * 0.18) * (0.5 + strength * 0.5);
    const alpha = (1 - cycle) * strength * 0.38;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, flashR);
    grad.addColorStop(0, hexToRgba('#ffffff', alpha));
    grad.addColorStop(0.35, hexToRgba(color, alpha * 0.65));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, flashR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Stage 5: CMB acoustic oscillation expanding rings */
function drawCMBAcoustic(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rings = 6 + Math.floor(strength * 6);
  for (let i = 0; i < rings; i++) {
    const phase = (now * 0.000075 * (1 + i * 0.12) + i * 0.55 + seed * 0.008) % 1;
    const r = radius * (0.12 + phase * 0.9);
    const alpha = (1 - phase) * (0.022 + strength * 0.038) / (i * 0.3 + 1);
    ctx.strokeStyle = hexToRgba(i % 3 === 0 ? '#ffffff' : color, alpha);
    ctx.lineWidth = 0.6 + (1 - phase) * strength * 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Soft CMB background glow
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius * 1.1);
  glow.addColorStop(0, hexToRgba(color, 0.01 + strength * 0.016));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Stage 8: Expanding ionization wave filling the canvas */
function drawReionizationWave(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  const bubbles = 7 + Math.floor(strength * 11);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < bubbles; i++) {
    const bx = i === 0 ? cx : cx + (unit(seed + i, 111) - 0.5) * radius * 1.85;
    const by = i === 0 ? cy : cy + (unit(seed + i, 112) - 0.5) * radius * 1.45;
    const speed = 0.000045 + unit(seed + i, 113) * 0.00007;
    const phase = (now * speed + unit(seed + i, 114) * Math.PI * 2) % (Math.PI * 2);
    const baseR = radius * (0.1 + unit(seed + i, 115) * 0.38);
    const bubR = baseR * (0.82 + Math.sin(phase) * 0.18);
    const alpha = (0.022 + strength * 0.042) * (0.55 + Math.cos(phase) * 0.45);
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 0.7 + strength * 0.65;
    ctx.beginPath();
    ctx.arc(bx, by, bubR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba('#ffffff', alpha * 0.35);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.arc(bx, by, bubR * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Stage 9: Large-scale cosmic web spanning the full canvas */
function drawCosmicWebField(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  const nodes = 12 + Math.floor(strength * 14);
  const pts = Array.from({ length: nodes }, (_, i) => {
    const a = (i / nodes) * Math.PI * 2 + Math.sin(now * 0.00005 + i) * 0.06;
    const r = radius * (0.14 + unit(seed + i, 121) * 0.9);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a * 1.18) * r * 0.82 };
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.5 + strength * 0.45;
  for (let i = 0; i < nodes; i++) {
    for (let skip = 1; skip <= 3; skip++) {
      const j = (i + Math.max(1, Math.floor(nodes / 4)) * skip) % nodes;
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius * 1.55) continue;
      const alpha = (0.016 + strength * 0.03) * (1 - dist / (radius * 1.6));
      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      const midX = (pts[i].x + pts[j].x) / 2 + Math.sin(now * 0.000038 + i * j) * radius * 0.07;
      const midY = (pts[i].y + pts[j].y) / 2 + Math.cos(now * 0.000032 + i * j) * radius * 0.055;
      ctx.quadraticCurveTo(midX, midY, pts[j].x, pts[j].y);
      ctx.stroke();
    }
  }
  for (const p of pts) {
    ctx.fillStyle = hexToRgba(color, 0.07 + strength * 0.1);
    fillCircle(ctx, p.x, p.y, 1.3 + strength * 2.2);
  }
  ctx.restore();
}

/** Stage 13/14: Cold remnants slowly drifting in darkness */
function drawStellarGraveyardDrift(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number, seed = 0,
): void {
  const count = 12 + Math.floor(strength * 18);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const driftAngle = unit(seed + i, 141) * Math.PI * 2;
    const driftSpeed = 0.000012 + unit(seed + i, 142) * 0.000025;
    const phase = unit(seed + i, 143) * Math.PI * 2;
    const dist = radius * (0.1 + unit(seed + i, 144) * 0.88);
    const x = cx + Math.cos(driftAngle + now * driftSpeed + phase) * dist;
    const y = cy + Math.sin(driftAngle * 1.12 + now * driftSpeed * 0.82 + phase) * dist * 0.82;
    const flicker = (Math.sin(now * 0.0014 + i * 3.7 + seed) + 1) / 2;
    ctx.fillStyle = hexToRgba(color, 0.035 + flicker * strength * 0.12);
    fillCircle(ctx, x, y, 0.55 + unit(seed + i, 145) * (1.1 + strength * 1.8));
  }
  ctx.restore();
}

/** Stage 15: Hawking radiation — particles escaping black holes */
function drawHawkingGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, now: number, strength: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * (0.88 + strength * 0.28));
  bg.addColorStop(0, hexToRgba(color, 0.018 + strength * 0.035));
  bg.addColorStop(0.55, hexToRgba(color, 0.007 + strength * 0.013));
  bg.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (0.88 + strength * 0.28), 0, Math.PI * 2);
  ctx.fill();
  const particles = 8 + Math.floor(strength * 16);
  for (let i = 0; i < particles; i++) {
    const angle = unit(i * 7, 131) * Math.PI * 2;
    const phase = (now * 0.00011 * (1 + unit(i, 132) * 0.8) + unit(i, 133) * 10) % 1;
    const dist = radius * (0.04 + phase * 0.94);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const alpha = (1 - phase) * strength * 0.28;
    ctx.fillStyle = hexToRgba(phase < 0.12 ? '#ffffff' : color, alpha);
    fillCircle(ctx, x, y, 0.5 + (1 - phase) * strength * 2.0);
  }
  ctx.restore();
}

function drawGlobalEntityFields(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  activeEntities: ActiveEntity[],
  now: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const { entity, count } of activeEntities) {
    const text = `${entity.name} ${entity.formula} ${entity.visual.glyph}`.toLowerCase();
    const strength = entityStrength(entity, count);
    // Larger base radius so effects span a bigger portion of the canvas
    const radius = 100 + strength * 150 + (entity.rarity === 'legendary' ? 55 : 0);
    const col = entity.visual.color;
    const sid = entity.stageId;
    const idLen = entity.id.length;

    // ── Stage 1: Quantum Fluctuation — whole-canvas ripple + foam
    if (textHas(text, 'quantum', 'fluctuation', 'foam', 'tunneling', 'virtual particle')) {
      drawQuantumFoam(ctx, cx, cy, radius * 1.1, col, now, strength, sid + idLen);
    }
    // ── Stage 1: Vacuum / inflaton — many scattered bubbles
    if (textHas(text, 'vacuum', 'inflaton', 'inflation', 'symmetry', 'wormhole', 'de sitter', 'bubble')) {
      drawVacuumBubble(ctx, cx, cy, radius * 1.05, col, now, strength, idLen);
    }
    // ── Stage 2/3: Quark-gluon plasma — color charges + turbulent sea
    if (textHas(text, 'quark', 'gluon', 'qcd', 'color', 'baryon', 'pion', 'kaon', 'plasma')) {
      drawColorCharge(ctx, cx, cy, radius * 0.78, col, now, strength);
      drawPlasmaSea(ctx, cx, cy, radius * 1.0, col, now, strength, idLen);
    }
    // ── Stage 4: Nucleosynthesis — fusion bursts + nuclear clusters
    if (textHas(text, 'proton', 'neutron', 'deuterium', 'tritium', 'helium', 'lithium', 'beryllium', 'fusion', 'nucleosynthesis', 'fireball', 'bbn')) {
      drawNuclearCluster(ctx, cx, cy, radius * 0.9, col, now, strength, idLen);
      drawFusionBursts(ctx, cx, cy, radius * 1.1, col, now, strength, idLen);
    }
    // ── Stage 5: Recombination / CMB — acoustic rings + cloud clearing
    if (textHas(text, 'cmb', 'photon decoupling', 'last scattering', 'acoustic', 'transparency', 'plasma to gas')) {
      drawCMBAcoustic(ctx, cx, cy, radius * 1.1, col, now, strength, idLen);
    }
    // ── Stage 6: Dark Age / gas clouds — large nebula blobs
    if (textHas(text, 'cloud', 'gas', 'nebula', 'envelope', 'dust', 'wind', 'hydrogen', 'molecular', 'protogalactic')) {
      drawNebulaCloud(ctx, cx, cy, radius * 1.05, col, now, strength, idLen);
    }
    // ── Stage 7: First stars — stellar wind + HII glow
    if (textHas(text, 'star', 'protostar', 'stellar', 'hii', 'pop iii', 'supernova precursor')) {
      drawNebulaCloud(ctx, cx, cy, radius * 0.88, col, now, strength * 0.7, idLen + 3);
    }
    // ── Stage 8: Reionization — expanding ionization bubbles
    if (textHas(text, 'ionization', 'reionization', 'ionized', 'hii bubble', 'metagalactic', 'bubble merger', 'gunn-peterson', 'intergalactic')) {
      drawReionizationWave(ctx, cx, cy, radius * 1.15, col, now, strength, idLen);
    }
    if (textHas(text, 'photon', 'uv', 'lyman', 'x-ray')) {
      drawIonizationBubbles(ctx, cx, cy, radius * 0.95, col, now, strength);
    }
    // ── Stage 9: Galaxy formation — cosmic web
    if (textHas(text, 'dark matter', 'halo', 'filament', 'cosmic web', 'large scale', 'galaxy cluster', 'void')) {
      drawWebField(ctx, cx, cy, radius, col, now, strength);
      drawCosmicWebField(ctx, cx, cy, radius * 1.1, col, now, strength, idLen);
    }
    if (textHas(text, 'quasar', 'active galactic nucleus', 'agn')) {
      drawQuasarJets(ctx, cx, cy, radius * 1.2, col, now, strength);
    }
    // ── Stage 10: Solar system — disk + water ripples
    if (textHas(text, 'planet', 'moon', 'comet', 'asteroid', 'disk', 'core', 'zone', 'habitable', 'goldilocks')) {
      drawDiskSwarm(ctx, cx, cy, radius * 0.92, col, now, strength, idLen);
    }
    if (textHas(text, 'water', 'h₂o', 'ice')) {
      drawWaterRipples(ctx, cx, cy, radius * 0.88, col, now, strength);
    }
    // ── Stage 11: Life — living network
    if (textHas(text, 'dna', 'rna', 'neuron', 'life', 'photosynthesis', 'cell', 'sapiens', 'amino', 'prokaryote', 'eukaryote')) {
      drawLivingNetwork(ctx, cx, cy, radius * 0.95, col, now, strength);
    }
    // ── Stage 12: Stellar death — magnetic + compact remnants
    if (textHas(text, 'magnetic field', 'magnetar')) {
      drawMagneticLoops(ctx, cx, cy, radius * 1.05, col, now, strength);
    }
    if (textHas(text, 'gravitational wave', 'gw echo')) {
      drawWaterRipples(ctx, cx, cy, radius * 1.15, col, now + 900, strength);
    }
    // ── Stage 13/14: Stelliferous end / degenerate — remnant drift + pulsar
    if (textHas(text, 'white dwarf', 'brown dwarf', 'black dwarf', 'neutron star', 'pulsar', 'remnant', 'graveyard', 'iron star')) {
      drawPulsarBeacon(ctx, cx, cy, radius * 1.0, col, now, strength, idLen);
      drawStellarGraveyardDrift(ctx, cx, cy, radius * 0.95, col, now, strength, idLen);
    }
    // ── Stage 14/15/16: Black holes
    if (textHas(text, 'black hole', ' bh', 'event horizon', 'singularity', '⚫', 'ergosphere', 'hawking', 'penrose', 'firewall')) {
      drawBlackHoleLens(ctx, cx, cy, radius * 1.0, col, now, strength);
      if (sid >= 14) drawHawkingGlow(ctx, cx, cy, radius * 1.1, col, now, strength);
    }
    // ── Stage 14/16: Entropy / decay / end
    if (textHas(text, 'entropy', 'decay', 'annihilation', 'washout', 'equilibrium', 'darkness', 'void', 'thermal', 'last baryon', 'relic', 'lone photon')) {
      drawEntropyFragments(ctx, cx, cy, radius * 1.05, col, now, strength, idLen);
    }
    // ── Stage 16: Dark energy / big rip
    if (textHas(text, 'dark energy', 'big rip', 'spike', 'de sitter')) {
      drawRiftLines(ctx, cx, cy, radius * 1.05, col, now, strength, idLen);
    }
    // ── Stage 16: Bounce
    if (textHas(text, 'bounce')) {
      drawBounceEcho(ctx, cx, cy, radius * 0.9, col, now, strength);
    }
  }
  ctx.restore();
}

function drawLocalEntityEffect(ctx: CanvasRenderingContext2D, position: EntityPosition, now: number): void {
  const { item, x, y, size, glowRadius } = position;
  const text = itemText(item);
  const strength = item.maxCount > 0 ? Math.min(1, (item.ownedCount || 1) / item.maxCount) : 0.45;
  const pulse = 1 + Math.sin(now * 0.002 + item.seed) * 0.1;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  if (textHas(text, 'magnetic field', 'magnetar')) {
    drawMagneticLoops(ctx, 0, 0, glowRadius * 1.25, item.color, now + item.seed, 0.55 + strength * 0.45);
  } else if (textHas(text, 'quasar', 'active galactic nucleus', 'agn')) {
    ctx.rotate(now * 0.001 + item.seed);
    drawQuasarJets(ctx, 0, 0, glowRadius * 2.1, item.color, now, 0.45 + strength * 0.55);
  } else if (textHas(text, 'black hole', ' bh', 'event horizon', 'singularity', '⚫')) {
    drawBlackHoleLens(ctx, 0, 0, glowRadius * 1.55, item.color, now + item.seed, 0.5 + strength * 0.5);
  } else if (textHas(text, 'bounce')) {
    drawBounceEcho(ctx, 0, 0, glowRadius * 1.35, item.color, now + item.seed, 0.55 + strength * 0.45);
  } else if (textHas(text, 'dark energy', 'big rip', 'spike')) {
    drawRiftLines(ctx, 0, 0, glowRadius * 1.6, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'entropy', 'decay', 'annihilation', 'washout', 'equilibrium', 'darkness', 'void', 'thermal', 'last baryon')) {
    drawEntropyFragments(ctx, 0, 0, glowRadius * 1.35, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'vacuum', 'inflaton', 'inflation', 'symmetry', 'wormhole', 'de sitter', 'bubble')) {
    drawVacuumBubble(ctx, 0, 0, glowRadius * 1.45, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'quantum', 'fluctuation', 'foam', 'tunneling', 'virtual particle')) {
    drawQuantumFoam(ctx, 0, 0, glowRadius * 1.55, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'quark', 'gluon', 'qcd', 'color', 'baryon', 'pion', 'kaon')) {
    drawColorCharge(ctx, 0, 0, glowRadius * 1.55, item.color, now + item.seed, 0.45 + strength * 0.55);
  } else if (textHas(text, 'proton', 'neutron', 'deuterium', 'tritium', 'helium', 'lithium', 'beryllium', 'fusion', 'nucleosynthesis')) {
    drawNuclearCluster(ctx, 0, 0, glowRadius * 1.55, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'white dwarf', 'brown dwarf', 'black dwarf', 'neutron star', 'pulsar', 'remnant', 'graveyard')) {
    drawPulsarBeacon(ctx, 0, 0, glowRadius * 1.7, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'supernova', 'nova', 'flash', 'eruption')) {
    for (let i = 0; i < 3; i += 1) {
      const r = glowRadius * (0.58 + i * 0.38 + ((now * 0.00045 + i * 0.2 + item.copyIndex * 0.13) % 0.34));
      ctx.strokeStyle = hexToRgba(item.color, (0.15 + strength * 0.12) / (i + 1));
      ctx.lineWidth = 0.9 + i * 0.25;
      strokeCircle(ctx, 0, 0, r);
    }
  } else if (textHas(text, 'comet')) {
    ctx.strokeStyle = hexToRgba(item.color, 0.26 + strength * 0.14);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-glowRadius * 1.8, size * 0.1);
    ctx.quadraticCurveTo(-glowRadius * 0.7, -glowRadius * 0.35, 0, 0);
    ctx.stroke();
  } else if (textHas(text, 'planet', 'moon', 'asteroid', 'disk', 'core', 'zone', 'habitable')) {
    drawDiskSwarm(ctx, 0, 0, glowRadius * 1.55, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'cloud', 'gas', 'nebula', 'envelope', 'dust', 'wind', 'hydrogen')) {
    drawNebulaCloud(ctx, 0, 0, glowRadius * 1.45, item.color, now + item.seed, 0.45 + strength * 0.55, item.seed);
  } else if (textHas(text, 'dna', 'rna')) {
    ctx.strokeStyle = hexToRgba(item.color, 0.24 + strength * 0.12);
    ctx.lineWidth = 1;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const yy = -glowRadius + (i / 8) * glowRadius * 2;
        const xx = Math.sin(i * 0.9 + now * 0.004 + item.seed) * size * 0.55 * side;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  } else if (textHas(text, 'neuron', 'brain')) {
    drawLivingNetwork(ctx, 0, 0, glowRadius * 1.35, item.color, now + item.seed, 0.55 + strength * 0.45);
  } else if (textHas(text, 'water', 'h₂o', 'ice')) {
    drawWaterRipples(ctx, 0, 0, glowRadius * 1.1, item.color, now + item.seed, 0.45 + strength * 0.45);
  } else if (textHas(text, 'galaxy', 'spiral', 'cosmic web', 'filament')) {
    drawWebField(ctx, 0, 0, glowRadius * 1.45, item.color, now + item.seed, 0.4 + strength * 0.45);
  } else if (textHas(text, 'star', 'sun', 'fusion', 'photon', 'uv', 'ray')) {
    ctx.strokeStyle = hexToRgba(item.color, 0.16 + strength * 0.14);
    ctx.lineWidth = 0.9 + strength * 0.8;
    drawRays(ctx, glowRadius * pulse, 8 + Math.floor(strength * 4));
  } else if (textHas(text, 'wave', 'oscillation', 'signal', 'front')) {
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = hexToRgba(item.color, 0.11 / (i + 0.8));
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius * (0.65 + i * 0.34 + Math.sin(now * 0.001 + i) * 0.04), Math.PI * 0.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else if (item.effectType === 'crit') {
    ctx.strokeStyle = hexToRgba('#ffffff', 0.1 + strength * 0.12);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 5]);
    strokeCircle(ctx, 0, 0, glowRadius * 1.15);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function lifeEntitySize(item: EntityDrawItem): number {
  const scaleByRarity: Record<EntityRarity, number> = {
    common: 0.68,
    rare: 0.74,
    epic: 0.82,
    legendary: 0.95,
  };
  return ICON_SIZE[item.rarity] * scaleByRarity[item.rarity];
}

function lifeEntityGlow(item: EntityDrawItem): number {
  const scaleByRarity: Record<EntityRarity, number> = {
    common: 0.56,
    rare: 0.54,
    epic: 0.52,
    legendary: 0.5,
  };
  return GLOW_RADIUS[item.rarity] * scaleByRarity[item.rarity];
}

/** Stage 11: The Moon — orbits Earth, grows with moonFraction (Moon entity level 0–1), proper z-order */
function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  earthRadius: number,
  now: number,
  moonFraction: number,   // 0 = no Moon entity, 1 = fully maxed
  isBehind: boolean,
): void {
  // Always show moon, but grows dramatically from level 1 → 20
  const moonRadius = earthRadius * (0.16 + moonFraction * 0.36);
  const orbitR = earthRadius * 2.55;
  const orbTilt = 0.62;
  const angle = now * 0.000022;
  const mx = cx + Math.cos(angle) * orbitR;
  const my = cy + Math.sin(angle) * orbitR * orbTilt;

  // Orbit track — draw only on the "behind" pass so it sits behind Earth
  if (isBehind) {
    ctx.save();
    ctx.strokeStyle = hexToRgba('#a89c78', 0.06 + moonFraction * 0.04);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 8]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitR, orbitR * orbTilt, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const depthAlpha = isBehind ? 0.52 : 1.0;

  ctx.save();

  // Soft outer glow — grows with moonFraction
  ctx.globalCompositeOperation = 'lighter';
  const glowR = moonRadius * 3.2;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, glowR);
  glow.addColorStop(0, hexToRgba('#d8d0b4', (0.18 + moonFraction * 0.18) * depthAlpha));
  glow.addColorStop(0.45, hexToRgba('#b0a880', 0.07 * depthAlpha));
  glow.addColorStop(1, hexToRgba('#887860', 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Moon body
  ctx.beginPath();
  ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(
    mx - moonRadius * 0.28, my - moonRadius * 0.28, moonRadius * 0.04,
    mx, my, moonRadius,
  );
  bodyGrad.addColorStop(0, `rgba(218, 208, 184, ${0.96 * depthAlpha})`);
  bodyGrad.addColorStop(0.5, `rgba(162, 154, 132, ${0.92 * depthAlpha})`);
  bodyGrad.addColorStop(1, `rgba(86, 80, 66, ${0.88 * depthAlpha})`);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Craters + phase shadow clipped to moon circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
  ctx.clip();

  const craters = [
    { ox: 0.26, oy: -0.2, r: 0.22 },
    { ox: -0.31, oy: 0.24, r: 0.17 },
    { ox: 0.07, oy: 0.34, r: 0.13 },
    { ox: -0.16, oy: -0.32, r: 0.11 },
    { ox: 0.38, oy: 0.12, r: 0.09 },
  ];
  for (const c of craters) {
    const crX = mx + c.ox * moonRadius;
    const crY = my + c.oy * moonRadius;
    const crR = c.r * moonRadius;
    ctx.fillStyle = `rgba(62, 58, 46, ${0.32 * depthAlpha})`;
    ctx.beginPath();
    ctx.arc(crX, crY, crR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 192, 168, ${0.2 * depthAlpha})`;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.arc(crX - crR * 0.2, crY - crR * 0.2, crR * 1.06, Math.PI * 0.85, Math.PI * 1.85);
    ctx.stroke();
  }

  // Phase shadow — rotates with orbit angle
  const shadowDir = angle + 0.85;
  const sg = ctx.createLinearGradient(
    mx + Math.cos(shadowDir) * moonRadius,
    my + Math.sin(shadowDir) * moonRadius,
    mx - Math.cos(shadowDir) * moonRadius * 0.55,
    my - Math.sin(shadowDir) * moonRadius * 0.55,
  );
  sg.addColorStop(0, 'rgba(4, 6, 20, 0)');
  sg.addColorStop(0.32, 'rgba(4, 6, 20, 0.14)');
  sg.addColorStop(0.62, 'rgba(4, 6, 20, 0.52)');
  sg.addColorStop(1, 'rgba(4, 6, 20, 0.80)');
  ctx.fillStyle = sg;
  ctx.fillRect(mx - moonRadius - 1, my - moonRadius - 1, moonRadius * 2 + 2, moonRadius * 2 + 2);

  ctx.restore(); // exits moon clip
  ctx.restore();
}

/** Stage 11: Canvas-wide living ambient — aurora bands, neural web, signal pulses */
function drawLifeCanvasAmbient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  items: EntityDrawItem[],
  now: number,
): void {
  const lifePower = Math.min(1, items.length / 12);
  if (lifePower < 0.04) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Aurora bands — sweeping horizontal gradients
  const auroraColors = ['#3affb4', '#74cfff', '#a8ff88'];
  for (let band = 0; band < 3; band++) {
    const baseY = cy + (band - 1) * radius * 0.72 + Math.sin(now * 0.00025 + band * 2.0) * radius * 0.22;
    const hue = auroraColors[band];
    const pulse = 0.45 + Math.sin(now * 0.0007 + band * 1.4) * 0.55;
    const bandH = radius * (0.32 + Math.cos(now * 0.00032 + band) * 0.08);
    const grad = ctx.createLinearGradient(cx - radius * 1.4, baseY, cx + radius * 1.4, baseY);
    grad.addColorStop(0, hexToRgba(hue, 0));
    grad.addColorStop(0.22, hexToRgba(hue, (0.025 + lifePower * 0.07) * pulse));
    grad.addColorStop(0.5, hexToRgba(hue, (0.035 + lifePower * 0.085) * pulse));
    grad.addColorStop(0.78, hexToRgba(hue, (0.022 + lifePower * 0.06) * pulse));
    grad.addColorStop(1, hexToRgba(hue, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius * 1.45, baseY - bandH, radius * 2.9, bandH * 2);
  }

  // Large neural web spanning full canvas
  const nodeCount = 16 + Math.floor(lifePower * 20);
  const pts = Array.from({ length: nodeCount }, (_, i) => {
    const a = (i / nodeCount) * Math.PI * 2 + Math.sin(now * 0.000048 + i * 0.82) * 0.18;
    const dist = radius * (0.28 + unit(i + 200, 60) * 0.92);
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a * 1.1) * dist * 0.8 };
  });

  ctx.lineCap = 'round';
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      const dist = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (dist > radius * 1.1) continue;
      const flicker = 0.45 + Math.sin(now * 0.0005 + (i * nodeCount + j) * 0.14) * 0.55;
      const alpha = (0.022 + lifePower * 0.058) * (1 - dist / (radius * 1.15)) * flicker;
      ctx.strokeStyle = hexToRgba(j % 3 === 0 ? '#3affb4' : '#74cfff', alpha);
      ctx.lineWidth = 0.5 + lifePower * 0.5;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      const mx = (pts[i].x + pts[j].x) / 2 + Math.sin(now * 0.00022 + i + j) * radius * 0.05;
      const my = (pts[i].y + pts[j].y) / 2 + Math.cos(now * 0.00018 + i + j) * radius * 0.04;
      ctx.quadraticCurveTo(mx, my, pts[j].x, pts[j].y);
      ctx.stroke();
    }
    ctx.fillStyle = hexToRgba('#7dffaa', 0.1 + lifePower * 0.2);
    fillCircle(ctx, pts[i].x, pts[i].y, 1.1 + lifePower * 2.2);
  }

  // Signal pulse rings radiating from Earth center
  const pulseCount = 3 + Math.floor(lifePower * 4);
  for (let i = 0; i < pulseCount; i++) {
    const phase = (now * 0.00006 + i * (1 / pulseCount)) % 1;
    const r = radius * (0.08 + phase * 1.1);
    const alpha = (1 - phase) * lifePower * 0.075;
    ctx.strokeStyle = hexToRgba(i % 2 === 0 ? '#4dffb8' : '#74cfff', alpha);
    ctx.lineWidth = 0.8 + (1 - phase) * 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEarthBiosphereVeins(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  items: EntityDrawItem[],
  now: number,
): void {
  if (items.length === 0) return;

  const lifePower = Math.min(1, items.reduce((sum, item) => sum + Math.max(1, item.ownedCount), 0) / 40);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Biosphere current strands — much more visible, with branches
  const strandCount = 10;
  for (let strand = 0; strand < strandCount; strand++) {
    const midOffset = (strandCount - 1) / 2;
    const y = cy + (strand - midOffset) * radius * 0.14 + Math.sin(now * 0.00045 + strand) * 1.8;
    const xHalf = radius * (0.72 - Math.abs(strand - midOffset) * 0.035);
    const hue = strand % 3 === 0 ? '#7dffab' : strand % 3 === 1 ? '#a6f7ff' : '#96ffd2';
    ctx.strokeStyle = hexToRgba(hue, 0.072 + lifePower * 0.11);
    ctx.lineWidth = 0.85 + lifePower * 1.05;
    ctx.beginPath();
    ctx.moveTo(cx - xHalf, y);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const x = cx - xHalf + xHalf * 2 * t;
      const wave = Math.sin(now * 0.001 + strand * 1.7 + step * 0.9) * radius * 0.032;
      const ripple = Math.cos(now * 0.00065 + strand * 2.3 + step * 1.1) * radius * 0.016;
      ctx.lineTo(x, y + wave + ripple);
    }
    ctx.stroke();

    // Branch filaments
    if (strand % 2 === 0 && lifePower > 0.2) {
      const branchN = 2 + Math.floor(lifePower * 3);
      for (let b = 0; b < branchN; b++) {
        const bt = (b + 1) / (branchN + 1);
        const bx = cx - xHalf + xHalf * 2 * bt;
        const by = y + Math.sin(now * 0.001 + strand * 1.7 + bt * 8 * 0.9) * radius * 0.032;
        const bLen = radius * (0.04 + lifePower * 0.06);
        const bAngle = -Math.PI / 2 + Math.sin(now * 0.0005 + b * 0.7 + strand) * 0.6;
        ctx.strokeStyle = hexToRgba(hue, 0.04 + lifePower * 0.07);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(bAngle) * bLen, by + Math.sin(bAngle) * bLen);
        ctx.stroke();
      }
      ctx.lineWidth = 0.85 + lifePower * 1.05;
    }
  }

  // Inner biosphere pulse aura — much brighter
  const pulse = 0.65 + Math.sin(now * 0.0012) * 0.35;
  const aura = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 0.97);
  aura.addColorStop(0, hexToRgba('#6dff9c', 0.07 * lifePower * pulse));
  aura.addColorStop(0.42, hexToRgba('#4bdc8f', 0.14 * lifePower * pulse));
  aura.addColorStop(0.75, hexToRgba('#3a9dff', 0.09 * lifePower * pulse));
  aura.addColorStop(1, hexToRgba('#3a9dff', 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.97, 0, Math.PI * 2);
  ctx.fill();

  // Secondary pulsing aura
  const pulse2 = 0.4 + Math.sin(now * 0.0009 + 2.1) * 0.6;
  const aura2 = ctx.createRadialGradient(cx, cy, radius * 0.22, cx, cy, radius * 0.88);
  aura2.addColorStop(0, hexToRgba('#b8ffdc', 0));
  aura2.addColorStop(0.5, hexToRgba('#7dffab', 0.06 * lifePower * pulse2));
  aura2.addColorStop(1, hexToRgba('#5bc8ff', 0));
  ctx.fillStyle = aura2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function isLifeOrbitEntity(item: EntityDrawItem): boolean {
  const text = itemText(item);
  return textHas(
    text,
    'satellite',
    'telescope',
    'observatory',
    'probe',
    'lander',
    'ark',
    'homo sapiens',
    'intelligence',
  );
}

function drawSpacecraftBody(
  ctx: CanvasRenderingContext2D,
  item: EntityDrawItem,
  size: number,
  now: number,
): void {
  const text = itemText(item);
  const color = item.color;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = hexToRgba(color, 0.75);
  ctx.fillStyle = hexToRgba(color, 0.62);
  if (textHas(text, 'telescope', 'observatory')) {
    ctx.lineWidth = Math.max(0.9, size * 0.12);
    ctx.fillRect(-size * 0.55, -size * 0.16, size * 1.1, size * 0.32);
    ctx.strokeRect(-size * 0.55, -size * 0.16, size * 1.1, size * 0.32);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.58);
    ctx.beginPath();
    ctx.arc(size * 0.58, 0, size * 0.18, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(color, 0.46);
    ctx.beginPath();
    ctx.moveTo(-size * 0.22, size * 0.2);
    ctx.lineTo(-size * 0.44, size * 0.62);
    ctx.lineTo(size * 0.28, size * 0.62);
    ctx.stroke();
  } else if (textHas(text, 'probe', 'lander', 'ark')) {
    ctx.lineWidth = Math.max(0.8, size * 0.1);
    ctx.beginPath();
    ctx.moveTo(size * 0.68, 0);
    ctx.lineTo(-size * 0.45, -size * 0.34);
    ctx.lineTo(-size * 0.24, 0);
    ctx.lineTo(-size * 0.45, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.45);
    ctx.beginPath();
    ctx.moveTo(-size * 0.52, -size * 0.36);
    ctx.lineTo(-size * 0.78, -size * 0.66);
    ctx.moveTo(-size * 0.52, size * 0.36);
    ctx.lineTo(-size * 0.78, size * 0.66);
    ctx.stroke();
    const flame = 0.45 + Math.sin(now * 0.006 + item.seed) * 0.18;
    ctx.fillStyle = hexToRgba('#ffd36b', flame);
    ctx.beginPath();
    ctx.moveTo(-size * 0.45, 0);
    ctx.lineTo(-size * (0.82 + flame * 0.34), -size * 0.18);
    ctx.lineTo(-size * (0.82 + flame * 0.34), size * 0.18);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(0.8, size * 0.1);
    ctx.fillRect(-size * 0.28, -size * 0.2, size * 0.56, size * 0.4);
    ctx.strokeRect(-size * 0.28, -size * 0.2, size * 0.56, size * 0.4);
    ctx.fillStyle = hexToRgba('#74cfff', 0.38);
    ctx.fillRect(-size * 0.92, -size * 0.16, size * 0.46, size * 0.32);
    ctx.fillRect(size * 0.46, -size * 0.16, size * 0.46, size * 0.32);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.32);
    ctx.beginPath();
    ctx.moveTo(-size * 0.46, 0);
    ctx.lineTo(-size * 0.28, 0);
    ctx.moveTo(size * 0.28, 0);
    ctx.lineTo(size * 0.46, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLifeOrbitEntities(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  earthRadius: number,
  items: EntityDrawItem[],
  now: number,
): void {
  if (items.length === 0) return;

  const techLevel = Math.min(1, items.length / 6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Orbit rings — prominently visible with glow + dashes
  const orbitCount = Math.min(4, Math.max(2, Math.ceil(items.length / 3)));
  for (let i = 0; i < orbitCount; i += 1) {
    const orbitR = earthRadius + 45 + i * 32;
    const pulse = 0.65 + Math.sin(now * 0.0007 + i * 1.8) * 0.35;
    const tilt = 0.44 + i * 0.035;
    const tiltAngle = Math.sin(now * 0.00012 + i) * 0.14;
    // Outer glow
    ctx.strokeStyle = hexToRgba(i % 2 === 0 ? '#b9d8ff' : '#fff4a8', (0.055 + techLevel * 0.04) * pulse);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitR, orbitR * tilt, tiltAngle, 0, Math.PI * 2);
    ctx.stroke();
    // Crisp dashed ring
    ctx.strokeStyle = hexToRgba(i % 2 === 0 ? '#dceeff' : '#fffbd0', (0.22 + techLevel * 0.18) * pulse);
    ctx.lineWidth = 1.0;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitR, orbitR * tilt, tiltAngle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const positions = items.map((item, index) => {
    const seed = item.seed;
    const text = itemText(item);
    const isLegend = item.rarity === 'legendary';
    const isFreeFlight = textHas(text, 'probe', 'lander', 'ark');
    const orbitBand = index % 4;
    const orbitR = earthRadius + 45 + orbitBand * 32 + (isLegend ? 28 : 0);
    const speed = isFreeFlight ? 0.0002 + unit(seed, 82) * 0.00016 : 0.00034 + unit(seed, 82) * 0.00022;
    const angle = now * speed * (unit(seed, 83) > 0.5 ? 1 : -1) + unit(seed, 84) * Math.PI * 2;
    const tilt = 0.44 + unit(seed, 85) * 0.2;
    const x = cx + Math.cos(angle) * orbitR;
    const y = cy + Math.sin(angle) * orbitR * tilt + Math.sin(now * 0.00055 + seed) * (isFreeFlight ? 9 : 3);
    return { item, x, y, angle, orbitR, isFreeFlight };
  });

  for (const position of positions) {
    const { item, x, y, angle, orbitR, isFreeFlight } = position;
    const text = itemText(item);
    const size =
      item.rarity === 'legendary'
        ? 16 + Math.sin(now * 0.001 + item.seed) * 1.5
        : item.rarity === 'epic'
          ? 12
          : 8.5;

    if (textHas(text, 'telescope', 'observatory', 'intelligence', 'homo sapiens')) {
      const surfaceX = cx + Math.cos(angle + Math.PI) * earthRadius * 0.62;
      const surfaceY = cy + Math.sin(angle + Math.PI) * earthRadius * 0.36;
      ctx.strokeStyle = hexToRgba(item.color, 0.14);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(surfaceX, surfaceY);
      ctx.lineTo(x, y);
      ctx.stroke();
      for (let ring = 0; ring < 2; ring += 1) {
        ctx.strokeStyle = hexToRgba('#ffffff', 0.18 / (ring + 1));
        ctx.lineWidth = 1.2 - ring * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, size * (1.8 + ring * 1.1 + Math.sin(now * 0.002 + ring) * 0.12), -0.7, 0.7);
        ctx.stroke();
      }
    }

    if (isFreeFlight) {
      const trail = orbitR * (0.14 + unit(item.seed, 86) * 0.07);
      ctx.strokeStyle = hexToRgba(item.color, 0.24);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * trail, y - Math.sin(angle) * trail * 0.44);
      ctx.quadraticCurveTo(
        x - Math.cos(angle) * trail * 0.45,
        y - Math.sin(angle) * trail * 0.2 - 9,
        x,
        y,
      );
      ctx.stroke();
    }

    // Big soft glow
    const glowR = size * 6;
    const glowAlpha = item.rarity === 'legendary' ? 0.42 : 0.28;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, hexToRgba(item.glowColor, glowAlpha));
    glow.addColorStop(0.3, hexToRgba(item.glowColor, glowAlpha * 0.5));
    glow.addColorStop(1, hexToRgba(item.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Crisp inner glow
    const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 2.5);
    innerGlow.addColorStop(0, hexToRgba('#ffffff', 0.4));
    innerGlow.addColorStop(0.4, hexToRgba(item.glowColor, 0.32));
    innerGlow.addColorStop(1, hexToRgba(item.color, 0));
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Legendary pulsing outer ring
    if (item.rarity === 'legendary') {
      const ringPulse = 0.6 + Math.sin(now * 0.0015 + item.seed) * 0.4;
      ctx.strokeStyle = hexToRgba('#ffffff', 0.35 * ringPulse);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size * 2.2 + Math.sin(now * 0.001 + item.seed) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (isFreeFlight ? 0 : Math.PI / 2));
    drawSpacecraftBody(ctx, item, size, now);
    ctx.restore();
  }

  ctx.restore();
}

function drawLifeEarthEntities(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  items: EntityDrawItem[],
  now: number,
): void {
  const earthRadius = TUNING.LIFE_SURFACE_R;
  const rotation = now * TUNING.LIFE_EARTH_ROT_RATE * 0.75;
  const orbitItems = items.filter(isLifeOrbitEntity);
  const surfaceItems = items.filter((item) => !isLifeOrbitEntity(item));
  const ownedPower = Math.min(1, items.length / 38);
  const moonAngle = now * 0.000022;
  const moonIsBehind = Math.sin(moonAngle) * 0.62 < 0; // back half of orbit

  // Moon entity level → controls visual moon size (0 = tiny always-present, 1 = fully maxed)
  const moonItem = items.find((item) => item.name.toLowerCase() === 'moon');
  const moonFraction = moonItem
    ? Math.min(1, moonItem.ownedCount / Math.max(1, moonItem.maxCount))
    : 0.08; // always show a small moon even before buying the entity

  // ── Canvas-wide ambient ─────────────────────────────────────────────────
  drawLifeCanvasAmbient(ctx, cx, cy, 220, items, now);

  // Moon orbit track + moon body when behind Earth (drawn before clip so Earth covers it)
  drawMoon(ctx, cx, cy, earthRadius, now, moonFraction, moonIsBehind);

  // Atmospheric halo around Earth (outside clip)
  if (ownedPower > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const atmPulse = 0.6 + Math.sin(now * 0.0009) * 0.4;
    const atm = ctx.createRadialGradient(cx, cy, earthRadius * 0.88, cx, cy, earthRadius * 2.6);
    atm.addColorStop(0, hexToRgba('#3affb4', 0.065 * ownedPower * atmPulse));
    atm.addColorStop(0.28, hexToRgba('#74cfff', 0.1 * ownedPower * atmPulse));
    atm.addColorStop(0.65, hexToRgba('#2a9dff', 0.04 * ownedPower));
    atm.addColorStop(1, hexToRgba('#2a9dff', 0));
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Earth surface clip ──────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, earthRadius * 0.98, 0, Math.PI * 2);
  ctx.clip();

  drawEarthBiosphereVeins(ctx, cx, cy, earthRadius, items, now);

  const positions: EntityPosition[] = surfaceItems.map((item) => {
    const seed = item.seed;
    const text = itemText(item);
    const isMolecular =
      textHas(text, 'amino', 'rna', 'dna', 'molecule', 'membrane', 'cell', 'prokaryote', 'eukaryote');
    const isMind = textHas(text, 'neuron', 'intelligence', 'sapiens', 'brain');
    const latitudeBand = isMolecular ? 0.44 : isMind ? 0.58 : 0.7;
    const lat = (unit(seed, 71) - 0.5) * Math.PI * latitudeBand;
    const lon =
      unit(seed, 72) * Math.PI * 2 +
      rotation * (unit(seed, 73) > 0.5 ? 1 : -0.72) +
      Math.sin(now * 0.00025 + seed) * 0.12;
    const sx = Math.cos(lat) * Math.sin(lon);
    const sy = Math.sin(lat);
    const sz = Math.cos(lat) * Math.cos(lon);
    const depth = Math.max(0.18, (sz + 1) / 2);
    const habitatRadius = earthRadius * (isMolecular ? 0.46 + unit(seed, 74) * 0.18 : 0.68 + unit(seed, 74) * 0.18);
    const x =
      cx +
      sx * habitatRadius +
      Math.sin(now * 0.0009 + seed) * (isMind ? 1.8 : 1.1);
    const y =
      cy +
      sy * habitatRadius * 0.82 +
      Math.cos(now * 0.0008 + seed * 0.7) * (isMind ? 1.5 : 0.9);
    const pulse =
      item.rarity === 'legendary'
        ? 1 + Math.sin(now * 0.0015 + seed) * 0.14
        : 1 + Math.sin(now * 0.001 + seed) * 0.045;

    return {
      item,
      x,
      y,
      size: lifeEntitySize(item) * (0.72 + depth * 0.38) * pulse,
      glowRadius: lifeEntityGlow(item) * (0.72 + depth * 0.42) * pulse,
    };
  });

  positions.sort((a, b) => a.size - b.size);

  for (let index = 1; index < positions.length; index += 1) {
    const current = positions[index];
    const previous = positions[index - 1];
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (distance > earthRadius * 0.72) continue;
    ctx.strokeStyle = hexToRgba('#82ffae', Math.max(0.018, 0.085 - distance / 820));
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    const midX = (previous.x + current.x) / 2 + Math.sin(now * 0.0005 + current.item.seed) * 2.5;
    const midY = (previous.y + current.y) / 2 + Math.cos(now * 0.00045 + current.item.seed) * 2.5;
    ctx.quadraticCurveTo(midX, midY, current.x, current.y);
    ctx.stroke();
  }

  for (const position of positions) {
    const { item, x, y, size, glowRadius } = position;
    drawLocalEntityEffect(ctx, position, now);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    grad.addColorStop(0, hexToRgba(item.glowColor, item.rarity === 'legendary' ? 0.36 : 0.2));
    grad.addColorStop(1, hexToRgba(item.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    if (item.rarity === 'legendary') {
      ctx.strokeStyle = hexToRgba('#fff2a8', 0.2);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius * 0.86 + Math.sin(now * 0.001 + item.seed) * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawEntityGlyph(ctx, item, x, y, size, now);
  }

  ctx.restore(); // exits Earth clip

  // ── Earth border rings (outside clip) ───────────────────────────────────
  if (ownedPower > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ringPulse = 0.72 + Math.sin(now * 0.001) * 0.28;
    // Main biosphere border
    ctx.strokeStyle = hexToRgba('#8fffc0', 0.22 + ownedPower * 0.22);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius * (0.99 + Math.sin(now * 0.001) * 0.01), 0, Math.PI * 2);
    ctx.stroke();
    // Atmosphere glow ring
    ctx.strokeStyle = hexToRgba('#74cfff', 0.14 * ownedPower * ringPulse);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius * 1.08, 0, Math.PI * 2);
    ctx.stroke();
    // Outer faint ring
    ctx.strokeStyle = hexToRgba('#3affb4', 0.08 * ownedPower);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Moon in front of Earth (drawn after clip restore so it overlaps Earth)
  if (!moonIsBehind) {
    drawMoon(ctx, cx, cy, earthRadius, now, moonFraction, false);
  }

  drawLifeOrbitEntities(ctx, cx, cy, earthRadius, orbitItems, now);
}

function drawEntityGlyph(
  ctx: CanvasRenderingContext2D,
  item: EntityDrawItem,
  x: number,
  y: number,
  size: number,
  now: number,
): void {
  const spin = now * 0.001 + item.sourceIndex * 0.7 + item.copyIndex * 0.23;
  const pulse = 1 + Math.sin(now * 0.002 + item.copyIndex) * 0.08;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin * 0.18);
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  switch (item.glyph) {
    case 'black_hole':
      ctx.save();
      ctx.rotate(-0.22);
      ctx.fillStyle = hexToRgba(item.color, 0.75);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.25, size * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#02030a';
      fillCircle(ctx, 0, 0, size * 0.7);
      ctx.strokeStyle = hexToRgba(item.color, 0.55);
      strokeCircle(ctx, 0, 0, size * 1.05);
      break;
    case 'galaxy':
      ctx.rotate(spin * 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.95, 0.1, Math.PI * 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.95, Math.PI + 0.1, Math.PI * 2.1);
      ctx.stroke();
      fillCircle(ctx, 0, 0, size * 0.35 * pulse);
      break;
    case 'star':
    case 'supernova':
      ctx.lineWidth = Math.max(1, size * 0.16);
      drawRays(ctx, size, item.glyph === 'supernova' ? 10 : 8);
      fillCircle(ctx, 0, 0, size * (item.glyph === 'supernova' ? 0.58 : 0.48) * pulse);
      break;
    case 'planet':
      fillCircle(ctx, 0, 0, size * 0.68);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.2, size * 0.35, -0.28, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'water':
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.1, size * 0.45, size * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = hexToRgba(item.color, 0.5);
      ctx.beginPath();
      ctx.ellipse(0, size * 0.75, size * 0.9, size * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'molecule':
      ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.beginPath();
      ctx.moveTo(-size * 0.75, 0);
      ctx.lineTo(0, -size * 0.35);
      ctx.lineTo(size * 0.72, size * 0.18);
      ctx.stroke();
      fillCircle(ctx, -size * 0.75, 0, size * 0.32);
      fillCircle(ctx, 0, -size * 0.35, size * 0.42);
      fillCircle(ctx, size * 0.72, size * 0.18, size * 0.28);
      break;
    case 'atom':
    case 'lepton':
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.1, size * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.1, size * 0.45, Math.PI / 2.6, 0, Math.PI * 2);
      ctx.stroke();
      fillCircle(ctx, 0, 0, size * 0.35);
      ctx.fillStyle = '#fff';
      fillCircle(ctx, Math.cos(spin) * size * 1.05, Math.sin(spin) * size * 0.45, size * 0.18);
      break;
    case 'nucleus':
    case 'quark':
      fillCircle(ctx, -size * 0.32, -size * 0.18, size * 0.34);
      fillCircle(ctx, size * 0.22, -size * 0.12, size * 0.36);
      fillCircle(ctx, -size * 0.05, size * 0.34, size * 0.34);
      if (item.glyph === 'quark') {
        ctx.strokeStyle = hexToRgba(item.color, 0.6);
        strokeCircle(ctx, 0, 0, size * 0.95);
      }
      break;
    case 'radiation':
      ctx.lineWidth = Math.max(1, size * 0.12);
      drawRays(ctx, size, 6);
      fillCircle(ctx, 0, 0, size * 0.25);
      break;
    case 'wave':
    case 'field':
    case 'boson':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * size * 0.35, 0, size * 0.62, -0.8, 0.8);
        ctx.stroke();
      }
      if (item.glyph !== 'wave') fillCircle(ctx, 0, 0, size * 0.24);
      break;
    case 'cloud':
    case 'halo':
      ctx.fillStyle = hexToRgba(item.color, 0.55);
      fillCircle(ctx, -size * 0.35, size * 0.05, size * 0.45);
      fillCircle(ctx, size * 0.2, -size * 0.16, size * 0.55);
      fillCircle(ctx, size * 0.48, size * 0.17, size * 0.38);
      if (item.glyph === 'halo') {
        ctx.strokeStyle = hexToRgba(item.color, 0.5);
        strokeCircle(ctx, 0, 0, size * 1.08);
      }
      break;
    case 'plasma':
      for (let i = 0; i < 5; i++) {
        const angle = spin + (i / 5) * Math.PI * 2;
        fillCircle(ctx, Math.cos(angle) * size * 0.75, Math.sin(angle * 1.7) * size * 0.55, size * 0.22);
      }
      strokeCircle(ctx, 0, 0, size * 0.92);
      break;
    case 'dna':
      ctx.beginPath();
      ctx.moveTo(-size * 0.45, -size);
      ctx.bezierCurveTo(size * 0.4, -size * 0.55, -size * 0.4, size * 0.55, size * 0.45, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.45, -size);
      ctx.bezierCurveTo(-size * 0.4, -size * 0.55, size * 0.4, size * 0.55, -size * 0.45, size);
      ctx.stroke();
      break;
    case 'life':
      ctx.beginPath();
      ctx.ellipse(-size * 0.28, -size * 0.1, size * 0.42, size * 0.25, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(size * 0.32, size * 0.08, size * 0.42, size * 0.25, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.8);
      ctx.lineTo(0, -size * 0.55);
      ctx.stroke();
      break;
    case 'cell':
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.95, size * 0.74, Math.sin(spin) * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      fillCircle(ctx, size * 0.12, -size * 0.05, size * 0.32);
      break;
    case 'neuron':
      fillCircle(ctx, 0, 0, size * 0.36);
      for (let i = 0; i < 4; i++) {
        const angle = spin + (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * size * 1.15, Math.sin(angle) * size * 1.15);
        ctx.stroke();
      }
      break;
    case 'void':
    case 'singularity':
      ctx.fillStyle = '#02030a';
      fillCircle(ctx, 0, 0, size * 0.74);
      ctx.strokeStyle = hexToRgba(item.color, 0.62);
      strokeCircle(ctx, 0, 0, size * (item.glyph === 'singularity' ? 1.2 : 0.98));
      if (item.glyph === 'singularity') strokeCircle(ctx, 0, 0, size * 0.55);
      break;
    case 'bounce':
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.92, 0.3, Math.PI * 1.75);
      ctx.stroke();
      fillCircle(ctx, 0, 0, size * 0.38 * pulse);
      break;
    case 'remnant':
      ctx.strokeStyle = hexToRgba(item.color, 0.75);
      strokeCircle(ctx, 0, 0, size * 0.8);
      ctx.setLineDash([2, 3]);
      strokeCircle(ctx, 0, 0, size * 1.08);
      ctx.setLineDash([]);
      fillCircle(ctx, 0, 0, size * 0.28);
      break;
    case 'entropy':
      for (let i = 0; i < 5; i++) {
        const angle = spin + i * 1.31;
        fillCircle(ctx, Math.cos(angle) * size * (0.35 + i * 0.12), Math.sin(angle) * size * (0.35 + i * 0.1), size * 0.17);
      }
      break;
    case 'antiparticle':
      strokeCircle(ctx, 0, 0, size * 0.9);
      ctx.beginPath();
      ctx.moveTo(-size * 0.45, 0);
      ctx.lineTo(size * 0.45, 0);
      ctx.stroke();
      fillCircle(ctx, 0, 0, size * 0.28);
      break;
    case 'quantum':
    case 'particle':
    default:
      strokeCircle(ctx, 0, 0, size * 0.9);
      fillCircle(ctx, 0, 0, size * 0.3 * pulse);
      fillCircle(ctx, Math.cos(spin) * size * 0.9, Math.sin(spin * 1.4) * size * 0.55, size * 0.16);
      fillCircle(ctx, Math.cos(spin + 2.1) * size * 0.7, Math.sin(spin + 2.1) * size * 0.75, size * 0.14);
      break;
  }

  ctx.restore();
}

export function drawEntities(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  stageId: number,
  purchasedEntities: PurchasedEntityEntry[],
  now: number,
): void {
  if (purchasedEntities.length === 0) return;

  const items: EntityDrawItem[] = [];
  const activeEntities: ActiveEntity[] = [];
  const entitiesById = new Map<string, ActiveEntity>();
  let orderIndex = 0;

  for (const [sourceIndex, entry] of purchasedEntities.entries()) {
    if (entry.count <= 0) continue;
    const entity = findEntityById(entry.entityId, stageId);
    if (!entity) continue;
    const existing = entitiesById.get(entity.id);
    if (existing) {
      existing.count += entry.count;
    } else {
      const active = { entity, count: entry.count, sourceIndex };
      entitiesById.set(entity.id, active);
      activeEntities.push(active);
    }
  }

  for (const { entity, count, sourceIndex } of activeEntities) {
    const visibleCount = Math.min(count, MAX_VISIBLE_PER_ENTITY);
    for (let copyIndex = 0; copyIndex < visibleCount; copyIndex++) {
      items.push({
        id: entity.id,
        name: entity.name,
        formula: entity.formula,
        color: entity.visual.color,
        glowColor: entity.visual.glowColor,
        glyph: entity.visual.glyph,
        rarity: entity.rarity,
        effectType: entity.effect.type,
        ownedCount: count,
        maxCount: entity.maxCount,
        copyIndex,
        orderIndex,
        sourceIndex,
        seed: hashString(`${stageId}:${entity.id}:${sourceIndex}:${copyIndex}`),
      });
      orderIndex += 1;
    }
  }

  if (items.length === 0) return;
  if (items.length > MAX_TOTAL_ENTITY_DRAW) {
    const RARITY_PRIORITY: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
    items.sort((a, b) => (RARITY_PRIORITY[a.rarity] ?? 3) - (RARITY_PRIORITY[b.rarity] ?? 3));
    items.length = MAX_TOTAL_ENTITY_DRAW;
  }

  if (stageId === 11) {
    drawLifeEarthEntities(ctx, cx, cy, items, now);
    return;
  }

  const positions: EntityPosition[] = items.map((item) => {
    const iconSize = ICON_SIZE[item.rarity];
    const glowR = GLOW_RADIUS[item.rarity];
    const isLegend = item.rarity === 'legendary';
    const phase = unit(item.seed, 1) * Math.PI * 2;
    const direction = unit(item.seed, 2) > 0.5 ? 1 : -1;
    const ageSpread = Math.sqrt(item.orderIndex + 1) * 11;
    const formationBreath = Math.sin(now * 0.00032 + phase) * (8 + unit(item.seed, 3) * 16);
    const localWander = 7 + unit(item.seed, 4) * (isLegend ? 24 : 15);
    const radius = Math.min(
      218,
      58 + ageSpread + rarityRadiusOffset(item.rarity) + formationBreath + item.copyIndex * 1.7,
    );
    const angle =
      item.orderIndex * GOLDEN_ANGLE +
      phase * 0.18 +
      now * raritySpeed(item.rarity) * direction +
      Math.sin(now * 0.00021 + phase) * 0.36;
    const epicycleAngle = now * (0.00055 + unit(item.seed, 5) * 0.00065) + phase;
    const braidAngle = angle * (1.6 + unit(item.seed, 6) * 0.9) + now * 0.00018 * direction;
    const x =
      cx +
      Math.cos(angle) * radius +
      Math.cos(epicycleAngle) * localWander +
      Math.cos(braidAngle) * (4 + unit(item.seed, 7) * 10);
    const y =
      cy +
      Math.sin(angle) * (radius * (0.82 + unit(item.seed, 8) * 0.22)) +
      Math.sin(epicycleAngle * 1.13) * localWander +
      Math.sin(braidAngle) * (5 + unit(item.seed, 9) * 9);
    const pulse = isLegend
      ? 1 + Math.sin(now * 0.0016 + phase) * 0.2
      : 1 + Math.sin(now * 0.0011 + phase) * 0.06;

    return {
      item,
      x,
      y,
      size: iconSize * pulse,
      glowRadius: glowR * pulse,
    };
  });

  ctx.save();
  drawGlobalEntityFields(ctx, cx, cy, activeEntities, now);

  ctx.lineWidth = 0.7;
  for (let index = 1; index < positions.length; index += 1) {
    const current = positions[index];
    const previous = positions[index - 1];
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (distance > 170) continue;
    ctx.strokeStyle = hexToRgba(current.item.glowColor, Math.max(0.035, 0.13 - distance / 1800));
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    const midX = (previous.x + current.x) / 2 + Math.sin(now * 0.0004 + current.item.seed) * 8;
    const midY = (previous.y + current.y) / 2 + Math.cos(now * 0.00035 + current.item.seed) * 8;
    ctx.quadraticCurveTo(midX, midY, current.x, current.y);
    ctx.stroke();
  }

  for (const position of positions) {
    const { item, x, y, size, glowRadius } = position;
    const isLegend = item.rarity === 'legendary';
    drawLocalEntityEffect(ctx, position, now);
    ctx.fillStyle = hexToRgba(item.glowColor, isLegend ? 0.18 : 0.10);
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba(item.glowColor, isLegend ? 0.28 : 0.16);
    ctx.beginPath();
    ctx.arc(x, y, glowRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    if (isLegend) {
      ctx.strokeStyle = hexToRgba(item.glowColor, 0.28);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius * 0.76 + Math.sin(now * 0.001 + item.seed) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawEntityGlyph(ctx, item, x, y, size, now);
  }

  ctx.restore();
}
