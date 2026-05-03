import { hexToRgba } from '../game/formulas';
import type { WakeTrail } from '../game/types';

export function drawWake(ctx: CanvasRenderingContext2D, wakeTrails: WakeTrail[]): void {
  wakeTrails.forEach((trail) => {
    ctx.fillStyle = hexToRgba(trail.color, trail.life * 0.5);
    ctx.beginPath();
    ctx.arc(trail.x, trail.y, trail.r * trail.life, 0, Math.PI * 2);
    ctx.fill();
  });
}
