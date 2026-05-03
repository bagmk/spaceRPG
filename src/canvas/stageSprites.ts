import { hexToRgba } from '../game/formulas';
import type { RogueTypeKey, Stage } from '../game/types';

const ROGUE_NAMES: Record<number, Record<RogueTypeKey, string>> = {
  1: { minor: 'Inflation Shard', major: 'Vacuum Pulse', massive: 'Expansion Front' },
  2: { minor: 'Matter Survivor', major: 'Charge Pair', massive: 'Annihilation Knot' },
  3: { minor: 'Quark Flicker', major: 'Gluon Coil', massive: 'Plasma Surge' },
  4: { minor: 'Bound Proton', major: 'Helium Seed', massive: 'Fusion Bloom' },
  5: { minor: 'Captured Electron', major: 'Young Atom', massive: 'Photon Torrent' },
  6: { minor: 'Cold Hydrogen', major: 'Shadow Drift', massive: 'Silent Cloud' },
  7: { minor: 'Protostar', major: 'Blue Giant', massive: 'Population III Titan' },
  8: { minor: 'Ion Bubble', major: 'Bright Front', massive: 'Clearing Wave' },
  9: { minor: 'Spiral Wisp', major: 'Dense Core', massive: 'Quasar Heart' },
  10: { minor: 'Planetesimal', major: 'Young World', massive: 'Accretion Giant' },
  11: { minor: 'Living Cell', major: 'Ocean Bloom', massive: 'Memory Cluster' },
  12: { minor: 'Solar Ember', major: 'Ash Ring', massive: 'Scorched Orbit' },
  13: { minor: 'Cooling Dwarf', major: 'Cold Relic', massive: 'Iron Remnant' },
  14: { minor: 'Decay Spark', major: 'Crystal Ghost', massive: 'Degenerate Core' },
  15: { minor: 'Hawking Trace', major: 'Photon Arc', massive: 'Rogue Horizon' },
  16: { minor: 'Thermal Ripple', major: 'Ghost Fluctuation', massive: 'Boltzmann Flicker' },
};

const ROGUE_SHAPES: Record<number, string> = {
  1: 'inflation',
  2: 'baryon',
  3: 'quark',
  4: 'nucleus',
  5: 'atom',
  6: 'hydrogen',
  7: 'star',
  8: 'bubble',
  9: 'galaxy',
  10: 'planet',
  11: 'cell',
  12: 'ember',
  13: 'dwarf',
  14: 'decay',
  15: 'hawking',
  16: 'fluctuation',
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

export function getStageRogueShape(stageId: number): string {
  return ROGUE_SHAPES[stageId] ?? 'inflation';
}

export function drawSoftNode(
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

export function drawThread(
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

export function strokeLocalEllipse(
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

export function drawStageSprite(
  ctx: CanvasRenderingContext2D,
  stageId: number,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  t: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
  switch (stageId) {
    case 1:
      drawSpriteInflation(ctx, r, color, t);
      break;
    case 2:
      drawSpriteBaryon(ctx, r, color, t);
      break;
    case 3:
      drawSpriteQuark(ctx, r, color, t);
      break;
    case 4:
      drawSpriteNucleus(ctx, r, color);
      break;
    case 5:
      drawSpriteAtom(ctx, r, color, t);
      break;
    case 6:
      drawSpriteHydrogen(ctx, r, color);
      break;
    case 7:
      drawSpriteStar(ctx, r, color, t);
      break;
    case 8:
      drawSpriteIonBubble(ctx, r, color, t);
      break;
    case 9:
      drawSpriteGalaxy(ctx, r, color, t);
      break;
    case 10:
      drawSpritePlanet(ctx, r, color);
      break;
    case 11:
      drawSpriteCell(ctx, r, color);
      break;
    case 12:
      drawSpriteEmber(ctx, r, color, t);
      break;
    case 13:
      drawSpriteDwarf(ctx, r, color);
      break;
    case 14:
      drawSpriteDecay(ctx, r, color, t);
      break;
    case 15:
      drawSpriteHawking(ctx, r, color, t);
      break;
    case 16:
      drawSpriteFluctuation(ctx, r, color, t);
      break;
    default:
      drawSpriteInflation(ctx, r, color, t);
  }
  ctx.restore();
}

function drawSpriteInflation(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  const blur = Math.max(2, r * 1.8);
  ctx.rotate(t * 0.5);
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = hexToRgba(color, 0.35);
  ctx.fillRect(-blur * 0.2, -r * 0.5, blur, r);
}

function drawSpriteBaryon(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.2, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, 0);
  ctx.lineTo(r * 0.6, 0);
  if (Math.sin(t * 3) > 0) {
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(0, r * 0.6);
  }
  ctx.stroke();
}

function drawSpriteQuark(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.rotate(t);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(r, r);
  ctx.lineTo(-r, r);
  ctx.closePath();
  ctx.fill();
}

function drawSpriteNucleus(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const small = Math.max(1.2, r * 0.8);
  ctx.fillStyle = color;
  [-1, 1, 0].forEach((offset, index) => {
    ctx.beginPath();
    ctx.arc(offset * small * 0.8, index === 2 ? -small * 0.7 : small * 0.3, small, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSpriteAtom(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.2, r * 0.7), 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(t * 0.8);
  ctx.strokeStyle = hexToRgba(color, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.8, r * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpriteHydrogen(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, r * 0.7), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(r, -1, 2, 2);
}

function drawSpriteStar(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.rotate(t * 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.4);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.8);
  ctx.lineTo(0, r * 1.8);
  ctx.moveTo(-r * 1.8, 0);
  ctx.lineTo(r * 1.8, 0);
  ctx.stroke();
}

function drawSpriteIonBubble(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  const rr = r * (1.4 + (Math.sin(t * 4) + 1) * 0.2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rr * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpriteGalaxy(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.rotate(t * 0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let arm = 0; arm < 2; arm += 1) {
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const u = i / 11;
      const angle = arm * Math.PI + u * Math.PI * 1.8;
      const dist = r * (0.2 + u * 1.8);
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist * 0.7;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawSpritePlanet(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r * 1.1), 0, Math.PI * 2);
  ctx.fill();
}

function drawSpriteCell(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = hexToRgba(color, 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.8, r * 1.15), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.8, r * 0.35), 0, Math.PI * 2);
  ctx.fill();
}

function drawSpriteEmber(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.rotate(t * 0.8);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.4);
  ctx.lineTo(r, -r * 0.2);
  ctx.lineTo(r * 0.5, r * 1.2);
  ctx.lineTo(-r * 0.7, r * 0.9);
  ctx.lineTo(-r, -r * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawSpriteDwarf(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSpriteDecay(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.rotate(Math.sin(t * 8) * 0.2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r, -r);
  ctx.lineTo(r, r);
  ctx.moveTo(-r, r);
  ctx.lineTo(r, -r);
  ctx.stroke();
}

function drawSpriteHawking(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, r), Math.PI * 0.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.rotate(t * 0.5);
  ctx.beginPath();
  ctx.moveTo(r * 0.3, -r * 1.3);
  ctx.lineTo(r * 1.5, -r * 2.1);
  ctx.lineTo(r * 1.1, -r * 1.2);
  ctx.stroke();
}

function drawSpriteFluctuation(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  if (Math.sin(t * 10) > -0.2) {
    ctx.fillStyle = color;
    ctx.fillRect(-r * 0.5, -r * 0.5, Math.max(1, r), Math.max(1, r));
  }
}
