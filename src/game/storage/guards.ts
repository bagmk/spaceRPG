/** Runtime type guards used by the save validation and migration logic. */

import type {
  EndingId,
  EndingProgressFlags,
  CondenseProgressEntry,
  UniverseAtlasEntry,
  UniverseSeed,
  DailyCheckInState,
  EntityInstance,
  PurchasedEntityEntry,
  ShopBoost,
  LegacyShopBoosts,
} from '../types';

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

export function isEndingId(value: unknown): value is EndingId {
  return (
    value === 'heat_death' ||
    value === 'big_rip' ||
    value === 'big_crunch' ||
    value === 'vacuum_decay' ||
    value === 'bounce'
  );
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isEndingProgressFlags(value: unknown): value is EndingProgressFlags {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as EndingProgressFlags).bigCrunchEligible === 'boolean' &&
    ((value as Partial<EndingProgressFlags>).criticalUpgradedThisUniverse === undefined ||
      typeof (value as Partial<EndingProgressFlags>).criticalUpgradedThisUniverse === 'boolean') &&
    typeof (value as EndingProgressFlags).bigRipEverEligible === 'boolean' &&
    typeof (value as EndingProgressFlags).vacuumDecayEligible === 'boolean'
  );
}

export function isUniverseSeed(value: unknown): value is UniverseSeed {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as UniverseSeed).index) &&
    isFiniteNumber((value as UniverseSeed).gravityMod) &&
    isFiniteNumber((value as UniverseSeed).timeMod) &&
    isFiniteNumber((value as UniverseSeed).paletteShift) &&
    (typeof (value as UniverseSeed).anomaly === 'string' || (value as UniverseSeed).anomaly === null) &&
    typeof (value as UniverseSeed).atlasName === 'string'
  );
}

export function isCondenseProgressEntry(value: unknown): value is CondenseProgressEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as CondenseProgressEntry).stageId) &&
    isFiniteNumber((value as CondenseProgressEntry).progressAtCondense)
  );
}

export function isUniverseAtlasEntry(value: unknown): value is UniverseAtlasEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    isFiniteNumber((value as UniverseAtlasEntry).universeIndex) &&
    typeof (value as UniverseAtlasEntry).atlasName === 'string' &&
    isEndingId((value as UniverseAtlasEntry).endingId) &&
    isFiniteNumber((value as UniverseAtlasEntry).durationMs) &&
    isFiniteNumber((value as UniverseAtlasEntry).totalClicks) &&
    isFiniteNumber((value as UniverseAtlasEntry).collisions) &&
    isFiniteNumber((value as UniverseAtlasEntry).completedAt) &&
    isUniverseSeed((value as UniverseAtlasEntry).seed)
  );
}

export function isDailyCheckInState(value: unknown): value is DailyCheckInState {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as DailyCheckInState).lastDayKey === 'string' &&
    isFiniteNumber((value as DailyCheckInState).streakDays)
  );
}

export function isTutorialFlags(value: unknown): value is Record<string, boolean> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'boolean')
  );
}

export function isShopBoost(value: unknown): value is ShopBoost {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === 'string' &&
    (b.category === undefined || b.category === 'time' || b.category === 'matter') &&
    isFiniteNumber(b.factor) &&
    isFiniteNumber(b.expiresAt)
  );
}

export function isLegacyShopBoosts(value: unknown): value is LegacyShopBoosts {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['timeMult', 'quantaMult'].every((key) => {
    const boost = record[key];
    if (boost === undefined) return true;
    if (!boost || typeof boost !== 'object') return false;
    const b = boost as Record<string, unknown>;
    return isFiniteNumber(b.factor) && isFiniteNumber(b.expiresAt);
  });
}

export function isPurchasedEntityEntry(value: unknown): value is PurchasedEntityEntry {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.entityId === 'string' && isFiniteNumber(r.count);
}

export function isEntityInstance(value: unknown): value is EntityInstance {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.entityId === 'string' &&
    isFiniteNumber(r.count) &&
    isFiniteNumber(r.level) &&
    (r.invested === undefined || isFiniteNumber(r.invested))
  );
}

export function isAlmanacCollected(value: unknown): value is Record<number, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isStringArray);
}

export function isSkillState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    ['click', 'auto', 'crit', 'time'].every((treeId) => {
      const branch = record[treeId] as Record<string, unknown> | undefined;
      return !!branch && (isFiniteNumber(branch.level) || isFiniteNumber(branch.rootLevel));
    }) &&
    (record.unlockedTracks === undefined || isStringArray(record.unlockedTracks)) &&
    (record.ownedCrossNodes === undefined || isStringArray(record.ownedCrossNodes))
  );
}
