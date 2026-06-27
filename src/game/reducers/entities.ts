import type { GameState, FusionResultCard } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById, getEntitiesForStage, getOwnedEntityCount } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { addToAlmanac, addToInventory, pickDropStage } from '../entities/drops';
import { makeInstance, pickFreeCopyId, reservedInstanceIds } from '../entities/instances';
import { getDerivedRiftSlotCount, getDerivedUnlockedSlotCount, getEquipCategory } from '../entities/effects';
import {
  applyFusionOutput,
  consumeFusionInputs,
  getFusionEntropyBurst,
  getFusionQuantaCost,
  pickFusionOutput,
  rollFusionRarity,
  validateFusionInputs,
} from '../entities/fusion';
import {
  getEnhanceLevelCap,
  applyMergeCopies,
  getEnhanceStoneCost,
  isEnhanceRiskLevel,
  getEnhanceFailChance,
  getSpecialEnhanceFailChance,
  rollBreakStones,
} from '../entities/enhance';
import { ENHANCE_STONE_THRESHOLD, SPECIAL_ENHANCE_CARD_COST } from '../balance';
import { rollQualityScore, bestQuality } from '../entities/quality';
import { getSecondaryStats } from '../entities/substats';
import {
  FUSION_ENHANCE_COST_BASE,
  FUSION_BURST_REF_COST_FRAC,
  FUSION_INPUT_COUNT,
  RARITY_STAGE_GATES,
  FUSION_FAIL_STONES_BY_TIER,
  FUSION_SAME_ENTITY_UP_BONUS,
  FUSION_SAME_ENTITY_FAIL_STONE_BONUS,
  FUSION_SAME_SUBSET_BURST_MULT,
  FUSION_BURST_SPAN_CAP,
  FUSION_BATCH_BURST_SPAN_CAP,
  HEX_WILD_UNLOCK_STAGE,
} from '../balance';
import { getEntityCost } from '../entities/types';
import { getAutoEntropyRate, getEntropyGateFloor, safeAdd } from '../formulas';
import { getPrestigeMultiplier } from '../prestige';
import { STAGES } from '../stages';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import { getAdjustedClickPower, getCurrentModifiers, getBoltzmannBrainFusionBurstMult, nextEventId } from './helpers';

type PurchaseAction = Extract<GameAction, { type: 'PURCHASE_ENTITY' }>;
type EquipAction = Extract<GameAction, { type: 'EQUIP_ENTITY' }>;
type UnequipAction = Extract<GameAction, { type: 'UNEQUIP_ENTITY' }>;
type FuseAction = Extract<GameAction, { type: 'FUSE_ENTITIES' }>;
type FuseBatchAction = Extract<GameAction, { type: 'FUSE_BATCH' }>;
type EnhanceAction = Extract<GameAction, { type: 'ENHANCE_ENTITY' }>;

/** Raise slot counts when stage/almanac progress earns new slots (never lowers). */
export function syncSlotUnlocks(state: GameState): GameState {
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  const derived = getDerivedUnlockedSlotCount(stage.id, state.almanacCollected);
  const derivedRift = getDerivedRiftSlotCount(stage.id, state.almanacCollected);
  if (derived <= state.unlockedSlotCount && derivedRift <= state.unlockedRiftSlotCount) return state;
  return {
    ...state,
    unlockedSlotCount: Math.max(state.unlockedSlotCount, derived),
    unlockedRiftSlotCount: Math.max(state.unlockedRiftSlotCount, derivedRift),
  };
}

/**
 * Equip an owned entity. The gear category is derived from the entity itself —
 * auto/time entities go to the rift slots, everything else to click slots.
 * Without an explicit slot, the first empty unlocked one is used.
 */
