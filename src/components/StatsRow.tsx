import { formatWhole } from '../game/formulas';

interface StatsRowProps {
  click: number;
  auto: number;
  crit: number;
  time: number;
}

export function formatTimeMultiplier(mult: number): string {
  if (!Number.isFinite(mult) || mult <= 1) return 'x1';
  if (mult <= 999) return `x${Math.floor(mult)}`;
  const exp = Math.floor(Math.log10(mult));
  const mantissa = mult / Math.pow(10, exp);
  if (mantissa < 2) return `x10^${exp}`;
  return `x${Math.floor(mantissa)}*10^${exp}`;
}

export function StatsRow({ click, auto, crit, time }: StatsRowProps) {
  return (
    <div className="stats-row">
      <div>
        <span className="label">Click</span>
        <span className="value">{formatWhole(click)}</span>
      </div>
      <div>
        <span className="label">Auto</span>
        <span className="value">{`${formatWhole(auto)}/s`}</span>
      </div>
      <div>
        <span className="label">Crit</span>
        <span className="value">{`x${formatWhole(crit)}`}</span>
      </div>
      <div>
        <span className="label">Time</span>
        <span className="value">{formatTimeMultiplier(time)}</span>
      </div>
    </div>
  );
}
