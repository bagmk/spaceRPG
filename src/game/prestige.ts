/**
 * Prestige upgrade system — 5 permanent upgrades purchasable with Entropy on the final screen.
 * Each upgrade can be purchased up to 5 times, multiplying its effect by 1.5x each time
 * (x1.5 → x2.25 → x3.375 → x5.0625 → x7.59).
 */

import type { Lang } from '../i18n';
import {
  PRESTIGE_COST_BASE_KB,
  PRESTIGE_COST_GROWTH,
  CONDENSATION_CORE_BOOST_PER_LEVEL,
  CONDENSATION_CORE_COST_BASE,
  CONDENSATION_CORE_COST_GROWTH,
} from './balance';
import { formatEntropyAmount } from './formulas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// `condensation_core` is the ENDLESS off-gate sink (no PRESTIGE_MAX_LEVEL cap, bought
// with condensedMass — see handleBuyPrestigeUpgrade). The other 5 are entropy-bought,
// capped at PRESTIGE_MAX_LEVEL. Adding it as a record key needs NO save migration:
// old saves default it to 0 via the `?? 0` reads everywhere.
export type PrestigeUpgradeId =
  | 'time_warp'
  | 'matter_forge'
  | 'critical_core'
  | 'auto_engine'
  | 'entropy_echo'
  | 'condensation_core'
  // P7 (v32): the ENDLESS off-gate compounding lever, bought with 특이점 잔향 (Singularity
  // Echo, derived from peakEntropy). Geometric (×1.03/level), wallet-only — see P1.
  | 'resonance_core';

export interface PrestigeUpgradeLevels {
  time_warp: number;
  matter_forge: number;
  critical_core: number;
  auto_engine: number;
  entropy_echo: number;
  condensation_core: number;
  /** P7 (v32): endless Resonance Core level (echo-bought, off-gate). Default 0. */
  resonance_core: number;
  /** P7 (v32): 0..100 click↔auto focus for the Resonance Core multiplier (50 = balanced,
   *  geometric-mean-preserving so the split never changes total power). Default 50. */
  echoFocus: number;
}

export function createDefaultPrestigeUpgrades(): PrestigeUpgradeLevels {
  return {
    time_warp: 0,
    matter_forge: 0,
    critical_core: 0,
    auto_engine: 0,
    entropy_echo: 0,
    condensation_core: 0,
    resonance_core: 0,
    echoFocus: 50,
  };
}

// ---------------------------------------------------------------------------
// Condensation Core (endless, condensedMass-bought, off-gate)
// ---------------------------------------------------------------------------

/** The off-gate wallet multiplier granted by `level` Condensation Core levels
 *  (applied to BOTH clickMatterMult and autoMatterMult in getActiveModifiers). */
export function getCondensationCoreMultiplier(level: number): number {
  return 1 + CONDENSATION_CORE_BOOST_PER_LEVEL * Math.max(0, level);
}

/** condensedMass cost to buy the NEXT Condensation Core level (geometric, endless). */
export function getCondensationCoreCost(currentLevel: number): number {
  return Math.ceil(
    CONDENSATION_CORE_COST_BASE * Math.pow(CONDENSATION_CORE_COST_GROWTH, Math.max(0, currentLevel)),
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PRESTIGE_MAX_LEVEL = 5;

/**
 * Costs in KB (the game's internal entropy unit).
 * 1 YB = 1024^7 KB ≈ 1.8014e21 KB
 */
// Threshold-relative since v17 (Phase 4-2): Lv1 first affordable around the
// stage-8 gate, ×PRESTIGE_COST_GROWTH per level. Recalibrations move these
// automatically with the pacing ladder.
export const PRESTIGE_COSTS_KB: [number, number, number, number, number] = [
  PRESTIGE_COST_BASE_KB,
  PRESTIGE_COST_BASE_KB * PRESTIGE_COST_GROWTH,
  PRESTIGE_COST_BASE_KB * Math.pow(PRESTIGE_COST_GROWTH, 2),
  PRESTIGE_COST_BASE_KB * Math.pow(PRESTIGE_COST_GROWTH, 3),
  PRESTIGE_COST_BASE_KB * Math.pow(PRESTIGE_COST_GROWTH, 4),
];

export function getPrestigeCost(currentLevel: number): number | null {
  if (currentLevel >= PRESTIGE_MAX_LEVEL) return null;
  return PRESTIGE_COSTS_KB[currentLevel];
}

export function getPrestigeMultiplier(level: number): number {
  return Math.pow(1.5, Math.min(level, PRESTIGE_MAX_LEVEL));
}

// ---------------------------------------------------------------------------
// Definitions (for UI)
// ---------------------------------------------------------------------------

interface PrestigeUpgradeDefinition {
  id: PrestigeUpgradeId;
  name: { en: string; ko: string };
  description: { en: string; ko: string };
}

// NOTE: the upgrade `id`s are legacy save keys (PrestigeUpgradeLevels). Their
// EFFECTS were retargeted in Overhaul-2 after the time mechanic was removed, so
// some ids no longer match their lever — the mapping is owned by
// getActiveModifiers (skills/effects.ts) and the entropy reducers:
//   matter_forge  → click power     auto_engine   → auto production
//   critical_core → crit multiplier entropy_echo  → entropy gain
//   time_warp     → entity DROP rate (was time flow; "Nucleation Seed")
// Keeping the keys avoids a save migration; players' purchased levels carry over.
export const PRESTIGE_UPGRADES: PrestigeUpgradeDefinition[] = [
  {
    id: 'matter_forge',
    name: { en: 'Matter Forge', ko: '물질 응축' },
    description: {
      en: 'Click matter ×1.5 per level.',
      ko: '레벨당 클릭 물질 획득량 ×1.5.',
    },
  },
  {
    id: 'auto_engine',
    name: { en: 'Auto Engine', ko: '자동 엔진' },
    description: {
      en: 'Auto production ×1.5 per level.',
      ko: '레벨당 자동 생산량 ×1.5.',
    },
  },
  {
    id: 'critical_core',
    name: { en: 'Critical Core', ko: '임계 코어' },
    description: {
      en: 'Critical multiplier ×1.5 per level.',
      ko: '레벨당 크리티컬 배수 ×1.5.',
    },
  },
  {
    id: 'time_warp',
    name: { en: 'Nucleation Seed', ko: '응결핵' },
    description: {
      en: 'Entity drop chance ×1.5 per level.',
      ko: '레벨당 엔티티 획득 확률 ×1.5.',
    },
  },
  {
    id: 'entropy_echo',
    name: { en: 'Entropy Echo', ko: '엔트로피 메아리' },
    description: {
      en: 'Entropy gain ×1.5 per level.',
      ko: '레벨당 엔트로피 획득량 ×1.5.',
    },
  },
];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatPrestigeCost(level: number): string {
  // C-P1 (audit): show the REAL entropy cost (getPrestigeCost → PRESTIGE_COSTS_KB),
  // formatted with the game's entropy units — the old hardcoded "1YB/5YB/…" was
  // off by ~12-14 orders of magnitude vs the threshold-relative cost.
  const cost = getPrestigeCost(level);
  return cost === null ? '' : formatEntropyAmount(cost);
}

export function getPrestigeUpgradeName(id: PrestigeUpgradeId, lang: Lang): string {
  const def = PRESTIGE_UPGRADES.find((u) => u.id === id);
  return def ? def.name[lang] : id;
}

export function getPrestigeUpgradeDescription(id: PrestigeUpgradeId, lang: Lang): string {
  const def = PRESTIGE_UPGRADES.find((u) => u.id === id);
  return def ? def.description[lang] : '';
}
