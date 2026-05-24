import { hexToRgba } from '../game/formulas';
import type { RogueTypeKey, Stage } from '../game/types';
import type { Lang } from '../i18n';

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

const ROGUE_NAME_KO: Record<string, string> = {
  'Inflation Shard': '인플레이션 파편',
  'Vacuum Pulse': '진공 파동',
  'Expansion Front': '팽창 전선',
  'Matter Survivor': '물질 생존자',
  'Charge Pair': '전하 쌍',
  'Annihilation Knot': '쌍소멸 매듭',
  'Quark Flicker': '쿼크 섬광',
  'Gluon Coil': '글루온 고리',
  'Plasma Surge': '플라스마 쇄도',
  'Bound Proton': '결합 양성자',
  'Helium Seed': '헬륨 씨앗',
  'Fusion Bloom': '융합 개화',
  'Captured Electron': '포획 전자',
  'Young Atom': '어린 원자',
  'Photon Torrent': '광자 급류',
  'Cold Hydrogen': '차가운 수소',
  'Shadow Drift': '그림자 표류',
  'Silent Cloud': '침묵의 구름',
  'Protostar': '원시별',
  'Blue Giant': '청색거성',
  'Population III Titan': '제3종족 거성',
  'Ion Bubble': '이온 거품',
  'Bright Front': '밝은 전선',
  'Clearing Wave': '개벽의 파동',
  'Spiral Wisp': '나선 성운결',
  'Dense Core': '고밀도 핵',
  'Quasar Heart': '퀘이사 심장',
  'Planetesimal': '미행성체',
  'Young World': '어린 행성',
  'Accretion Giant': '강착 거체',
  'Living Cell': '살아있는 세포',
  'Ocean Bloom': '바다 개화',
  'Memory Cluster': '기억 군집',
  'Solar Ember': '태양 불씨',
  'Ash Ring': '재의 고리',
  'Scorched Orbit': '그을린 궤도',
  'Cooling Dwarf': '식어가는 왜성',
  'Cold Relic': '차가운 유물',
  'Iron Remnant': '철 잔해',
  'Decay Spark': '붕괴 불꽃',
  'Crystal Ghost': '결정 유령',
  'Degenerate Core': '축퇴핵',
  'Hawking Trace': '호킹 흔적',
  'Photon Arc': '광자 호',
  'Rogue Horizon': '떠도는 지평선',
  'Thermal Ripple': '열적 물결',
  'Ghost Fluctuation': '유령 요동',
  'Boltzmann Flicker': '볼츠만 깜빡임',
  'Rogue Object': '떠도는 천체',
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

export function getRogueNameLabel(name: string, lang: Lang): string {
  return lang === 'ko' ? ROGUE_NAME_KO[name] ?? name : name;
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
  const s = Math.max(2.5, r * 2.2);
  // Quantum foam bubble — pulsating energy ripple
  // Size varies per particle via t phase offset
  const sizeVar = 0.8 + Math.sin(t * 0.7) * 0.4; // 0.4–1.2x variation
  const sz = s * sizeVar;
  const pulse = 0.7 + Math.sin(t * 3) * 0.3;
  const breathe = 0.8 + Math.sin(t * 1.7) * 0.2;

  // Outer energy ripple ring (expanding spacetime)
  ctx.strokeStyle = hexToRgba(color, 0.15 * pulse);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, sz * 1.4 * breathe, 0, Math.PI * 2);
  ctx.stroke();

  // Second ripple ring offset
  ctx.strokeStyle = hexToRgba(color, 0.08 * pulse);
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, sz * 1.8 * breathe, 0, Math.PI * 2);
  ctx.stroke();

  // Inner vacuum fluctuation — soft glowing blob
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * pulse);
  grad.addColorStop(0, hexToRgba('#ffffff', 0.45 * pulse));
  grad.addColorStop(0.35, hexToRgba(color, 0.3 * pulse));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, sz * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Energy sparks orbiting (virtual particle pairs)
  for (let i = 0; i < 4; i++) {
    const a = t * 0.8 + (i / 4) * Math.PI * 2;
    const orbitR = sz * (0.5 + Math.sin(t * 0.6 + i * 2) * 0.3);
    const sx = Math.cos(a) * orbitR;
    const sy = Math.sin(a) * orbitR;
    const sparkR = sz * (0.12 + Math.sin(t * 1.5 + i) * 0.06);
    ctx.fillStyle = hexToRgba('#ffffff', 0.35 + Math.sin(t * 1.2 + i * 1.5) * 0.2);
    ctx.beginPath();
    ctx.arc(sx, sy, sparkR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpriteBaryon(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  const s = Math.max(1.2, r);
  // Quark triplet — 3 small colored dots orbiting a center
  // Represents the 3 color charges (r/g/b) of QCD
  const qColors = ['#ff6666', '#66dd66', '#6688ff'];
  const orbitR = s * 0.55;
  ctx.rotate(t * 0.8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const qx = Math.cos(a) * orbitR;
    const qy = Math.sin(a) * orbitR;
    // Gluon connection line to center
    ctx.strokeStyle = hexToRgba(qColors[i], 0.25);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(qx, qy);
    ctx.stroke();
    // Quark dot
    ctx.fillStyle = qColors[i];
    ctx.beginPath();
    ctx.arc(qx, qy, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center glow (confinement)
  ctx.fillStyle = hexToRgba(color, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
  ctx.fill();
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
  // Ice crystal / snowflake
  const s = Math.max(1.5, r * 1.3);
  const branches = 6;
  ctx.strokeStyle = hexToRgba(color, 0.75);
  ctx.lineWidth = Math.max(0.4, s * 0.1);
  ctx.lineCap = 'round';
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ca * s, sa * s);
    ctx.stroke();
    // Side twigs
    const mid = s * 0.55;
    const tw = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(ca * mid, sa * mid);
    ctx.lineTo(ca * mid + Math.cos(a + 0.5) * tw, sa * mid + Math.sin(a + 0.5) * tw);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ca * mid, sa * mid);
    ctx.lineTo(ca * mid + Math.cos(a - 0.5) * tw, sa * mid + Math.sin(a - 0.5) * tw);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRgba('#ffffff', 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
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
  // Stage 13: Dying star — dimming glow with fading corona
  const s = Math.max(2, r * 1.8);
  // Fading corona
  const grad = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.2);
  grad.addColorStop(0, hexToRgba(color, 0.5));
  grad.addColorStop(0.5, hexToRgba(color, 0.15));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Dense core
  ctx.fillStyle = hexToRgba(color, 0.7);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Faint pulsating ring (remnant shell)
  ctx.strokeStyle = hexToRgba(color, 0.15);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpriteDecay(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  // Stage 14: Particle decay — fragments splitting apart from center
  const s = Math.max(2, r * 1.8);
  const phase = t * 0.8;
  // Decaying fragments flying outward
  for (let i = 0; i < 5; i++) {
    const a = phase + (i / 5) * Math.PI * 2;
    const dist = s * (0.2 + ((t * 0.3 + i * 0.2) % 1) * 0.8);
    const fade = 1 - ((t * 0.3 + i * 0.2) % 1);
    const px = Math.cos(a) * dist;
    const py = Math.sin(a) * dist;
    ctx.fillStyle = hexToRgba(color, fade * 0.5);
    ctx.beginPath();
    ctx.arc(px, py, s * 0.08 * fade, 0, Math.PI * 2);
    ctx.fill();
  }
  // Unstable core flickering
  const flicker = 0.4 + Math.sin(t * 5) * 0.3;
  ctx.fillStyle = hexToRgba(color, flicker);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Decay wave ring
  ctx.strokeStyle = hexToRgba(color, 0.12);
  ctx.lineWidth = 0.3;
  const waveR = s * (0.3 + (t * 0.5 % 1) * 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, waveR, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpriteHawking(ctx: CanvasRenderingContext2D, r: number, color: string, t: number): void {
  // Stage 15: Hawking radiation — black hole emitting particles
  const s = Math.max(2, r * 1.8);
  // Event horizon (dark center)
  ctx.fillStyle = '#020308';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Photon ring
  ctx.strokeStyle = hexToRgba(color, 0.35);
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  // Hawking radiation particles escaping
  for (let i = 0; i < 4; i++) {
    const a = t * 0.6 + (i / 4) * Math.PI * 2;
    const escape = s * (0.6 + ((t * 0.4 + i * 0.25) % 1) * 0.6);
    const fade = 1 - ((t * 0.4 + i * 0.25) % 1);
    ctx.fillStyle = hexToRgba(color, fade * 0.6);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * escape, Math.sin(a) * escape, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  // Accretion glow
  const glowGrad = ctx.createRadialGradient(0, 0, s * 0.35, 0, 0, s * 0.9);
  glowGrad.addColorStop(0, hexToRgba(color, 0.15));
  glowGrad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpriteFluctuation(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
): void {
  // Stage 16: Heat death — lone fading particle in void
  const s = Math.max(2, r * 1.6);
  // Single dim particle that breathes
  const breathe = 0.3 + Math.sin(t * 0.5) * 0.3;
  const drift = Math.sin(t * 0.3) * s * 0.15;
  // Faint void glow
  const voidGrad = ctx.createRadialGradient(drift, 0, 0, drift, 0, s * 0.8);
  voidGrad.addColorStop(0, hexToRgba(color, 0.08 * breathe));
  voidGrad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = voidGrad;
  ctx.beginPath();
  ctx.arc(drift, 0, s * 0.8, 0, Math.PI * 2);
  ctx.fill();
  // The lone particle
  ctx.fillStyle = hexToRgba(color, breathe);
  ctx.beginPath();
  ctx.arc(drift, Math.cos(t * 0.4) * s * 0.08, s * 0.1 * breathe, 0, Math.PI * 2);
  ctx.fill();
  // Occasional quantum flicker (ghost particle appears/disappears)
  if (Math.sin(t * 3) > 0.7) {
    const fx = Math.sin(t * 1.7) * s * 0.5;
    const fy = Math.cos(t * 2.1) * s * 0.4;
    ctx.fillStyle = hexToRgba('#ffffff', 0.15);
    ctx.beginPath();
    ctx.arc(fx, fy, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}
