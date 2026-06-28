/** Handlers: TICK, CLICK, BUY_CLICK, BUY_AUTO, BUY_CRIT, ABSORB_COMET, REPORT_ENCOUNTER */

import { TUNING } from '../constants';
import {
  COLLISION_ENTROPY_SPAN_CAP,
  CONDENSE_SPAN_FRAC,
  CONDENSE_STAGE_CAP,
  ENTROPY_W_CLICK,
} from '../balance';
import {
  safeAdd,
  getAutoRate,
  getAutoEntropyRate,
  getComboMult,
  getCosmicTimeFillRate,
  getCritChance,
  getCritMultiplier,
  getEffectiveThreshold,
  getEntropyFromMatterGain,
  getEntropyGateFloor,
  getEntropyGateProgress,
  getEntropyGateSpan,
  getLifeStep,
  getProgress,
  getTimeGaugeForCosmicClock,
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
  isNewDiscovery,
  rollEntityDrop,
} from '../entities/drops';
import { rollQualityScore } from '../entities/quality';
import { getEquippedInstances } from '../entities/effects';
import { syncSlotUnlocks } from './entities';
import { bumpRevisitMilestones } from '../quests';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import {
  getCurrentStage,
  nextEventId,
  getComboCapBonus,
  getCurrentModifiers,
  getAdjustedClickPower,
  getHexSlots,
  getEncounterRewardMultiplier,
  getEncounterClickMultiplier,
  getStellarMemoryAutoMult,
  getMultiverseLensDropMult,
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
type AbsorbCometAction = Extract<GameAction, { type: 'ABSORB_COMET' }>;
type ReportEncounterAction = Extract<GameAction, { type: 'REPORT_ENCOUNTER' }>;

export function handleTick(state: GameState, action: TickAction): GameState {
  const stage = getCurrentStage(state);
  const activeBoosts = pruneExpiredShopBoosts(state.shopBoosts, action.now);
  const shouldEndImplosion =
    state.imploding &&
    state.condenseStartedAt !== null &&
    action.now - state.condenseStartedAt >= TUNING.CONDENSE_IMPLOSION_MS;
  const modifiers = getActiveModifiers({
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
    stageId: stage.id,
    gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx),
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage)),
    hexSlots: getHexSlots(state),
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots, state.wildSlot]), state.prestigeUpgrades, state.almanacCollected, state.claimedCodexSubsetIds);
  const shouldClearCombo =
    state.combo > 0 && action.now - state.lastClick >= modifiers.comboTimeoutMs;
  const canAccrue =
    (!state.completedRun || state.lastEndingId === null) &&
    state.pendingCondenseStageIdx === null &&
    !state.imploding &&
    state.selectedEndingId === null;
  const effectiveThreshold = getEffectiveThreshold(stage);
  const progress = getProgress(state.quanta, effectiveThreshold);
  const baseAuto = getAutoRate(modifiers);
  // GEAR-ONLY ECONOMY CRANK (2026-06-21): the TAME (pre-crank) auto rate feeds the
  // ENTROPY gate so progression pacing is unchanged; the cranked baseAuto feeds the
  // WALLET so auto income affords the shop. Mirrors clickMatterMult ↔ entropy split.
  const baseAutoEntropy = getAutoEntropyRate(modifiers);
  const matterBoost = getActiveShopBoostMultiplier(activeBoosts, 'matter', action.now);
  const timeBoost = getActiveShopBoostMultiplier(activeBoosts, 'time', action.now);
  const simulatedDtSec = (action.dt / 1000) * timeBoost;
  const autoBonusFactor =
    stage.mechanic === 'reionization'
      ? state.mechanicCharge * 0.5
      : stage.mechanic === 'first_stars'
        ? Math.min(1.5, state.mechanicCharge * 0.12)
        : 0;
  const stageAutoBonus = baseAuto * autoBonusFactor;
  const gained = canAccrue ? (baseAuto + stageAutoBonus) * simulatedDtSec * matterBoost : 0;
  // Tame auto matter delta for the entropy gate (same bonus factor, tame base).
  const gainedEntropy = canAccrue ? (baseAutoEntropy * (1 + autoBonusFactor)) * simulatedDtSec * matterBoost : 0;
  // Fill time gauge at gaugeRate%/s regardless of the absolute cosmic-time span.
  // This prevents mid-game stages (6+) from becoming impossible to complete.
  const gaugeRate = getCosmicTimeFillRate(modifiers, 1, state.stageIdx + 1);
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
  // #44 hexagon: the auto bingo bonus boosts the WALLET auto only — entropy keeps
  // riding the TAME `gained` (mirrors clickMatterMult), so a strong auto bonus
  // never feeds the entropy gate (no re-sim). autoMatterMult defaults to 1.
  // stellar_memory singularity (off-gate): ×1.25 on the WALLET auto only.
  const stellarMemoryMult = getStellarMemoryAutoMult(state);
  const walletAuto = gained * modifiers.autoMatterMult * stellarMemoryMult;
  const quantaDelta = walletAuto + tickQuantaDelta;
  const nextQuanta = safeAdd(state.quanta, quantaDelta);
  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Entropy rides the TAME auto delta (gainedEntropy), NOT the cranked wallet `gained`.
  const tameAutoNextQuanta = safeAdd(state.quanta, gainedEntropy + tickQuantaDelta);
  const entropyFromMatter = canAccrue
    ? getEntropyFromMatterGain(state.quanta, tameAutoNextQuanta, effectiveThreshold, 'auto') *
      entropyEchoMult * modifiers.entropyGainMult
    : 0;
  const nextEntropy = safeAdd(state.entropy, entropyFromMatter + tickEntropyDelta * entropyEchoMult);
  // 🅠3: throttled (~1/sec) passive auto-income floating text. Now also fires
  // gearless (base auto income) — entityId '' renders as a plain "+N/s" float.
  // Transient — driven off action.now, never persisted.
  // P6: slots store an instanceId — resolve it to the entity id the float renders.
  const primaryRiftId = getEquippedInstances(state.inventory, state.riftSlots.slice(0, 1))[0]?.entityId ?? '';
  const perSecAuto = (baseAuto + stageAutoBonus) * matterBoost * modifiers.autoMatterMult * stellarMemoryMult;
  const emitAutoIncome =
    canAccrue &&
    perSecAuto > 0 &&
    action.now - (state.lastAutoIncomeEvent?.t ?? 0) >= TUNING.AUTO_INCOME_EVENT_INTERVAL_MS;
  const autoIncomeEventId = emitAutoIncome ? nextEventId(state) : state.eventCounter;
  const lastAutoIncomeEvent = emitAutoIncome
    ? { id: autoIncomeEventId, gained: perSecAuto, entityId: primaryRiftId ?? '', t: action.now }
    : state.lastAutoIncomeEvent;
  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: nextQuanta,
    eventCounter: autoIncomeEventId,
    lastAutoIncomeEvent,
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
  const modifiers = getActiveModifiers({
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (action.now - state.stageStartedAt) / 1000),
    stageId: stage.id,
    gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx),
    progress01: getProgress(state.quanta, getEffectiveThreshold(stage)),
    hexSlots: getHexSlots(state),
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots, state.wildSlot]), state.prestigeUpgrades, state.almanacCollected, state.claimedCodexSubsetIds);
  const combo =
    action.now - state.lastClick < modifiers.comboTimeoutMs ? state.combo + 1 : 1;
  const clickPower = getAdjustedClickPower(state);
  const comboMult = getComboMult(combo, getComboCapBonus(state) + modifiers.comboCapAdd);
  const critEnabled = stage.id > 2 || modifiers.critChanceAdd > 0;
  const isCrit =
    critEnabled &&
    (action.forceCrit === true ||
      action.randomValue < getCritChance(combo, modifiers));
  const critMult = isCrit ? getCritMultiplier(modifiers) : 1;
  const gainMultiplier = action.gainMultiplier ?? 1;
  const matterBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'matter', action.now);
  const baseGained = Math.max(
    1,
    clickPower * comboMult * critMult * gainMultiplier + (action.gainFlat ?? 0),
  );
  const boostedMechanicQuanta = (action.quantaDelta ?? 0) * matterBoost;
  const gained = baseGained * matterBoost;
  // #39 decoupling: the explosive click-gear multiplier scales ONLY the matter
  // the player banks (the satisfying number) — NOT the entropy income below, so
  // the entropy gate stays exactly as calibrated. `gained` remains the tame
  // value that feeds entropy; `matterGained` is what hits the wallet.
  // Overhaul-4: + the click WALLET flat add (ITEM-anchored per tap, mirrors auto's
  // flat /sec; the shop matterBoost applies). Off-gate — the entropy below still rides
  // the tame `gained`, so the gate stays calibrated.
  // 2026-06-23 (user): combo × crit now multiply the FLAT-ADD too. Before, they lived
  // only in `gained`, so once a strong item made the flat-add dominate, combo/crit
  // barely moved the total ("아이템이 쎄지면 콤보/크리가 클릭파워를 안 바꾼다"). Now they scale
  // the whole per-tap matter.
  const comboCritMult = comboMult * critMult;
  const matterGained = gained * modifiers.clickMatterMult + modifiers.clickMatterFlatAdd * comboCritMult * matterBoost;
  const eventId = nextEventId(state);
  const nextQuanta = safeAdd(state.quanta, matterGained + boostedMechanicQuanta);
  const nextProgress = getProgress(nextQuanta, getEffectiveThreshold(stage));
  const particleName = pickParticleName(stage.id, nextProgress);
  const clickEntropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Entropy rides the TAME `gained` (no clickMatterMult) — gate pacing unchanged.
  const clickEntropy = (gained + boostedMechanicQuanta) * ENTROPY_W_CLICK;
  const entropyGained = (clickEntropy + getParticleEntropyBonus(stage.id, particleName, isCrit) + (action.entropyDelta ?? 0)) * clickEntropyEchoMult * modifiers.entropyGainMult;
  // Entity drop roll — collect loop. Skipped when rolls are absent (tests).
  // Stage-revisit: when viewing a PAST stage, draw the drop from THAT stage's pool so the
  // player can revisit earlier eras to fill their codex (absent/current → current stage).
  const dropStageId =
    action.viewedStageId !== undefined && action.viewedStageId >= 1 && action.viewedStageId < stage.id
      ? action.viewedStageId
      : stage.id;
  const droppedEntity =
    action.dropRoll !== undefined && action.dropPickRoll !== undefined
      ? rollEntityDrop(
          dropStageId,
          getClickDropChance(isCrit) * modifiers.dropChanceMult * getMultiverseLensDropMult(state),
          { roll: action.dropRoll, pickRoll: action.dropPickRoll, stageRoll: action.dropStageRoll },
          { isCrit, combo },
          state.almanacCollected,
          // Era-ordered drops only for a live current-stage drop (not a past-stage revisit).
          dropStageId === stage.id ? getEntropyGateProgress(state.entropy, state.stageIdx) : undefined,
        )
      : null;
  // Persona #10: a drop that adds an entity not yet in the almanac is a genuine
  // NEW discovery — fire the floating "발견!" reveal. Uses its OWN event id
  // (eventId + 1) so the CLEAR_DROP_EVENT match is unambiguous; eventCounter
  // advances to cover it. Mirrors lastGachaEvent (transient reveal, not persisted).
  const dropIsNew =
    droppedEntity !== null && isNewDiscovery(state.almanacCollected, droppedEntity.stageId, droppedEntity.id);
  const dropEventId = dropIsNew ? eventId + 1 : eventId;
  // Stage-revisit: a click in a PAST era advances that era's pulse(click) + combo milestone
  // snapshots so a revisit can finish them (same-ref no-op outside a past-stage view).
  const stageQuestProgress =
    action.viewedStageId !== undefined && action.viewedStageId >= 1 && action.viewedStageId < stage.id
      ? bumpRevisitMilestones(state.stageQuestProgress, action.viewedStageId, state.completedQuestIds, {
          pulse: { mode: 'inc', value: 1 },
          combo: { mode: 'max', value: combo },
        })
      : state.stageQuestProgress;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: nextQuanta,
    stageQuestProgress,
    entropy: safeAdd(state.entropy, entropyGained),
    totalClicks: state.totalClicks + 1,
    combo,
    // 🅠5: combo-track quests watch the running max combo reached.
    comboThisStage: Math.max(state.comboThisStage, combo), // milestones: per-stage peak combo
    lastClick: action.now,
    eventCounter: dropEventId,
    lastDropEvent:
      dropIsNew && droppedEntity
        ? { id: dropEventId, entityId: droppedEntity.id, stageId: droppedEntity.stageId, rarity: droppedEntity.rarity }
        : state.lastDropEvent,
    inventory: droppedEntity
      ? addToInventory(
          state.inventory,
          droppedEntity.id,
          action.qualityRoll1 !== undefined && action.qualityRoll2 !== undefined
            ? rollQualityScore(action.qualityRoll1, action.qualityRoll2)
            : undefined,
        )
      : state.inventory,
    almanacCollected: droppedEntity
      ? addToAlmanac(state.almanacCollected, droppedEntity.stageId, droppedEntity.id)
      : state.almanacCollected,
    lastClickEvent: createClickEvent(
      eventId, action.x, action.y, matterGained, isCrit, combo, comboMult, particleName, entropyGained,
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

export function handleAbsorbComet(state: GameState, action: AbsorbCometAction): GameState {
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
  const rawEntropyGain =
    (boostedBonus * ENTROPY_W_CLICK + Math.max(action.entropyBonus, tierEntropyFloor) * mult) *
    modifiers.entropyGainMult;
  // Overhaul-2 🅠1: the matter bonus rides the MATTER threshold (stage.threshold,
  // up to 4e21), but the entropy gate maxes at ~4e8 — so an uncapped late comet
  // dumped many stages of entropy at once. Cap the entropy reward to a fraction
  // of the CURRENT stage's entropy span so a comet is a bounded burst.
  const entropySpan = Math.max(1, stage.entropyThreshold - getEntropyGateFloor(state.stageIdx));
  const tierSpanCap = COLLISION_ENTROPY_SPAN_CAP[action.tier] ?? COLLISION_ENTROPY_SPAN_CAP.minor;
  const entropyGained = Math.min(rawEntropyGain, entropySpan * tierSpanCap);
  const eventId = nextEventId(state);
  // Stage-revisit: absorb a comet while viewing a PAST stage → drop from that stage's pool.
  const dropStageId =
    action.viewedStageId !== undefined && action.viewedStageId >= 1 && action.viewedStageId < stage.id
      ? action.viewedStageId
      : stage.id;
  const droppedEntity =
    action.dropRoll !== undefined && action.dropPickRoll !== undefined
      ? rollEntityDrop(
          dropStageId,
          getCollisionDropChance() * modifiers.dropChanceMult * getMultiverseLensDropMult(state),
          { roll: action.dropRoll, pickRoll: action.dropPickRoll, stageRoll: action.dropStageRoll },
          { isCrit: true },
          state.almanacCollected,
          dropStageId === stage.id ? getEntropyGateProgress(state.entropy, state.stageIdx) : undefined,
        )
      : null;
  // Persona #10: same NEW-discovery reveal for comet-absorb drops.
  const dropIsNew =
    droppedEntity !== null && isNewDiscovery(state.almanacCollected, droppedEntity.stageId, droppedEntity.id);
  const dropEventId = dropIsNew ? eventId + 1 : eventId;
  // Stage-revisit: absorbing a comet while viewing a PAST era advances that era's comet milestone.
  const stageQuestProgress =
    action.viewedStageId !== undefined && action.viewedStageId >= 1 && action.viewedStageId < stage.id
      ? bumpRevisitMilestones(state.stageQuestProgress, action.viewedStageId, state.completedQuestIds, {
          comet: { mode: 'inc', value: 1 },
        })
      : state.stageQuestProgress;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: safeAdd(state.quanta, boostedBonus),
    stageQuestProgress,
    entropy: safeAdd(state.entropy, entropyGained),
    collisions: state.collisions + 1,
    cometsThisStage: state.cometsThisStage + 1, // milestones: per-stage comet counter
    eventCounter: dropEventId,
    lastDropEvent:
      dropIsNew && droppedEntity
        ? { id: dropEventId, entityId: droppedEntity.id, stageId: droppedEntity.stageId, rarity: droppedEntity.rarity }
        : state.lastDropEvent,
    inventory: droppedEntity
      ? addToInventory(
          state.inventory,
          droppedEntity.id,
          action.qualityRoll1 !== undefined && action.qualityRoll2 !== undefined
            ? rollQualityScore(action.qualityRoll1, action.qualityRoll2)
            : undefined,
        )
      : state.inventory,
    almanacCollected: droppedEntity
      ? addToAlmanac(state.almanacCollected, droppedEntity.stageId, droppedEntity.id)
      : state.almanacCollected,
    lastCollisionEvent: createCollisionEvent(
      eventId, action.x, action.y, boostedBonus, entropyGained, action.name, action.tier,
      droppedEntity?.id,
    ),
  }));
}

