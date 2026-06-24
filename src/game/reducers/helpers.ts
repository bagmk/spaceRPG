/**
 * Shared helper functions used across reducer slice handlers.
 * None of these are exported from the package — they are internal to the reducer.
 */

import { STAGES } from '../stages';
import { COMBO_CAP_PER_STAGE, COMBO_CAP_CODEX_MAX, COMBO_CAP_SINGULARITY } from '../balance';
import { getActiveModifiers } from '../skills/effects';
import { getEquippedInstances } from '../entities/effects';
import { getCodexCompletionFraction } from '../entities/codexSets';
import { getClickPower, getEntropyGateProgress, getProgress, getEffectiveThreshold } from '../formulas';
import type { GameState } from '../types';
import type { FloatingClickEvent, FloatingCollisionEvent, EncounterEvent } from '../types/events';
import type { RogueTypeKey } from '../types/canvas';
import type { SingularityUnlockId } from '../types';
import { PARTICLE_DEFINITIONS } from '../particles';

export function getCurrentStage(state: GameState) {
  return STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
}

export function getPreviousStage(state: GameState) {
  return state.stageIdx > 0 ? STAGES[state.stageIdx - 1] : null;
}

export function nextEventId(state: GameState): number {
  return state.eventCounter + 1;
}

export function hasUnlock(state: GameState, unlockId: SingularityUnlockId): boolean {
  return state.singularityUnlocks.includes(unlockId);
}

/**
 * Combo-cap BONUS above COMBO_CAP_BASE (P5/R10): grows with stage progression,
 * codex completion, and the free_combo singularity. The gear comboCap substat
 * (modifiers.comboCapAdd) is added separately at the call site.
 */
export function getComboCapBonus(state: GameState): number {
  const stage = COMBO_CAP_PER_STAGE * state.stageIdx;
  // NOTE: codex completion is intentionally consumed TWICE — here (combo cap)
  // and in the prestige mass bonus (getCondensedMassReward, ×CODEX_MASS_BONUS).
  // Collecting deliberately pays off on two axes; both terms are bounded.
  const codex = getCodexCompletionFraction(state.almanacCollected) * COMBO_CAP_CODEX_MAX;
  const singularity = hasUnlock(state, 'free_combo') ? COMBO_CAP_SINGULARITY : 0;
  return stage + codex + singularity;
}

export function getLateStageCompression(state: GameState): number {
  return hasUnlock(state, 'red_shift') && state.stageIdx >= 10 && state.stageIdx <= 14 ? 1.5 : 1;
}

// ── Endgame Singularity nodes (wired 2026-06-24, all OFF-GATE) ───────────────
// These four nodes were `unimplemented` stubs that silently ate condensedMass.
// They now grant modest OFF-GATE boosts (wallet income / drop rate / offline /
// fusion burst) — never a gate lever (clickPower/auto/crit/combo), so the
// entropy-gate calibration is untouched (the sim doesn't read these paths).

/** stellar_memory: auto WALLET matter income ×1.25 (off-gate; mirrors autoMatterMult). */
export function getStellarMemoryAutoMult(state: GameState): number {
  return hasUnlock(state, 'stellar_memory') ? 1.25 : 1;
}

/** multiverse_lens: entity drop chance ×1.5 (off-gate; stacks on dropChanceMult). */
export function getMultiverseLensDropMult(state: GameState): number {
  return hasUnlock(state, 'multiverse_lens') ? 1.5 : 1;
}

// vacuum_stability (offline income ×2) is applied inline in useGameState.ts, where
// the offline catch-up runs on the loaded save payload (no full GameState/hasUnlock).

/** boltzmann_brain: fusion entropy burst ×2 (still span-capped by FUSION_BURST_SPAN_CAP). */
export function getBoltzmannBrainFusionBurstMult(state: GameState): number {
  return hasUnlock(state, 'boltzmann_brain') ? 2 : 1;
}

