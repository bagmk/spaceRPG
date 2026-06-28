import { TUNING } from '../game/constants';
import { hexToRgba } from '../game/formulas';
import type { Stage } from '../game/types';

interface DrawCoreArgs {
  ctx: CanvasRenderingContext2D;
  stage: Stage;
  width: number;
  height: number;
  progress: number;
  showThresholdRing: boolean;
  now: number;
  idlePulse: boolean;
  /** 물질 응축 charge 0..1 — matter income fills it; draws a purple charge halo on the core. */
  charge01: number;
  /** Fully charged & legal to fire — the halo animates/pulses to invite the tap. */
  charged: boolean;
}

export function drawCore({
  ctx,
  stage,
  width,
  height,
  progress,
  showThresholdRing,
  now,
  idlePulse,
  charge01,
  charged,
}: DrawCoreArgs): void {
  const cx = width / 2;
  const cy = height / 2;
  const glowRadius = Math.max(width, height) * TUNING.FIELD_GLOW_RADIUS_FRAC;

  if (Number.isFinite(glowRadius) && glowRadius > 0) {
    const fieldGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    fieldGlow.addColorStop(0, hexToRgba(stage.accent, 0.1 + progress * 0.06));
    fieldGlow.addColorStop(0.5, hexToRgba(stage.accent, 0.03));
    fieldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fieldGlow;
    ctx.fillRect(0, 0, width, height);
  }

  if (progress > 0.3) {
    ctx.strokeStyle = hexToRgba(stage.accent, 0.06 * progress);
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, 60 * ring + Math.sin(now / 1200 + ring) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const coreRadius = TUNING.CORE_BASE_RADIUS + progress * TUNING.CORE_PROGRESS_RADIUS;

  if (showThresholdRing) {
    const time = now / 600;
    const ringRadius =
      coreRadius * TUNING.THRESHOLD_RING_RADIUS_MULT +
      Math.sin(time) * TUNING.THRESHOLD_RING_OSCILLATION;
    ctx.strokeStyle = hexToRgba(stage.accent, 0.6 + Math.sin(time) * 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Idle pulse ring: shown only before first click to invite interaction.
  if (idlePulse) {
    const pulseScale = Math.sin(now * 0.005) * 0.15 + 1.25;
    const ringRadius = coreRadius * pulseScale;
    const alpha = (Math.sin(now * 0.005) * 0.5 + 0.5) * 0.5 + 0.2;
    ctx.save();
    ctx.strokeStyle = stage.accent;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 물질 응축 charge halo: a purple ring grows + brightens with charge01; at full charge it
  // pulses to invite the tap that fires the condense burst.
  if (charge01 > 0.001) {
    const r = coreRadius * (1.18 + charge01 * 0.25);
    ctx.save();
    ctx.strokeStyle = '#bb8cff';
    ctx.globalAlpha = 0.25 + charge01 * 0.5;
    ctx.lineWidth = 1.5 + charge01 * 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (charged) {
      const p = Math.sin(now * 0.006) * 0.5 + 0.5;
      ctx.globalAlpha = 0.4 + p * 0.5;
      ctx.lineWidth = 2.5 + p * 2;
      ctx.shadowColor = '#bb8cff';
      ctx.shadowBlur = 14 + p * 16;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 + p * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