/**
 * CONDENSE_BURST (분사 / 물질 응축): spend matter (quanta) for a span-capped entropy burst.
 * The off-gate matter wallet does nothing for the entropy gate, so this converts a matter
 * surplus into gate progress — but a PER-STAGE cap (CONDENSE_STAGE_CAP × the stage's entropy
 * span, persisted in condenseBurstThisStage) bounds total 분사 contribution so wealth can never
 * SKIP the gate; after the cap you must click/auto for the rest. The 30s cooldown is enforced
 * UI-side; the reducer only enforces cost / per-stage budget / gate guards. Mirrors the comet
 * entropy-span clamp pattern (handleAbsorbComet).
 */
export function handleCondenseBurst(state: GameState): GameState {
  if (
    state.pendingCondenseStageIdx !== null ||
    state.completedRun ||
    state.imploding ||
    state.selectedEndingId !== null
  ) {
    return state;
  }
  const stage = getCurrentStage(state);
  // No-op if already at/over the gate — 분사 funds progress TO the gate, never past it.
  if (state.entropy >= stage.entropyThreshold) return state;
  const span = getEntropyGateSpan(state.stageIdx);
  // Remaining per-stage 분사 budget: the cap minus what 분사 has already contributed this stage.
  const remainingBudget = span * CONDENSE_STAGE_CAP - state.condenseBurstThisStage;
  if (remainingBudget <= 0) return state;
  // Per-fire add, clamped to the remaining stage budget AND to the gate ceiling (mirrors the
  // comet span clamp — a 분사 never overshoots the gate).
  const perFireAdd = span * CONDENSE_SPAN_FRAC;
  const headroom = Math.max(0, stage.entropyThreshold - state.entropy);
  const add = Math.min(perFireAdd, remainingBudget, headroom);
  if (add <= 0) return state;
  const nextEntropy = safeAdd(state.entropy, add);
  return withCurrentUniverseEndingProgress({
    ...state,
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    condenseBurstThisStage: state.condenseBurstThisStage + add,
  });
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
