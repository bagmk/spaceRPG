import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { addToAlmanac, pickDropStage } from '../entities/drops';
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
  getEnhanceCost,
  getEnhanceLevelCap,
  getEnhanceStoneCost,
  getEnhanceProtectStoneCost,
  getEnhanceFailChance,
  isEnhanceStonePhase,
  isEnhanceDestroyEligible,
} from '../entities/enhance';
import { getSecondaryStats } from '../entities/substats';
import {
  ENTITY_COST_ANCHORS,
  FUSION_BURST_REF_COST_FRAC,
  RARITY_STAGE_GATES,
  ENHANCE_DESTROY_CHANCE_ON_FAIL,
  ENHANCE_STONE_THRESHOLD,
  FUSION_FAIL_STONES_BY_TIER,
  FUSION_SAME_ENTITY_UP_BONUS,
  FUSION_SAME_ENTITY_FAIL_STONE_BONUS,
  FUSION_SAME_SUBSET_BURST_MULT,
} from '../balance';
import { getEntityCost } from '../entities/types';
import { getAutoRate, safeAdd } from '../formulas';
import { getPrestigeMultiplier } from '../prestige';
import { STAGES } from '../stages';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import { getAdjustedClickPower, getCurrentModifiers, nextEventId } from './helpers';

type PurchaseAction = Extract<GameAction, { type: 'PURCHASE_ENTITY' }>;
type EquipAction = Extract<GameAction, { type: 'EQUIP_ENTITY' }>;
type UnequipAction = Extract<GameAction, { type: 'UNEQUIP_ENTITY' }>;
type FuseAction = Extract<GameAction, { type: 'FUSE_ENTITIES' }>;
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

  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;

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
  // Same entity cannot occupy two slots.
  if (slots.some((id, i) => i !== slot && id === action.entityId)) return state;

  // Dense array — empty slots hold '' so JSON round-trips cleanly (no holes).
  const next: string[] = [];
  for (let i = 0; i < slotCount; i++) next[i] = slots[i] ?? '';
  next[slot] = action.entityId;
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  // Vacuum decay in gear terms (Phase 4-2): equipping Critical-flavored gear
  // marks the universe as crit-upgraded — the ending requires never doing so.
  const isCritGear =
    entity.effect.type === 'crit' ||
    getSecondaryStats(entity).some((sub) => sub.type === 'critChance' || sub.type === 'critMult');
  const endingProgressFlags = isCritGear && !state.endingProgressFlags.criticalUpgradedThisUniverse
    ? { ...state.endingProgressFlags, criticalUpgradedThisUniverse: true, vacuumDecayEligible: false }
    : state.endingProgressFlags;
  return category === 'rift'
    ? { ...state, riftSlots: next, endingProgressFlags }
    : { ...state, equippedSlots: next, endingProgressFlags };
}

export function handleUnequipEntity(state: GameState, action: UnequipAction): GameState {
  const category = action.target ?? 'click';
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

  const existing = state.inventory.find((entry) => entityMatchesId(entity, entry.entityId));
  const currentCount = existing?.count ?? 0;

  // Max count check
  if (entity.maxCount > 0 && currentCount >= entity.maxCount) return state;

  // Anchor lock — non-anchor entities on the same stage are blocked until
  // the anchor entity for that stage (e.g. Sun on stage 10, Earth Formation
  // on stage 11) is fully maxed.
  if (isEntityLockedByAnchor(entity, state.inventory)) return state;

  const cost = getEntityCost(entity, currentCount, currentStage.id);
  if (state.quanta < cost) return state;

  const updatedInventory = existing
    ? state.inventory.map((e) =>
        e.entityId === existing.entityId ? { ...e, count: e.count + 1 } : e,
      )
    : [...state.inventory, { entityId: action.entityId, count: 1, level: 1 }];

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
 * quanta fraction; roll a same-stage output with rarity-up odds (pity-backed),
 * fire an entropy burst, and feed duplicates at max count into level-ups.
 * Randomness arrives via action rolls so the reducer stays pure.
 */
export function handleFuseEntities(state: GameState, action: FuseAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const validation = validateFusionInputs(state.inventory, action.inputEntityIds);
  if (!validation.ok || !validation.rarity || !validation.stageId) return state;

  const currentStageIdForFusion = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  // P2b bonuses: 3-of-the-same-entity lifts the up chance; 3-from-one-codex
  // category amplifies the entropy burst.
  const sameEntity = validation.sameEntity === true;
  const sameSubset = validation.sameSubsetId != null;
  const rarityResult = rollFusionRarity(
    validation.rarity, action.rarityRoll, state.fusionPity, currentStageIdForFusion,
    sameEntity ? FUSION_SAME_ENTITY_UP_BONUS : 0,
  );
  // Output pool stage follows the same player-stage weighting as drops
  // (Phase 4-1) — input origin stages no longer determine the output pool.
  const outputStageId =
    action.stageRoll !== undefined
      ? pickDropStage(currentStageIdForFusion, action.stageRoll, state.almanacCollected)
      : currentStageIdForFusion;
  const output = pickFusionOutput(outputStageId, rarityResult.rarity, action.pickRoll, {
    category: validation.category,
    familyKey: validation.familyKey,
  }, outputStageId !== currentStageIdForFusion);
  if (!output) return state;

  const cost = getFusionQuantaCost(validation.rarity, state.quanta);
  const { inventory: consumed, refund: enhanceRefund, stoneRefund } = consumeFusionInputs(state.inventory, action.inputEntityIds);
  const { inventory, leveledUp, capRefund } = applyFusionOutput(consumed, output, currentStageIdForFusion);
  const totalRefund = enhanceRefund + capRefund;
  // A failed fusion (no rarity-up) mints 강화석 — the consolation that funds
  // Lv5+ enhancement (R1). Stones scale with the input tier; +bonus for same-entity.
  const stonesEarned = rarityResult.rarityUp
    ? 0
    : (FUSION_FAIL_STONES_BY_TIER[validation.rarity] ?? 1) + (sameEntity ? FUSION_SAME_ENTITY_FAIL_STONE_BONUS : 0);

  const fusionModifiers = getCurrentModifiers(state);
  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Burst scales by what the fusion actually cost against a flat player-stage
  // reference price — closes the bank-then-burst-dump exploit (cost is a
  // fraction of the bank, so an emptied bank used to buy full bursts for free).
  const burstRefCost =
    (ENTITY_COST_ANCHORS[currentStageIdForFusion as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16]) *
    FUSION_BURST_REF_COST_FRAC;
  const burstCostScale = burstRefCost > 0 ? Math.min(1, cost / burstRefCost) : 1;
  const burst =
    getFusionEntropyBurst(getAdjustedClickPower(state), getAutoRate(fusionModifiers)) *
    fusionModifiers.fusionBurstMult *
    entropyEchoMult *
    burstCostScale *
    (sameSubset ? FUSION_SAME_SUBSET_BURST_MULT : 1);
  const nextEntropy = safeAdd(state.entropy, burst);
  const eventId = nextEventId(state);
  const nextPity = rarityResult.pityApplicable
    ? (rarityResult.rarityUp ? 0 : state.fusionPity + 1)
    : state.fusionPity;

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: Math.max(0, state.quanta - cost + totalRefund),
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    enhanceStones: Math.max(0, state.enhanceStones + stonesEarned + stoneRefund),
    inventory,
    almanacCollected: addToAlmanac(state.almanacCollected, output.stageId, output.id),
    fusionPity: nextPity,
    eventCounter: eventId,
    lastFusionEvent: {
      id: eventId,
      outputEntityId: output.id,
      rarityUp: rarityResult.rarityUp,
      leveledUp,
      entropyBurst: burst,
      refund: totalRefund,
      atCap: capRefund > 0,
      stonesEarned,
    },
  }));
}

