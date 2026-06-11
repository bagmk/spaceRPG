import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { addToAlmanac } from '../entities/drops';
import { getEntityCost } from '../entities/types';
import { STAGES } from '../stages';
import { withCurrentUniverseEndingProgress } from '../multiverse';

type PurchaseAction = Extract<GameAction, { type: 'PURCHASE_ENTITY' }>;
type EquipAction = Extract<GameAction, { type: 'EQUIP_ENTITY' }>;
type UnequipAction = Extract<GameAction, { type: 'UNEQUIP_ENTITY' }>;

/** Equip an owned entity into a slot (entity redesign Phase 2 — slot 0 only for now). */
export function handleEquipEntity(state: GameState, action: EquipAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;

  const slot = action.slot ?? 0;
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

  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: state.quanta - cost,
    inventory: updatedInventory,
    // Purchases count as collected for the almanac grid.
    almanacCollected: addToAlmanac(state.almanacCollected, entity.stageId, entity.id),
  });
}
