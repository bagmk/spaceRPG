import React, { forwardRef, useEffect, useState } from 'react';
import { formatWhole } from '../game/formulas';
import { getActiveBoostSummary } from '../game/shop/boosts';
import type { ActiveBoostSummary } from '../game/shop/boosts';
import type { ShopBoost, ShopBoostCategory } from '../game/types';
import type { Lang } from '../i18n';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
          const label = summary.category === 'time' ? 'T' : 'M';
          const color = summary.category === 'time' ? 'var(--boost-time)' : 'var(--boost-matter)';
          return (
            <span key={summary.category} className="active-boost-pip" style={{ '--pip-color': color } as React.CSSProperties}>
              <span className="active-boost-pip__label">{label}</span>
              <span>×{formatWhole(summary.factor)}</span>
              <span className="active-boost-pip__timer">{formatRemaining(summary.expiresAt - now)}</span>
            </span>
          );
        })}
      </div>
    );
  },
);