export function handleEquipEntity(state: GameState, action: EquipAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  // P6: equip a SPECIFIC free copy. The UI still passes an entityId; the reducer
  // picks the first un-equipped copy's instanceId, so clicking equip on the same
  // item twice places two distinct copies in two slots (per-copy placement).
  const reserved = reservedInstanceIds(state.equippedSlots, state.riftSlots, state.wildSlot);
  const instanceId = pickFreeCopyId(state.inventory, entity, reserved);
  if (!instanceId) return state; // no spare (un-equipped) copy to place

  // Vacuum-decay (crit-gear) flag — shared by the wild + normal equip paths.
  const isCritGear =
    entity.effect.type === 'crit' ||
    getSecondaryStats(entity).some((sub) => sub.type === 'critChance' || sub.type === 'critMult');
  const critFlags = isCritGear && !state.endingProgressFlags.criticalUpgradedThisUniverse
    ? { ...state.endingProgressFlags, criticalUpgradedThisUniverse: true, vacuumDecayEligible: false }
    : state.endingProgressFlags;
  // #3 (user): first successful equip arms the fusion-intro tutorial step.
  const eqFlags = state.tutorialFlags['first-equip-done']
    ? state.tutorialFlags
    : { ...state.tutorialFlags, 'first-equip-done': true };

  // #44 hexagon CENTER (wild) slot — accepts ANY category. Unlocks by stage.
  if (action.wild) {
    const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
    if (stageId < HEX_WILD_UNLOCK_STAGE) return state;
    return { ...state, wildSlot: instanceId, endingProgressFlags: critFlags, tutorialFlags: eqFlags };
  }

  const category = getEquipCategory(entity);
  const slots = category === 'rift' ? state.riftSlots : state.equippedSlots;
  const slotCount = category === 'rift' ? state.unlockedRiftSlotCount : state.unlockedSlotCount;

  let slot = action.slot ?? -1;
  if (slot === -1) {
    // First empty unlocked slot; fall back to replacing slot 0.
    slot = 0;
    for (let i = 0; i < slotCount; i++) {
      if (!slots[i]) { slot = i; break; }
    }
  }
  if (slot < 0 || slot >= slotCount) return state;

  // Dense array — empty slots hold '' so JSON round-trips cleanly (no holes).
  // The chosen copy is guaranteed un-reserved, so no duplicate-instance check.
  const next: string[] = [];
  for (let i = 0; i < slotCount; i++) next[i] = slots[i] ?? '';
  next[slot] = instanceId;
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return category === 'rift'
    ? { ...state, riftSlots: next, endingProgressFlags: critFlags, tutorialFlags: eqFlags }
    : { ...state, equippedSlots: next, endingProgressFlags: critFlags, tutorialFlags: eqFlags };
}

export function handleUnequipEntity(state: GameState, action: UnequipAction): GameState {
  const category = action.target ?? 'click';
  if (category === 'wild') {
    return state.wildSlot ? { ...state, wildSlot: '' } : state;
  }
  const slots = category === 'rift' ? state.riftSlots : state.equippedSlots;
  if (action.slot < 0 || action.slot >= slots.length) return state;
  if (!slots[action.slot]) return state;
  const next = slots.map((id, i) => (i === action.slot ? '' : id));
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return category === 'rift'
    ? { ...state, riftSlots: next }
    : { ...state, equippedSlots: next };
}

export function handlePurchaseEntity(state: GameState, action: PurchaseAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  // Allow purchasing entities from any stage up to and including the current stage
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage || entity.stageId > currentStage.id) return state;

  // Rarity gate: higher tiers unlock as the run progresses (fusion can craft
  // one tier early, but the shop never sells ahead of the gate).
  if ((RARITY_STAGE_GATES[entity.rarity] ?? 1) > currentStage.id) return state;

  // P6: count is the total of all flat copies of this entity (each count 1).
  const currentCount = getOwnedEntityCount(state.inventory, entity);

  // Max count check — Overhaul-4 P1: this cap is BUY-for-collection ONLY. Grants/mints
  // (drops, gacha, fusion output, the copy-token) go through addToInventory and are
  // intentionally uncapped, so high-rarity duplicate-collection leveling stays possible.
  if (entity.maxCount > 0 && currentCount >= entity.maxCount) return state;

  // Anchor lock — non-anchor entities on the same stage are blocked until
  // the anchor entity for that stage (e.g. Sun on stage 10, Earth Formation
  // on stage 11) is fully maxed.
  if (isEntityLockedByAnchor(entity, state.inventory)) return state;

  const cost = getEntityCost(entity, currentCount, currentStage.id);
  if (state.quanta < cost) return state;

  // #50: a purchased copy rolls quality too; the stack keeps its best specimen.
  const rolledQuality =
    action.qualityRoll1 !== undefined && action.qualityRoll2 !== undefined
      ? rollQualityScore(action.qualityRoll1, action.qualityRoll2)
      : undefined;
  // P6: every purchase adds a NEW flat copy (its own instanceId, level 1).
  const updatedInventory = [
    ...state.inventory,
    makeInstance(action.entityId, rolledQuality !== undefined ? { quality: rolledQuality } : {}),
  ];

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: state.quanta - cost,
    inventory: updatedInventory,
    // Purchases count as collected for the almanac grid.
    almanacCollected: addToAlmanac(state.almanacCollected, entity.stageId, entity.id),
  }));
}

