import { hexToRgba } from '../game/formulas';
import type { EntityGlyph, EntityRarity, PurchasedEntityEntry } from '../game/entities/types';
import { STAGE_ENTITIES } from '../game/entities/stageItems';

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

const MAX_VISIBLE_PER_ENTITY = 24;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface EntityDrawItem {
  color: string;
  glowColor: string;
  glyph: EntityGlyph;
  rarity: EntityRarity;
  copyIndex: number;
  orderIndex: number;
  sourceIndex: number;
  seed: number;
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
  ctx.shadowBlur = item.rarity === 'legendary' ? 16 : 8;
  ctx.shadowColor = item.glowColor;

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
  let orderIndex = 0;

  for (const [sourceIndex, entry] of purchasedEntities.entries()) {
    if (entry.count <= 0) continue;
    const entity = STAGE_ENTITIES.find((e) => e.id === entry.entityId && e.stageId === stageId);
    if (!entity) continue;

    const visibleCount = Math.min(entry.count, MAX_VISIBLE_PER_ENTITY);
    for (let copyIndex = 0; copyIndex < visibleCount; copyIndex++) {
      items.push({
        color: entity.visual.color,
        glowColor: entity.visual.glowColor,
        glyph: entity.visual.glyph,
        rarity: entity.rarity,
        copyIndex,
        orderIndex,
        sourceIndex,
        seed: hashString(`${stageId}:${entry.entityId}:${sourceIndex}:${copyIndex}`),
      });
      orderIndex += 1;
    }
  }

  if (items.length === 0) return;

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
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    grad.addColorStop(0, hexToRgba(item.glowColor, isLegend ? 0.44 : 0.25));
    grad.addColorStop(1, hexToRgba(item.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
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
