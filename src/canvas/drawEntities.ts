import { hexToRgba } from '../game/formulas';
import { TUNING, CANVAS_SCALE } from '../game/constants';
import type { EntityEffectType, EntityGlyph, EntityRarity, PurchasedEntityEntry, StageEntity } from '../game/entities/types';
import type { MoteCluster } from '../game/types/canvas';
import { findEntityById } from '../game/entities/stageItems';

// ── Stage 11 entity ID lookup ───────────────────────────────────────────────
// IDs follow `s${stageId}_${index padded to 2 digits}_${slug(name)}`.
const S11 = {
  CRUST:       's11_01_earth_formation',
  MOON:        's11_02_moon_formation',
  OCEAN:       's11_03_first_ocean',
  ATMO:        's11_04_atmosphere',
  CONTINENTS:  's11_05_continents_rise',
  PHOTO:       's11_06_photosynthesis',
  PROKARYOTE:  's11_07_prokaryote',
  CAMBRIAN:    's11_08_cambrian_explosion',
  NEURON:      's11_09_neuron',
  SAPIENS:     's11_10_homo_sapiens',
  CITY_LIGHTS: 's11_11_city_lights',
  SATELLITE:   's11_12_artificial_satellite',
  SPACEFARING: 's11_13_spacefaring_humanity',
  ARK:         's11_14_interstellar_ark',
} as const;

// Persistent velocity cache for entity n-body simulation
const _entityBodyCache = new Map<string, { x: number; y: number; vx: number; vy: number; lastSeen: number }>();
function _getEntityBodyCache() { return _entityBodyCache; }

const ICON_SIZE: Record<EntityRarity, number> = {
  common: 7 * CANVAS_SCALE,
  rare: 10 * CANVAS_SCALE,
  epic: 14 * CANVAS_SCALE,
  legendary: 19 * CANVAS_SCALE,
};

const GLOW_RADIUS: Record<EntityRarity, number> = {
  common: 9 * CANVAS_SCALE,
  rare: 13 * CANVAS_SCALE,
  epic: 18 * CANVAS_SCALE,
  legendary: 28 * CANVAS_SCALE,
};

/**
 * Visible-particle thresholds for the dynamic cap.
 *
 *   - Below VISIBLE_PARTICLE_THRESHOLD: everything you buy is drawn. e.g.
 *     buying 20 commons all show up on screen.
 *   - Above the threshold: rarity caps are walked down using the
 *     REDUCTION_CYCLE pattern (3:2:1 ratio between common, rare, epic).
 *     Common shrinks fastest; legendary never shrinks. This keeps the
 *     early-game lush and only trims when the field is genuinely overcrowded.
 */
const VISIBLE_PARTICLE_THRESHOLD = 80;
const HARD_CEILING = 160;
const RARITY_MAX_VISIBLE: Record<EntityRarity, number> = {
  common: 20,
  rare: 10,
  epic: 5,
  legendary: 1,
};
// Walk-down pattern: take one slot off this rarity each iteration. Length 6,
// containing 3 commons + 2 rares + 1 epic, so the cumulative reduction over
// any window is exactly 3:2:1.
const REDUCTION_CYCLE: ReadonlyArray<EntityRarity> = [
  'common', 'common', 'common', 'rare', 'rare', 'epic',
];
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

// Global quasar jets (center) — stable beam with gentle sway
function drawQuasarJetsGlobal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const angle = now * 0.00015 + strength * 0.7 + Math.sin(now * 0.0004) * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  for (const dir of [-1, 1]) {
    const beam = ctx.createLinearGradient(0, 0, dir * radius, 0);
    beam.addColorStop(0, hexToRgba('#ffffff', 0.12 + strength * 0.15));
    beam.addColorStop(0.25, hexToRgba(color, 0.1 + strength * 0.12));
    beam.addColorStop(0.6, hexToRgba(color, 0.03 + strength * 0.04));
    beam.addColorStop(1, hexToRgba(color, 0));
    ctx.strokeStyle = beam;
    ctx.lineWidth = 2 + strength * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * radius * 0.1, 0);
    ctx.lineTo(dir * radius, 0);
    ctx.stroke();
    // Soft glow
    ctx.lineWidth = (2 + strength * 4) * 3;
    ctx.globalAlpha = 0.12;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.4 + strength * 0.2);
  fillCircle(ctx, 0, 0, 2 + strength * 4);
  ctx.restore();
}

