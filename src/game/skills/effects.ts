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
  /**
   * MATTER-ONLY explosive click multiplier (Overhaul-3 #39). Equipped click
   * gear stacks into this multiplicatively so a full loadout feels like
   * 500×500 — but it is applied ONLY to matter gained from a click, NEVER to
   * the entropy income (which keeps riding the tame clickPowerMult). This
   * decouples the satisfying click number from the entropy gate, so pacing
   * across all 16 stages is untouched (no re-sim needed).
   */
  clickMatterMult: number;
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
    clickMatterMult: 1,
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

  // Apply permanent prestige multipliers. Ids are legacy save keys; their levers
  // were retargeted in Overhaul-2 (see PRESTIGE_UPGRADES in ../prestige).
  // entropy_echo is applied at the reducer level (it scales entropy income).
  if (prestigeUpgrades) {
    mods.clickPowerMult *= getPrestigeMultiplier(prestigeUpgrades.matter_forge);   // Matter Forge → click power
    mods.autoRateMult *= getPrestigeMultiplier(prestigeUpgrades.auto_engine);      // Auto Engine → auto production
    mods.critMultMult *= getPrestigeMultiplier(prestigeUpgrades.critical_core);    // Critical Core → crit multiplier
    mods.dropChanceMult *= getPrestigeMultiplier(prestigeUpgrades.time_warp);      // Nucleation Seed → drop rate
  }

  return mods;
}
