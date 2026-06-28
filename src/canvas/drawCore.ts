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

  // Per-era core character. The shared "field glow + concentric rings" core made
  // every late era (S13 remnant / S14 degenerate / S15 black hole / S16 heat
  // death) read as the SAME dark-core-with-rings; and made S1 inflation look as
  // calm as the cold end. We gate the generic treatment OFF for these stages and
  // give each its own core mood. (Everything else is unchanged.)
  const mode = stage.clusterMode;
  const isHotEarly = mode === 'inflation';                  // S1 — violent, expanding
  const isWarmRemnant = mode === 'remnant';                 // S13 — last embers cooling
  const isColdDegenerate = mode === 'degenerate';           // S14 — near-dark, sparse points
  const isBlackHole = mode === 'blackHole';                 // S15 — the cluster IS the black hole
  const isHeatDeath = mode === 'heatDeath';                 // S16 — maximum entropy, near-empty

  if (Number.isFinite(glowRadius) && glowRadius > 0) {
    // S1 burns brighter and churns; S16 is the dimmest possible wash; S14/S15 are
    // darker than mid-game. Everything else keeps the original field glow exactly.
    let glow0 = 0.1 + progress * 0.06;
    let glow1 = 0.03;
    if (isHotEarly) {
      // Hot, dense, pulsing — the early universe full of energy.
      const churn = 0.5 + Math.sin(now * 0.004) * 0.5;
      glow0 = 0.26 + progress * 0.16 + churn * 0.1;
      glow1 = 0.08 + churn * 0.04;
    } else if (isHeatDeath) {
      glow0 = 0.04 + progress * 0.015;   // almost nothing — a flat, cold haze
      glow1 = 0.012;
    } else if (isColdDegenerate) {
      glow0 = 0.06 + progress * 0.025;
      glow1 = 0.02;
    } else if (isBlackHole) {
      glow0 = 0.07 + progress * 0.03;
      glow1 = 0.022;
    }
    const fieldGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    fieldGlow.addColorStop(0, hexToRgba(isHotEarly ? stage.coreColor : stage.accent, glow0));
    fieldGlow.addColorStop(0.5, hexToRgba(stage.accent, glow1));
    fieldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fieldGlow;
    ctx.fillRect(0, 0, width, height);
  }

  // S1 hot expanding shock: a bright, fast-pulsing inner core flash that grows
  // with progress — reads as churning early-universe energy (never the calm
  // rings of the cold late eras).
  if (isHotEarly) {
    const flash = 0.6 + Math.sin(now * 0.006) * 0.4;
    const hotR = (TUNING.CORE_BASE_RADIUS + progress * TUNING.CORE_PROGRESS_RADIUS) * (1.6 + flash * 0.5);
    const hot = ctx.createRadialGradient(cx, cy, 0, cx, cy, hotR);
    hot.addColorStop(0, hexToRgba('#fffaf0', 0.5 + flash * 0.3));
    hot.addColorStop(0.4, hexToRgba(stage.coreColor, 0.32 + flash * 0.18));
    hot.addColorStop(1, hexToRgba(stage.accent, 0));
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(cx, cy, hotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Generic concentric rings — the element that made the late eras look alike.
  // Keep them for every NORMAL stage; skip them for S1 (churns instead) and for
  // each late era (each has its own bespoke cluster scene).
  const skipGenericRings = isHotEarly || isWarmRemnant || isColdDegenerate || isBlackHole || isHeatDeath;
  if (progress > 0.3 && !skipGenericRings) {
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
