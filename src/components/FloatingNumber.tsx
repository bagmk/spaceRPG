interface FloatingNumberProps {
  x: number;
  y: number;
  text: string;
  variant: 'normal' | 'crit' | 'collision';
}

export function FloatingNumber({ x, y, text, variant }: FloatingNumberProps) {
  return (
    <div
      className={`float-text ${variant}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