/**
 * FUSE_ENTITIES (Phase 3): consume FUSION_INPUT_COUNT same-rarity copies plus a
 * quanta fraction; roll a same-stage output with pure rarity-up odds (no pity),
 * fire an entropy burst, and feed duplicates at max count into level-ups.
 * Randomness arrives via action rolls so the reducer stays pure.
 */
interface FuseRolls {
  rarityRoll: number;
  pickRoll: number;
  stageRoll?: number;
  /** #50 — gaussian quality roll for the fused output (paired with pickRoll). */
  qualityRoll?: number;
}

interface OneFusionResult {
  outputId: string;
  rarityUp: boolean;
  atCap: boolean;
  stonesEarned: number;
  burst: number;
  refund: number;
}

/**
 * Core of one fusion (🅠4): validate + afford-check + roll + consume + apply,
 * returning the MUTATED state (quanta / entropy / 강화석 / inventory / almanac)
 * WITHOUT the lastFusionEvent / eventCounter / ending-progress wrap. The caller
 * (single FUSE_ENTITIES or batched FUSE_BATCH) sets the event + wraps ONCE.
 * Returns null when the inputs are invalid or unaffordable (which stops a batch).
 */
function fuseOnce(
  state: GameState,
  inputEntityIds: string[],
  rolls: FuseRolls,
): { state: GameState; result: OneFusionResult } | null {
  const equippedIds = new Set([...state.equippedSlots, ...state.riftSlots, state.wildSlot].filter(Boolean) as string[]);
  const validation = validateFusionInputs(state.inventory, inputEntityIds, equippedIds);
  if (!validation.ok || !validation.rarity || !validation.stageId) return null;

  const currentStageIdForFusion = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  // Fusion is a fixed per-era price (Overhaul-2 🅠1): anchor × FUSION_FLAT_COST.
  // The player must afford it in full — there is no bank-fraction discount.
  const cost = getFusionQuantaCost(validation.rarity, currentStageIdForFusion);
  if (state.quanta < cost) return null;
  // P2b bonuses: 3-of-the-same-entity lifts the up chance; 3-from-one-codex
  // category amplifies the entropy burst.
  const sameEntity = validation.sameEntity === true;
  const sameSubset = validation.sameSubsetId != null;

  // Onboarding: first two fusions at stage 2 (stageIdx 1) yield guaranteed types
  // so new players immediately see both click and auto items to equip. Guards
  // against re-triggering after prestige via the tutorialFlag.
  const stageEntities = getEntitiesForStage(currentStageIdForFusion);
  const isFirstFusion =
    state.stageIdx === 1 &&
    (state.fusionsThisStage ?? 0) === 0 &&
    !state.tutorialFlags['first-fuse-done'];
  const isSecondFusion =
    state.stageIdx === 1 &&
    (state.fusionsThisStage ?? 0) === 1 &&
    !state.tutorialFlags['second-fuse-done'];

  let output =
    isFirstFusion
      ? (stageEntities.find(e => e.rarity === 'common' && e.effect.type === 'click') ?? null)
      : isSecondFusion
        ? (stageEntities.find(e => e.rarity === 'common' && e.effect.type === 'auto') ?? null)
        : null;

  let rarityResult = { rarity: validation.rarity, rarityUp: false as boolean };
  if (!output) {
    rarityResult = rollFusionRarity(
      validation.rarity, rolls.rarityRoll, currentStageIdForFusion,
      sameEntity ? FUSION_SAME_ENTITY_UP_BONUS : 0,
    );
    // Output pool stage follows the same player-stage weighting as drops
    // (Phase 4-1) — input origin stages no longer determine the output pool.
    const outputStageId =
      rolls.stageRoll !== undefined
        ? pickDropStage(currentStageIdForFusion, rolls.stageRoll, state.almanacCollected)
        : currentStageIdForFusion;
    output = pickFusionOutput(outputStageId, rarityResult.rarity, rolls.pickRoll, {
      category: validation.category,
      familyKey: validation.familyKey,
    }, outputStageId !== currentStageIdForFusion);
  }
  if (!output) return null;

  // P6: never consume an equipped copy — pass the reserved instanceIds so the
  // forge picks only spare (un-equipped) copies.
  const fuseReserved = reservedInstanceIds(state.equippedSlots, state.riftSlots, state.wildSlot);
  const { inventory: consumed, refund: enhanceRefund, stoneRefund, minLevel: fusedLevel } = consumeFusionInputs(state.inventory, inputEntityIds, fuseReserved);
  // #50: the fused output rolls quality too — fusion is the headline "pull", so a
  // lucky tail here is the most exciting place to land a gold item.
  const fusedQuality =
    rolls.qualityRoll !== undefined ? rollQualityScore(rolls.qualityRoll, rolls.pickRoll) : undefined;
  // P7b: the output carries the lowest consumed level so merge-leveling survives a fuse-up.
  const { inventory, capRefund } = applyFusionOutput(consumed, output, currentStageIdForFusion, fusedQuality, fusedLevel);
  const totalRefund = enhanceRefund + capRefund;
  // RARITY-UP IS THE ACTUAL OUTPUT vs INPUT (#42-fix): rollFusionRarity can roll
  // "up" but pickFusionOutput falls back to a lower rarity when the rolled output
  // stage lacks that tier — so a common→common fusion was wrongly flagged "등급
  // 상승". Judge by the real output rarity instead.
  const FUSION_RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const rarityUp = (FUSION_RARITY_RANK[output.rarity] ?? 0) > (FUSION_RARITY_RANK[validation.rarity] ?? 0);
  // A failed fusion (no rarity-up) mints 강화석 — the consolation that funds
  // Lv5+ enhancement (R1). Stones scale with the input tier; +bonus for same-entity.
  const stonesEarned = rarityUp
    ? 0
    : (FUSION_FAIL_STONES_BY_TIER[validation.rarity] ?? 1) + (sameEntity ? FUSION_SAME_ENTITY_FAIL_STONE_BONUS : 0);

  const fusionModifiers = getCurrentModifiers(state);
  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Burst scales by fusion cost vs a reference price. Overhaul-2 follow-up:
  // both the cost and this reference now use the stage-independent flat base, so
  // burstCostScale resolves to a fixed per-rarity fraction at EVERY stage (the
  // burst no longer collapses late-game when costs were flattened).
  const burstRefCost = FUSION_ENHANCE_COST_BASE * FUSION_BURST_REF_COST_FRAC;
  const burstCostScale = burstRefCost > 0 ? Math.min(1, cost / burstRefCost) : 1;
  const rawBurst =
    // GEAR-ONLY ECONOMY CRANK (2026-06-21): the burst's auto reference uses the TAME
    // (pre-crank) auto rate so the player-stage wallet crank never inflates the
    // entropy burst (gate untouched; also still span-capped below).
    getFusionEntropyBurst(getAdjustedClickPower(state), getAutoEntropyRate(fusionModifiers)) *
    fusionModifiers.fusionBurstMult *
    getBoltzmannBrainFusionBurstMult(state) *
    entropyEchoMult *
    burstCostScale *
    (sameSubset ? FUSION_SAME_SUBSET_BURST_MULT : 1);
  // Overhaul-3 pacing fix: clamp the burst to a small fraction of the CURRENT
  // stage's entropy span (mirrors the comet cap, gameplay.ts handleAbsorbComet)
  // so a single fuse — even at a heavily-enhanced loadout — can't dump most of a
  // stage's gate at once. fuseOnce is shared by single AND batch fuses, so this
  // one clamp bounds both. `burst` (capped) is what hits entropy AND the result.
  const fuseStage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  const fuseSpan = Math.max(1, fuseStage.entropyThreshold - getEntropyGateFloor(state.stageIdx));
  const burst = Math.min(rawBurst, fuseSpan * FUSION_BURST_SPAN_CAP);
  const nextEntropy = safeAdd(state.entropy, burst);

  const nextTutorialFlags = isFirstFusion
    ? { ...state.tutorialFlags, 'first-fuse-done': true }
    : isSecondFusion
      ? { ...state.tutorialFlags, 'second-fuse-done': true }
      : state.tutorialFlags;

  const nextState: GameState = {
    ...state,
    quanta: Math.max(0, state.quanta - cost + totalRefund),
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    enhanceStones: Math.max(0, state.enhanceStones + stonesEarned + stoneRefund),
    inventory,
    almanacCollected: addToAlmanac(state.almanacCollected, output.stageId, output.id),
    tutorialFlags: nextTutorialFlags,
  };
  return {
    state: nextState,
    result: {
      outputId: output.id,
      rarityUp,
      atCap: capRefund > 0,
      stonesEarned,
      burst,
      refund: totalRefund,
    },
  };
}

