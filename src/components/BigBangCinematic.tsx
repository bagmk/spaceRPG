import { useEffect, useRef } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';

export function BigBangCinematic({
  durationMs = 3000,
  onComplete,
}: {
  durationMs?: number;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedAt = useRef(performance.now());

  useEffect(() => {
    const timerId = window.setTimeout(onComplete, durationMs);
    return () => window.clearTimeout(timerId);
  }, [durationMs, onComplete]);

  useGameLoop((now) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== bounds.width * dpr || canvas.height !== bounds.height * dpr) {
      canvas.width = bounds.width * dpr;
      canvas.height = bounds.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const width = bounds.width;
    const height = bounds.height;
    const elapsed = now - startedAt.current;
    const t = Math.min(1, elapsed / durationMs);
    const cx = width / 2;
    const cy = height / 2;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    if (elapsed >= 500) {
      const burstT = Math.min(1, (elapsed - 500) / 1700);
      const radius = 2 + Math.pow(burstT, 2.4) * Math.max(width, height) * 0.9;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.2, 'rgba(255,215,160,0.85)');
      glow.addColorStop(0.52, 'rgba(255,105,70,0.28)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (elapsed >= 2000) {
      const flash = Math.max(0, 1 - (elapsed - 2000) / 1000);
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - t * 1.2)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5 + t * 8, 0, Math.PI * 2);
    ctx.fill();
  });

  return (
    <div className="bigbang-cinematic" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