export function getEncounterRewardMultiplier(state: GameState): number {
  return hasUnlock(state, 'cosmic_web') ? 2 : 1;
}

export function getEncounterClickMultiplier(tier: RogueTypeKey): number {
  if (tier === 'massive') return 100;
  if (tier === 'major') return 40;
  return 10;
}

/** #44: the 7-slot hexagon array (0-2 click / 3-5 rift / 6 wild) for bingo bonuses. */
export function getHexSlots(state: GameState): (string | null)[] {
  const e = state.equippedSlots;
  const r = state.riftSlots;
  return [e[0] || null, e[1] || null, e[2] || null, r[0] || null, r[1] || null, r[2] || null, state.wildSlot || null];
}

export function getCurrentModifiers(state: GameState) {
  const stage = getCurrentStage(state);
  return getActiveModifiers({
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (state.totalTimePlayed - Math.max(0, state.stageStartedAt - state.runStartTime)) / 1000),
    stageId: stage.id,
    gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx),
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage)),
    hexSlots: getHexSlots(state),
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots, state.wildSlot]), state.prestigeUpgrades, state.almanacCollected, state.claimedCodexSubsetIds);
}

export function getAdjustedClickPower(state: GameState): number {
  const mods = getCurrentModifiers(state);
  const base = getClickPower(mods);
  // quark_foam re-anchored (Phase 4-2): the old +clickLevel bonus is gone with
  // the skill tree — a flat +10% keeps the unlock meaningful at any scale.
  return hasUnlock(state, 'quark_foam') ? base * 1.1 : base;
}

export function resetMechanicState(
  _state: GameState,
): Pick<GameState, 'mechanicCharge' | 'mechanicStep' | 'mechanicTriggered'> {
  return { mechanicCharge: 0, mechanicStep: 0, mechanicTriggered: false };
}

export function recordLateStageClickRate(state: GameState, now: number): number[] {
  const stage = getCurrentStage(state);
  if (stage.id < 13 || stage.id > 16) {
    return state.clickRateLog;
  }
  const elapsedSec = Math.max(1, (now - state.stageStartedAt) / 1000);
  const clickRate = Math.max(0, state.totalClicks - state.stageClicksAtStageStart) / elapsedSec;
  return [...state.clickRateLog, clickRate].slice(-4);
}

export function buildAtlasEntry(state: GameState, now: number) {
  const endingId = state.selectedEndingId ?? state.lastEndingId;
  if (!endingId) return null;
  return {
    universeIndex: state.universeCount,
    atlasName: state.currentUniverseSeed.atlasName,
    endingId,
    durationMs: state.totalTimePlayed,
    totalClicks: state.totalClicks,
    collisions: state.collisions,
    completedAt: now,
    seed: state.currentUniverseSeed,
    entropy: state.entropy,
  };
}

export function createClickEvent(
  id: number,
  x: number,
  y: number,
  gained: number,
  isCrit: boolean,
  combo: number,
  comboMult: number,
  particleName: string,
  entropyGained: number,
  droppedEntityId?: string,
): FloatingClickEvent {
  return {
    id,
    x,
    y,
    gained,
    isCrit,
    combo,
    comboMult,
    particleName,
    particleDefinition: PARTICLE_DEFINITIONS[particleName],
    entropyGained,
    droppedEntityId,
  };
}

export function createCollisionEvent(
  id: number,
  x: number,
  y: number,
  bonus: number,
  entropyGained: number,
  name: string,
  tier: RogueTypeKey,
  droppedEntityId?: string,
): FloatingCollisionEvent {
  return { id, x, y, bonus, entropyGained, name, tier, droppedEntityId };
}

export function createEncounterEvent(id: number, name: string, color: string): EncounterEvent {
  return { id, name, color };
}

export function debugDroppedClick(reason: string): void {
  if (import.meta.env.DEV) {
    console.debug(`[click dropped] ${reason}`);
  }
}