/**
 * FUSE_ENTITIES (Phase 3 / 🅠4): consume FUSION_INPUT_COUNT same-rarity copies +
 * a fixed quanta cost; roll a same-stage output with pure rarity-up odds, fire an
 * entropy burst, feed duplicates at max count into level-ups. Randomness arrives
 * via action rolls so the reducer stays pure.
 */
export function handleFuseEntities(state: GameState, action: FuseAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const r = fuseOnce(state, action.inputEntityIds, action);
  if (!r) return state;
  const eventId = nextEventId(r.state);
  const { result } = r;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...r.state,
    eventCounter: eventId,
    fusionsThisStage: r.state.fusionsThisStage + 1, // milestones: per-stage fuse counter
    lastFusionEvent: {
      id: eventId,
      outputEntityId: result.outputId,
      rarityUp: result.rarityUp,
      entropyBurst: result.burst,
      refund: result.refund,
      atCap: result.atCap,
      stonesEarned: result.stonesEarned,
      batchCount: 1,
      successCount: result.rarityUp ? 1 : 0,
      failCount: result.rarityUp ? 0 : 1,
      cards: [{
        outputEntityId: result.outputId,
        rarityUp: result.rarityUp,
        atCap: result.atCap,
        stonesEarned: result.stonesEarned,
      }],
    },
  }));
}

