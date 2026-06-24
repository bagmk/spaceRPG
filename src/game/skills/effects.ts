import type { EntityInstance } from '../entities/types';
import type { PrestigeUpgradeLevels } from '../prestige';
import { getPrestigeMultiplier, getCondensationCoreMultiplier } from '../prestige';
import { applyCollectionRewards, applyEntityModifiers, applySetBonuses } from '../entities/effects';
import { computeHexBingo } from '../entities/hexBingo';
import { CRIT_MULT_GEAR_CAP } from '../balance';

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
  /** #44 hexagon: the 7-slot positional array (0-2 click / 3-5 rift / 6 wild),
   *  ids or null. When present, completed bingo lines feed the off-gate
   *  click/auto matter multipliers. */
  hexSlots?: (string | null)[];
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
  /**
   * Overhaul-4: click gear's player-stage-anchored WALLET matter-per-tap (flat add,
   * mirrors autoRateFlatAdd). Makes a click out-earn auto/sec. Off-gate (entropy
   * rides the tame `gained`, never this), like clickMatterMult. Default 0.
   */
  clickMatterFlatAdd: number;
  /**
   * #44 hexagon bingo: wallet-only AUTO multiplier — mirrors clickMatterMult.
   * Boosts the auto matter that hits the WALLET but NOT the auto entropy (which
   * keeps riding the tame auto delta), so a strong hex auto bonus never touches
   * the entropy gate. Default 1.
   */
  autoMatterMult: number;
  clickEmissionCount: number;
  clickVfxScale: number;
  autoRateMult: number;
  autoRateAdd: number;
  autoRateFlatAdd: number;
  /**
   * GEAR-ONLY ECONOMY CRANK (2026-06-21): the TAME (pre-crank) auto flat add that
   * feeds the ENTROPY gate ONLY — keeps progression pacing exactly as calibrated
   * while autoRateFlatAdd carries the player-stage-anchored WALLET income crank.
   * Decouples auto wallet income (affords the shop) from auto entropy (progression),
   * the same way clickMatterMult decouples click matter from click entropy. The
   * entropy tick reads THIS, never the cranked autoRateFlatAdd. Default 0.
   */
  autoEntropyFlatAdd: number;
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
    clickMatterFlatAdd: 0,
    autoMatterMult: 1,
    clickEmissionCount: 1,
    clickVfxScale: 1,
    autoRateMult: 1,
    autoRateAdd: 0,
    autoRateFlatAdd: 0,
    autoEntropyFlatAdd: 0,
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
  claimedCodexSubsetIds?: readonly string[],
): Modifiers {
  const mods = defaultModifiers();

  if (inventory && inventory.length > 0) {
    applyEntityModifiers(mods, inventory, { stageId: ctx.stageId, gateProgress01: ctx.gateProgress01 });
    applySetBonuses(mods, inventory);
  }

  // CRIT GEAR CAP (P fix, 2026-06-24): CRIT_MULT_GEAR_CAP was defined but NEVER applied
  // in-game, so the gear-built crit mult ran away to ~×36 (display ×80), far past the
  // sim's calibrated cap. Crit feeds the entropy gate (gained = clickPower×combo×critMult),
  // so uncapped crit trivialized late stages ("12화부터 너무 쉬움"). The sim's critFactor
  // already caps it as 1.5×min(CAP, 1+multAdd) — this makes the GAME match its own
  // calibration. Collection rewards + prestige (meta-progression) still stack on top.
  mods.critMultMult = Math.min(mods.critMultMult, CRIT_MULT_GEAR_CAP);

  // #44 hexagon bingo: completed lines feed OFF-GATE matter multipliers (click →
  // wallet click matter, auto → wallet auto matter), never the entropy gate.
  if (ctx.hexSlots) {
    const hb = computeHexBingo(ctx.hexSlots);
    mods.clickMatterMult *= hb.clickMult;
    mods.autoMatterMult *= hb.autoMult;
  }

  // Codex collection completion rewards (permanent, from the almanac).
  if (almanacCollected) {
    applyCollectionRewards(mods, almanacCollected, claimedCodexSubsetIds ?? []);
  }

  // Apply permanent prestige multipliers. Ids are legacy save keys; their levers
  // were retargeted in Overhaul-2 (see PRESTIGE_UPGRADES in ../prestige).
  // entropy_echo is applied at the reducer level (it scales entropy income).
  if (prestigeUpgrades) {
    mods.clickPowerMult *= getPrestigeMultiplier(prestigeUpgrades.matter_forge);   // Matter Forge → click power
    mods.autoRateMult *= getPrestigeMultiplier(prestigeUpgrades.auto_engine);      // Auto Engine → auto production
    mods.critMultMult *= getPrestigeMultiplier(prestigeUpgrades.critical_core);    // Critical Core → crit multiplier
    mods.dropChanceMult *= getPrestigeMultiplier(prestigeUpgrades.time_warp);      // Nucleation Seed → drop rate

    // Condensation Core (endless, off-gate): each level lifts the WALLET income
    // mults only (clickMatterMult + autoMatterMult), NEVER a gate lever. The
    // entropy gate rides the tame clickPower/auto deltas, so stacking this to any
    // level can't move the sim's calibrated pacing.
    const condCore = getCondensationCoreMultiplier(prestigeUpgrades.condensation_core ?? 0);
    mods.clickMatterMult *= condCore;
    mods.autoMatterMult *= condCore;
  }

  // CRIT GEAR CAP re-applied AFTER prestige? No — prestige critMultMult (critical_core)
  // is meta-progression and intentionally stacks ON TOP of the gear cap above.
  return mods;
}
