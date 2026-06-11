/**
 * Shared helper functions used across reducer slice handlers.
 * None of these are exported from the package — they are internal to the reducer.
 */

import { STAGES } from '../stages';
import { getActiveModifiers } from '../skills/effects';
import { getEquippedInstances } from '../entities/effects';
import { getClickPower, getProgress, getEffectiveThreshold } from '../formulas';
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

export function getComboCapBonus(state: GameState): number {
  return hasUnlock(state, 'free_combo') ? 2 : 0;
}

export function getLateStageCompression(state: GameState): number {
  return hasUnlock(state, 'red_shift') && state.stageIdx >= 10 && state.stageIdx <= 14 ? 1.5 : 1;
}

export function getEncounterRewardMultiplier(state: GameState): number {
  return hasUnlock(state, 'cosmic_web') ? 2 : 1;
}

export function getEncounterClickMultiplier(tier: RogueTypeKey): number {
  if (tier === 'massive') return 100;
  if (tier === 'major') return 40;
  return 10;
}

export function getCurrentModifiers(state: GameState) {
  const stage = getCurrentStage(state);
  return getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (state.totalTimePlayed - Math.max(0, state.stageStartedAt - state.runStartTime)) / 1000),
    stageId: stage.id,
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost)),
    clickLevel: state.skills.click.level,
  }, getEquippedInstances(state.inventory, state.equippedSlots), state.prestigeUpgrades);
}

export function getAdjustedClickPower(state: GameState): number {
  const mods = getCurrentModifiers(state);
  const base = getClickPower(mods);
  return hasUnlock(state, 'quark_foam') ? base + state.skills.click.level + 1 : base;
}

export function getTrackUnlocksForStage(stageId: number): GameState['skills']['unlockedTracks'] {
  const unlocked: GameState['skills']['unlockedTracks'] = ['click'];
  if (stageId >= 3) unlocked.push('auto');
  if (stageId >= 4) unlocked.push('crit');
  if (stageId >= 5) unlocked.push('time');
  return unlocked;
}

export function unlockTrackForStage(
  skills: GameState['skills'],
  stageId: number,
): GameState['skills'] {
  const unlocked = new Set(skills.unlockedTracks);
  getTrackUnlocksForStage(stageId).forEach((trackId) => unlocked.add(trackId));
  return { ...skills, unlockedTracks: Array.from(unlocked) as GameState['skills']['unlockedTracks'] };
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
