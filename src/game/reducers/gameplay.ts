/** Handlers: TICK, CLICK, BUY_CLICK, BUY_AUTO, BUY_CRIT, REPORT_COLLISION, REPORT_ENCOUNTER */

import { TUNING } from '../constants';
import { ENTROPY_W_CLICK } from '../balance';
import {
  safeAdd,
  getAutoRate,
  getComboMult,
  getCosmicTimeFillRate,
  getCritChance,
  getCritMultiplier,
  getEffectiveThreshold,
  getEntropyFromMatterGain,
  getLifeStep,
  getProgress,
  getTimeGaugeForCosmicClock,
  getClickCost,
  getAutoCost,
  getCritCost,
} from '../formulas';
import { getActiveShopBoostMultiplier, pruneExpiredShopBoosts } from '../shop/boosts';
import { getStageStartCosmicTime } from '../timeFlow';
import { getActiveModifiers } from '../skills/effects';
import { getPrestigeMultiplier } from '../prestige';
import { getMechanic } from '../mechanics';
import { pickParticleName, getParticleEntropyBonus } from '../particles';
import {
  addToAlmanac,
  addToInventory,
  getClickDropChance,
  getCollisionDropChance,
  rollEntityDrop,
} from '../entities/drops';
import { getEquippedInstances } from '../entities/effects';
import { syncSlotUnlocks } from './entities';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import {
  getCurrentStage,
  nextEventId,
  getComboCapBonus,
  getCurrentModifiers,
  getAdjustedClickPower,
  getEncounterRewardMultiplier,
  getEncounterClickMultiplier,
  createClickEvent,
  createCollisionEvent,
  createEncounterEvent,
  debugDroppedClick,
} from './helpers';

type TickAction = Extract<GameAction, { type: 'TICK' }>;
type ClickAction = Extract<GameAction, { type: 'CLICK' }>;
type BuyClickAction = Extract<GameAction, { type: 'BUY_CLICK' }>;
type BuyAutoAction = Extract<GameAction, { type: 'BUY_AUTO' }>;
type BuyCritAction = Extract<GameAction, { type: 'BUY_CRIT' }>;
type ReportCollisionAction = Extract<GameAction, { type: 'REPORT_COLLISION' }>;
type ReportEncounterAction = Extract<GameAction, { type: 'REPORT_ENCOUNTER' }>;

export function handleTick(state: GameState, action: TickAction): GameState {
  const stage = getCurrentStage(state);
  const activeBoosts = pruneExpiredShopBoosts(state.shopBoosts, action.now);
  const shouldEndImplosion =
    state.imploding &&
    state.condenseStartedAt !== null &&
    action.now - state.condenseStartedAt >= TUNING.CONDENSE_IMPLOSION_MS;
  const modifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
    stageId: stage.id,
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost)),
    clickLevel: state.skills.click.level,
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots]), state.prestigeUpgrades);
  const shouldClearCombo =
    state.combo > 0 && action.now - state.lastClick >= modifiers.comboTimeoutMs;
  const canAccrue =
    (!state.completedRun || state.lastEndingId === null) &&
    state.pendingCondenseStageIdx === null &&
    !state.imploding &&
    state.selectedEndingId === null;
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  const progress = getProgress(state.quanta, effectiveThreshold);
  const baseAuto = getAutoRate(modifiers);
  const matterBoost = getActiveShopBoostMultiplier(activeBoosts, 'matter', action.now);
  const timeBoost = getActiveShopBoostMultiplier(activeBoosts, 'time', action.now);
  const simulatedDtSec = (action.dt / 1000) * timeBoost;
  const stageAutoBonus =
    stage.mechanic === 'reionization'
      ? baseAuto * state.mechanicCharge * 0.5
      : stage.mechanic === 'first_stars'
        ? baseAuto * Math.min(1.5, state.mechanicCharge * 0.12)
        : 0;
  const gained = canAccrue ? (baseAuto + stageAutoBonus) * simulatedDtSec * matterBoost : 0;
  // Fill time gauge at gaugeRate%/s regardless of the absolute cosmic-time span.
  // This prevents mid-game stages (6+) from becoming impossible to complete.
  const gaugeRate = getCosmicTimeFillRate(state.skills.time.level, modifiers, 1, state.stageIdx + 1);
  const stageStartCosmic = getStageStartCosmicTime(state.stageIdx);
  const logSpan = Math.log10(stage.cosmicTimeSec) - Math.log10(stageStartCosmic);
  const safeCosmic = Math.max(state.cosmicClockSec, stageStartCosmic);
  const cosmicDelta = canAccrue && logSpan > 0
    ? (gaugeRate * simulatedDtSec * logSpan * Math.LN10 * safeCosmic) / 100
    : 0;
  const nextCosmicClockSec = state.completedRun
    ? state.cosmicClockSec
    : Math.min(safeCosmic + cosmicDelta, stage.cosmicTimeSec);
  const nextTimeGauge = getTimeGaugeForCosmicClock(state.stageIdx, nextCosmicClockSec);
  const mechanic = getMechanic(stage.mechanic);
  const tickResult =
    canAccrue && mechanic.onTick
      ? mechanic.onTick({ state, stage, now: action.now, progress01: progress })
      : null;
  const tickQuantaDelta = (tickResult?.quantaDelta ?? 0) * timeBoost * matterBoost;
  const tickEntropyDelta = (tickResult?.entropyDelta ?? 0) * timeBoost;
  const tickMechanicChargeDelta = (tickResult?.mechanicChargeDelta ?? 0) * timeBoost;
  const quantaDelta = gained + tickQuantaDelta;
  const nextQuanta = safeAdd(state.quanta, quantaDelta);
  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  const entropyFromMatter = canAccrue
    ? getEntropyFromMatterGain(state.quanta, nextQuanta, effectiveThreshold, 'auto') *
      entropyEchoMult * modifiers.entropyGainMult
    : 0;
  const nextEntropy = safeAdd(state.entropy, entropyFromMatter + tickEntropyDelta * entropyEchoMult);
  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: nextQuanta,
    timeGauge: nextTimeGauge,
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    totalTimePlayed: state.completedRun ? state.totalTimePlayed : state.totalTimePlayed + action.dt,
    combo: shouldClearCombo ? 0 : state.combo,
    imploding: shouldEndImplosion ? false : state.imploding,
    cosmicClockSec: nextCosmicClockSec,
    mechanicCharge: Math.max(0, state.mechanicCharge + tickMechanicChargeDelta),
    mechanicStep: tickResult?.mechanicStep ?? state.mechanicStep,
    mechanicTriggered: state.mechanicTriggered || Boolean(tickResult?.trigger),
    shopBoosts: activeBoosts,
  });
}

