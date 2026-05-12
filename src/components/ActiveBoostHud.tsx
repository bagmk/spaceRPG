import { forwardRef, useEffect, useState } from 'react';
import { formatWhole, getCompositeBoostMultiplier } from '../game/formulas';
import type { ShopBoost } from '../game/types';
import { t, type Lang } from '../i18n';

function formatRemaining(boosts: ShopBoost[], prefix: string, now: number, language: Lang): string {
  const active = boosts.filter((boost) => boost.id.startsWith(prefix) && boost.expiresAt > now);
  if (active.length === 0) return `0:00 ${t(language, 'shopLeft')}`;
  const remainingSec = Math.max(0, Math.floor((Math.min(...active.map((boost) => boost.expiresAt)) - now) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} ${t(language, 'shopLeft')}`;
}

export const ActiveBoostHud = forwardRef<HTMLDivElement, { boosts: ShopBoost[]; language: Lang }>(
  function ActiveBoostHud({ boosts, language }, ref) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(intervalId);
    }, []);

    const active = boosts.filter((boost) => boost.expiresAt > now);
    if (active.length === 0) return null;

    const timeCount = active.filter((boost) => boost.id.startsWith('time_')).length;
    const quantaCount = active.filter((boost) => boost.id.startsWith('quanta_')).length;
    const timeMult = getCompositeBoostMultiplier(active, 'time_', now);
    const quantaMult = getCompositeBoostMultiplier(active, 'quanta_', now);

    return (
      <div ref={ref} className="active-boost-hud">
        {timeCount > 0 ? (
          <div className="active-boost-line">{`${t(language, 'hudTime')} x${formatWhole(timeMult)} (${formatRemaining(active, 'time_', now, language)})`}</div>
        ) : null}
        {quantaCount > 0 ? (
          <div className="active-boost-line">{`${t(language, 'hudQuanta')} x${formatWhole(quantaMult)} (${formatRemaining(active, 'quanta_', now, language)})`}</div>
        ) : null}
      </div>
    );
  },
);
