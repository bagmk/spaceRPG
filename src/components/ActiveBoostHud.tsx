import { useEffect, useState } from 'react';
import { formatWhole, getCompositeBoostMultiplier } from '../game/formulas';
import type { ShopBoost } from '../game/types';

function formatRemaining(boosts: ShopBoost[], prefix: string, now: number): string {
  const active = boosts.filter((boost) => boost.id.startsWith(prefix) && boost.expiresAt > now);
  if (active.length === 0) return '0:00 left';
  const remainingSec = Math.max(0, Math.floor((Math.min(...active.map((boost) => boost.expiresAt)) - now) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} left`;
}

export function ActiveBoostHud({ boosts }: { boosts: ShopBoost[] }) {
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
    <div className="active-boost-hud">
      <div className="scale-title">Active Boosts</div>
      {timeCount > 0 ? (
        <div>{`Time x${formatWhole(timeMult)} (${formatRemaining(active, 'time_', now)})`}</div>
      ) : null}
      {quantaCount > 0 ? (
        <div>{`Quanta x${formatWhole(quantaMult)} (${formatRemaining(active, 'quanta_', now)})`}</div>
      ) : null}
    </div>
  );
}
