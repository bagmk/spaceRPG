interface FloatingNumberProps {
  x: number;
  y: number;
  text: string;
  particleName?: string;
  particleDefinition?: string;
  variant: 'normal' | 'crit' | 'collision';
  delayMs?: number;
}

export function FloatingNumber({
  x,
  y,
  text,
  particleName,
  particleDefinition,
  variant,
  delayMs = 0,
}: FloatingNumberProps) {

  return (
    <div
      className={`float-text ${variant}`}
      style={{ left: `${x}px`, top: `${y - 72}px`, animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      {particleName ? (
        <span className="float-particle" title={particleDefinition}>
          {particleName}
        </span>
      ) : null}
      <span className="float-amount">{text}</span>
    </div>
  );
}