/**
 * FUSE_BATCH (🅠4): fuse up to action.rolls.length trios in one action. The UI
 * supplies a flat inputEntityIds list (FUSION_INPUT_COUNT × N copies it already
 * drew from the inventory) plus N roll-sets. Each trio runs through fuseOnce;
 * the loop stops early on the first invalid/unaffordable trio. A single batch
 * summary event ("N성공 / M") is emitted with the accumulated totals.
 */
export function handleFuseBatch(state: GameState, action: FuseBatchAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  let s = state;
  let done = 0;
  let successCount = 0;
  let failCount = 0;
  let totalStones = 0;
  let totalBurst = 0;
  let totalRefund = 0;
  let anyAtCap = false;
  let lastResult: OneFusionResult | null = null;
  const cards: FusionResultCard[] = [];
  for (let i = 0; i < action.rolls.length; i++) {
    const trio = action.inputEntityIds.slice(i * FUSION_INPUT_COUNT, i * FUSION_INPUT_COUNT + FUSION_INPUT_COUNT);
    if (trio.length < FUSION_INPUT_COUNT) break;
    const r = fuseOnce(s, trio, action.rolls[i]);
    if (!r) break; // invalid inputs or out of quanta — stop the batch here.
    s = r.state;
    done += 1;
    if (r.result.rarityUp) successCount += 1; else failCount += 1;
    totalStones += r.result.stonesEarned;
    totalBurst += r.result.burst;
    totalRefund += r.result.refund;
    anyAtCap = anyAtCap || r.result.atCap;
    lastResult = r.result;
    cards.push({
      outputEntityId: r.result.outputId,
      rarityUp: r.result.rarityUp,
      atCap: r.result.atCap,
      stonesEarned: r.result.stonesEarned,
    });
  }
  if (!lastResult) return state;
  // Overhaul-3 pacing fix: defense-in-depth aggregate cap. Each constituent burst
  // is already clamped to FUSION_BURST_SPAN_CAP in fuseOnce, but up to
  // FUSION_BATCH_MAX_TRIOS of them still sum, so a full batch could otherwise
  // advance a large slice of a stage. Clamp the batch total to a fraction of the
  // span and refund the excess back out of entropy.
  const batchStage = STAGES[Math.min(s.stageIdx, STAGES.length - 1)];
  const batchSpan = Math.max(1, batchStage.entropyThreshold - getEntropyGateFloor(s.stageIdx));
  const batchAllowed = batchSpan * FUSION_BATCH_BURST_SPAN_CAP;
  if (totalBurst > batchAllowed) {
    const excess = totalBurst - batchAllowed;
    const floor = getEntropyGateFloor(s.stageIdx);
    s = { ...s, entropy: Math.max(floor, s.entropy - excess) };
    totalBurst = batchAllowed;
  }
  const eventId = nextEventId(s);
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...s,
    eventCounter: eventId,
    fusionsThisStage: s.fusionsThisStage + done, // milestones: per-stage fuse counter
    lastFusionEvent: {
      id: eventId,
      outputEntityId: lastResult.outputId,
      rarityUp: successCount > 0,
      entropyBurst: totalBurst,
      refund: totalRefund,
      atCap: anyAtCap,
      stonesEarned: totalStones,
      batchCount: done,
      successCount,
      failCount,
      cards,
    },
  }));
}