export function handleClick(state: GameState, action: ClickAction): GameState {
  if (state.completedRun && state.lastEndingId !== null) { debugDroppedClick('completed run'); return state; }
  if (state.pendingCondenseStageIdx !== null) { debugDroppedClick('pending condense'); return state; }
  if (state.imploding) { debugDroppedClick('imploding'); return state; }
  if (state.selectedEndingId !== null) { debugDroppedClick('ending selected'); return state; }

  const stage = getCurrentStage(state);
  const modifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
    stageId: stage.id,
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage, state.cumulativeBoost)),
    clickLevel: state.skills.click.level,
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots]), state.prestigeUpgrades);
  const combo =
    action.now - state.lastClick < modifiers.comboTimeoutMs ? state.combo + 1 : 1;
  const clickPower = getAdjustedClickPower(state);
  const comboMult = getComboMult(combo, getComboCapBonus(state) + modifiers.comboCapAdd);
  const critEnabled = stage.id > 2 || state.skills.crit.level > 0 || modifiers.critChanceAdd > 0;
  const isCrit =
    critEnabled &&
    (action.forceCrit === true ||
      action.randomValue < getCritChance(state.skills.crit.level, combo, modifiers));
  const critMult = isCrit ? getCritMultiplier(state.skills.crit.level, modifiers) : 1;
  const gainMultiplier = action.gainMultiplier ?? 1;
  const matterBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'matter', action.now);
  const baseGained = Math.max(
    1,
    clickPower * comboMult * critMult * gainMultiplier + (action.gainFlat ?? 0),
  );
  const boostedMechanicQuanta = (action.quantaDelta ?? 0) * matterBoost;
  const gained = baseGained * matterBoost;
  const eventId = nextEventId(state);
  const nextQuanta = safeAdd(state.quanta, gained + boostedMechanicQuanta);
  const nextProgress = getProgress(nextQuanta, getEffectiveThreshold(stage, state.cumulativeBoost));
  const particleName = pickParticleName(stage.id, nextProgress);
  const clickEntropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  const clickEntropy = (gained + boostedMechanicQuanta) * ENTROPY_W_CLICK;
  const entropyGained = (clickEntropy + getParticleEntropyBonus(stage.id, particleName, isCrit) + (action.entropyDelta ?? 0)) * clickEntropyEchoMult * modifiers.entropyGainMult;
  // Entity drop roll — collect loop. Skipped when rolls are absent (tests).
  const droppedEntity =
    action.dropRoll !== undefined && action.dropPickRoll !== undefined
      ? rollEntityDrop(
          stage.id,
          getClickDropChance(isCrit) * modifiers.dropChanceMult,
          { roll: action.dropRoll, pickRoll: action.dropPickRoll },
          { isCrit, combo },
        )
      : null;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: nextQuanta,
    entropy: safeAdd(state.entropy, entropyGained),
    totalClicks: state.totalClicks + 1,
    combo,
    lastClick: action.now,
    eventCounter: eventId,
    inventory: droppedEntity ? addToInventory(state.inventory, droppedEntity.id) : state.inventory,
    almanacCollected: droppedEntity
      ? addToAlmanac(state.almanacCollected, droppedEntity.stageId, droppedEntity.id)
      : state.almanacCollected,
    lastClickEvent: createClickEvent(
      eventId, action.x, action.y, gained, isCrit, combo, comboMult, particleName, entropyGained,
      droppedEntity?.id,
    ),
    mechanicCharge: Math.max(0, state.mechanicCharge + (action.mechanicChargeDelta ?? 0)),
    mechanicStep: action.mechanicStep ?? (stage.mechanic === 'life_evolution' ? getLifeStep(nextProgress) : state.mechanicStep),
    mechanicTriggered: state.mechanicTriggered || Boolean(action.trigger),
  }));
}

