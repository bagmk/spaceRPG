import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { addToAlmanac } from '../entities/drops';
import { getDerivedUnlockedSlotCount } from '../entities/effects';
import {
  applyFusionOutput,
  consumeFusionInputs,
  getFusionEntropyBurst,
  getFusionQuantaCost,
  pickFusionOutput,
  rollFusionRarity,
  validateFusionInputs,
} from '../entities/fusion';
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

/** Raise unlockedSlotCount when stage/almanac progress earns a new slot (never lowers). */
export function syncSlotUnlocks(state: GameState): GameState {
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  const derived = getDerivedUnlockedSlotCount(stage.id, state.almanacCollected);
  if (derived <= state.unlockedSlotCount) return state;
  return { ...state, unlockedSlotCount: derived };
}

/** Equip an owned entity into a slot. Without an explicit slot, the first empty one is used. */
export function handleEquipEntity(state: GameState, action: EquipAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;

  let slot = action.slot ?? -1;
  if (slot === -1) {
    // First empty unlocked slot; fall back to replacing slot 0.
    slot = 0;
    for (let i = 0; i < state.unlockedSlotCount; i++) {
      if (!state.equippedSlots[i]) { slot = i; break; }
    }
  }
  if (slot < 0 || slot >= state.unlockedSlotCount) return state;
  // Same entity cannot occupy two slots.
  if (state.equippedSlots.some((id, i) => i !== slot && id === action.entityId)) return state;

  // Dense array — empty slots hold '' so JSON round-trips cleanly (no holes).
  const next: string[] = [];
  for (let i = 0; i < state.unlockedSlotCount; i++) next[i] = state.equippedSlots[i] ?? '';
  next[slot] = action.entityId;
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return { ...state, equippedSlots: next };
}

export function handleUnequipEntity(state: GameState, action: UnequipAction): GameState {
  if (action.slot < 0 || action.slot >= state.equippedSlots.length) return state;
  if (!state.equippedSlots[action.slot]) return state;
  const next = state.equippedSlots.map((id, i) => (i === action.slot ? '' : id));
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return { ...state, equippedSlots: next };
}

export function handlePurchaseEntity(state: GameState, action: PurchaseAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  // Allow purchasing entities from any stage up to and including the current stage
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage || entity.stageId > currentStage.id) return state;

  const existing = state.inventory.find((entry) => entityMatchesId(entity, entry.entityId));
  const currentCount = existing?.count ?? 0;

  // Max count check
  if (entity.maxCount > 0 && currentCount >= entity.maxCount) return state;

  // Anchor lock — non-anchor entities on the same stage are blocked until
  // the anchor entity for that stage (e.g. Sun on stage 10, Earth Formation
  // on stage 11) is fully maxed.
  if (isEntityLockedByAnchor(entity, state.inventory)) return state;

  const cost = getEntityCost(entity, currentCount);
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

  const rarityResult = rollFusionRarity(validation.rarity, action.rarityRoll, state.fusionPity);
  const output = pickFusionOutput(validation.stageId, rarityResult.rarity, action.pickRoll);
  if (!output) return state;

  const cost = getFusionQuantaCost(state.quanta);
  const consumed = consumeFusionInputs(state.inventory, action.inputEntityIds);
  const { inventory, leveledUp } = applyFusionOutput(consumed, output);

  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  const burst =
    getFusionEntropyBurst(getAdjustedClickPower(state), getAutoRate(getCurrentModifiers(state))) *
    entropyEchoMult;
  const nextEntropy = safeAdd(state.entropy, burst);
  const eventId = nextEventId(state);
  const nextPity = rarityResult.pityApplicable
    ? (rarityResult.rarityUp ? 0 : state.fusionPity + 1)
    : state.fusionPity;

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: Math.max(0, state.quanta - cost),
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
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
    },
  }));
}
