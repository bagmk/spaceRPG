import { forwardRef, useEffect, useState } from 'react';
import { formatWhole } from '../game/formulas';
import { getActiveBoostSummary } from '../game/shop/boosts';
import type { ActiveBoostSummary } from '../game/shop/boosts';
import type { ShopBoost, ShopBoostCategory } from '../game/types';
import { t, type Lang } from '../i18n';

function formatRemaining(ms: number, language: Lang): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return `${clock} ${t(language, 'shopLeft')}`;
}

export const ActiveBoostHud = forwardRef<HTMLDivElement, { boosts: ShopBoost[]; language: Lang }>(
  function ActiveBoostHud({ boosts, language }, ref) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(intervalId);
    }, []);

    const summaries = (['time', 'matter'] as ShopBoostCategory[])
      .map((category) => getActiveBoostSummary(boosts, category, now))
      .filter((summary): summary is ActiveBoostSummary => summary !== null);

    if (summaries.length === 0) return null;

    return (
      <div ref={ref} className="active-boost-hud">
        {summaries.map((summary) => {
          const label = summary.category === 'time' ? t(language, 'hudTime') : t(language, 'hudQuanta');
          return (
            <div key={summary.category} className="active-boost-line">
              {`${label} x${formatWhole(summary.factor)} (${formatRemaining(summary.expiresAt - now, language)})`}
            </div>
          );
        })}
      </div>
    );
  },
);
