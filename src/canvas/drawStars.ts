import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Star } from '../game/types';

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  coreVX: number,
  coreVY: number,
): void {
  stars.forEach((star) => {
    const twinkle = (Math.sin(star.twinkle) * 0.2 + 0.8) * star.a;
    const speed = Math.hypot(coreVX, coreVY) * star.depth;
    if (speed > TUNING.STAR_STREAK_THRESHOLD) {
      ctx.strokeStyle = hexToRgba('#ffffff', twinkle * 0.6);
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
    ctx.fillStyle = hexToRgba('#ffffff', twinkle);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
}
