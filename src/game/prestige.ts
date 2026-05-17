/**
 * Prestige upgrade system — 5 permanent upgrades purchasable with Entropy on the final screen.
 * Each upgrade can be purchased up to 3 times, doubling its effect each time (x2 → x4 → x8).
 */

import type { Lang } from '../i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrestigeUpgradeId = 'time_warp' | 'matter_forge' | 'critical_core' | 'auto_engine' | 'entropy_echo';

export interface PrestigeUpgradeLevels {
  time_warp: number;
  matter_forge: number;
  critical_core: number;
  auto_engine: number;
  entropy_echo: number;
}

export function createDefaultPrestigeUpgrades(): PrestigeUpgradeLevels {
  return {
    time_warp: 0,
    matter_forge: 0,
    critical_core: 0,
    auto_engine: 0,
    entropy_echo: 0,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PRESTIGE_MAX_LEVEL = 3;

/**
 * Costs in KB (the game's internal entropy unit).
 * 1 YB = 1024^7 KB = 1024^7 ≈ 1.8014e21 KB
 * 100 YB = 100 * 1024^7 KB
 */
const KB_PER_YB = Math.pow(1024, 7);

export const PRESTIGE_COSTS_KB: [number, number, number] = [
  100 * KB_PER_YB,  // Lv1: 100 YB
  200 * KB_PER_YB,  // Lv2: 200 YB
  400 * KB_PER_YB,  // Lv3: 400 YB
];

export function getPrestigeCost(currentLevel: number): number | null {
  if (currentLevel >= PRESTIGE_MAX_LEVEL) return null;
  return PRESTIGE_COSTS_KB[currentLevel];
}

export function getPrestigeMultiplier(level: number): number {
  return Math.pow(2, Math.min(level, PRESTIGE_MAX_LEVEL));
}

// ---------------------------------------------------------------------------
// Definitions (for UI)
// ---------------------------------------------------------------------------

interface PrestigeUpgradeDefinition {
  id: PrestigeUpgradeId;
  name: { en: string; ko: string };
  description: { en: string; ko: string };
}

export const PRESTIGE_UPGRADES: PrestigeUpgradeDefinition[] = [
  {
    id: 'time_warp',
    name: { en: 'Time Warp', ko: '시간 왜곡' },
    description: {
      en: 'Double time flow in future universes.',
      ko: '다음 우주에서 시간 흐름이 2배가 됩니다.',
    },
  },
  {
    id: 'matter_forge',
    name: { en: 'Matter Forge', ko: '물질 응축' },
    description: {
      en: 'Double matter gain in future universes.',
      ko: '다음 우주에서 물질 획득량이 2배가 됩니다.',
    },
  },
  {
    id: 'critical_core',
    name: { en: 'Critical Core', ko: '크리티컬 코어' },
    description: {
      en: 'Double critical effect in future universes.',
      ko: '다음 우주에서 크리티컬 효과가 2배가 됩니다.',
    },
  },
  {
    id: 'auto_engine',
    name: { en: 'Auto Engine', ko: '자동 구동' },
    description: {
      en: 'Double auto production speed in future universes.',
      ko: '다음 우주에서 자동 생산 속도가 2배가 됩니다.',
    },
  },
  {
    id: 'entropy_echo',
    name: { en: 'Entropy Echo', ko: '엔트로피 메아리' },
    description: {
      en: 'Double entropy gain in future universes.',
      ko: '다음 우주에서 엔트로피 획득량이 2배가 됩니다.',
    },
  },
];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatPrestigeCost(level: number): string {
  if (level >= PRESTIGE_MAX_LEVEL) return '';
  const ybAmount = [100, 200, 400][level];
  return `${ybAmount}YB`;
}

export function getPrestigeUpgradeName(id: PrestigeUpgradeId, lang: Lang): string {
  const def = PRESTIGE_UPGRADES.find((u) => u.id === id);
  return def ? def.name[lang] : id;
}

export function getPrestigeUpgradeDescription(id: PrestigeUpgradeId, lang: Lang): string {
  const def = PRESTIGE_UPGRADES.find((u) => u.id === id);
  return def ? def.description[lang] : '';
}
