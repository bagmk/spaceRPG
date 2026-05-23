import type { PurchasedEntityEntry, StageEntity } from './types';
import { entityMatchesId, findEntityById } from './stageItems';

/**
 * Anchor entities gate the rest of the stage: until the anchor is fully
 * maxed (e.g. count == maxCount), every other entity on the same stage is
 * locked. This forces the player to fully experience the "Earth forming"
 * (stage 11) or "Sun igniting" (stage 10) animation before unlocking the
 * downstream upgrades.
 *
 * Stored as a stable id → that id MUST exist as either the canonical id or
 * an alias of an entity on the stage.
 */
export const STAGE_ANCHOR_ENTITY: Record<number, string> = {
  10: 's10_01_sun',
  11: 's11_01_earth_formation',
};

export function getStageAnchorEntity(stageId: number): StageEntity | undefined {
  const anchorId = STAGE_ANCHOR_ENTITY[stageId];
  if (!anchorId) return undefined;
  return findEntityById(anchorId, stageId);
}

export function getEntityCount(
  purchasedEntities: PurchasedEntityEntry[],
  entity: StageEntity,
): number {
  return purchasedEntities.reduce(
    (sum, entry) => (entityMatchesId(entity, entry.entityId) ? sum + entry.count : sum),
    0,
  );
}

/**
 * True when the stage has an anchor that hasn't been fully maxed yet AND
 * the candidate entity is not the anchor itself. Used to gate purchases
 * and the entity-panel UI.
 */
export function isEntityLockedByAnchor(
  entity: StageEntity,
  purchasedEntities: PurchasedEntityEntry[],
): boolean {
  const anchor = getStageAnchorEntity(entity.stageId);
  if (!anchor) return false;
  if (entityMatchesId(anchor, entity.id)) return false;
  if (anchor.maxCount <= 0) return false;
  const anchorCount = getEntityCount(purchasedEntities, anchor);
  return anchorCount < anchor.maxCount;
}