function isInteractionBlocked(state: GameState): boolean {
  return (
    state.completedRun ||
    state.pendingCondenseStageIdx !== null ||
    state.imploding ||
    state.selectedEndingId !== null
  );
}

export function handleBuyClick(state: GameState, _action: BuyClickAction): GameState {
  if (isInteractionBlocked(state)) return state;
  const stage = getCurrentStage(state);
  const cost = getClickCost(stage, state.clickLevel);
  if (state.quanta < cost) return state;
  return { ...state, quanta: state.quanta - cost, clickLevel: state.clickLevel + 1 };
}

export function handleBuyAuto(state: GameState, _action: BuyAutoAction): GameState {
  if (isInteractionBlocked(state)) return state;
  const stage = getCurrentStage(state);
  const cost = getAutoCost(stage, state.autoLevel);
  if (state.quanta < cost) return state;
  return { ...state, quanta: state.quanta - cost, autoLevel: state.autoLevel + 1 };
}

export function handleBuyCrit(state: GameState, _action: BuyCritAction): GameState {
  if (isInteractionBlocked(state)) return state;
  const stage = getCurrentStage(state);
  const cost = getCritCost(stage, state.critLevel);
  if (state.quanta < cost) return state;
  return withCurrentUniverseEndingProgress({ ...state, quanta: state.quanta - cost, critLevel: state.critLevel + 1 });
}

export function handleReportCollision(state: GameState, action: ReportCollisionAction): GameState {
  if (state.pendingCondenseStageIdx !== null || state.completedRun) return state;
  const stage = getCurrentStage(state);
  const modifiers = getCurrentModifiers(state);
  const mult = getEncounterRewardMultiplier(state);
  const clickScaledBonus = getAdjustedClickPower(state) * getEncounterClickMultiplier(action.tier);
  const rawBonus = Math.max(action.bonus, clickScaledBonus);
  const scaledClickBonus = clickScaledBonus * mult * modifiers.encounterBonusMult;
  const tierCapMult = action.tier === 'massive' ? 3 : action.tier === 'major' ? 2 : 1;
  const cap = Math.max(
    stage.threshold * (modifiers.manyWorldsCapMult > 1 ? 0.05 : 0.02) * tierCapMult,
    scaledClickBonus,
  );
  const cappedBonus = Math.min(rawBonus * mult * modifiers.encounterBonusMult, cap);
  const tierEntropyFloor = action.tier === 'massive' ? 200 : action.tier === 'major' ? 50 : 10;
  const matterBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'matter', Date.now());
  const boostedBonus = cappedBonus * matterBoost;
  const entropyGained =
    (boostedBonus * ENTROPY_W_CLICK + Math.max(action.entropyBonus, tierEntropyFloor) * mult) *
    modifiers.entropyGainMult;
  const eventId = nextEventId(state);
  const droppedEntity =
    action.dropRoll !== undefined && action.dropPickRoll !== undefined
      ? rollEntityDrop(
          stage.id,
          getCollisionDropChance() * modifiers.dropChanceMult,
          { roll: action.dropRoll, pickRoll: action.dropPickRoll },
          { isCrit: true },
        )
      : null;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: safeAdd(state.quanta, boostedBonus),
    entropy: safeAdd(state.entropy, entropyGained),
    collisions: state.collisions + 1,
    eventCounter: eventId,
    inventory: droppedEntity ? addToInventory(state.inventory, droppedEntity.id) : state.inventory,
    almanacCollected: droppedEntity
      ? addToAlmanac(state.almanacCollected, droppedEntity.stageId, droppedEntity.id)
      : state.almanacCollected,
    lastCollisionEvent: createCollisionEvent(
      eventId, action.x, action.y, boostedBonus, entropyGained, action.name, action.tier,
      droppedEntity?.id,
    ),
  }));
}

export function handleReportEncounter(state: GameState, action: ReportEncounterAction): GameState {
  if (state.pendingCondenseStageIdx !== null || state.completedRun) return state;
  const eventId = nextEventId(state);
  return {
    ...state,
    eventCounter: eventId,
    lastEncounterEvent: createEncounterEvent(eventId, action.name, action.color),
  };
}
