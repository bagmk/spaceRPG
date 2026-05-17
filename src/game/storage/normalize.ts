/** Data normalization helpers — convert legacy shapes to current SaveState fields. */

import type { EndingProgressFlags, ShopBoost } from '../types';
import type { SkillState } from '../skills/types';
import { createDefaultEndingProgressFlags, createDefaultSkills } from '../defaults';
import { normalizeShopBoost } from '../shop/boosts';
import { isShopBoost, isLegacyShopBoosts, isStringArray, isFiniteNumber } from './guards';

function isV7CrossNodeId(nodeId: string): boolean {
  return /^(click|auto|crit|time)_lv(5|10|15|20|25|30)$/.test(nodeId);
}

export function getUnlockedTracksForProgress(
  stageIdx: number,
  universeCount: number,
): SkillState['unlockedTracks'] {
  if (universeCount > 1) {
    return ['click', 'crit', 'auto', 'time'];
  }
  const unlocked: SkillState['unlockedTracks'] = ['click'];
  if (stageIdx >= 1) unlocked.push('crit', 'auto', 'time');
  return unlocked;
}

function mapLegacyNodeId(_nodeId: string): string | null {
  return null;
}

export function normalizeSkillState(
  value: unknown,
  stageIdx: number,
  universeCount: number,
  forceReconstructedUnlocks = false,
): SkillState {
  const fallback = createDefaultSkills();
  fallback.unlockedTracks = getUnlockedTracksForProgress(stageIdx, universeCount);

  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const record = value as Record<string, unknown>;

  const isNewShape =
    ['click', 'auto', 'crit', 'time'].every((trackId) => {
      const branch = record[trackId] as Record<string, unknown> | undefined;
      return !!branch && isFiniteNumber(branch.level);
    }) &&
    isStringArray(record.unlockedTracks) &&
    isStringArray(record.ownedCrossNodes);

  if (isNewShape) {
    const savedUnlockedTracks = (record.unlockedTracks as string[]).filter(
      (t): t is 'click' | 'auto' | 'crit' | 'time' =>
        t === 'click' || t === 'auto' || t === 'crit' || t === 'time',
    );
    return {
      click: { level: (record.click as Record<string, number>).level },
      auto: { level: (record.auto as Record<string, number>).level },
      crit: { level: (record.crit as Record<string, number>).level },
      time: { level: (record.time as Record<string, number>).level },
      unlockedTracks: forceReconstructedUnlocks
        ? fallback.unlockedTracks
        : savedUnlockedTracks.length > 0
          ? savedUnlockedTracks
          : fallback.unlockedTracks,
      ownedCrossNodes: (record.ownedCrossNodes as string[]).filter(isV7CrossNodeId),
    };
  }

  const isLegacyShape = ['click', 'auto', 'crit', 'time'].every((trackId) => {
    const branch = record[trackId] as Record<string, unknown> | undefined;
    return !!branch && isFiniteNumber(branch.rootLevel) && isStringArray(branch.ownedNodes);
  });

  if (!isLegacyShape) {
    return fallback;
  }

  const ownedCrossNodes = [
    ...new Set(
      ['click', 'auto', 'crit', 'time']
        .flatMap((trackId) => ((record[trackId] as Record<string, unknown>).ownedNodes as string[]))
        .map(mapLegacyNodeId)
        .filter((v): v is string => v !== null),
    ),
  ];

  return {
    click: { level: ((record.click as Record<string, number>).rootLevel ?? 0) as number },
    auto: { level: ((record.auto as Record<string, number>).rootLevel ?? 0) as number },
    crit: { level: ((record.crit as Record<string, number>).rootLevel ?? 0) as number },
    time: { level: ((record.time as Record<string, number>).rootLevel ?? 0) as number },
    unlockedTracks: getUnlockedTracksForProgress(stageIdx, universeCount),
    ownedCrossNodes,
  };
}

export function normalizeShopBoosts(value: unknown): ShopBoost[] {
  if (Array.isArray(value)) {
    return value.filter(isShopBoost).map(normalizeShopBoost);
  }
  if (!isLegacyShopBoosts(value)) {
    return [];
  }
  const boosts: ShopBoost[] = [];
  if (value.timeMult) {
    boosts.push({
      id: `time_legacy_${value.timeMult.expiresAt}`,
      category: 'time',
      factor: value.timeMult.factor,
      expiresAt: value.timeMult.expiresAt,
    });
  }
  if (value.quantaMult) {
    boosts.push({
      id: `quanta_legacy_${value.quantaMult.expiresAt}`,
      category: 'matter',
      factor: value.quantaMult.factor,
      expiresAt: value.quantaMult.expiresAt,
    });
  }
  return boosts;
}

export function normalizeEndingProgressFlags(
  value: unknown,
  state?: {
    critLevel?: number;
    skills?: SkillState;
  },
): EndingProgressFlags {
  const fallback = createDefaultEndingProgressFlags();
  const inferredCritical =
    (state?.critLevel ?? 0) > 0 ||
    (state?.skills?.crit.level ?? 0) > 0 ||
    (state?.skills?.ownedCrossNodes ?? []).some((nodeId) => nodeId.startsWith('crit_'));

  if (!value || typeof value !== 'object') {
    return {
      ...fallback,
      criticalUpgradedThisUniverse: inferredCritical,
    };
  }

  const record = value as Partial<EndingProgressFlags>;
  return {
    bigCrunchEligible:
      typeof record.bigCrunchEligible === 'boolean'
        ? record.bigCrunchEligible
        : fallback.bigCrunchEligible,
    criticalUpgradedThisUniverse:
      typeof record.criticalUpgradedThisUniverse === 'boolean'
        ? record.criticalUpgradedThisUniverse || inferredCritical
        : inferredCritical,
    bigRipEverEligible:
      typeof record.bigRipEverEligible === 'boolean'
        ? record.bigRipEverEligible
        : fallback.bigRipEverEligible,
    vacuumDecayEligible:
      typeof record.vacuumDecayEligible === 'boolean'
        ? record.vacuumDecayEligible
        : fallback.vacuumDecayEligible,
  };
}