/**
 * ENHANCE_ENTITY (강화소): level an owned stack directly. Lv1→5 spend matter and
 * always succeed; Lv5+ spend 강화석 and CAN FAIL — mostly a level-down, with a
 * small chance to destroy a copy near the cap. "보호 강화" (protect) costs extra
 * stones and negates any loss on a failed attempt (운빨 존망겜, P1).
 */
export function handleEnhanceEntity(state: GameState, action: EnhanceAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const entity = findEntityById(action.entityId);
  if (!entity) return state;
  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;
  const level = owned.level;
  if (level >= getEnhanceLevelCap(entity)) return state;

  const eventId = nextEventId(state);
  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;

  // ── Matter phase (Lv < 5): pay quanta, always succeeds. ──
  if (!isEnhanceStonePhase(level)) {
    const cost = getEnhanceCost(entity, level, stageId);
    if (state.quanta < cost) return state;
    return withCurrentUniverseEndingProgress({
      ...state,
      quanta: state.quanta - cost,
      eventCounter: eventId,
      lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'up', level: level + 1 },
      inventory: state.inventory.map((e) =>
        e.entityId === owned.entityId
          ? { ...e, level: e.level + 1, invested: (e.invested ?? 0) + cost }
          : e,
      ),
    });
  }

  // ── Stone phase (Lv ≥ 5): pay 강화석, can fail. ──
  const protect = action.protect === true;
  const stoneCost = getEnhanceStoneCost(entity, level);
  const protectCost = protect ? getEnhanceProtectStoneCost(entity, level) : 0;
  const totalStones = stoneCost + protectCost;
  if (state.enhanceStones < totalStones) return state;

  const failChance = getEnhanceFailChance(level);
  const succeeded = (action.failRoll ?? 1) >= failChance;
  const nextStones = state.enhanceStones - totalStones;

  let outcome: 'up' | 'down' | 'break' | 'protected';
  let nextLevel = level;
  let destroyed = false;
  if (succeeded) {
    outcome = 'up';
    nextLevel = level + 1;
  } else if (protect) {
    outcome = 'protected'; // loss negated — stones still spent
  } else if (isEnhanceDestroyEligible(entity, level) && (action.destroyRoll ?? 1) < ENHANCE_DESTROY_CHANCE_ON_FAIL) {
    outcome = 'break';
    destroyed = true;
  } else {
    outcome = 'down';
    nextLevel = Math.max(ENHANCE_STONE_THRESHOLD, level - 1); // never below the matter-bought line
  }

  // Apply to the stack. A break consumes one copy and resets the stack's level;
  // if it empties, drop the entry's slot references.
  let nextInventory = state.inventory.map((e) => {
    if (e.entityId !== owned.entityId) return e;
    const investedStones = succeeded ? (e.investedStones ?? 0) + stoneCost : (e.investedStones ?? 0);
    if (destroyed) {
      return { ...e, count: e.count - 1, level: 1, investedStones: 0 };
    }
    return { ...e, level: nextLevel, investedStones };
  });
  let nextState: GameState = { ...state, enhanceStones: Math.max(0, nextStones) };
  if (destroyed && (nextInventory.find((e) => e.entityId === owned.entityId)?.count ?? 0) <= 0) {
    nextInventory = nextInventory.filter((e) => e.entityId !== owned.entityId);
    nextState = {
      ...nextState,
      equippedSlots: state.equippedSlots.filter((id) => id !== owned.entityId),
      riftSlots: state.riftSlots.filter((id) => id !== owned.entityId),
    };
  }

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...nextState,
    inventory: nextInventory,
    eventCounter: eventId,
    lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome, level: destroyed ? 1 : nextLevel },
  }));
}
