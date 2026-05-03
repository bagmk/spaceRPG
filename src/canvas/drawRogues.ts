import { hexToRgba } from '../game/formulas';
import type { Rogue } from '../game/types';
import { drawStageSprite } from './stageSprites';

function formatRogueDistance(stageId: number, fracOfScreen: number): string {
  const v = Math.max(1, Math.floor(fracOfScreen * 20));
  if (stageId <= 3) return `${v} ps·c`;
  if (stageId <= 6) return `${v} AU`;
  if (stageId <= 9) return `${v} ly`;
  if (stageId <= 12) return `${v} AU`;
  if (stageId <= 14) return `${v} ly`;
  return `${v} Mpc`;
}

export function drawRogues(
  ctx: CanvasRenderingContext2D,
  rogues: Rogue[],
  width: number,
  height: number,
  now: number,
): void {
  rogues.forEach((rogue) => {
    const onScreen =
      rogue.x > -50 && rogue.x < width + 50 && rogue.y > -50 && rogue.y < height + 50;
    if (!onScreen) {
      return;
    }

    const pulse = 1 + Math.sin(now / 350 + rogue.rotation * 5) * 0.15;
    const gradientRadius = rogue.r * 3.5;
    if (!Number.isFinite(gradientRadius) || gradientRadius <= 0) {
      return;
    }
    const glow = ctx.createRadialGradient(rogue.x, rogue.y, 0, rogue.x, rogue.y, gradientRadius);
    glow.addColorStop(0, hexToRgba(rogue.glowColor, 0.55));
    glow.addColorStop(0.4, hexToRgba(rogue.color, 0.25));
    glow.addColorStop(1, hexToRgba(rogue.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(rogue.x, rogue.y, gradientRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 18;
    ctx.shadowColor = rogue.color;
    drawStageSprite(ctx, rogue.stageId, rogue.x, rogue.y, rogue.r * 0.42 * pulse, rogue.color, 0.95, rogue.rotation);
    ctx.shadowBlur = 0;

    if (rogue.typeKey === 'major') {
      for (let index = 0; index < 2; index += 1) {
        const angle = rogue.rotation * 4 + index * Math.PI;
        const satelliteX = rogue.x + Math.cos(angle) * rogue.r * 1.7;
        const satelliteY = rogue.y + Math.sin(angle) * rogue.r * 1.7;
        ctx.fillStyle = hexToRgba('#ffffff', 0.85);
        ctx.beginPath();
        ctx.arc(satelliteX, satelliteY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (rogue.typeKey === 'massive') {
      ctx.strokeStyle = hexToRgba('#ffffff', 0.7 + Math.sin(now / 80) * 0.3);
      ctx.lineWidth = 1.5;
      for (let index = 0; index < 5; index += 1) {
        const angle =
          rogue.rotation * 2 + index * Math.PI * 0.4 + Math.sin(now / 120 + index) * 0.3;
        const length = rogue.r * (1.4 + Math.sin(now / 100 + index) * 0.3);
        ctx.beginPath();
        ctx.moveTo(rogue.x, rogue.y);
        ctx.lineTo(rogue.x + Math.cos(angle) * length, rogue.y + Math.sin(angle) * length);
        ctx.stroke();
      }
    }

    const dx = rogue.x - width / 2;
    const dy = rogue.y - height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fracOfScreen = dist / Math.min(width, height) / 2;
    if (fracOfScreen > 0.5) {
      const alpha = Math.min(0.9, (fracOfScreen - 0.5) * 1.4);
      ctx.fillStyle = hexToRgba('#ffffff', alpha);
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatRogueDistance(rogue.stageId, fracOfScreen), rogue.x, rogue.y - rogue.r - 10);
    }
  });
}