/**
 * ENHANCE_ENTITY (강화소): level a copy by MERGING spare duplicate copies of the SAME
 * item (collect, don't pay), or — when you have no spares — paying the 강화석 escape.
 * Anchor = the equipped copy of that entity if one is equipped, else its highest-level
 * copy. Fodder = its OTHER copies (spares), excluding the anchor and any equipped copy;
 * consumed lowest-level then lowest-quality first. The anchor inherits the best quality
 * among itself + everything consumed.
 *
 * RISK (user "실패·파괴 부활 + 보호 아이템"): the Lv1→2 and Lv2→3 steps are GUARANTEED. From
 * the step landing on ENHANCE_STONE_THRESHOLD (Lv3) up, each attempt is a SINGLE level
 * that can FAIL (getEnhanceFailChance). On an unprotected fail the anchor copy is
 * DESTROYED + consolation 강화석 minted; if "보호 사용" is on AND a charge is held, one
 * enhanceProtectCharge is spent instead and the copy survives unchanged. The merge path
 * still climbs MULTIPLE levels at once, but ONLY through the guaranteed band — it stops
 * at the threshold so every risky step is a deliberate, single, insurable attempt.
 */
export function handleEnhanceEntity(state: GameState, action: EnhanceAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const equippedIds = new Set(
    [...state.equippedSlots, ...state.riftSlots, state.wildSlot].filter(Boolean) as string[],
  );
  // Resolve the anchor copy: by instanceId, else (entityId fallback) the equipped
  // copy of that entity, else its highest-level copy.
  let anchor = state.inventory.find((e) => e.instanceId === action.instanceId);
  let entity = anchor ? findEntityById(anchor.entityId) : undefined;
  if (!anchor) {
    const ent = findEntityById(action.instanceId);
    if (ent) {
      const copies = state.inventory.filter((e) => entityMatchesId(ent, e.entityId));
      anchor = copies.find((e) => equippedIds.has(e.instanceId ?? '')) ?? [...copies].sort((a, b) => b.level - a.level)[0];
      entity = ent;
    }
  }
  if (!anchor || !entity) return state;

  const cap = getEnhanceLevelCap(entity);
  if (anchor.level >= cap) return state;
  const anchorId = anchor.instanceId;
  const prevLevel = anchor.level;
  const risky = isEnhanceRiskLevel(prevLevel); // this step (prev → prev+1) can fail

  // Fodder = same-entity spares (not the anchor, not equipped), weakest first.
  const fodder = state.inventory
    .filter((e) => e.entityId === anchor!.entityId && e.instanceId !== anchorId && !equippedIds.has(e.instanceId ?? ''))
    .sort((a, b) => a.level - b.level || (a.quality ?? 1) - (b.quality ?? 1));
  const spares = fodder.reduce((s, e) => s + (e.count ?? 1), 0);

  // Guaranteed multi-level merge climbs only THROUGH the threshold; the risky step is
  // always taken one level at a time so each fail roll covers exactly one attempt.
  const mergeCap = risky ? prevLevel : Math.min(cap, ENHANCE_STONE_THRESHOLD - 1);
  const merge = applyMergeCopies(prevLevel, spares, mergeCap);

  // ── Determine COST & path. The risk step is single-level on whichever path is open;
  //    the guaranteed band uses the existing greedy merge / 강화석 escape. ──
  const usingMerge = merge.levelsGained > 0; // spares cover at least one guaranteed level
  let consumedIds = new Set<string | undefined>();
  let consumedInstances = fodder.slice(0, 0);
  let stoneSpend = 0;
  let resultLevel: number;

  if (risky) {
    // Single risky level: pay with copies if you have need(prevLevel), else the 강화석
    // escape, else no-op. Resolve the fail roll, then apply protect/break/up.
    // 특수강화: the copy path is a FLAT 3 cards with a reduced fail chance; the 강화석
    // escape keeps the normal (un-reduced) odds.
    const needCopies = SPECIAL_ENHANCE_CARD_COST;
    const stoneCost = getEnhanceStoneCost(entity, prevLevel);
    // useSpecial OFF (default ON) forces the 강화석 path even when copies are spare.
    const payWithCopies = (action.useSpecial ?? true) && spares >= needCopies;
    if (!payWithCopies && state.enhanceStones < stoneCost) return state;
    if (payWithCopies) {
      consumedInstances = fodder.slice(0, needCopies);
      consumedIds = new Set(consumedInstances.map((e) => e.instanceId));
    } else {
      stoneSpend = stoneCost;
    }
    resultLevel = prevLevel + 1;

    const failRoll = action.failRoll ?? Math.random();
    const effFail = payWithCopies ? getSpecialEnhanceFailChance(prevLevel) : getEnhanceFailChance(prevLevel);
    const failed = failRoll < effFail;
    const eventId = nextEventId(state);

    if (!failed) {
      // SUCCESS — same as a guaranteed level-up (consume the cost, raise one level).
      const mergedQuality = consumedInstances.reduce<number | undefined>((q, e) => bestQuality(q, e.quality), anchor.quality);
      const nextInventory = state.inventory
        .filter((e) => !consumedIds.has(e.instanceId))
        .map((e) => {
          if (e.instanceId !== anchorId) return e;
          const next = { ...e, level: resultLevel };
          if (mergedQuality !== undefined) next.quality = mergedQuality;
          return next;
        });
      return withCurrentUniverseEndingProgress(syncSlotUnlocks({
        ...state,
        enhanceStones: state.enhanceStones - stoneSpend,
        inventory: nextInventory,
        eventCounter: eventId,
        lastEnhanceEvent: {
          id: eventId, entityId: anchor.entityId, instanceId: anchorId,
          outcome: 'up', level: resultLevel, prevLevel,
          mergedCount: payWithCopies ? needCopies : 0,
        },
      }));
    }

    // FAILED. The cost (copies / stones) is consumed either way.
    const protectAvailable = !!action.useProtect && state.enhanceProtectCharges > 0;
    if (protectAvailable) {
      // PROTECTED — spend one charge; the anchor survives at its current level.
      const nextInventory = state.inventory.filter((e) => !consumedIds.has(e.instanceId));
      return withCurrentUniverseEndingProgress(syncSlotUnlocks({
        ...state,
        enhanceStones: state.enhanceStones - stoneSpend,
        enhanceProtectCharges: state.enhanceProtectCharges - 1,
        inventory: nextInventory,
        eventCounter: eventId,
        lastEnhanceEvent: {
          id: eventId, entityId: anchor.entityId, instanceId: anchorId,
          outcome: 'protected', level: prevLevel, prevLevel,
        },
      }));
    }

    // UNPROTECTED FAIL — DESTROY the anchor copy + mint consolation 강화석.
    const breakStones = rollBreakStones(entity.rarity, action.breakRoll);
    const destroyedIds = new Set<string | undefined>([anchorId, ...consumedIds]);
    const nextInventory = state.inventory.filter((e) => !destroyedIds.has(e.instanceId));
    return withCurrentUniverseEndingProgress(syncSlotUnlocks({
      ...state,
      enhanceStones: state.enhanceStones - stoneSpend + breakStones,
      // The destroyed anchor may be equipped (you can enhance worn gear) — scrub its slot.
      equippedSlots: state.equippedSlots.filter((id) => !destroyedIds.has(id)),
      riftSlots: state.riftSlots.filter((id) => !destroyedIds.has(id)),
      wildSlot: destroyedIds.has(state.wildSlot) ? '' : state.wildSlot,
      inventory: nextInventory,
      eventCounter: eventId,
      lastEnhanceEvent: {
        id: eventId, entityId: anchor.entityId, instanceId: anchorId,
        outcome: 'break', level: prevLevel, prevLevel, stonesEarned: breakStones,
      },
    }));
  }

  // ── GUARANTEED band (resulting level < threshold): unchanged behaviour. ──
  if (!usingMerge) {
    // #8 (user): no spare copies for even one level → the 강화석 escape valve
    // ("카드가 없으면 비싸게 업그레이트"). Pay an escalating 강화석 price for ONE level; no
    // copies consumed. Copies remain the cheap (free) path when you have them.
    const stoneCost = getEnhanceStoneCost(entity, prevLevel);
    if (state.enhanceStones < stoneCost) return state;
    const nextLevel = prevLevel + 1;
    const eventId = nextEventId(state);
    const nextInventory = state.inventory.map((e) =>
      e.instanceId === anchorId ? { ...e, level: nextLevel } : e);
    return withCurrentUniverseEndingProgress(syncSlotUnlocks({
      ...state,
      enhanceStones: state.enhanceStones - stoneCost,
      inventory: nextInventory,
      eventCounter: eventId,
      lastEnhanceEvent: {
        id: eventId, entityId: anchor.entityId, instanceId: anchorId,
        outcome: 'up', level: nextLevel, prevLevel, mergedCount: 0,
      },
    }));
  }

  consumedInstances = fodder.slice(0, merge.consumed); // each flat copy = 1
  consumedIds = new Set(consumedInstances.map((e) => e.instanceId));
  const mergedQuality = consumedInstances.reduce<number | undefined>((q, e) => bestQuality(q, e.quality), anchor.quality);

  const eventId = nextEventId(state);
  const nextInventory = state.inventory
    .filter((e) => !consumedIds.has(e.instanceId))
    .map((e) => {
      if (e.instanceId !== anchorId) return e;
      const next = { ...e, level: merge.newLevel };
      if (mergedQuality !== undefined) next.quality = mergedQuality;
      return next;
    });

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    // Defensive: scrub any consumed id from a slot (shouldn't be equipped, but safe).
    equippedSlots: state.equippedSlots.filter((id) => !consumedIds.has(id)),
    riftSlots: state.riftSlots.filter((id) => !consumedIds.has(id)),
    wildSlot: consumedIds.has(state.wildSlot) ? '' : state.wildSlot,
    inventory: nextInventory,
    eventCounter: eventId,
    lastEnhanceEvent: {
      id: eventId, entityId: anchor.entityId, instanceId: anchorId,
      outcome: 'up', level: merge.newLevel, prevLevel, mergedCount: merge.consumed,
    },
  }));
}


/**
 * Overhaul-4 (v26): toggle an entity's ★ favorite. Favorited entities' copies are
 * protected from Fuse-All (and, once duplicate-collection ships, pooled enhance
 * fodder). Keyed by entityId (the inventory UI groups by item type), so one ★
 * protects every spare of that item.
 */
export function handleToggleFavorite(
  state: GameState,
  action: Extract<GameAction, { type: 'TOGGLE_FAVORITE' }>,
): GameState {
  const set = new Set(state.favoriteEntityIds);
  if (set.has(action.entityId)) set.delete(action.entityId);
  else set.add(action.entityId);
  return { ...state, favoriteEntityIds: [...set] };
}

/** Overhaul-4: is this entity favorited (★)? Single source of truth for the lock. */
export function isFavoriteEntity(state: Pick<GameState, 'favoriteEntityIds'>, entityId: string): boolean {
  return state.favoriteEntityIds.includes(entityId);
}
