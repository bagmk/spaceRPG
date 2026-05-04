import { useEffect, useRef } from 'react';
import { drawStageSprite } from '../canvas/stageSprites';

interface FloatingNumberProps {
  x: number;
  y: number;
  text: string;
  particleName?: string;
  particleDefinition?: string;
  variant: 'normal' | 'crit' | 'collision';
  stageId?: number;
  delayMs?: number;
}

export function FloatingNumber({
  x,
  y,
  text,
  particleName,
  particleDefinition,
  variant,
  stageId,
  delayMs = 0,
}: FloatingNumberProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (stageId) {
      drawStageSprite(ctx, stageId, 8, 8, 5, '#ffffff', 1, performance.now() / 1000);
    }
  }, [stageId]);

  return (
    <div
      className={`float-text ${variant}`}
      style={{ left: `${x}px`, top: `${y}px`, animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} width={16} height={16} className="float-glyph" />
      <span className="float-amount">{text}</span>
      {particleName ? (
        <span className="float-particle" title={particleDefinition}>
          {particleName}
        </span>
      ) : null}
    </div>
  );
}
