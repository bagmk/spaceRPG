import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Rogue, Shockwave } from '../game/types';

interface DrawEffectsArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  now: number;
  color: string;
  rogues: Rogue[];
  shockwaves: Shockwave[];
}

export function drawEffects({
  ctx,
  width,
  height,
  now,
  color,
  rogues,
  shockwaves,
}: DrawEffectsArgs): void {
  const cx = width / 2;
  const cy = height / 2;

  shockwaves.forEach((shockwave) => {
    const ageMs = now - shockwave.startedAt;
    const lifeMs = shockwave.lifeMs ?? TUNING.SHOCKWAVE_FADE_MS;
    if (ageMs > lifeMs) {
      return;
    }
    const age = ageMs / 1000;
    const opacity = Math.max(0, 1 - ageMs / lifeMs);
    const radius = Math.min(
      shockwave.maxRadius ?? Number.POSITIVE_INFINITY,
      age * TUNING.SHOCKWAVE_SPEED_PX_PER_SEC,
    );
    const waveX = shockwave.x ?? cx;
    const waveY = shockwave.y ?? cy;
    ctx.strokeStyle = hexToRgba(shockwave.color, opacity);
    ctx.lineWidth = (shockwave.lineWidth ?? 6) * opacity;
    ctx.beginPath();
    ctx.arc(waveX, waveY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = hexToRgba('#ffffff', opacity * 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(waveX, waveY, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  });

  rogues.forEach((rogue) => {
    const onScreen = rogue.x > 0 && rogue.x < width && rogue.y > 0 && rogue.y < height;
    if (onScreen) {
      return;
    }
    const dx = rogue.x - cx;
    const dy = rogue.y - cy;
    const angle = Math.atan2(dy, dx);
    const halfWidth = width / 2 - TUNING.ROGUE_INDICATOR_MARGIN;
    const halfHeight = height / 2 - TUNING.ROGUE_INDICATOR_MARGIN;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const distanceX = halfWidth / Math.abs(cosAngle || 0.0001);
    const distanceY = halfHeight / Math.abs(sinAngle || 0.0001);
    const travel = Math.min(distanceX, distanceY);
    const indicatorX = cx + cosAngle * travel;
    const indicatorY = cy + sinAngle * travel;
    const pulse = 1 + Math.sin(now / TUNING.ROGUE_INDICATOR_PULSE_MS) * 0.25;

    const distance = Math.hypot(dx, dy);
    const alpha = Math.min(0.9, Math.max(0.35, 1 - distance / (Math.max(width, height) * 1.5)));

    ctx.save();
    ctx.translate(indicatorX, indicatorY);
    ctx.rotate(angle);

    // Arrow chevron
    const size = 8 * pulse;
    ctx.strokeStyle = rogue.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, -size);
    ctx.lineTo(size * 0.6, 0);
    ctx.lineTo(-size * 0.6, size);
    ctx.stroke();

    // Soft glow dot
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = rogue.color;
    ctx.beginPath();
    ctx.arc(0, 0, 4 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  });
}
