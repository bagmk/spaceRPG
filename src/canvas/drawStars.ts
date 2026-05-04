import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Stage, Star } from '../game/types';

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  coreVX: number,
  coreVY: number,
  stage: Stage,
  width: number,
  height: number,
  now: number,
): void {
  const bg = stage.background;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, bg.gradientTop);
  gradient.addColorStop(1, bg.gradientBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawDistantElements(ctx, stage, width, height, now, coreVX, coreVY);

  stars.forEach((star) => {
    if (star.a > bg.starDensity) {
      return;
    }
    const twinkle = (Math.sin(star.twinkle) * 0.2 + 0.8) * star.a;
    const speed = Math.hypot(coreVX, coreVY) * star.depth;
    if (speed > TUNING.STAR_STREAK_THRESHOLD) {
      ctx.strokeStyle = hexToRgba(bg.starColor, twinkle * 0.6);
      ctx.lineWidth = star.r * 0.7;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(
        star.x + coreVX * star.depth * TUNING.STAR_STREAK_MULTIPLIER,
        star.y + coreVY * star.depth * TUNING.STAR_STREAK_MULTIPLIER,
      );
      ctx.stroke();
      return;
    }
    ctx.fillStyle = hexToRgba(bg.starColor, twinkle);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDistantElements(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  width: number,
  height: number,
  now: number,
  coreVX: number,
  coreVY: number,
): void {
  const bg = stage.background;
  const intensity = bg.nebulaIntensity;
  if (intensity <= 0) return;

  const t = now / 1000;
  const offsetX = -coreVX * 28;
  const offsetY = -coreVY * 18;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.globalCompositeOperation = 'screen';

  switch (bg.distantElements) {
    case 'expansion_burst':
      drawRadialBurst(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'pair_streaks':
      drawPairStreaks(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'plasma_swirl':
      drawPlasmaSwirls(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'binding_orbits':
      drawBindingOrbits(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'clearing_fog':
      drawFog(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'bright_pinpoints':
      drawPinpointHalo(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'ionization_bubbles':
      drawIonizationBubbles(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'galaxy_field':
      drawGalaxyHints(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'nearby_stars':
      drawNearbyStarGlow(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'earth_orbit':
      drawEarthOrbitHint(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'red_shroud':
      drawRedShroud(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'fading_stars':
    case 'dim_specks':
      drawFadingField(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'lensed_field':
      drawLensedField(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'redshifted_void':
      drawRedshiftedVoid(ctx, width, height, t, bg.distantElementColor, intensity);
      break;
    case 'void':
      break;
  }

  ctx.restore();
}

function drawRadialBurst(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  for (let ray = 0; ray < 28; ray += 1) {
    const angle = (ray / 28) * Math.PI * 2 + Math.sin(t * 0.4) * 0.08;
    const r0 = 20;
    const r1 = Math.max(width, height) * (0.42 + (ray % 4) * 0.06);
    ctx.strokeStyle = hexToRgba(color, intensity * 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();
  }
}

function drawPairStreaks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 97 + t * 18) % (width + 120)) - 60;
    const y = height * (0.18 + ((i * 37) % 70) / 100);
    ctx.strokeStyle = hexToRgba(color, intensity * 0.18);
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 8);
    ctx.lineTo(x + 22, y + 8);
    ctx.moveTo(x + 28, y - 8);
    ctx.lineTo(x - 16, y + 8);
    ctx.stroke();
  }
}

function drawPlasmaSwirls(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 7; i += 1) {
    const x = (i / 6) * width + Math.sin(t * 0.55 + i) * 50;
    const y = height * 0.32 + Math.cos(t * 0.48 + i * 1.3) * 80;
    const radius = 70 + 36 * Math.sin(t * 0.7 + i);
    ctx.fillStyle = hexToRgba(color, 0.08 * intensity);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBindingOrbits(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = hexToRgba(color, intensity * (0.08 + i * 0.01));
    ctx.beginPath();
    ctx.ellipse(cx, cy, 90 + i * 38, 24 + i * 12, t * 0.04 + i * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 5; i += 1) {
    const x = width * (0.15 + i * 0.2) + Math.sin(t * 0.2 + i) * 20;
    const y = height * (0.22 + (i % 2) * 0.28);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, width * 0.3);
    grad.addColorStop(0, hexToRgba(color, intensity * 0.12));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawPinpointHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 10; i += 1) {
    const x = width * (((i * 23) % 100) / 100);
    const y = height * (((i * 41) % 100) / 100);
    const r = 16 + Math.sin(t * 2 + i) * 5;
    ctx.fillStyle = hexToRgba(color, intensity * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIonizationBubbles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 9; i += 1) {
    const x = width * (((i * 29) % 100) / 100);
    const y = height * (((i * 47) % 100) / 100);
    ctx.strokeStyle = hexToRgba(color, intensity * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, 34 + (i % 4) * 18 + Math.sin(t + i) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGalaxyHints(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 6; i += 1) {
    const x = width * (0.12 + ((i * 17) % 74) / 100);
    const y = height * (0.15 + ((i * 31) % 68) / 100);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.02 + i);
    ctx.strokeStyle = hexToRgba(color, intensity * 0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 + (i % 3) * 7, 7 + (i % 2) * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawNearbyStarGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const x = width * 0.18;
  const y = height * 0.24;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 160 + Math.sin(t) * 8);
  grad.addColorStop(0, hexToRgba(color, intensity * 0.28));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawEarthOrbitHint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const cx = width * 0.5;
  const cy = height * 0.5;
  ctx.strokeStyle = hexToRgba(color, intensity * 0.12);
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.22, height * 0.09, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hexToRgba(color, intensity * 0.3);
  ctx.beginPath();
  ctx.arc(cx + Math.cos(t * 0.2) * width * 0.22, cy + Math.sin(t * 0.2) * height * 0.09, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawRedShroud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 20, width * 0.5, height * 0.5, width * 0.48);
  grad.addColorStop(0, hexToRgba(color, intensity * (0.22 + Math.sin(t) * 0.04)));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawFadingField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 18; i += 1) {
    const x = width * (((i * 19) % 100) / 100);
    const y = height * (((i * 43) % 100) / 100);
    ctx.fillStyle = hexToRgba(color, intensity * (0.05 + Math.max(0, Math.sin(t * 0.4 + i)) * 0.08));
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLensedField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = hexToRgba(color, intensity * (0.12 + i * 0.02));
    ctx.beginPath();
    ctx.arc(cx, cy, 90 + i * 38 + Math.sin(t + i) * 3, Math.PI * 0.1, Math.PI * 1.35);
    ctx.stroke();
  }
}

function drawRedshiftedVoid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  color: string,
  intensity: number,
): void {
  for (let i = 0; i < 4; i += 1) {
    const y = height * (0.2 + i * 0.18);
    ctx.strokeStyle = hexToRgba(color, intensity * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(t * 0.2 + i) * 8);
    ctx.lineTo(width, y + Math.cos(t * 0.18 + i) * 8);
    ctx.stroke();
  }
}
