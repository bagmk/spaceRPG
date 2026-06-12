import type { EntityInstance } from '../entities/types';
import type { PrestigeUpgradeLevels } from '../prestige';
import { getPrestigeMultiplier } from '../prestige';
import { applyCollectionRewards, applyEntityModifiers, applySetBonuses } from '../entities/effects';

export interface ModifierContext {
  currentQuanta?: number;
  stagesCleared?: number;
  secondsInStage?: number;
  /** Player's current stage id — REQUIRED: anchors the shared gear power curve. */
  stageId: number;
  /**
   * Entropy-gate progress within the current stage (0..1) — REQUIRED: the
   * fractional part of the gear power exponent (in-stage acceleration).
   * Compute via getEntropyGateProgress(entropy, stageIdx).
   */
  gateProgress01: number;
  progress01?: number;
}

export interface Modifiers {
  clickPowerMult: number;
  clickPowerAdd: number;
  clickEmissionCount: number;
  clickVfxScale: number;
  autoRateMult: number;
  autoRateAdd: number;
  autoRateFlatAdd: number;
  critChanceAdd: number;
  critChanceCapAdd: number;
  critMultMult: number;
  comboTimeoutMs: number;
  comboCapAdd: number;
  timeMultMult: number;
  echoClickChance: number;
  pairProductionPeriod: number;
  bigBangUnlocked: boolean;
  hawkingEcho: boolean;
  darkEnergyAuto: boolean;
  filamentExp: number;
  eternalEngine: boolean;
  webOfAll: boolean;
  heisenberg: boolean;
  waveCollapse: boolean;
  manyWorldsCapMult: number;
  encounterBonusMult: number;
  /** Secondary stat: multiplies entity drop chance (clicks + collisions). */
  dropChanceMult: number;
  /** Secondary stat: multiplies entropy earned from play income. */
  entropyGainMult: number;
  /** Secondary stat: multiplies the fusion entropy burst. */
  fusionBurstMult: number;
  /** Secondary stat: multiplies offline income (rift gear). */
  offlineGainMult: number;
  /** Auto Power primary: multiplies entity flat-auto output (rift gear). */
  autoFlatMult: number;
  apexMult: number;
  inflatonEchoSec: number;
  dilation: boolean;
  eternalReturnUnlocked: boolean;
}

export function defaultModifiers(): Modifiers {
  return {
    clickPowerMult: 1,
    clickPowerAdd: 0,
    clickEmissionCount: 1,
    clickVfxScale: 1,
    autoRateMult: 1,
    autoRateAdd: 0,
    autoRateFlatAdd: 0,
    critChanceAdd: 0,
    critChanceCapAdd: 0,
    critMultMult: 1,
    comboTimeoutMs: 700,
    comboCapAdd: 0,
    timeMultMult: 1,
    echoClickChance: 0,
    pairProductionPeriod: 0,
    bigBangUnlocked: false,
    hawkingEcho: false,
    darkEnergyAuto: false,
    filamentExp: 0,
    eternalEngine: false,
    webOfAll: false,
    heisenberg: false,
    waveCollapse: false,
    manyWorldsCapMult: 1,
    encounterBonusMult: 1,
    dropChanceMult: 1,
    entropyGainMult: 1,
    fusionBurstMult: 1,
    offlineGainMult: 1,
    autoFlatMult: 1,
    apexMult: 1,
    inflatonEchoSec: 0,
    dilation: false,
    eternalReturnUnlocked: false,
  };
}

/**
 * Gear-only modifiers (Phase 4-2 — the skill tree is removed; it had been
 * unreachable UI since the Entity Lab). Power comes from equipped gear, set
 * bonuses, codex completion rewards and prestige upgrades.
 */
export function getActiveModifiers(
  ctx: ModifierContext,
  inventory?: EntityInstance[],
  prestigeUpgrades?: PrestigeUpgradeLevels,
  almanacCollected?: Record<number, string[]>,
): Modifiers {
  const mods = defaultModifiers();

  if (inventory && inventory.length > 0) {
    applyEntityModifiers(mods, inventory, { stageId: ctx.stageId, gateProgress01: ctx.gateProgress01 });
    applySetBonuses(mods, inventory);
  }

  // Codex collection completion rewards (permanent, from the almanac).
  if (almanacCollected) {
    applyCollectionRewards(mods, almanacCollected);
  }

  // Apply permanent prestige multipliers
  if (prestigeUpgrades) {
    mods.timeMultMult *= getPrestigeMultiplier(prestigeUpgrades.time_warp);
    mods.clickPowerMult *= getPrestigeMultiplier(prestigeUpgrades.matter_forge);
    mods.autoRateMult *= getPrestigeMultiplier(prestigeUpgrades.matter_forge);
    mods.critMultMult *= getPrestigeMultiplier(prestigeUpgrades.critical_core);
    mods.autoRateMult *= getPrestigeMultiplier(prestigeUpgrades.auto_engine);
  }

  return mods;
}
