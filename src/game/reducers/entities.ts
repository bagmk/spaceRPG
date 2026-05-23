import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { getEntityCost } from '../entities/types';
import { STAGES } from '../stages';
import { withCurrentUniverseEndingProgress } from '../multiverse';

type PurchaseAction = Extract<GameAction, { type: 'PURCHASE_ENTITY' }>;

export function handlePurchaseEntity(state: GameState, action: PurchaseAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  // Allow purchasing entities from any stage up to and including the current stage
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage || entity.stageId > currentStage.id) return state;

  const existing = state.purchasedEntities.find((entry) => entityMatchesId(entity, entry.entityId));
  const currentCount = existing?.count ?? 0;

  // Max count check
  if (entity.maxCount > 0 && currentCount >= entity.maxCount) return state;

  // Anchor lock — non-anchor entities on the same stage are blocked until
  // the anchor entity for that stage (e.g. Sun on stage 10, Earth Formation
  // on stage 11) is fully maxed.
  if (isEntityLockedByAnchor(entity, state.purchasedEntities)) return state;

  const cost = getEntityCost(entity, currentCount);
  if (state.quanta < cost) return state;

  const updatedEntities = existing
    ? state.purchasedEntities.map((e) =>
        e.entityId === existing.entityId ? { ...e, count: e.count + 1 } : e,
      )
    : [...state.purchasedEntities, { entityId: action.entityId, count: 1 }];

  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: state.quanta - cost,
    purchasedEntities: updatedEntities,
  });
}