// Per-entity quasar jets — wiggly, animated
function drawQuasarJets(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength: number,
): void {
  const baseAngle = now * 0.0004 + strength * 0.7;
  const wobble = Math.sin(now * 0.001) * 0.35 + Math.sin(now * 0.0017) * 0.2;
  const angle = baseAngle + wobble;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  const segments = 14;
  for (const dir of [-1, 1]) {
    const widthBase = 1.2 + strength * 2.5;
    ctx.beginPath();
    ctx.moveTo(dir * radius * 0.1, 0);
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const xPos = dir * radius * (0.1 + t * 0.9);
      const wiggle = Math.sin(now * 0.003 + t * 9 + dir * 3) * radius * 0.06 * t;
      ctx.lineTo(xPos, wiggle);
    }
    const beam = ctx.createLinearGradient(0, 0, dir * radius, 0);
    beam.addColorStop(0, hexToRgba('#ffffff', 0.1 + strength * 0.12));
    beam.addColorStop(0.2, hexToRgba(color, 0.08 + strength * 0.1));
    beam.addColorStop(0.6, hexToRgba(color, 0.03 + strength * 0.04));
    beam.addColorStop(1, hexToRgba(color, 0));
    ctx.strokeStyle = beam;
    ctx.lineWidth = widthBase;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = widthBase * 2.5;
    ctx.globalAlpha = 0.1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.3 + strength * 0.15);
  fillCircle(ctx, 0, 0, 1.5 + strength * 2.5);
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
  stageId = 2,
): void {
  const t = now * 0.001;
  const pulse = 0.6 + Math.sin(t * 3) * 0.2;

  // Stage-specific flavor: count, colors, speed, wobble
  const chargeCount = stageId <= 2 ? 2 : stageId <= 3 ? 3 : stageId <= 4 ? 4 : 5;
  const spinSpeed = stageId <= 2 ? 0.0012 : stageId <= 3 ? 0.0008 : stageId <= 4 ? 0.0006 : 0.0004;
  const wobbleAmp = stageId <= 2 ? 0.12 : stageId <= 3 ? 0.08 : stageId <= 4 ? 0.05 : 0.03;
  const tubeWave = stageId <= 2 ? 0.18 : stageId <= 3 ? 0.12 : stageId <= 4 ? 0.08 : 0.05;
  const palette = stageId <= 2
    ? ['#ff8844', '#44aaff']                                     // matter vs antimatter pair
    : stageId <= 3
      ? ['#ff5c55', '#57d77a', '#5aa7ff']                        // RGB quark colors
      : stageId <= 4
        ? ['#ffaa44', '#ff6644', '#ffdd66', '#ffcc88']           // warm fusion
        : ['#aa88ff', '#6644cc', '#8866dd', '#bb99ff', '#5533aa']; // cool degenerate
  const spin = now * spinSpeed;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Central confinement glow
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.35);
  coreGrad.addColorStop(0, hexToRgba('#ffffff', 0.15 * pulse * strength));
  coreGrad.addColorStop(0.5, hexToRgba(color, 0.08 * pulse));
  coreGrad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Charges with independent wobble
  const points = Array.from({ length: chargeCount }, (_, i) => {
    const cc = palette[i % palette.length];
    const baseAngle = spin + (i / chargeCount) * Math.PI * 2;
    const wobble = Math.sin(t * (2.5 + i * 0.7) + i * 2.1) * radius * wobbleAmp;
    const orbitR = radius * (0.22 + Math.sin(t * 1.8 + i * 1.3) * 0.06) + wobble;
    return {
      color: cc,
      x: cx + Math.cos(baseAngle) * orbitR,
      y: cy + Math.sin(baseAngle) * orbitR * 0.82,
    };
  });

  // Wavy flux tubes
  ctx.lineWidth = 0.7 + strength * 0.8;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const wave = Math.sin(t * 4 + i * 2.1) * radius * tubeWave;
    const perpX = -(b.y - a.y) / dist * wave;
    const perpY = (b.x - a.x) / dist * wave;
    for (let s = -1; s <= 1; s += 2) {
      ctx.strokeStyle = hexToRgba(a.color, (0.06 + strength * 0.08) * pulse);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx + perpX * s, my + perpY * s, b.x, b.y);
      ctx.stroke();
    }
    // Energy spark
    const sparkT = (t * 2 + i * 0.33) % 1;
    const sx = a.x + (b.x - a.x) * sparkT;
    const sy = a.y + (b.y - a.y) * sparkT;
    ctx.fillStyle = hexToRgba('#ffffff', 0.3 * pulse * strength);
    fillCircle(ctx, sx, sy, 0.6 + strength * 0.5);
  }

  // Charge particles with glow
  for (const point of points) {
    ctx.fillStyle = hexToRgba(point.color, 0.12 + strength * 0.1);
    fillCircle(ctx, point.x, point.y, 2.5 + strength * 3.5);
    ctx.fillStyle = hexToRgba(point.color, 0.45 + strength * 0.35);
    fillCircle(ctx, point.x, point.y, 1.2 + strength * 1.8);
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
      drawColorCharge(ctx, cx, cy, radius * 0.78, col, now, strength, sid);
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
      drawQuasarJetsGlobal(ctx, cx, cy, radius * 1.2, col, now, strength);
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

/** Stage 11: The Moon — screen-space rendering with mares, craters, terminator. */
function drawMoon(
  ctx: CanvasRenderingContext2D,
  mx: number,
  my: number,
  moonRadius: number,
  now: number,
  orbitAngle: number,
  moonFraction: number,
  isBehind: boolean,
  nudgePulse = 0,
): void {
  const depthAlpha = isBehind ? 0.55 : 1.0;
  const nudgeGlow = Math.max(0, Math.min(1, nudgePulse));

  ctx.save();

  // Soft outer glow — extra intensity when user just nudged the moon
  ctx.globalCompositeOperation = 'lighter';
  const glowR = moonRadius * (3.0 + nudgeGlow * 1.4);
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, glowR);
  glow.addColorStop(0, hexToRgba('#fff0d8', (0.22 + moonFraction * 0.18 + nudgeGlow * 0.30) * depthAlpha));
  glow.addColorStop(0.4, hexToRgba('#d8c89c', 0.08 * depthAlpha));
  glow.addColorStop(1, hexToRgba('#887860', 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Moon body — pearlescent gradient
  ctx.beginPath();
  ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(
    mx - moonRadius * 0.32, my - moonRadius * 0.32, moonRadius * 0.05,
    mx, my, moonRadius,
  );
  bodyGrad.addColorStop(0, `rgba(238, 230, 210, ${0.98 * depthAlpha})`);
  bodyGrad.addColorStop(0.45, `rgba(196, 188, 168, ${0.95 * depthAlpha})`);
  bodyGrad.addColorStop(0.78, `rgba(140, 132, 116, ${0.92 * depthAlpha})`);
  bodyGrad.addColorStop(1, `rgba(78, 72, 60, ${0.9 * depthAlpha})`);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
  ctx.clip();

  // Lunar maria — large dark patches (Mare Imbrium, Tranquillitatis, Serenitatis…)
  const mares = [
    { ox: -0.10, oy: -0.20, rx: 0.42, ry: 0.30, a: 0.22 },
    { ox:  0.18, oy: -0.06, rx: 0.28, ry: 0.24, a: 0.20 },
    { ox: -0.22, oy:  0.18, rx: 0.32, ry: 0.20, a: 0.18 },
    { ox:  0.06, oy:  0.30, rx: 0.20, ry: 0.16, a: 0.16 },
  ];
  for (const m of mares) {
    const mareGrad = ctx.createRadialGradient(
      mx + m.ox * moonRadius, my + m.oy * moonRadius, 0,
      mx + m.ox * moonRadius, my + m.oy * moonRadius, m.rx * moonRadius,
    );
    mareGrad.addColorStop(0, `rgba(58, 54, 48, ${m.a * depthAlpha})`);
    mareGrad.addColorStop(1, 'rgba(58, 54, 48, 0)');
    ctx.fillStyle = mareGrad;
    ctx.beginPath();
    ctx.ellipse(mx + m.ox * moonRadius, my + m.oy * moonRadius, m.rx * moonRadius, m.ry * moonRadius, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Craters (10 — both rims and floors)
  const craters = [
    { ox:  0.28, oy: -0.22, r: 0.18 },
    { ox: -0.34, oy:  0.20, r: 0.15 },
    { ox:  0.06, oy:  0.36, r: 0.12 },
    { ox: -0.18, oy: -0.30, r: 0.10 },
    { ox:  0.42, oy:  0.10, r: 0.085 },
    { ox: -0.05, oy: -0.55, r: 0.075 },
    { ox:  0.50, oy: -0.30, r: 0.065 },
    { ox: -0.46, oy: -0.05, r: 0.06 },
    { ox:  0.32, oy:  0.45, r: 0.055 },
    { ox: -0.10, oy:  0.58, r: 0.05 },
  ];
  for (const c of craters) {
    const crX = mx + c.ox * moonRadius;
    const crY = my + c.oy * moonRadius;
    const crR = c.r * moonRadius;
    // Floor (darker)
    ctx.fillStyle = `rgba(52, 48, 38, ${0.34 * depthAlpha})`;
    ctx.beginPath();
    ctx.arc(crX, crY, crR, 0, Math.PI * 2);
    ctx.fill();
    // Bright rim arc on the sun-facing side
    ctx.strokeStyle = `rgba(232, 224, 198, ${0.32 * depthAlpha})`;
    ctx.lineWidth = Math.max(0.5, crR * 0.18);
    ctx.beginPath();
    ctx.arc(crX, crY, crR * 1.02, Math.PI * 0.85, Math.PI * 1.85);
    ctx.stroke();
    // Bright inner highlight on the opposite side
    ctx.fillStyle = `rgba(232, 224, 198, ${0.18 * depthAlpha})`;
    ctx.beginPath();
    ctx.arc(crX + crR * 0.18, crY + crR * 0.18, crR * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Phase shadow — driven by the orbit angle so day side faces 'sun'
  const shadowDir = orbitAngle + 0.85;
  const sg = ctx.createLinearGradient(
    mx + Math.cos(shadowDir) * moonRadius,
    my + Math.sin(shadowDir) * moonRadius,
    mx - Math.cos(shadowDir) * moonRadius * 0.55,
    my - Math.sin(shadowDir) * moonRadius * 0.55,
  );
  sg.addColorStop(0, 'rgba(4, 6, 20, 0)');
  sg.addColorStop(0.30, 'rgba(4, 6, 20, 0.10)');
  sg.addColorStop(0.65, 'rgba(4, 6, 20, 0.46)');
  sg.addColorStop(1, 'rgba(4, 6, 20, 0.74)');
  ctx.fillStyle = sg;
  ctx.fillRect(mx - moonRadius - 1, my - moonRadius - 1, moonRadius * 2 + 2, moonRadius * 2 + 2);

  ctx.restore(); // exits moon clip
  ctx.restore();

  // Subtle click feedback ring (decays toward zero each frame)
  if (nudgeGlow > 0.02) {
    ctx.save();
    ctx.strokeStyle = hexToRgba('#fff4c8', 0.6 * nudgeGlow);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(mx, my, moonRadius * (1.2 + (1 - nudgeGlow) * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Mark `now` as used so the signature stays stable for future tweaks.
  void now;
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

  // Aurora ribbons — soft feathered strokes instead of hard rectangular strips.
  const auroraColors = ['#3affb4', '#74cfff', '#a8ff88'];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let band = 0; band < 3; band++) {
    const baseY = cy + (band - 1) * radius * 0.72 + Math.sin(now * 0.00025 + band * 2.0) * radius * 0.22;
    const hue = auroraColors[band];
    const pulse = 0.45 + Math.sin(now * 0.0007 + band * 1.4) * 0.55;
    const bandH = radius * (0.32 + Math.cos(now * 0.00032 + band) * 0.08);
    const ribbonCount: number = 7;
    const xStart = cx - radius * 1.52;
    const xEnd = cx + radius * 1.52;

    for (let layer = 0; layer < ribbonCount; layer += 1) {
      const centered = ribbonCount === 1 ? 0 : (layer / (ribbonCount - 1)) * 2 - 1;
      const feather = Math.pow(1 - Math.abs(centered), 1.65);
      if (feather <= 0) continue;

      const layerPhase = now * (0.00028 + layer * 0.000018) + band * 2.7 + layer * 0.91;
      const yBase =
        baseY +
        centered * bandH * 0.58 +
        Math.sin(layerPhase) * radius * 0.035;
      const alpha = (0.014 + lifePower * 0.045) * pulse * feather;
      const grad = ctx.createLinearGradient(xStart, yBase, xEnd, yBase);
      grad.addColorStop(0, hexToRgba(hue, 0));
      grad.addColorStop(0.18, hexToRgba(hue, alpha * 0.28));
      grad.addColorStop(0.48, hexToRgba(hue, alpha));
      grad.addColorStop(0.72, hexToRgba(hue, alpha * 0.52));
      grad.addColorStop(1, hexToRgba(hue, 0));

      ctx.strokeStyle = grad;
      ctx.lineWidth = bandH * (0.09 + feather * 0.08);
      ctx.beginPath();
      ctx.moveTo(xStart, yBase + Math.sin(layerPhase - 0.8) * radius * 0.035);
      for (let step = 1; step <= 6; step += 1) {
        const t = step / 6;
        const x = xStart + (xEnd - xStart) * t;
        const prevT = (step - 0.5) / 6;
        const controlX = xStart + (xEnd - xStart) * prevT;
        const controlY =
          yBase +
          Math.sin(layerPhase + prevT * Math.PI * 3.1) * radius * (0.04 + lifePower * 0.025) +
          Math.cos(now * 0.00017 + band + layer * 1.9 + prevT * 5) * radius * 0.018;
        const y =
          yBase +
          Math.sin(layerPhase + t * Math.PI * 3.1) * radius * (0.032 + lifePower * 0.018);
        ctx.quadraticCurveTo(controlX, controlY, x, y);
      }
      ctx.stroke();
    }
  }

  // Subtle neural web — faint dots only, no connecting lines
  const nodeCount = 8 + Math.floor(lifePower * 10);
  const pts = Array.from({ length: nodeCount }, (_, i) => {
    const a = (i / nodeCount) * Math.PI * 2 + Math.sin(now * 0.000048 + i * 0.82) * 0.18;
    const dist = radius * (0.4 + unit(i + 200, 60) * 0.7);
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a * 1.1) * dist * 0.8 };
  });

  for (let i = 0; i < nodeCount; i++) {
    const flicker = 0.3 + Math.sin(now * 0.0004 + i * 1.3) * 0.3;
    ctx.fillStyle = hexToRgba('#7dffaa', flicker * lifePower * 0.12);
    fillCircle(ctx, pts[i].x, pts[i].y, 0.8 + lifePower * 1.2);
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
    'spacefaring',
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
    // Simple body + solar panels (no triangle/beam)
    ctx.lineWidth = Math.max(0.6, size * 0.08);
    ctx.fillRect(-size * 0.3, -size * 0.15, size * 0.6, size * 0.3);
    ctx.fillStyle = hexToRgba('#74cfff', 0.35);
    ctx.fillRect(-size * 0.8, -size * 0.1, size * 0.4, size * 0.2);
    ctx.fillRect(size * 0.4, -size * 0.1, size * 0.4, size * 0.2);
  } else if (textHas(text, 'probe', 'lander', 'ark')) {
    // Compact spacecraft — small body + dish antenna + faint thruster glow
    ctx.lineWidth = Math.max(0.6, size * 0.08);
    // Body
    ctx.fillRect(-size * 0.2, -size * 0.15, size * 0.4, size * 0.3);
    ctx.strokeRect(-size * 0.2, -size * 0.15, size * 0.4, size * 0.3);
    // Solar panels
    ctx.fillStyle = hexToRgba('#74cfff', 0.35);
    ctx.fillRect(-size * 0.7, -size * 0.1, size * 0.4, size * 0.2);
    ctx.fillRect(size * 0.3, -size * 0.1, size * 0.4, size * 0.2);
    // Dish antenna
    ctx.strokeStyle = hexToRgba('#ffffff', 0.5);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(size * 0.2, -size * 0.3, size * 0.18, Math.PI * 0.7, Math.PI * 1.3);
    ctx.stroke();
    // Faint thruster dot
    const glow = 0.3 + Math.sin(now * 0.005 + item.seed) * 0.15;
    ctx.fillStyle = hexToRgba('#88ccff', glow);
    ctx.beginPath();
    ctx.arc(-size * 0.28, 0, size * 0.06, 0, Math.PI * 2);
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
  pointerPressure?: PointerPressureVisualField | null,
): void {
  if (items.length === 0) return;

  const techLevel = Math.min(1, items.length / 6);
  ctx.save();

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
    const dir = isFreeFlight ? 1 : (unit(seed, 83) > 0.5 ? 1 : -1);
    const angle = now * speed * dir + unit(seed, 84) * Math.PI * 2;
    const tilt = 0.44 + unit(seed, 85) * 0.2;
    const x = cx + Math.cos(angle) * orbitR;
    const y = cy + Math.sin(angle) * orbitR * tilt + Math.sin(now * 0.00055 + seed) * (isFreeFlight ? 9 : 3);
    return { item, x, y, angle, orbitR, isFreeFlight };
  });

  for (const position of positions) {
    const { item, angle, orbitR, isFreeFlight } = position;
    const pushed = applyPointerVisualDisplacement(position.x, position.y, pointerPressure, 14);
    const x = pushed.x;
    const y = pushed.y;
    const text = itemText(item);
    const size =
      item.rarity === 'legendary'
        ? 16 + Math.sin(now * 0.001 + item.seed) * 1.5
        : item.rarity === 'epic'
          ? 12
          : 8.5;

    // Subtle orbit glow dot for telescope/observatory (no beam)
    if (textHas(text, 'telescope', 'observatory')) {
      ctx.fillStyle = hexToRgba(item.color, 0.12);
      ctx.beginPath();
      ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
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

    // Soft glow (reduced to avoid bright beams)
    const glowR = size * 3;
    const glowAlpha = item.rarity === 'legendary' ? 0.25 : 0.15;
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

    const nameL = item.name.toLowerCase();

    // ── Spacefaring Humanity — Dyson Sphere wrapping Earth ──
    if (nameL.includes('spacefaring')) {
      const t = now * 0.001;
      const dysonR = earthRadius * 1.25;
      ctx.save();
      ctx.translate(cx, cy);
      // 3 rotating Dyson swarm rings around the planet
      for (let ring = 0; ring < 3; ring++) {
        const ringAngle = t * (0.2 + ring * 0.12) + ring * 2.1;
        const tilt = 0.35 + ring * 0.2;
        const pulse = 0.5 + Math.sin(t * 1.5 + ring * 1.2) * 0.3;
        ctx.strokeStyle = hexToRgba('#ffd866', 0.3 * pulse);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, dysonR + ring * 8, (dysonR + ring * 8) * tilt, ringAngle, 0, Math.PI * 2);
        ctx.stroke();
        // Energy collection panels
        for (let p = 0; p < 8; p++) {
          const pa = ringAngle + p * (Math.PI * 2 / 8);
          const pr = dysonR + ring * 8;
          const panelX = Math.cos(pa) * pr;
          const panelY = Math.sin(pa) * pr * tilt;
          ctx.fillStyle = hexToRgba('#ffe888', 0.35 * pulse);
          fillCircle(ctx, panelX, panelY, 1.8);
        }
      }
      // Faint golden energy halo
      ctx.fillStyle = hexToRgba('#ffd866', 0.04 + Math.sin(t * 0.8) * 0.02);
      fillCircle(ctx, 0, 0, dysonR + 20);
      ctx.restore();
      // Small glyph at orbital position
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = hexToRgba('#ffe888', 0.8);
      fillCircle(ctx, 0, 0, 3);
      ctx.restore();
    }
    // ── Interstellar Ark — small glowing dot with faint trail ──
    else if (nameL.includes('ark')) {
      const t = now * 0.001;
      ctx.save();
      ctx.translate(x, y);
      const heading = angle + Math.PI / 2 + Math.sin(t * 0.35) * 0.25;
      ctx.rotate(heading);
      const s = size * 1.2;

      // Short engine glow (radial, no beam)
      const engineGrad = ctx.createRadialGradient(-s * 1.3, 0, 0, -s * 1.3, 0, s * 0.8);
      engineGrad.addColorStop(0, hexToRgba('#66bbff', 0.25));
      engineGrad.addColorStop(1, hexToRgba('#2255aa', 0));
      ctx.fillStyle = engineGrad;
      fillCircle(ctx, -s * 1.3, 0, s * 0.8);

      // Main hull — sleek diamond shape
      ctx.fillStyle = hexToRgba('#d0dce8', 0.82);
      ctx.beginPath();
      ctx.moveTo(s * 1.8, 0);
      ctx.lineTo(s * 0.3, -s * 0.55);
      ctx.lineTo(-s * 1.2, -s * 0.25);
      ctx.lineTo(-s * 1.2, s * 0.25);
      ctx.lineTo(s * 0.3, s * 0.55);
      ctx.closePath();
      ctx.fill();

      // Hull center stripe
      ctx.fillStyle = hexToRgba('#a8c4e0', 0.6);
      ctx.beginPath();
      ctx.moveTo(s * 1.5, 0);
      ctx.lineTo(s * 0.2, -s * 0.18);
      ctx.lineTo(-s * 1.0, -s * 0.1);
      ctx.lineTo(-s * 1.0, s * 0.1);
      ctx.lineTo(s * 0.2, s * 0.18);
      ctx.closePath();
      ctx.fill();

      // Cockpit window
      ctx.fillStyle = hexToRgba('#aaeeff', 0.7);
      ctx.beginPath();
      ctx.ellipse(s * 1.2, 0, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Habitat ring
      ctx.strokeStyle = hexToRgba('#88bbff', 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.65, s * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const la = t * 0.6 + i * (Math.PI * 2 / 6);
        ctx.fillStyle = hexToRgba('#cceeff', 0.35 + Math.sin(t * 1.5 + i) * 0.15);
        fillCircle(ctx, Math.cos(la) * s * 0.6, Math.sin(la) * s * 0.6, 1.0);
      }

      // Nav lights
      const navBlink = Math.sin(t * 4) > 0.3 ? 0.8 : 0.2;
      ctx.fillStyle = hexToRgba('#ff4444', navBlink);
      fillCircle(ctx, s * 0.3, -s * 0.52, 1.0);
      ctx.fillStyle = hexToRgba('#44ff44', navBlink);
      fillCircle(ctx, s * 0.3, s * 0.52, 1.0);
      ctx.restore();
    }
    // ── Generic orbital entity ──
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + (isFreeFlight ? 0 : Math.PI / 2));
      drawSpacecraftBody(ctx, item, size, now);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ── Stage 11: lookup helpers ────────────────────────────────────────────────
interface S11Lookup {
  has: (id: string) => boolean;
  count: (id: string) => number;
}

function makeS11Lookup(items: EntityDrawItem[]): S11Lookup {
  const counts = new Map<string, number>();
  for (const it of items) {
    if (!counts.has(it.id)) counts.set(it.id, it.ownedCount);
  }
  return {
    has: (id) => (counts.get(id) ?? 0) > 0,
    count: (id) => counts.get(id) ?? 0,
  };
}

function stage11MoonAngle(now: number, cluster?: MoteCluster | null): number {
  return now * 0.00022 + (cluster?.moonAngleOffset ?? 0);
}

const STAGE11_MOON_ORBIT_TILT = 0.34;

function stage11MoonOrbitRadius(earthR: number): number {
  return earthR * 1.95;
}

function stage11MoonBodyRadius(earthR: number, moonCount: number): number {
  // Grows gradually across full maxCount (20 for common)
  const grow = Math.min(1, moonCount / 20);
  return earthR * (0.08 + grow * 0.24);
}

export interface Stage11MoonScreen {
  cx: number;
  cy: number;
  earthR: number;
  moonX: number;
  moonY: number;
  moonR: number;
  isBehind: boolean;
  visible: boolean;
}

export function getStage11MoonScreen(
  cx: number,
  cy: number,
  now: number,
  cluster: MoteCluster | null | undefined,
  purchasedEntities: PurchasedEntityEntry[],
): Stage11MoonScreen {
  const earthR = TUNING.LIFE_SURFACE_R;
  let moonCount = 0;
  for (const entry of purchasedEntities) {
    const ent = findEntityById(entry.entityId, 11);
    if (ent && ent.id === S11.MOON) moonCount += entry.count;
  }
  const angle = stage11MoonAngle(now, cluster);
  const dist = stage11MoonOrbitRadius(earthR);
  const moonR = stage11MoonBodyRadius(earthR, moonCount);
  const moonX = cx + Math.cos(angle) * dist;
  const moonY = cy + Math.sin(angle) * dist * STAGE11_MOON_ORBIT_TILT;
  return {
    cx,
    cy,
    earthR,
    moonX,
    moonY,
    moonR,
    isBehind: Math.sin(angle) < 0,
    visible: moonCount > 0,
  };
}

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function drawLifeEarthEntities(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  items: EntityDrawItem[],
  now: number,
  pointerPressure?: PointerPressureVisualField | null,
  cluster?: MoteCluster | null,
): void {
  const R = TUNING.LIFE_SURFACE_R;
  // Earth rotation: prefer the shared cluster counter so day/night stays in
  // sync with the sim, otherwise fall back to a derived spin from `now`.
  const earthSpin = cluster?.earthRotation !== undefined
    ? cluster.earthRotation * 12 + now * 0.0006
    : now * 0.0009;

  const L = makeS11Lookup(items);

  // Raw counts (0..20 for commons, 0..10 rares, 0..5 epics, 0..3 legendaries).
  const crustC      = L.count(S11.CRUST);
  const oceanC      = L.count(S11.OCEAN);
  const atmoC       = L.count(S11.ATMO);
  const moonC       = L.count(S11.MOON);
  const proC        = L.count(S11.PROKARYOTE);
  const photoC      = L.count(S11.PHOTO);
  const cambrianC   = L.count(S11.CAMBRIAN);
  const contC       = L.count(S11.CONTINENTS);
  const neuronC     = L.count(S11.NEURON);
  const sapiensC    = L.count(S11.SAPIENS);
  const cityC       = L.count(S11.CITY_LIGHTS);
  const satC        = L.count(S11.SATELLITE);

  const hasCrust   = crustC > 0;
  const hasOcean   = oceanC > 0;
  const hasAtmo    = atmoC > 0;
  const hasMoon    = moonC > 0;
  const hasPhoto   = photoC > 0;
  const hasContinents = contC > 0 || cambrianC > 0; // Cambrian implies surface land
  const hasNeuron  = neuronC > 0;
  const hasSapiens = sapiensC > 0;
  const hasCity    = cityC > 0 || hasSapiens;
  const hasSat     = satC > 0;

  // 0..1 ramps. Each one scales smoothly across the full common (×20) range,
  // so the visual change keeps deepening every click instead of plateauing
  // after a couple of purchases.
  const crustGrow    = smoothstep01(crustC / 20);      // 0..1 over 20 clicks
  const oceanGrow    = smoothstep01(oceanC / 20);
  const atmoGrow     = smoothstep01(atmoC / 20);
  const moonGrow     = smoothstep01(moonC / 20);
  const photoGrow    = smoothstep01(photoC / 10);      // rare → 10 max
  const sapiensGrow  = smoothstep01(sapiensC / 5);     // epic → 5 max
  const cityGrow     = smoothstep01((cityC * 2 + sapiensC) / 10);
  const satGrow      = smoothstep01(satC / 5);

  // Entity-count budgets that ramp with purchases.
  const dustClumps   = Math.max(0, Math.min(20, crustC * 2 + 6));   // accretion debris
  // Earth size scales for the ENTIRE 1→20 range so every Earth Formation
  // purchase makes the planet visibly bigger. count=1 ≈ small proto-Earth
  // (~22% radius), count=20 = full radius R.
  const sphereR      = hasCrust
    ? R * (0.22 + 0.78 * smoothstep01(crustC / 20))
    : 0;
  const oceanBlobs   = Math.min(22, oceanC * 2);                     // pools growing into seas
  const atmoLayers   = Math.min(4, 1 + Math.floor(atmoC / 5));       // halo intensity steps
  const cloudCount   = Math.min(12, Math.floor(atmoC * 0.7));        // clouds appear over time
  const cambrianN    = Math.min(12, cambrianC);
  const proN         = Math.min(20, proC * 2);
  const neuronMesh   = Math.min(14, neuronC);
  const continentsN  = hasContinents ? Math.min(7, Math.max(2, contC + Math.floor(cambrianC / 3))) : 0;
  const cityN        = Math.min(40, cityC * 4 + sapiensC * 3);
  const buildingN    = Math.min(18, sapiensC * 3);                   // tiny buildings
  const satN         = Math.min(6, 1 + satC);

  // Hover wiggle helper — surface points drift away from the cursor (or are
  // tugged by the satellite-amplified scan ripple). Returns a displaced
  // (x, y) plus a 0..1 falloff for opacity/size tweaks.
  const wiggleAmount = (hasSat ? 7 : 2.4) * (1 + satGrow * 1.4);
  const applyWiggle = (x: number, y: number) =>
    pointerPressure && pointerPressure.strength > 0
      ? applyPointerVisualDisplacement(x, y, pointerPressure, wiggleAmount)
      : { x, y, falloff: 0 };

  // ── Pre-stage: no entities yet → primordial accretion dust ───────────────
  if (!hasCrust && !hasOcean && !hasAtmo && !hasMoon && items.length === 0) {
    const cloudR = R * 1.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const swirl = ctx.createRadialGradient(
        cx + Math.cos(now * 0.0002 + i) * R * 0.18,
        cy + Math.sin(now * 0.00018 + i * 1.7) * R * 0.18,
        0,
        cx, cy, cloudR,
      );
      swirl.addColorStop(0, hexToRgba('#d8b890', 0.06));
      swirl.addColorStop(1, hexToRgba('#3a2a1a', 0));
      ctx.fillStyle = swirl;
      fillCircle(ctx, cx, cy, cloudR);
    }
    ctx.restore();
    return;
  }

  // ── Canvas-wide neural ambient (after Neuron purchased) ──────────────────
  if (hasNeuron || hasSapiens) {
    drawLifeCanvasAmbient(ctx, cx, cy, R, items, now);
  }

  // ── Moon orbit geometry ──────────────────────────────────────────────────
  const moonAngle = stage11MoonAngle(now, cluster);
  const moonDist = stage11MoonOrbitRadius(R);
  const moonR = stage11MoonBodyRadius(R, moonC);
  const moonX = cx + Math.cos(moonAngle) * moonDist;
  const moonY = cy + Math.sin(moonAngle) * moonDist * STAGE11_MOON_ORBIT_TILT;
  const moonBehind = Math.sin(moonAngle) < 0;
  const moonNudgePulse = Math.max(0, Math.min(1, cluster?.moonNudgeImpulse ?? 0));

  // Moon behind Earth — drawn before Earth body
  if (hasMoon && moonBehind) {
    drawMoon(ctx, moonX, moonY, moonR, now, moonAngle, moonGrow, true, moonNudgePulse);
  }

  // Moon orbit guide (only when moon owned)
  if (hasMoon) {
    ctx.save();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.05);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, moonDist, moonDist * STAGE11_MOON_ORBIT_TILT, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Atmosphere — grows progressively. The first click drops one faint
  // wisp; each subsequent click adds another wisp and thickens the halo,
  // so the atmosphere wraps the planet gradually instead of popping in.
  if (hasAtmo && sphereR > 0.5) {
    // Linear "level" 0..1 so very low atmoC stays very subtle.
    const atmoLevel = Math.min(1, atmoC / 20);
    const haloR = sphereR * (1.10 + atmoLevel * 0.35);
    // Full halo gradient — alpha scales strongly with atmoLevel so level 1
    // is almost invisible and level 20 is a thick blue envelope.
    const ag = ctx.createRadialGradient(cx, cy, sphereR * 0.94, cx, cy, haloR);
    ag.addColorStop(0, hexToRgba('#7ec0ff', 0.12 + atmoLevel * 0.30));
    ag.addColorStop(0.5, hexToRgba('#3c80d8', 0.06 + atmoLevel * 0.18));
    ag.addColorStop(1, hexToRgba('#1c4080', 0));
    ctx.fillStyle = ag;
    fillCircle(ctx, cx, cy, haloR);

    // Wisp ribbons — one per purchased atmosphere level (up to ~8), each
    // anchored at a fixed angle so successive purchases add new streaks.
    const wispCount = Math.min(8, atmoC);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < wispCount; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + unit(i + 1300, 1) * 0.6;
      const arcStart = angle - 0.55;
      const arcEnd = angle + 0.55;
      const wispR = sphereR * (1.04 + atmoLevel * 0.12);
      const breathe = 0.4 + Math.sin(now * 0.0008 + i * 1.7) * 0.4;
      const alpha = (0.06 + atmoLevel * 0.10) * breathe;
      ctx.strokeStyle = hexToRgba('#a8d8ff', alpha);
      ctx.lineWidth = sphereR * (0.02 + atmoLevel * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, wispR, arcStart, arcEnd);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Earth body (clipped to the *current* sphere size, not fixed R) ──────
  if (sphereR > 0.5) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, sphereR, 0, Math.PI * 2);
  ctx.clip();

  // Base layer is ALWAYS the rocky planet (lava → cooled rock as crustGrow
  // ramps). The ocean is rendered on top as progressively-painted patches
  // below so the player sees water spread across the surface click by click,
  // instead of the planet flipping to blue the moment First Ocean is bought.
  const baseGrad = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.28, R * 0.06, cx, cy, R);
  if (hasCrust) {
    const heat = 1 - crustGrow * 0.55;
    baseGrad.addColorStop(0, `rgb(${Math.round(120 + heat * 80)}, ${Math.round(60 + heat * 30)}, ${Math.round(30 + heat * 12)})`);
    baseGrad.addColorStop(1, `rgb(${Math.round(56 + heat * 22)}, ${Math.round(24 + heat * 10)}, ${Math.round(12 + heat * 4)})`);
  } else {
    baseGrad.addColorStop(0, '#1a1a1a');
    baseGrad.addColorStop(1, '#0a0a0a');
  }
  ctx.fillStyle = baseGrad;
  fillCircle(ctx, cx, cy, R);

  // Ocean — gradual blue wash over the entire planet, then continents rise above it
  if (oceanC > 0) {
    // Full-sphere ocean wash that fades in smoothly with each purchase
    const washAlpha = Math.min(0.88, oceanGrow * 0.92);
    ctx.fillStyle = hexToRgba('#1a5a9e', washAlpha);
    fillCircle(ctx, cx, cy, sphereR);
    // Deeper ocean gradient for depth
    if (oceanGrow > 0.3) {
      const deepA = Math.min(0.5, (oceanGrow - 0.3) * 0.7);
      ctx.fillStyle = hexToRgba('#0a3060', deepA);
      fillCircle(ctx, cx, cy, sphereR * 0.85);
    }
    // Specular highlight on water
    ctx.fillStyle = hexToRgba('#5abaff', 0.08 + oceanGrow * 0.06);
    ctx.beginPath();
    ctx.ellipse(cx - sphereR * 0.2, cy - sphereR * 0.25, sphereR * 0.4, sphereR * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lava veins on a crust that hasn't cooled into ocean yet
  if (hasCrust && !hasOcean) {
    const veinIntensity = 1 - crustGrow * 0.5;
    for (let i = 0; i < 9; i += 1) {
      const a = earthSpin * 0.35 + i * 0.78 + unit(i + 500, 1) * 1.6;
      const r = R * (0.18 + unit(i + 510, 2) * 0.62);
      const vx = cx + Math.cos(a) * r;
      const vy = cy + Math.sin(a) * r * 0.95;
      const flicker = 0.25 + Math.sin(now * 0.0042 + i * 1.7) * 0.15;
      ctx.fillStyle = hexToRgba('#ff5a14', flicker * veinIntensity);
      fillCircle(ctx, vx, vy, R * (0.05 + unit(i + 511, 3) * 0.05));
    }
  }

  // Ocean wave shimmer over the base (only when ocean is unlocked)
  if (hasOcean) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i += 1) {
      const ripple = 0.06 + Math.sin(now * 0.0008 + i * 2.1) * 0.05;
      ctx.fillStyle = hexToRgba('#7ec8ff', ripple * (0.4 + oceanGrow * 0.6));
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 0.08, R * 0.78, R * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Continents — Pangaea → modern continents
  // contC=1: single Pangaea blob, contC grows → continents drift apart
  if (continentsN > 0) {
    const drift = Math.min(1, Math.max(0, (contC - 1) / 6));
    const sizeGrow = Math.min(1, contC / 3);
    // Fixed continent positions (screen-space, no rotation — always visible)
    // x/y are offsets from center as fraction of R
    const PANGAEA = [
      // Pangaea position (clustered)     Modern position (spread)
      { px: 0.05, py: -0.05, mx: -0.10, my: -0.10, w: 0.28, h: 0.32, rot: 0.1 },   // Africa
      { px: -0.10, py: 0.0,  mx: -0.50, my: -0.05, w: 0.20, h: 0.40, rot: -0.1 },   // Americas
      { px: 0.10, py: 0.15,  mx: 0.10,  my: 0.30,  w: 0.35, h: 0.16, rot: 0.05 },   // Eurasia
      { px: 0.15, py: -0.15, mx: 0.42,  my: -0.30, w: 0.12, h: 0.12, rot: 0.3 },    // Australia
      { px: 0.0,  py: -0.25, mx: 0.0,   my: -0.52, w: 0.24, h: 0.08, rot: 0 },      // Antarctica
      { px: 0.12, py: 0.05,  mx: 0.25,  my: 0.05,  w: 0.10, h: 0.14, rot: 0.2 },    // India
      { px: -0.08, py: 0.12, mx: -0.32, my: 0.22,  w: 0.08, h: 0.10, rot: -0.1 },   // Islands
    ];
    const visibleCount = Math.min(PANGAEA.length, continentsN);

    // Color: brown rock → green with photosynthesis
    const gr = Math.round(110 - photoGrow * 40);
    const gg = Math.round(82 + photoGrow * 35);
    const gb = Math.round(50 + photoGrow * 10);
    const landColor = `rgb(${gr}, ${gg}, ${gb})`;

    for (let i = 0; i < visibleCount; i++) {
      const c = PANGAEA[i];
      // Interpolate between Pangaea (clustered) and modern (spread) positions
      const lx = cx + (c.px + (c.mx - c.px) * drift) * R;
      const ly = cy + (c.py + (c.my - c.py) * drift) * R;
      const cw = R * c.w * (0.3 + sizeGrow * 0.7);
      const ch = R * c.h * (0.3 + sizeGrow * 0.7);
      const alpha = Math.min(0.92, sizeGrow * 0.95);

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(c.rot);
      // Main landmass
      ctx.fillStyle = hexToRgba(landColor, alpha);
      ctx.beginPath();
      ctx.ellipse(0, 0, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sub-lobe for natural coastline
      ctx.beginPath();
      ctx.ellipse(cw * 0.25, ch * -0.15, cw * 0.45, ch * 0.55, 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Mountain highlight
      if (sizeGrow > 0.5) {
        ctx.fillStyle = hexToRgba('#a08860', 0.15 * sizeGrow);
        ctx.beginPath();
        ctx.ellipse(0, ch * -0.1, cw * 0.3, ch * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Photosynthesis — soft watercolor green brush blooms across the surface,
  // anchored to fixed lat/lon and gently breathing in/out over a few seconds.
  // Replaces the harsh elliptical green overlay so it looks painted on.
  if (hasPhoto) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strokes = Math.min(28, Math.floor(8 + photoGrow * 22));
    for (let i = 0; i < strokes; i += 1) {
      const lon = i * 0.74 + unit(i + 1100, 1) * 6 + earthSpin * 0.18;
      const lat = (unit(i + 1101, 2) - 0.5) * 1.4;
      const visible = Math.cos(lon) * Math.cos(lat);
      if (visible < -0.1) continue;
      const bx = cx + Math.cos(lon) * R * 0.64 * Math.cos(lat);
      const by = cy + Math.sin(lat) * R * 0.68;
      const bloomT = ((now * 0.0004 + unit(i + 1102, 3) * 8) % 4) / 4;
      const bloom = bloomT * bloomT * (3 - 2 * bloomT);
      const len = R * (0.04 + unit(i + 1103, 4) * 0.10) * (0.4 + photoGrow * 0.6) * (0.6 + bloom * 0.4);
      const wid = len * (0.5 + unit(i + 1104, 5) * 0.3);
      const tilt = unit(i + 1105, 6) * Math.PI;
      const greens = ['#3fcf6f', '#5be08a', '#2da556', '#7ff0a4'];
      const tint = greens[i % greens.length];
      ctx.fillStyle = hexToRgba(tint, 0.18 * (0.3 + photoGrow * 0.5));
      ctx.beginPath();
      ctx.ellipse(bx, by, len, wid, tilt, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Prokaryote — drifting microbial particles near Earth core. Each one
  // floats on a small, near-stationary orbit, bobs gently, glows softly, and
  // slides away from the cursor (with satellite amplifying the effect).
  if (proN > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < proN; i += 1) {
      const orbitR = R * (0.08 + unit(i + 1200, 1) * 0.38);
      const angle = now * (0.00016 + unit(i + 1201, 2) * 0.0002) + unit(i + 1202, 3) * 6.28;
      const bobY = Math.sin(now * 0.0009 + i * 1.7) * R * 0.04;
      const baseX = cx + Math.cos(angle) * orbitR;
      const baseY = cy + Math.sin(angle) * orbitR * 0.85 + bobY;
      const w = applyWiggle(baseX, baseY);
      const flick = 0.55 + Math.sin(now * 0.003 + i * 1.7) * 0.3;
      // Soft halo
      const halo = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 6 + w.falloff * 5);
      halo.addColorStop(0, hexToRgba('#9affc8', 0.40 + w.falloff * 0.25));
      halo.addColorStop(1, hexToRgba('#9affc8', 0));
      ctx.fillStyle = halo;
      fillCircle(ctx, w.x, w.y, 6 + w.falloff * 5);
      // Bright core
      ctx.fillStyle = hexToRgba('#dafff0', flick + w.falloff * 0.3);
      fillCircle(ctx, w.x, w.y, 1.2 + w.falloff * 1.4);
    }
    ctx.restore();
  }

  // Cambrian Explosion — bioluminescent life gems scattered across the ocean.
  // Each level adds more creatures with increasing color diversity.
  // Nearby gems connect with faint "web of life" threads.
  if (cambrianN > 0 && hasOcean) {
    const lifeColors = ['#ff6b8a', '#ffaa44', '#44ddaa', '#44aaff', '#cc77ff', '#ffdd44', '#ff8855', '#66eebb'];
    const diversity = Math.min(lifeColors.length, 2 + cambrianC);
    const gemCount = Math.min(36, cambrianN * 3);

    // Collect gem positions for web connections
    const gems: Array<{ x: number; y: number; color: string }> = [];

    ctx.save();
    for (let i = 0; i < gemCount; i++) {
      const lon = i * 1.1 + unit(i + 770, 1) * 4;
      const lat = (unit(i + 771, 2) - 0.5) * 1.2;
      const px = cx + Math.cos(lon + earthSpin * 0.3) * R * (0.25 + unit(i + 772, 3) * 0.45);
      const py = cy + Math.sin(lat) * R * 0.55;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > R * 0.82) continue;

      const color = lifeColors[i % diversity];
      const breathe = 0.6 + Math.sin(now * 0.002 + i * 1.9) * 0.4;
      const gemR = 1.2 + unit(i + 773, 4) * 1.5;

      // Soft glow
      ctx.fillStyle = hexToRgba(color, 0.10 * breathe);
      fillCircle(ctx, px, py, gemR * 3.5);
      // Bright core
      ctx.fillStyle = hexToRgba(color, 0.45 * breathe);
      fillCircle(ctx, px, py, gemR);
      // White sparkle center
      ctx.fillStyle = hexToRgba('#ffffff', 0.3 * breathe);
      fillCircle(ctx, px, py, gemR * 0.4);

      gems.push({ x: px, y: py, color });
    }

    // Web of life — faint lines between nearby gems
    if (gems.length > 2) {
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < gems.length; i++) {
        for (let j = i + 1; j < Math.min(gems.length, i + 4); j++) {
          const d = Math.hypot(gems[i].x - gems[j].x, gems[i].y - gems[j].y);
          if (d > R * 0.35) continue;
          ctx.strokeStyle = gems[i].color;
          ctx.beginPath();
          ctx.moveTo(gems[i].x, gems[i].y);
          ctx.lineTo(gems[j].x, gems[j].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Neuron — synaptic flashes across the planet surface.
  // Random golden sparks fire on the surface and chain-react to nearby points.
  // The planet looks like it's waking up, thinking.
  if (hasNeuron) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const nodeCount = Math.min(20, 6 + neuronC * 2);
    const t = now * 0.001;

    // Generate fixed synapse positions on the surface
    const synapses: Array<{ x: number; y: number; fire: number }> = [];
    for (let i = 0; i < nodeCount; i++) {
      const lon = i * 0.92 + unit(i + 820, 1) * 2.5;
      const lat = (unit(i + 821, 2) - 0.5) * 1.1;
      const px = cx + Math.cos(lon) * R * (0.35 + unit(i + 822, 3) * 0.35);
      const py = cy + Math.sin(lat) * R * 0.45;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > R * 0.82) continue;
      // Each synapse fires on its own cycle (0→1→0)
      const firePhase = ((t * (0.4 + unit(i + 823, 4) * 0.6) + unit(i + 824, 5) * 10) % 3) / 3;
      const fire = firePhase < 0.15
        ? firePhase / 0.15                     // ramp up
        : firePhase < 0.3
          ? 1 - (firePhase - 0.15) / 0.15     // ramp down
          : 0;                                  // dormant
      synapses.push({ x: px, y: py, fire });
    }

    // Chain-reaction arcs between firing synapses
    for (let i = 0; i < synapses.length; i++) {
      const a = synapses[i];
      if (a.fire < 0.1) continue;
      // Find nearest neighbor and draw arc
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < synapses.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(a.x - synapses[j].x, a.y - synapses[j].y);
        if (d < bestD && d < R * 0.6) { bestD = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        const b = synapses[bestJ];
        // Traveling pulse along the arc
        const pulsePos = a.fire;
        const arcX = a.x + (b.x - a.x) * pulsePos;
        const arcY = a.y + (b.y - a.y) * pulsePos;
        // Dim connection line
        ctx.strokeStyle = hexToRgba('#ffe088', 0.06 + a.fire * 0.08);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const midX = (a.x + b.x) / 2 + (a.y - b.y) * 0.15;
        const midY = (a.y + b.y) / 2 + (b.x - a.x) * 0.15;
        ctx.quadraticCurveTo(midX, midY, b.x, b.y);
        ctx.stroke();
        // Traveling spark
        ctx.fillStyle = hexToRgba('#ffffff', 0.5 * a.fire);
        fillCircle(ctx, arcX, arcY, 1.2);
      }
    }

    // Draw synapse nodes
    for (const s of synapses) {
      // Warm ambient glow (always visible)
      ctx.fillStyle = hexToRgba('#ffe4a0', 0.06 + s.fire * 0.04);
      fillCircle(ctx, s.x, s.y, 4 + s.fire * 3);
      // Firing flash (bright golden burst)
      if (s.fire > 0.05) {
        ctx.fillStyle = hexToRgba('#ffd866', 0.3 * s.fire);
        fillCircle(ctx, s.x, s.y, 2.5 + s.fire * 4);
        ctx.fillStyle = hexToRgba('#ffffff', 0.5 * s.fire);
        fillCircle(ctx, s.x, s.y, 1.2 + s.fire * 1.5);
      }
      // Dormant node (subtle warm dot)
      ctx.fillStyle = hexToRgba('#e8c878', 0.2);
      fillCircle(ctx, s.x, s.y, 1.3);
    }
    ctx.restore();
  }

  // Ice caps appear once an ocean has condensed
  if (hasOcean) {
    ctx.fillStyle = hexToRgba('#dceeff', 0.42);
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 0.84, R * 0.32, R * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 0.86, R * 0.30, R * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds (with atmosphere)
  if (hasAtmo) {
    const cloudCount = 4 + Math.floor(atmoGrow * 4);
    ctx.fillStyle = hexToRgba('#ffffff', 0.16 + atmoGrow * 0.08);
    for (let i = 0; i < cloudCount; i += 1) {
      const ca = earthSpin * 0.7 + i * 1.18 + unit(i + 700, 1) * 2;
      const clat = (unit(i + 710, 2) - 0.5) * 0.9;
      const vis = Math.cos(ca);
      if (vis <= 0.05) continue;
      const cw = R * (0.16 + unit(i + 720, 3) * 0.16);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(ca) * R * 0.58, cy + clat * R * 0.55, cw, cw * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Homo Sapiens — civilization spreading across the surface.
  // Settlements grow into cities connected by roads, with agriculture patches.
  if (hasSapiens) {
    const civLevel = Math.min(1, sapiensC / 5);
    const settlements = Math.min(12, 2 + sapiensC * 2);

    // Generate settlement positions
    const towns: Array<{ x: number; y: number; size: number }> = [];
    for (let i = 0; i < settlements; i++) {
      const lon = i * 0.85 + unit(i + 870, 1) * 2.5;
      const lat = (unit(i + 871, 2) - 0.5) * 0.85;
      const px = cx + Math.cos(lon) * R * (0.3 + unit(i + 872, 3) * 0.35);
      const py = cy + Math.sin(lat) * R * 0.45;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > R * 0.78) continue;
      const size = 1.5 + civLevel * 2.5 + unit(i + 873, 4) * 1.5;
      towns.push({ x: px, y: py, size });
    }

    // Roads connecting nearby settlements
    if (civLevel > 0.2 && towns.length > 1) {
      ctx.strokeStyle = hexToRgba('#c8b088', 0.12 + civLevel * 0.08);
      ctx.lineWidth = 0.5;
      for (let i = 0; i < towns.length; i++) {
        // Connect to 1-2 nearest neighbors
        for (let j = i + 1; j < Math.min(towns.length, i + 3); j++) {
          const d = Math.hypot(towns[i].x - towns[j].x, towns[i].y - towns[j].y);
          if (d > R * 0.4) continue;
          ctx.beginPath();
          ctx.moveTo(towns[i].x, towns[i].y);
          ctx.lineTo(towns[j].x, towns[j].y);
          ctx.stroke();
        }
      }
    }

    // Agriculture patches near settlements
    if (civLevel > 0.3) {
      ctx.fillStyle = hexToRgba('#b8a860', 0.12 + civLevel * 0.06);
      for (let i = 0; i < towns.length; i++) {
        const fieldW = towns[i].size * (0.8 + civLevel * 0.6);
        const fieldH = fieldW * 0.6;
        const fx = towns[i].x + unit(i + 880, 5) * 4 - 2;
        const fy = towns[i].y + unit(i + 881, 6) * 3;
        ctx.fillRect(fx - fieldW / 2, fy, fieldW, fieldH);
      }
    }

    // Settlement clusters — stacked rectangles (buildings)
    for (const town of towns) {
      const buildingCount = Math.min(5, 1 + Math.floor(civLevel * 4));
      for (let b = 0; b < buildingCount; b++) {
        const bw = 1 + unit(town.size * 100 + b, 1) * 1.5;
        const bh = town.size * (0.5 + unit(town.size * 100 + b + 10, 2) * 1.2);
        const bx = town.x + (unit(town.size * 100 + b + 20, 3) - 0.5) * town.size * 1.5;
        const by = town.y + (unit(town.size * 100 + b + 30, 4) - 0.5) * town.size * 0.8;
        // Building
        ctx.fillStyle = hexToRgba('#d8ceb0', 0.5 + civLevel * 0.3);
        ctx.fillRect(bx - bw / 2, by - bh, bw, bh);
      }
      // Warm center glow (hearth/activity)
      ctx.fillStyle = hexToRgba('#ffcc66', 0.08 + civLevel * 0.06);
      fillCircle(ctx, town.x, town.y, town.size * 1.8);

      // Landmark at high level — pyramid or tower
      if (civLevel > 0.6 && town.size > 3.5) {
        ctx.fillStyle = hexToRgba('#e0d0a8', 0.65);
        ctx.beginPath();
        ctx.moveTo(town.x, town.y - town.size * 1.8);
        ctx.lineTo(town.x - town.size * 0.5, town.y);
        ctx.lineTo(town.x + town.size * 0.5, town.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Day/night terminator — softer; rotates with the orbit so day side faces sun
  {
    const sunDir = moonAngle * 0.18 + earthSpin * 0.05;
    const dayCx = cx + Math.cos(sunDir) * R * 0.6;
    const dayCy = cy - R * 0.05;
    const nightGrad = ctx.createRadialGradient(dayCx, dayCy, R * 0.18, cx - Math.cos(sunDir) * R * 0.2, cy, R * 1.15);
    nightGrad.addColorStop(0, hexToRgba('#000000', 0));
    nightGrad.addColorStop(0.55, hexToRgba('#000000', 0.18));
    nightGrad.addColorStop(1, hexToRgba('#000000', 0.5));
    ctx.fillStyle = nightGrad;
    fillCircle(ctx, cx, cy, R);

    // City lights — turn on the moment Sapiens shows up (or via the explicit
    // City Lights entity). They live on the night side only.
    if ((hasSapiens || hasCity) && cityN > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const nightX = cx - Math.cos(sunDir) * R * 0.4;
      for (let i = 0; i < cityN; i += 1) {
        const lx = nightX + (unit(i + 800, 1) - 0.5) * R * 1.2;
        const ly = cy + (unit(i + 810, 2) - 0.5) * R * 1.5;
        const distFromCenter = Math.hypot(lx - cx, ly - cy);
        if (distFromCenter > R * 0.88) continue;
        // Skip lights on the day side
        const lightSunDot = (lx - cx) * Math.cos(sunDir) + (ly - cy) * Math.sin(sunDir);
        if (lightSunDot > R * 0.1) continue;
        const flicker = 0.7 + Math.sin(now * 0.0046 + i * 2.7) * 0.3;
        // Bright core
        ctx.fillStyle = hexToRgba('#ffe28a', flicker);
        fillCircle(ctx, lx, ly, 1.4 + unit(i + 820, 3) * 1.8);
        // Warm glow halo
        ctx.fillStyle = hexToRgba('#ffd060', 0.28 + cityGrow * 0.12);
        fillCircle(ctx, lx, ly, 4 + unit(i + 821, 4) * 3);
        // Hot white center
        ctx.fillStyle = hexToRgba('#ffffff', 0.25 * flicker);
        fillCircle(ctx, lx, ly, 0.8);
      }
      ctx.restore();
    }

    // Homo Sapiens fires — properly grounded camp fires on the planet
    // surface (clipped to the sphere), each with an ember + flickering
    // flame + thin smoke plume tilted away from the sun. Stops once city
    // lights have taken over.
    if (hasSapiens && cityC === 0) {
      const lit = Math.cos(sunDir);
      for (let i = 0; i < sapiensC * 3; i += 1) {
        const lon = earthSpin + unit(i + 830, 1) * Math.PI * 2;
        const lat = (unit(i + 831, 2) - 0.5) * 0.9;
        const visible = Math.cos(lon) * Math.cos(lat);
        if (visible < 0.1) continue;
        // Land on the surface, not centre — surfFrac > 0.7 keeps the spark
        // hugging the rocky crust.
        const surfFrac = 0.74;
        const baseX = cx + Math.cos(lon) * sphereR * surfFrac * Math.cos(lat);
        const baseY = cy + Math.sin(lat) * sphereR * surfFrac;
        const w = applyWiggle(baseX, baseY);
        const flick = 0.55 + Math.sin(now * 0.005 + i) * 0.35;
        // Outer orange ember
        ctx.fillStyle = hexToRgba('#ff7a26', flick);
        fillCircle(ctx, w.x, w.y, 1.6 + w.falloff * 0.8);
        // Inner yellow flame tip
        ctx.fillStyle = hexToRgba('#ffd17a', flick * 0.75);
        fillCircle(ctx, w.x, w.y, 0.75);
        // Thin smoke plume drifting away from the sun
        const smokeLen = 5 + Math.sin(now * 0.003 + i * 1.3) * 1.5;
        ctx.strokeStyle = hexToRgba('#bcbcbc', 0.18);
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.quadraticCurveTo(
          w.x - lit * 2,
          w.y - smokeLen * 0.5,
          w.x - lit * 4,
          w.y - smokeLen,
        );
        ctx.stroke();
      }
    }
  }

  // Moon shadow on Earth — fades smoothly based on moon angle
  if (hasMoon) {
    const sinA = Math.sin(moonAngle);
    // sinA > 0 = moon in front; fade from 0 at sinA=0 to full at sinA=0.5+
    const shadowFade = Math.max(0, Math.min(1, sinA * 3));
    if (shadowFade > 0.01) {
      const shadowX = moonX * 0.32 + cx * 0.68;
      const shadowY = moonY * 0.32 + cy * 0.68;
      ctx.fillStyle = hexToRgba('#000000', shadowFade * (0.14 + moonGrow * 0.06));
      fillCircle(ctx, shadowX, shadowY, moonR * (1.2 + shadowFade * 0.4));
    }
  }

  // Day-side specular highlight
  if (hasOcean || hasAtmo) {
    const sunDir = moonAngle * 0.18 + earthSpin * 0.05;
    const specGrad = ctx.createRadialGradient(
      cx + Math.cos(sunDir) * R * 0.4, cy - R * 0.25, 0,
      cx + Math.cos(sunDir) * R * 0.4, cy - R * 0.25, R * 0.7,
    );
    specGrad.addColorStop(0, hexToRgba('#ffffff', 0.18));
    specGrad.addColorStop(1, hexToRgba('#ffffff', 0));
    ctx.fillStyle = specGrad;
    fillCircle(ctx, cx, cy, R);
  }

  ctx.restore(); // end Earth clip
  } // end "if (sphereR > 0.5)" Earth-body guard

  // ── Biosphere veins outside the clip (life force tendrils) ───────────────
  // Biosphere veins removed — too noisy

  // Atmosphere ring (outline) — always visible once purchased
  if (hasAtmo) {
    ctx.strokeStyle = hexToRgba('#8ed0ff', 0.30 + atmoGrow * 0.25);
    ctx.lineWidth = R * 0.035;
    strokeCircle(ctx, cx, cy, R * 1.02);
  }

  // ── Satellites — body + solar-panel wings + scan beam + comm ping.
  // Visually very different from Sapiens (which is on the surface).
  // They also react to pointer pressure: a mouse-down near them pushes
  // them outward briefly.
  if (hasSat) {
    ctx.save();
    for (let i = 0; i < satN; i += 1) {
      const sa = now * (0.0009 + i * 0.00033) + i * 2.1;
      const sr = R * (1.14 + i * 0.07);
      let sx = cx + Math.cos(sa) * sr;
      let sy = cy + Math.sin(sa) * sr * 0.38;
      const pushed = applyPointerVisualDisplacement(sx, sy, pointerPressure, 14);
      sx = pushed.x;
      sy = pushed.y;
      // Body bus
      ctx.fillStyle = hexToRgba('#ffffff', 0.82);
      fillCircle(ctx, sx, sy, 1.8);
      // Solar-panel wings (rotated along orbit)
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sa + Math.PI / 2);
      ctx.fillStyle = hexToRgba('#88aaff', 0.62);
      ctx.fillRect(-3.4, -0.7, 6.8, 1.4);
      ctx.fillStyle = hexToRgba('#aaccff', 0.42);
      ctx.fillRect(-3.2, -0.35, 6.4, 0.7);
      ctx.restore();
      // Scan beam fan pointing at Earth
      const beamAngle = Math.atan2(cy - sy, cx - sx);
      const beamHalf = 0.17 + Math.sin(now * 0.003 + i) * 0.05;
      const beamReach = Math.hypot(sx - cx, sy - cy) * 0.95;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, beamReach);
      grad.addColorStop(0, hexToRgba('#9ce0ff', 0.32 + satGrow * 0.20));
      grad.addColorStop(1, hexToRgba('#9ce0ff', 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, beamReach, beamAngle - beamHalf, beamAngle + beamHalf);
      ctx.closePath();
      ctx.fill();
      // Comm ping ring expanding outward
      const ringPhase = (now * 0.001 + i * 0.7) % 1;
      ctx.strokeStyle = hexToRgba('#cdeaff', (1 - ringPhase) * 0.42);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + ringPhase * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Moon in front of Earth — drawn last so it sits above the surface
  if (hasMoon && !moonBehind) {
    drawMoon(ctx, moonX, moonY, moonR, now, moonAngle, moonGrow, false, moonNudgePulse);
  }

  // Legendary / Spacefaring / Ark / Telescope orbital glyphs — pointer
  // pressure pushes them outward slightly when the cursor is nearby.
  const orbitItems = items.filter(isLifeOrbitEntity);
  drawLifeOrbitEntities(ctx, cx, cy, R, orbitItems, now, pointerPressure);
}

function drawEntityGlyph(
  ctx: CanvasRenderingContext2D,
  item: EntityDrawItem,
  x: number,
  y: number,
  size: number,
  now: number,
): void {
  // Per-entity size variation based on seed (±15%)
  const sizeVar = 0.85 + unit(item.seed, 10) * 0.3;
  const s = size * sizeVar;
  // Spin speed varies per entity — some fast, some slow, some reversed
  const spinSpeed = (0.001 + unit(item.seed, 11) * 0.003) * (unit(item.seed, 12) > 0.4 ? 1 : -1);
  const spin = now * spinSpeed + item.sourceIndex * 0.7 + item.copyIndex * 0.23;
  const pulse = 1 + Math.sin(now * 0.002 + item.copyIndex) * 0.08;
  // Slight color hue shift per entity copy
  const hueShift = (item.copyIndex * 17 + item.sourceIndex * 31) % 360;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin * 0.18);
  ctx.lineWidth = Math.max(0.8, s * 0.1);
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;

  switch (item.glyph) {
    case 'black_hole': {
      // Accretion disk with orbiting debris
      const diskSpin = spin * 0.5;
      ctx.save();
      ctx.rotate(diskSpin);
      // Accretion ring
      ctx.strokeStyle = hexToRgba(item.color, 0.5);
      ctx.lineWidth = s * 0.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.3, s * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Orbiting debris particles
      for (let i = 0; i < 6; i++) {
        const a = diskSpin * 3 + i * 1.05 + unit(item.seed, i) * 0.5;
        const orbitR = s * (0.9 + unit(item.seed, i + 20) * 0.5);
        const px = Math.cos(a) * orbitR;
        const py = Math.sin(a) * orbitR * 0.3;
        const pr = s * (0.06 + unit(item.seed, i + 30) * 0.08);
        ctx.fillStyle = hexToRgba(item.color, 0.4 + unit(item.seed, i + 40) * 0.4);
        fillCircle(ctx, px, py, pr);
      }
      ctx.restore();
      // Event horizon
      ctx.fillStyle = '#02030a';
      fillCircle(ctx, 0, 0, s * 0.55);
      // Photon ring glow
      const bhGrad = ctx.createRadialGradient(0, 0, s * 0.5, 0, 0, s * 0.8);
      bhGrad.addColorStop(0, hexToRgba(item.color, 0.35));
      bhGrad.addColorStop(1, hexToRgba(item.color, 0));
      ctx.fillStyle = bhGrad;
      fillCircle(ctx, 0, 0, s * 0.8);
      break;
    }
    case 'galaxy': {
      // Spiral arms made of tiny dots
      ctx.rotate(spin * 0.4);
      const arms = 2;
      for (let arm = 0; arm < arms; arm++) {
        const armOffset = (arm / arms) * Math.PI * 2;
        for (let i = 0; i < 12; i++) {
          const t = i / 12;
          const spiralA = armOffset + t * Math.PI * 2.5;
          const r = s * (0.2 + t * 0.85);
          const px = Math.cos(spiralA) * r;
          const py = Math.sin(spiralA) * r * 0.6;
          const dotR = s * (0.04 + (1 - t) * 0.1);
          ctx.fillStyle = hexToRgba(item.color, 0.3 + (1 - t) * 0.5);
          fillCircle(ctx, px, py, dotR);
        }
      }
      // Bright core
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.3);
      coreGrad.addColorStop(0, hexToRgba('#ffffff', 0.6 * pulse));
      coreGrad.addColorStop(1, hexToRgba(item.color, 0));
      ctx.fillStyle = coreGrad;
      fillCircle(ctx, 0, 0, s * 0.3);
      break;
    }
    case 'star':
    case 'supernova': {
      // Core with flickering corona particles
      const isSN = item.glyph === 'supernova';
      const rayCount = isSN ? 8 : 5;
      for (let i = 0; i < rayCount; i++) {
        const a = spin * (isSN ? 1.5 : 0.8) + i * (Math.PI * 2 / rayCount);
        const len = s * (0.6 + Math.sin(now * 0.004 + i * 1.7) * 0.3);
        const px = Math.cos(a) * len;
        const py = Math.sin(a) * len;
        const pr = s * (isSN ? 0.12 : 0.08) * (0.7 + Math.sin(now * 0.006 + i) * 0.3);
        ctx.fillStyle = hexToRgba(item.color, 0.3 + Math.sin(now * 0.005 + i) * 0.2);
        fillCircle(ctx, px, py, pr);
      }
      // Bright core
      ctx.fillStyle = hexToRgba('#ffffff', isSN ? 0.7 : 0.5);
      fillCircle(ctx, 0, 0, s * (isSN ? 0.35 : 0.28) * pulse);
      ctx.fillStyle = hexToRgba(item.color, 0.6);
      fillCircle(ctx, 0, 0, s * (isSN ? 0.45 : 0.35) * pulse);
      break;
    }
    case 'nucleus':
    case 'quark':
    case 'nucleus': {
      // Quark triplet with color charge differentiation by name
      const isNucleus = item.glyph === 'nucleus';
      const count = isNucleus ? 4 : 3;
      const nameL2 = item.name.toLowerCase();
      // Color charges differ per quark type
      const qcColors = nameL2.includes('up') ? ['#ff4444', '#ff8844', '#ffcc44']
        : nameL2.includes('down') ? ['#4466ff', '#44aaff', '#44ddff']
        : nameL2.includes('strange') ? ['#44cc66', '#88ee44', '#ccff66']
        : ['#ff6666', '#66dd66', '#6688ff']; // default RGB triplet
      const orbitR2 = s * (isNucleus ? 0.35 : 0.32);
      for (let i = 0; i < count; i++) {
        const baseA = (i / count) * Math.PI * 2;
        const vibrate = Math.sin(now * 0.006 + i * 2.3 + item.seed) * s * 0.08;
        const r2 = orbitR2 + vibrate;
        const px = Math.cos(baseA + spin * 0.4) * r2;
        const py = Math.sin(baseA + spin * 0.4) * r2;
        const dotSize = s * (isNucleus ? 0.2 : 0.24);
        ctx.fillStyle = qcColors[i % qcColors.length];
        fillCircle(ctx, px, py, dotSize);
      }
      // Confinement ring
      ctx.strokeStyle = hexToRgba(item.color, 0.2);
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      strokeCircle(ctx, 0, 0, s * (isNucleus ? 0.55 : 0.5));
      ctx.setLineDash([]);
      // Center binding glow
      ctx.fillStyle = hexToRgba(item.color, 0.15);
      fillCircle(ctx, 0, 0, s * 0.15);
      break;
    }
    case 'atom': {
      // Full atom — nucleus + 2 electron orbits
      ctx.strokeStyle = hexToRgba(item.color, 0.2);
      ctx.lineWidth = 0.5;
      for (let o = 0; o < 2; o++) {
        const tilt = o * (Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * (0.85 + o * 0.25), s * (0.35 + o * 0.1), tilt, 0, Math.PI * 2);
        ctx.stroke();
        const eAngle = spin * (1.5 + o * 0.7);
        const ex = Math.cos(eAngle) * s * (0.85 + o * 0.25);
        const ey = Math.sin(eAngle) * s * (0.35 + o * 0.1);
        const rotX = ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const rotY = ex * Math.sin(tilt) + ey * Math.cos(tilt);
        ctx.fillStyle = '#ffffff';
        fillCircle(ctx, rotX, rotY, s * 0.1);
      }
      ctx.fillStyle = hexToRgba(item.color, 0.7);
      fillCircle(ctx, 0, 0, s * 0.22);
      break;
    }
    case 'lepton': {
      const nameL2 = item.name.toLowerCase();
      const isNeutrino = nameL2.includes('neutrino') || nameL2.includes('ν');
      if (isNeutrino) {
        // Neutrino — ghostly, almost invisible dashed orbit, tiny flickering dot
        ctx.strokeStyle = hexToRgba(item.color, 0.12);
        ctx.lineWidth = 0.4;
        ctx.setLineDash([2, 4]);
        strokeCircle(ctx, 0, 0, s * 0.7);
        ctx.setLineDash([]);
        // Ghost dot — flickers
        const ghostAlpha = 0.15 + Math.sin(now * 0.008 + item.seed) * 0.12;
        ctx.fillStyle = hexToRgba('#ccddff', ghostAlpha);
        const nAngle = spin * 2.2;
        fillCircle(ctx, Math.cos(nAngle) * s * 0.65, Math.sin(nAngle) * s * 0.25, s * 0.08);
        // Faint center
        ctx.fillStyle = hexToRgba(item.color, 0.08);
        fillCircle(ctx, 0, 0, s * 0.12);
      } else {
        // Electron — solid orbit with bright electron dot
        ctx.strokeStyle = hexToRgba(item.color, 0.25);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.85, s * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        const eAngle = spin * 1.8;
        const ex = Math.cos(eAngle) * s * 0.85;
        const ey = Math.sin(eAngle) * s * 0.35;
        // Electron with trail
        ctx.fillStyle = '#ffffff';
        fillCircle(ctx, ex, ey, s * 0.12);
        ctx.fillStyle = hexToRgba('#aaccff', 0.3);
        fillCircle(ctx, ex, ey, s * 0.22);
        // Charge symbol (-)
        ctx.strokeStyle = hexToRgba('#ffffff', 0.5);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, 0);
        ctx.lineTo(s * 0.08, 0);
        ctx.stroke();
      }
      break;
    }
    case 'radiation': {
      // Photon bursts radiating outward
      for (let i = 0; i < 7; i++) {
        const a = spin * 1.2 + i * 0.9;
        const dist = s * (0.3 + ((now * 0.002 + i * 0.4) % 1) * 0.7);
        const alpha = 1 - ((now * 0.002 + i * 0.4) % 1);
        ctx.fillStyle = hexToRgba(item.color, alpha * 0.5);
        fillCircle(ctx, Math.cos(a) * dist, Math.sin(a) * dist, s * 0.06);
      }
      ctx.fillStyle = hexToRgba('#ffffff', 0.5 * pulse);
      fillCircle(ctx, 0, 0, s * 0.15);
      break;
    }
    case 'wave':
    case 'field': {
      // Animated sine wave
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = hexToRgba(item.color, 0.6);
      const waveCount = item.glyph === 'wave' ? 1 : 2;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        for (let i = -20; i <= 20; i++) {
          const t = i / 20;
          const xp = t * s * 1.2;
          const yp = Math.sin(t * 6 + spin * 2 + w * Math.PI) * s * 0.4 * (1 - Math.abs(t));
          if (i === -20) ctx.moveTo(xp, yp);
          else ctx.lineTo(xp, yp);
        }
        ctx.stroke();
      }
      if (item.glyph === 'field') {
        ctx.fillStyle = hexToRgba(item.color, 0.4 * pulse);
        fillCircle(ctx, 0, 0, s * 0.15);
      }
      break;
    }
    case 'boson': {
      const nameL2 = item.name.toLowerCase();
      if (nameL2.includes('gluon')) {
        // Gluon — figure-8 / twisted loop (color force carrier)
        ctx.strokeStyle = hexToRgba('#ff8844', 0.5);
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = (i / 40) * Math.PI * 2;
          const x = Math.sin(t) * s * 0.6;
          const y = Math.sin(t * 2 + spin) * s * 0.3;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Color charge dots at the loops
        ctx.fillStyle = '#ff6666';
        fillCircle(ctx, 0, s * 0.25, s * 0.1);
        ctx.fillStyle = '#6688ff';
        fillCircle(ctx, 0, -s * 0.25, s * 0.1);
      } else if (nameL2.includes('w ') || nameL2.includes('w±') || nameL2.includes('z ')) {
        // W/Z Boson — zigzag lightning bolt (weak force)
        ctx.strokeStyle = hexToRgba('#ffdd44', 0.6);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const segments = 5;
        const zigLen = s * 0.85;
        for (let i = 0; i <= segments; i++) {
          const frac = i / segments;
          const x = -zigLen + frac * zigLen * 2;
          const y = ((i % 2 === 0) ? -1 : 1) * s * 0.3 * (1 - Math.abs(frac - 0.5) * 1.2);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Spark at center
        ctx.fillStyle = hexToRgba('#ffee88', 0.5 * pulse);
        fillCircle(ctx, 0, 0, s * 0.12);
      } else {
        // Generic boson — two crossing sine waves
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = hexToRgba(item.color, 0.5);
        for (let w = 0; w < 2; w++) {
          ctx.beginPath();
          for (let i = -20; i <= 20; i++) {
            const t = i / 20;
            const xp = t * s * 1.1;
            const yp = Math.sin(t * 6 + spin * 2 + w * Math.PI) * s * 0.35 * (1 - Math.abs(t));
            if (i === -20) ctx.moveTo(xp, yp); else ctx.lineTo(xp, yp);
          }
          ctx.stroke();
        }
        ctx.fillStyle = hexToRgba(item.color, 0.35 * pulse);
        fillCircle(ctx, 0, 0, s * 0.12);
      }
      break;
    }
    case 'cloud':
    case 'halo': {
      // Soft nebula blobs with varying opacity
      const blobs = 5 + Math.floor(unit(item.seed, 70) * 3);
      for (let i = 0; i < blobs; i++) {
        const bx = (unit(item.seed, i + 80) - 0.5) * s * 1.4;
        const by = (unit(item.seed, i + 90) - 0.5) * s * 1.0;
        const br = s * (0.2 + unit(item.seed, i + 100) * 0.25);
        const bAlpha = 0.15 + unit(item.seed, i + 110) * 0.25 + Math.sin(now * 0.001 + i) * 0.05;
        ctx.fillStyle = hexToRgba(item.color, bAlpha);
        fillCircle(ctx, bx + Math.sin(now * 0.0008 + i) * 2, by, br);
      }
      if (item.glyph === 'halo') {
        ctx.strokeStyle = hexToRgba(item.color, 0.15);
        ctx.lineWidth = 0.5;
        strokeCircle(ctx, 0, 0, s * 1.1);
      }
      break;
    }
    case 'plasma': {
      // Hot swirling particles
      for (let i = 0; i < 7; i++) {
        const a = spin * 1.3 + (i / 7) * Math.PI * 2;
        const r = s * (0.4 + Math.sin(now * 0.003 + i * 1.1) * 0.25);
        const pr = s * (0.1 + unit(item.seed, i + 120) * 0.1);
        ctx.fillStyle = hexToRgba(item.color, 0.5 + Math.sin(now * 0.004 + i) * 0.2);
        fillCircle(ctx, Math.cos(a) * r, Math.sin(a * 1.5) * r * 0.7, pr);
      }
      break;
    }
    case 'quantum': {
      // Space-warp dust cloud — tiny particles with color variation
      const dustCount = 8 + Math.floor(unit(item.seed, 130) * 5);
      for (let i = 0; i < dustCount; i++) {
        const phase = unit(item.seed, i + 140) * Math.PI * 2;
        const drift = now * 0.0005 * (0.5 + unit(item.seed, i + 150) * 1.0);
        const r = s * (0.3 + unit(item.seed, i + 160) * 0.9);
        const px = Math.cos(phase + drift) * r;
        const py = Math.sin(phase * 1.3 + drift * 0.8) * r * 0.7;
        const dotR = s * (0.04 + unit(item.seed, i + 170) * 0.06);
        // Color variation — slight warm/cool shift
        const warmth = unit(item.seed, i + 180);
        const alpha = 0.2 + warmth * 0.4 + Math.sin(now * 0.002 + i) * 0.1;
        ctx.fillStyle = hexToRgba(item.color, alpha);
        fillCircle(ctx, px, py, dotR);
      }
      // Faint warp ring
      ctx.strokeStyle = hexToRgba(item.color, 0.08 + Math.sin(spin) * 0.04);
      ctx.lineWidth = 0.4;
      const warpR = s * (0.8 + Math.sin(spin * 1.5) * 0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, warpR, warpR * 0.5, spin * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'entropy': {
      // Dissolving fragments drifting apart
      for (let i = 0; i < 6; i++) {
        const a = spin * 0.4 + i * 1.1 + unit(item.seed, i + 190) * 0.5;
        const drift = s * (0.3 + unit(item.seed, i + 200) * 0.5) * (1 + Math.sin(now * 0.001 + i) * 0.2);
        const pr = s * (0.08 + unit(item.seed, i + 210) * 0.1);
        const alpha = 0.6 - unit(item.seed, i + 220) * 0.3;
        ctx.fillStyle = hexToRgba(item.color, alpha);
        fillCircle(ctx, Math.cos(a) * drift, Math.sin(a) * drift, pr);
      }
      break;
    }
    case 'molecule': {
      // Bond structure — connected nodes
      const nodes = [
        { x: -s * 0.55, y: 0, r: s * 0.2 },
        { x: 0, y: -s * 0.35 + Math.sin(now * 0.003) * s * 0.05, r: s * 0.28 },
        { x: s * 0.5, y: s * 0.15, r: s * 0.18 },
      ];
      ctx.strokeStyle = hexToRgba(item.color, 0.4);
      ctx.lineWidth = s * 0.06;
      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
        ctx.stroke();
      }
      nodes.forEach((n, i) => {
        ctx.fillStyle = hexToRgba(item.color, 0.5 + i * 0.15);
        fillCircle(ctx, n.x, n.y, n.r);
      });
      break;
    }
    case 'dna': {
      // Double helix with rungs
      ctx.lineWidth = 0.7;
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const t = (i / steps) * 2 - 1;
        const yp = t * s;
        const twist = spin * 0.8 + t * 3;
        const x1 = Math.cos(twist) * s * 0.4;
        const x2 = -x1;
        ctx.strokeStyle = hexToRgba(item.color, 0.5);
        ctx.beginPath();
        ctx.moveTo(x1, yp);
        ctx.lineTo(x2, yp);
        ctx.stroke();
        ctx.fillStyle = hexToRgba(item.color, 0.6);
        fillCircle(ctx, x1, yp, s * 0.06);
        fillCircle(ctx, x2, yp, s * 0.06);
      }
      break;
    }
    case 'life': {
      // Rotating Earth with continents + atmosphere + orbiting moon
      const earthR = s * 0.55;
      const earthSpin = now * 0.003 + item.seed * 0.1;

      // Atmosphere glow
      const atmoGrad = ctx.createRadialGradient(0, 0, earthR * 0.8, 0, 0, earthR * 1.3);
      atmoGrad.addColorStop(0, hexToRgba('#4488ff', 0.0));
      atmoGrad.addColorStop(0.5, hexToRgba('#4488ff', 0.12));
      atmoGrad.addColorStop(1, hexToRgba('#4488ff', 0.0));
      ctx.fillStyle = atmoGrad;
      fillCircle(ctx, 0, 0, earthR * 1.3);

      // Ocean base
      ctx.fillStyle = hexToRgba('#1a3a6a', 0.85);
      fillCircle(ctx, 0, 0, earthR);

      // Continents (simplified blobs that rotate)
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, earthR, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = hexToRgba('#2d6e3f', 0.7);
      for (let i = 0; i < 4; i++) {
        const cAngle = earthSpin + i * 1.7 + unit(item.seed, i + 230) * 1.5;
        const cLat = (unit(item.seed, i + 240) - 0.5) * earthR * 1.2;
        const cx2 = Math.cos(cAngle) * earthR * 0.7;
        const visible = Math.cos(cAngle);
        if (visible > -0.2) {
          const cSize = earthR * (0.2 + unit(item.seed, i + 250) * 0.2);
          ctx.globalAlpha = 0.5 + visible * 0.4;
          ctx.beginPath();
          ctx.ellipse(cx2, cLat, cSize * (0.5 + visible * 0.5), cSize * 0.7, unit(item.seed, i + 260) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Polar ice caps
      ctx.fillStyle = hexToRgba('#ddeeff', 0.4);
      ctx.beginPath();
      ctx.ellipse(0, -earthR * 0.82, earthR * 0.4, earthR * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, earthR * 0.82, earthR * 0.35, earthR * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Specular highlight
      const specGrad = ctx.createRadialGradient(-earthR * 0.3, -earthR * 0.3, 0, -earthR * 0.3, -earthR * 0.3, earthR * 0.8);
      specGrad.addColorStop(0, hexToRgba('#ffffff', 0.2));
      specGrad.addColorStop(1, hexToRgba('#ffffff', 0.0));
      ctx.fillStyle = specGrad;
      fillCircle(ctx, 0, 0, earthR);

      // Thin atmosphere ring
      ctx.strokeStyle = hexToRgba('#66aaff', 0.2);
      ctx.lineWidth = earthR * 0.08;
      strokeCircle(ctx, 0, 0, earthR * 1.05);

      // Orbiting moon
      const moonAngle = now * 0.002 + item.seed * 0.3;
      const moonDist = earthR * 1.8;
      const moonX = Math.cos(moonAngle) * moonDist;
      const moonY = Math.sin(moonAngle) * moonDist * 0.35;
      const moonR = earthR * 0.22;
      const drawMoonEntity = () => {
        // Moon glow
        const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 2);
        moonGlow.addColorStop(0, hexToRgba('#ffffee', 0.2));
        moonGlow.addColorStop(1, hexToRgba('#ffffee', 0));
        ctx.fillStyle = moonGlow;
        fillCircle(ctx, moonX, moonY, moonR * 2.5);
        // Moon base
        const moonBase = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, 0, moonX, moonY, moonR);
        moonBase.addColorStop(0, '#f0ece0');
        moonBase.addColorStop(0.6, '#d0c8b8');
        moonBase.addColorStop(1, '#a8a090');
        ctx.fillStyle = moonBase;
        fillCircle(ctx, moonX, moonY, moonR);
        // Craters
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.clip();
        const craters = [
          { dx: 0.25, dy: -0.2, r: 0.18 },
          { dx: -0.3, dy: 0.15, r: 0.14 },
          { dx: 0.05, dy: 0.3, r: 0.11 },
          { dx: -0.15, dy: -0.35, r: 0.09 },
        ];
        for (const c of craters) {
          ctx.fillStyle = hexToRgba('#8a8270', 0.5);
          fillCircle(ctx, moonX + c.dx * moonR, moonY + c.dy * moonR, c.r * moonR);
          ctx.fillStyle = hexToRgba('#706858', 0.3);
          fillCircle(ctx, moonX + c.dx * moonR + moonR * 0.02, moonY + c.dy * moonR + moonR * 0.02, c.r * moonR * 0.7);
        }
        ctx.restore();
        // Terminator shadow (day/night)
        const shadowPhase = moonAngle * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = hexToRgba('#000000', 0.3);
        ctx.beginPath();
        ctx.ellipse(moonX + Math.cos(shadowPhase) * moonR * 0.4, moonY, moonR * 0.9, moonR, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      // Draw moon behind or in front based on angle
      if (Math.sin(moonAngle) < 0) drawMoonEntity();
      // Moon orbit path (faint)
      ctx.strokeStyle = hexToRgba('#ffffff', 0.04);
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, moonDist, moonDist * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (Math.sin(moonAngle) >= 0) drawMoonEntity();
      break;
    }
    case 'cell': {
      ctx.strokeStyle = hexToRgba(item.color, 0.35);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.85, s * 0.65, Math.sin(spin * 0.2) * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(item.color, 0.5);
      fillCircle(ctx, s * 0.1, -s * 0.05, s * 0.22);
      break;
    }
    case 'neuron': {
      // Cell body with branching dendrites
      ctx.fillStyle = hexToRgba(item.color, 0.6);
      fillCircle(ctx, 0, 0, s * 0.25);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + spin * 0.15;
        const len = s * (0.5 + unit(item.seed, i + 270) * 0.5);
        ctx.strokeStyle = hexToRgba(item.color, 0.3 + unit(item.seed, i + 280) * 0.2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const midX = Math.cos(a + 0.3) * len * 0.6;
        const midY = Math.sin(a + 0.3) * len * 0.6;
        ctx.quadraticCurveTo(midX, midY, Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
        // Synaptic terminal
        ctx.fillStyle = hexToRgba(item.color, 0.4);
        fillCircle(ctx, Math.cos(a) * len, Math.sin(a) * len, s * 0.05);
      }
      break;
    }
    case 'void': {
      // Unstable vacuum bubble — pulsing sphere with fracture lines
      const voidPulse = 1 + Math.sin(spin * 1.5) * 0.15;
      const bubbleR = s * 0.55 * voidPulse;
      // Dark interior
      ctx.fillStyle = hexToRgba('#08061a', 0.85);
      fillCircle(ctx, 0, 0, bubbleR);
      // Shimmering membrane
      ctx.strokeStyle = hexToRgba(item.color, 0.35 + Math.sin(spin * 2) * 0.15);
      ctx.lineWidth = 1.0;
      strokeCircle(ctx, 0, 0, bubbleR);
      // Fracture cracks — unstable vacuum about to pop
      for (let i = 0; i < 4; i++) {
        const crackA = spin * 0.4 + i * 1.57;
        const crackLen = bubbleR * (0.4 + Math.sin(now * 0.004 + i * 2) * 0.2);
        ctx.strokeStyle = hexToRgba('#cc88ff', 0.2 + Math.sin(now * 0.005 + i) * 0.1);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(crackA) * crackLen, Math.sin(crackA) * crackLen);
        ctx.stroke();
      }
      // Energy leak at crack tips
      ctx.fillStyle = hexToRgba('#aa77ff', 0.25 * voidPulse);
      fillCircle(ctx, 0, 0, bubbleR * 0.2);
      break;
    }
    case 'singularity': {
      // Crushing collapse — shrinking rings
      ctx.fillStyle = '#02030a';
      fillCircle(ctx, 0, 0, s * 0.45);
      for (let r = 1; r <= 3; r++) {
        const shrink = 1 - Math.sin(spin * 0.5 + r) * 0.08;
        ctx.strokeStyle = hexToRgba(item.color, 0.2 / r);
        ctx.lineWidth = 0.6;
        strokeCircle(ctx, 0, 0, s * (0.5 + r * 0.18) * shrink);
      }
      break;
    }
    case 'bounce': {
      ctx.strokeStyle = hexToRgba(item.color, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0.3, Math.PI * 1.75);
      ctx.stroke();
      // Arrow tip
      const tipA = Math.PI * 1.75;
      const tipX = Math.cos(tipA) * s * 0.8;
      const tipY = Math.sin(tipA) * s * 0.8;
      ctx.fillStyle = hexToRgba(item.color, 0.5);
      fillCircle(ctx, tipX, tipY, s * 0.1);
      fillCircle(ctx, 0, 0, s * 0.2 * pulse);
      break;
    }
    case 'remnant': {
      // Fading shell with dust
      ctx.strokeStyle = hexToRgba(item.color, 0.3);
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 3]);
      strokeCircle(ctx, 0, 0, s * 0.9);
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const a = spin * 0.2 + i * 1.6;
        const r = s * (0.3 + unit(item.seed, i + 290) * 0.4);
        ctx.fillStyle = hexToRgba(item.color, 0.25 + unit(item.seed, i + 300) * 0.2);
        fillCircle(ctx, Math.cos(a) * r, Math.sin(a) * r, s * 0.08);
      }
      ctx.fillStyle = hexToRgba(item.color, 0.5);
      fillCircle(ctx, 0, 0, s * 0.15);
      break;
    }
    case 'antiparticle': {
      // Matter-antimatter pair orbiting each other
      const pairAngle = spin * 1.5;
      const sep = s * 0.35;
      ctx.fillStyle = hexToRgba(item.color, 0.7);
      fillCircle(ctx, Math.cos(pairAngle) * sep, Math.sin(pairAngle) * sep, s * 0.2);
      ctx.fillStyle = hexToRgba(item.color, 0.35);
      fillCircle(ctx, -Math.cos(pairAngle) * sep, -Math.sin(pairAngle) * sep, s * 0.2);
      // Annihilation glow at center
      ctx.fillStyle = hexToRgba('#ffffff', 0.15 + Math.sin(spin * 3) * 0.1);
      fillCircle(ctx, 0, 0, s * 0.12);
      break;
    }
    case 'planet': {
      fillCircle(ctx, 0, 0, s * 0.55);
      // Ring
      ctx.strokeStyle = hexToRgba(item.color, 0.4);
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.0, s * 0.25, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      // Surface detail
      ctx.fillStyle = hexToRgba('#ffffff', 0.1);
      fillCircle(ctx, -s * 0.15, -s * 0.1, s * 0.12);
      break;
    }
    case 'water': {
      // Water droplet with ripple
      ctx.fillStyle = hexToRgba(item.color, 0.6);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.1, s * 0.35, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ripple rings
      for (let i = 1; i <= 2; i++) {
        const rr = s * (0.4 + i * 0.25) * (1 + Math.sin(now * 0.002 + i) * 0.1);
        ctx.strokeStyle = hexToRgba(item.color, 0.2 / i);
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.ellipse(0, s * 0.4, rr, rr * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'meson': {
      // Quark-antiquark pair tied by a vibrating color string
      const sep = s * 0.5;
      const wobble = Math.sin(now * 0.006 + unit(item.seed, 11) * 3) * s * 0.08;
      // Connecting string
      ctx.strokeStyle = hexToRgba(item.color, 0.6);
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(-sep, wobble);
      ctx.quadraticCurveTo(0, -wobble * 2, sep, wobble);
      ctx.stroke();
      // Two endpoints: quark + antiquark
      ctx.fillStyle = hexToRgba('#ffffff', 0.85);
      fillCircle(ctx, -sep, wobble, s * 0.18);
      fillCircle(ctx, sep, wobble, s * 0.18);
      // Bar over the right one to indicate "anti"
      ctx.strokeStyle = hexToRgba('#ffffff', 0.65);
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(sep - s * 0.18, wobble - s * 0.26);
      ctx.lineTo(sep + s * 0.18, wobble - s * 0.26);
      ctx.stroke();
      break;
    }
    case 'accretion': {
      // Funnel-like inflow: streamlines curving inward toward center
      const arms = 6;
      for (let i = 0; i < arms; i++) {
        const a0 = (i / arms) * Math.PI * 2 + spin * 0.4;
        ctx.strokeStyle = hexToRgba(item.color, 0.55);
        ctx.lineWidth = s * 0.08;
        ctx.beginPath();
        for (let t = 0; t < 12; t++) {
          const u = t / 12;
          const angle = a0 + u * 0.9; // curves as it falls in
          const radius = s * (1.1 - u);
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // Inflowing dust particles
      for (let i = 0; i < 5; i++) {
        const t = (now * 0.001 + unit(item.seed, i + 50)) % 1;
        const angle = unit(item.seed, i + 60) * Math.PI * 2 + t * 0.8;
        const radius = s * (1.0 - t);
        ctx.fillStyle = hexToRgba(item.color, 0.7 * (1 - t * 0.5));
        fillCircle(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, s * 0.06);
      }
      // Tiny bright core (the thing being fed)
      ctx.fillStyle = hexToRgba('#ffffff', 0.7);
      fillCircle(ctx, 0, 0, s * 0.12 * pulse);
      break;
    }
    case 'envelope': {
      // Small hot core wrapped in a billowing, slowly pulsing red envelope
      const breathing = 1 + Math.sin(now * 0.002 + unit(item.seed, 5)) * 0.12;
      // Outer envelope (translucent)
      const envR = s * 1.05 * breathing;
      const grad = ctx.createRadialGradient(0, 0, s * 0.25, 0, 0, envR);
      grad.addColorStop(0, hexToRgba(item.color, 0.55));
      grad.addColorStop(0.55, hexToRgba(item.color, 0.25));
      grad.addColorStop(1, hexToRgba(item.color, 0));
      ctx.fillStyle = grad;
      fillCircle(ctx, 0, 0, envR);
      // Wispy surface filaments
      for (let i = 0; i < 8; i++) {
        const a = spin * 0.3 + i * (Math.PI / 4);
        const wr = envR * (0.7 + Math.sin(now * 0.003 + i) * 0.2);
        ctx.strokeStyle = hexToRgba(item.color, 0.35);
        ctx.lineWidth = s * 0.04;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * envR * 0.4, Math.sin(a) * envR * 0.4);
        ctx.lineTo(Math.cos(a) * wr, Math.sin(a) * wr);
        ctx.stroke();
      }
      // Bright compact core
      ctx.fillStyle = hexToRgba('#ffe680', 0.9 * pulse);
      fillCircle(ctx, 0, 0, s * 0.22);
      break;
    }
    case 'nebula': {
      // Bipolar lobes with a faint central white-dwarf seed
      ctx.rotate(spin * 0.3);
      // Two asymmetric lobes (one on each side)
      for (const side of [-1, 1]) {
        const lobeGrad = ctx.createRadialGradient(side * s * 0.55, 0, 0, side * s * 0.55, 0, s * 0.7);
        lobeGrad.addColorStop(0, hexToRgba(item.color, 0.55));
        lobeGrad.addColorStop(0.6, hexToRgba(item.color, 0.18));
        lobeGrad.addColorStop(1, hexToRgba(item.color, 0));
        ctx.fillStyle = lobeGrad;
        ctx.beginPath();
        ctx.ellipse(side * s * 0.55, 0, s * 0.7, s * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Equatorial ring (thin, slightly tilted)
      ctx.strokeStyle = hexToRgba(item.color, 0.7);
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.05, s * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Central white-dwarf core (very bright pinpoint)
      ctx.fillStyle = hexToRgba('#e8f4ff', 0.95 * pulse);
      fillCircle(ctx, 0, 0, s * 0.13);
      break;
    }
    case 'crystal': {
      // A regular hexagonal lattice of bright nodes — frozen geometry
      const verts = 6;
      const r1 = s * 0.85;
      // Outer hexagon
      ctx.strokeStyle = hexToRgba(item.color, 0.85);
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      for (let i = 0; i <= verts; i++) {
        const a = (i / verts) * Math.PI * 2 + spin * 0.05;
        const px = Math.cos(a) * r1;
        const py = Math.sin(a) * r1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Inner spokes (to give a clear faceted look)
      ctx.strokeStyle = hexToRgba(item.color, 0.45);
      ctx.lineWidth = s * 0.045;
      for (let i = 0; i < verts; i++) {
        const a = (i / verts) * Math.PI * 2 + spin * 0.05;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      // Glittering vertex dots
      for (let i = 0; i < verts; i++) {
        const a = (i / verts) * Math.PI * 2 + spin * 0.05;
        const glint = 0.55 + Math.sin(now * 0.005 + i * 1.7) * 0.35;
        ctx.fillStyle = hexToRgba('#ffffff', glint);
        fillCircle(ctx, Math.cos(a) * r1, Math.sin(a) * r1, s * 0.09);
      }
      // Center gem
      ctx.fillStyle = hexToRgba('#ffffff', 0.9 * pulse);
      fillCircle(ctx, 0, 0, s * 0.16);
      break;
    }
    case 'particle':
    default: {
      // Generic particle cluster
      const dots = 3 + Math.floor(unit(item.seed, 310) * 2);
      for (let i = 0; i < dots; i++) {
        const a = spin * 0.6 + (i / dots) * Math.PI * 2;
        const r = s * (0.3 + unit(item.seed, i + 320) * 0.4);
        const dr = s * (0.1 + unit(item.seed, i + 330) * 0.12);
        ctx.fillStyle = hexToRgba(item.color, 0.4 + unit(item.seed, i + 340) * 0.3);
        fillCircle(ctx, Math.cos(a) * r, Math.sin(a) * r, dr);
      }
      ctx.fillStyle = hexToRgba(item.color, 0.5 * pulse);
      fillCircle(ctx, 0, 0, s * 0.15);
      break;
    }
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
  pointerPressure?: PointerPressureVisualField | null,
  cluster?: MoteCluster | null,
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
    // Stage 10: Sun glyph is represented by the evolving sun animation, skip it
    // Stage 10: Sun + planet-related entities are drawn by the cluster renderer
    if (stageId === 10) {
      const n = entity.name;
      if (n === 'Sun') continue;
    }
    const existing = entitiesById.get(entity.id);
    if (existing) {
      existing.count += entry.count;
    } else {
      const active = { entity, count: entry.count, sourceIndex };
      entitiesById.set(entity.id, active);
      activeEntities.push(active);
    }
  }

  // Dynamic per-rarity cap — start at each rarity's natural max (so a player who
  // owns 20 commons sees 20 commons), and only walk caps down when the total
  // particle count exceeds VISIBLE_PARTICLE_THRESHOLD.
  const caps: Record<EntityRarity, number> = { ...RARITY_MAX_VISIBLE };
  const computeTotalVisible = () => {
    let sum = 0;
    for (const ae of activeEntities) {
      sum += Math.min(ae.count, caps[ae.entity.rarity]);
    }
    return sum;
  };
  let totalVisible = computeTotalVisible();
  let cycleStep = 0;
  // Safety bound: cycle is at most ~6 * (20+10+5) = 210 iterations even if every
  // rarity gets walked to zero. In practice it stops much earlier.
  for (let safety = 0; safety < 300 && totalVisible > VISIBLE_PARTICLE_THRESHOLD; safety++) {
    const r = REDUCTION_CYCLE[cycleStep % REDUCTION_CYCLE.length];
    cycleStep++;
    if (caps[r] > 0) {
      caps[r] -= 1;
      totalVisible = computeTotalVisible();
    } else {
      // This rarity already exhausted — try the next slot in the cycle.
      // Avoid an infinite loop when all reducible rarities are at zero.
      let allZero = true;
      for (const checkR of ['common', 'rare', 'epic'] as EntityRarity[]) {
        if (caps[checkR] > 0) { allZero = false; break; }
      }
      if (allZero) break;
    }
  }

  for (const { entity, count, sourceIndex } of activeEntities) {
    const visibleCount = Math.min(count, caps[entity.rarity]);
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

  // Stage 11 uses its own entity lookup — skip the generic draw cap
  if (stageId === 11) {
    drawLifeEarthEntities(ctx, cx, cy, items, now, pointerPressure, cluster);
    return;
  }

  // Soft total cap: simple truncation in insertion order (no rarity priority).
  // The original rarity-priority cap erased Common entities when Rare/Epic
  // were added, so we just slice from the end if we ever exceed the ceiling.
  // Per-entity cap (MAX_VISIBLE_PER_ENTITY = 6) usually keeps us well under.
  if (items.length > HARD_CEILING) {
    items.length = HARD_CEILING;
  }

  // ── N-body physics simulation for entity particles ──────────────────────
  // Persistent velocity state across frames
  interface EntityBody { x: number; y: number; vx: number; vy: number; lastSeen: number }
  const bodyCache = _getEntityBodyCache();

  interface StageDynamics { gravity: number; repulsion: number; centerPull: number; dampening: number; maxSpeed: number }
  const STAGE_DYNAMICS: Record<number, StageDynamics> = {
    1:  { gravity: 1.6, repulsion: 5.0, centerPull: 0.003, dampening: 0.996, maxSpeed: 5.5 },
    2:  { gravity: 1.4, repulsion: 4.5, centerPull: 0.0025, dampening: 0.996, maxSpeed: 5.0 },
    3:  { gravity: 1.2, repulsion: 4.0, centerPull: 0.002, dampening: 0.997, maxSpeed: 4.5 },
    4:  { gravity: 0.9, repulsion: 3.5, centerPull: 0.001, dampening: 0.998, maxSpeed: 3.8 },
    5:  { gravity: 0.95, repulsion: 3.5, centerPull: 0.0012, dampening: 0.997, maxSpeed: 4.0 },
    6:  { gravity: 0.9, repulsion: 3.3, centerPull: 0.0012, dampening: 0.997, maxSpeed: 4.0 },
    7:  { gravity: 0.9, repulsion: 3.2, centerPull: 0.001, dampening: 0.998, maxSpeed: 3.8 },
    8:  { gravity: 1.0, repulsion: 3.5, centerPull: 0.001, dampening: 0.998, maxSpeed: 4.0 },
    9:  { gravity: 1.1, repulsion: 3.0, centerPull: 0.0012, dampening: 0.998, maxSpeed: 4.5 },
    10: { gravity: 0.7, repulsion: 2.8, centerPull: 0.0009, dampening: 0.998, maxSpeed: 3.2 },
    11: { gravity: 0.5, repulsion: 2.0, centerPull: 0.0006, dampening: 0.999, maxSpeed: 2.5 },
    12: { gravity: 1.3, repulsion: 4.0, centerPull: 0.0014, dampening: 0.998, maxSpeed: 4.5 },
    13: { gravity: 0.8, repulsion: 3.0, centerPull: 0.001, dampening: 0.998, maxSpeed: 3.5 },
    14: { gravity: 0.6, repulsion: 2.5, centerPull: 0.0008, dampening: 0.999, maxSpeed: 3.0 },
    15: { gravity: 1.5, repulsion: 4.5, centerPull: 0.0018, dampening: 0.997, maxSpeed: 5.5 },
    16: { gravity: 0.3, repulsion: 1.5, centerPull: 0.0004, dampening: 0.999, maxSpeed: 2.0 },
  };
  const dyn = STAGE_DYNAMICS[stageId] ?? { gravity: 0.8, repulsion: 3.0, centerPull: 0.008, dampening: 0.97, maxSpeed: 1.5 };
  const RARITY_MASS: Record<string, number> = { legendary: 3.0, epic: 2.0, rare: 1.4, common: 1.0 };
  const EFFECT_PERSONALITY: Record<string, { gravityMult: number; repulsionMult: number; speedMult: number }> = {
    auto:       { gravityMult: 1.0, repulsionMult: 0.8, speedMult: 1.0 },
    click:      { gravityMult: 0.7, repulsionMult: 1.4, speedMult: 1.3 },
    crit:       { gravityMult: 0.5, repulsionMult: 1.8, speedMult: 1.6 },
    time:       { gravityMult: 1.5, repulsionMult: 0.6, speedMult: 0.7 },
    multiplier: { gravityMult: 2.0, repulsionMult: 0.4, speedMult: 0.5 },
  };

  // Init or retrieve body state for each entity
  const bodies: { pos: EntityPosition; body: EntityBody; mass: number; pers: typeof EFFECT_PERSONALITY.auto }[] = [];
  for (const item of items) {
    const key = `${stageId}:${item.id}:${item.copyIndex}`;
    let body = bodyCache.get(key);
    if (!body) {
      const phase = unit(item.seed, 1) * Math.PI * 2;
      const r = 80 + unit(item.seed, 3) * 120;
      const tangentSpeed = 1.0 + unit(item.seed, 5) * 2.5;
      // Random orbit direction — 50% clockwise, 50% counter-clockwise
      const dir = unit(item.seed, 7) > 0.5 ? 1 : -1;
      body = {
        x: cx + Math.cos(phase) * r,
        y: cy + Math.sin(phase) * r,
        vx: -Math.sin(phase) * tangentSpeed * dir,
        vy: Math.cos(phase) * tangentSpeed * dir,
        lastSeen: now,
      };
      bodyCache.set(key, body);
    }
    body.lastSeen = now;
    const iconSize = ICON_SIZE[item.rarity];
    const glowR = GLOW_RADIUS[item.rarity];
    const pulse = item.rarity === 'legendary'
      ? 1 + Math.sin(now * 0.0016 + unit(item.seed, 1)) * 0.2
      : 1 + Math.sin(now * 0.0011 + unit(item.seed, 1)) * 0.06;
    const pos: EntityPosition = { item, x: body.x, y: body.y, size: iconSize * pulse, glowRadius: glowR * pulse };
    bodies.push({ pos, body, mass: RARITY_MASS[item.rarity] ?? 1, pers: EFFECT_PERSONALITY[item.effectType] ?? EFFECT_PERSONALITY.auto });
  }

  // ── Physics step (spatial-grid accelerated, O(N) average) ──────────────────
  // Each body is binned into a CELL_SIZE × CELL_SIZE grid cell. For each body
  // we only check pairs in its own cell + the 8 neighboring cells, and we
  // skip any pair beyond INTERACTION_RADIUS. This brings the per-frame cost
  // from N² (e.g. 19,600 pair checks for 140 particles) down to roughly
  // O(N × k) where k is the average neighbor count (~10-25), so the same
  // 140 particles now do ~1,400-3,500 pair checks instead.
  const CELL_SIZE = 90;            // shrunk to match smaller interaction radius
  const INTERACTION_RADIUS = 150;  // was 200 — fewer pair checks per body
  const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
  const grid = new Map<number, number[]>();
  const cellKey = (gx: number, gy: number) => gx * 100003 + gy;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const gx = Math.floor(b.body.x / CELL_SIZE);
    const gy = Math.floor(b.body.y / CELL_SIZE);
    const k = cellKey(gx, gy);
    let list = grid.get(k);
    if (!list) { list = []; grid.set(k, list); }
    list.push(i);
  }

  // Sleeping-body threshold: when both bodies in a pair are barely moving, skip
  // the inter-pair force calculation entirely. They'll still receive center-pull
  // and pointer push below, but skipping pairwise forces is a huge win in
  // late-game Stage 5/6 where particles tend to settle.
  const SLEEP_VEL_SQ = 0.04 * 0.04;

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    const aSpeedSq = a.body.vx * a.body.vx + a.body.vy * a.body.vy;
    const aSleeping = aSpeedSq < SLEEP_VEL_SQ;
    const agx = Math.floor(a.body.x / CELL_SIZE);
    const agy = Math.floor(a.body.y / CELL_SIZE);

    // Visit own cell + 8 neighbors
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = grid.get(cellKey(agx + ox, agy + oy));
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const j = list[k];
          if (j <= i) continue;  // unordered pair: only do i<j once
          // Skip pair entirely when both are essentially at rest.
          if (aSleeping) {
            const bj = bodies[j];
            const bSpeedSq = bj.body.vx * bj.body.vx + bj.body.vy * bj.body.vy;
            if (bSpeedSq < SLEEP_VEL_SQ) continue;
          }
          const b = bodies[j];
          const dx = b.body.x - a.body.x;
          const dy = b.body.y - a.body.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > INTERACTION_RADIUS_SQ) continue;  // far-field cutoff
          const d = Math.max(4, Math.sqrt(distSq));
          const nx = dx / d;
          const ny = dy / d;

          // Gravity pull between entities
          const gravAvg = (a.pers.gravityMult + b.pers.gravityMult) * 0.5;
          const gForce = dyn.gravity * gravAvg * (a.mass + b.mass) * 0.5 / (d * d + 400);
          a.body.vx += nx * gForce * a.pers.speedMult / a.mass;
          a.body.vy += ny * gForce * a.pers.speedMult / a.mass;
          b.body.vx -= nx * gForce * b.pers.speedMult / b.mass;
          b.body.vy -= ny * gForce * b.pers.speedMult / b.mass;

          // Repulsion when close
          const minDist = a.pos.size + b.pos.size + 18;
          if (d < minDist) {
            const distAC = Math.hypot(a.body.x - cx, a.body.y - cy);
            const distBC = Math.hypot(b.body.x - cx, b.body.y - cy);
            const centerFade = Math.min(1, Math.min(distAC, distBC) / 50);
            const repAvg = (a.pers.repulsionMult + b.pers.repulsionMult) * 0.5;
            const push = ((minDist - d) / minDist) * dyn.repulsion * repAvg * 0.08 * centerFade;
            a.body.vx -= nx * push * a.pers.speedMult / a.mass;
            a.body.vy -= ny * push * a.pers.speedMult / a.mass;
            b.body.vx += nx * push * b.pers.speedMult / b.mass;
            b.body.vy += ny * push * b.pers.speedMult / b.mass;
          }
        }
      }
    }

    // Center gravity + center repulsion (push away if too close)
    const toCx = cx - a.body.x;
    const toCy = cy - a.body.y;
    const cDist = Math.hypot(toCx, toCy) + 1;
    const ncx = toCx / cDist;
    const ncy = toCy / cDist;
    // Pull toward center (gentle, scales with distance)
    a.body.vx += ncx * dyn.centerPull * cDist * 0.3 * a.pers.speedMult;
    a.body.vy += ncy * dyn.centerPull * cDist * 0.3 * a.pers.speedMult;
    // Push away from center if too close (keeps entities from collapsing)
    const minCenterDist = 55;
    if (cDist < minCenterDist) {
      const centerPush = ((minCenterDist - cDist) / minCenterDist) * 0.6;
      a.body.vx -= ncx * centerPush;
      a.body.vy -= ncy * centerPush;
    }

    if (pointerPressure && pointerPressure.strength > 0) {
      const pdx = a.body.x - pointerPressure.x;
      const pdy = a.body.y - pointerPressure.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd < pointerPressure.radius) {
        const pnx = pd > 0.001 ? pdx / pd : 1;
        const pny = pd > 0.001 ? pdy / pd : 0;
        const push = Math.pow(1 - pd / pointerPressure.radius, 2) * pointerPressure.strength * 4.5;
        a.body.vx += pnx * push - pny * push * 0.14;
        a.body.vy += pny * push + pnx * push * 0.14;
      }
    }

    // Dampening
    a.body.vx *= dyn.dampening;
    a.body.vy *= dyn.dampening;

    // Speed cap
    const speed = Math.hypot(a.body.vx, a.body.vy);
    const maxSpd = dyn.maxSpeed * a.pers.speedMult;
    if (speed > maxSpd) {
      a.body.vx = (a.body.vx / speed) * maxSpd;
      a.body.vy = (a.body.vy / speed) * maxSpd;
    }

    // Integrate position
    a.body.x += a.body.vx;
    a.body.y += a.body.vy;
    a.pos.x = a.body.x;
    a.pos.y = a.body.y;
  }

  // Prune stale entries (entities sold/removed)
  for (const [key, body] of bodyCache) {
    if (now - body.lastSeen > 2000) bodyCache.delete(key);
  }

  const positions = bodies.map((b) => b.pos);

  ctx.save();
  drawGlobalEntityFields(ctx, cx, cy, activeEntities, now);

  ctx.lineWidth = 0.8;
  for (let index = 1; index < positions.length; index += 1) {
    const current = positions[index];
    const previous = positions[index - 1];
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (distance > 110) continue;  // was 170 — fewer gradient strokes when particles bunch up
    const alpha = Math.max(0.04, 0.15 - distance / 1400);
    const grad = ctx.createLinearGradient(previous.x, previous.y, current.x, current.y);
    grad.addColorStop(0, hexToRgba(previous.item.glowColor, alpha));
    grad.addColorStop(0.5, hexToRgba(current.item.glowColor, alpha * 0.3));
    grad.addColorStop(1, hexToRgba(current.item.glowColor, alpha));
    ctx.strokeStyle = grad;
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
