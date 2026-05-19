import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Burst, Flyer, Stage, AmbientParticle } from '../game/types';
import { drawStageSprite } from './stageSprites';

interface DrawParticlesArgs {
  ctx: CanvasRenderingContext2D;
  stage: Stage;
  particles: AmbientParticle[];
  flyers: Flyer[];
  bursts: Burst[];
}

export function drawParticles({ ctx, stage, particles, flyers, bursts }: DrawParticlesArgs): void {
  const particleAlphaBoost = stage.id === 11 ? TUNING.BLACK_HOLE_ALPHA_BOOST : 1;

  particles.forEach((particle) => {
    const alpha = (Math.sin(particle.phase) * 0.3 + 0.7) * particle.alpha * particleAlphaBoost;
    drawStageSprite(ctx, stage.id, particle.x, particle.y, particle.r, particle.color, alpha, particle.phase);
    const velocity = Math.hypot(particle.vx, particle.vy);
    if (velocity > 1.5) {
      ctx.strokeStyle = hexToRgba(particle.color, alpha * 0.4);
      ctx.lineWidth = particle.r * 0.8;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 3.2, particle.y - particle.vy * 3.2);
      ctx.stroke();
    }
  });

  flyers.forEach((flyer) => {
    const alpha = flyer.auto ? flyer.life * 0.85 : flyer.life * 0.75;
    const r = flyer.auto ? 3.2 : 4.0;
    ctx.fillStyle = hexToRgba(stage.accent, alpha * 0.25);
    ctx.beginPath();
    ctx.arc(flyer.x, flyer.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    drawStageSprite(
      ctx,
      flyer.spriteId ?? stage.id,
      flyer.x,
      flyer.y,
      r,
      stage.coreColor,
      alpha,
      flyer.life * Math.PI * 2,
    );
  });

  bursts.forEach((burst) => {
    drawStageSprite(
      ctx,
      burst.spriteId ?? stage.id,
      burst.x,
      burst.y,
      burst.r * burst.life,
      burst.color,
      burst.life,
      burst.life,
    );
  });
}
