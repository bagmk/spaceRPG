import { t, type Lang } from '../i18n';

interface ComboMeterProps {
  /** Current combo count (consecutive clicks). */
  combo: number;
  /** Active click-power multiplier from the combo. */
  mult: number;
  /** Click event id — bump it to re-trigger the per-hit pulse. */
  pulseId: number;
  /** True on the click that pushed the multiplier to a higher step. */
  levelUp: boolean;
  /** True while the meter is fading out after the combo stops. */
  fading: boolean;
  /** Multiplier cap (base + bonuses) — used to flag the MAX state. */
  maxMult: number;
  language: Lang;
}

// Visual-only escalation tiers (presentation, not game balance): each value is
// the minimum multiplier to enter the next colour tier (t0 → t4).
const TIER_THRESHOLDS = [1.5, 3, 5, 7];

function comboTier(mult: number): number {
  let tier = 0;
  for (const threshold of TIER_THRESHOLDS) {
    if (mult >= threshold) tier += 1;
  }
  return tier;
}

export function ComboMeter({ combo, mult, pulseId, levelUp, fading, maxMult, language }: ComboMeterProps) {
  const tier = comboTier(mult);
  const atMax = mult >= maxMult - 0.001;
  // Progress toward the next ×step (the multiplier steps up every 10 hits).
  const stepProgress = atMax ? 1 : (combo % 10) / 10;
  const multLabel = (Math.round(mult * 10) / 10).toFixed(1);

  return (
    <div
      className={[
        'combo-meter',
        `combo-meter--t${tier}`,
        fading ? 'combo-meter--out' : '',
        levelUp ? 'combo-meter--levelup' : '',
        atMax ? 'combo-meter--max' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <div className="combo-meter__label">{t(language, 'comboLabel')}</div>
      {/* Re-keyed by pulseId so the punch animation replays on every hit. */}
      <div className="combo-meter__mult" key={pulseId}>
        <span className="combo-meter__times">×</span>
        {multLabel}
      </div>
      <div className="combo-meter__track">
        <div className="combo-meter__fill" style={{ width: `${stepProgress * 100}%` }} />
      </div>
      <div className="combo-meter__hits">
        {atMax ? t(language, 'comboMax') : t(language, 'comboHits').replace('{n}', String(combo))}
      </div>
      {levelUp ? <div className="combo-meter__burst" key={`burst-${pulseId}`} /> : null}
    </div>
  );
}
