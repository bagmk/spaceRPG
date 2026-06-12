import type { EntityRarity, PurchasedEntityEntry, StageEntity } from './types';
import { entityMatchesId, findEntityById, getEntitiesForStage } from './stageItems';

/**
 * Anchor entities gate the rest of the stage. The simple anchor rule is:
 * until the anchor is fully maxed, every other entity on the same stage is
 * locked. This forces the player to fully experience the Sun (stage 10)
 * before unlocking the downstream upgrades.
 */
export const STAGE_ANCHOR_ENTITY: Record<number, string> = {
  10: 's10_01',
  11: 's11_01',
};

/**
 * Rarity progression: stages 3+ require all entities of the previous rarity
 * to be purchased (count > 0) before the next rarity tier unlocks.
 * Stage 11 is excluded (has its own chain). Stages 1-2 have no gating.
 *
 * common → rare (stage 3+)
 * rare → epic (stage 3+)
 * epic → legendary (stage 4+)
 */
const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_GATE_START_STAGE = 3;
const LEGENDARY_GATE_START_STAGE = 4;

function isRarityLocked(
  entity: StageEntity,
  purchasedEntities: PurchasedEntityEntry[],
): boolean {
  const stageId = entity.stageId;
  if (stageId < RARITY_GATE_START_STAGE || stageId === 11) return false;

  const rarityIdx = RARITY_ORDER.indexOf(entity.rarity);
  if (rarityIdx <= 0) return false; // common is never locked by rarity

  // Legendary requires stage 4+
  if (entity.rarity === 'legendary' && stageId < LEGENDARY_GATE_START_STAGE) return false;

  // Check that all entities of the previous rarity tier are fully maxed
  const prevRarity = RARITY_ORDER[rarityIdx - 1];
  const prevTierEntities = getEntitiesForStage(stageId).filter((e) => e.rarity === prevRarity);

  return prevTierEntities.some((prev) => {
    if (prev.maxCount <= 0) return false; // no cap = always satisfied
    const count = purchasedEntities.reduce(
      (sum, entry) => (entityMatchesId(prev, entry.entityId) ? sum + entry.count : sum),
      0,
    );
    return count < prev.maxCount;
  });
}

/**
 * Stage 11 uses an explicit chain instead of a single anchor — Earth
 * Formation unlocks Moon Formation, Moon Formation unlocks First Ocean and
 * Atmosphere, and the remaining tiers unlock once their previous tier is
 * fully maxed. Anything not listed falls back to the stage anchor rule.
 */
// Keyed by canonical (position-only) entity id. Stage 11 layout:
//   01 Earth Formation · 02 Moon Formation · 03 First Ocean · 04 Atmosphere
//   05 Continents Rise · 06 Photosynthesis · 07 Prokaryote · 08 Cambrian
//   09 Neuron · 10 Homo Sapiens · 11 City Lights · 12 Artificial Satellite
//   13 Spacefaring Humanity · 14 Interstellar Ark
const STAGE_11_PREREQUISITE: Record<string, string> = {
  's11_02': 's11_01', // Moon Formation ← Earth Formation
  's11_03': 's11_02', // First Ocean ← Moon Formation
  's11_04': 's11_02', // Atmosphere ← Moon Formation
  // Rares unlock once Atmosphere (the last common) is fully built.
  's11_05': 's11_04',
  's11_06': 's11_04',
  's11_07': 's11_04',
  's11_08': 's11_04',
  // Epics unlock once Continents Rise (the first rare) is fully built.
  's11_09': 's11_05',
  's11_10': 's11_05',
  's11_11': 's11_05',
  's11_12': 's11_05',
  // Legendaries unlock once Artificial Satellite (the last epic) is built.
  's11_13': 's11_12',
  's11_14': 's11_12',
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
 * Returns the entity that must be maxed before `entity` can be purchased,
 * or undefined if there is no such prerequisite (already unlocked).
 *
 * Stage 11 uses the explicit chain in STAGE_11_PREREQUISITE. Other stages
 * fall back to the single-anchor rule.
 */
export function getEntityLockPrerequisite(
  entity: StageEntity,
  purchasedEntities: PurchasedEntityEntry[],
): StageEntity | undefined {
  if (entity.stageId === 11) {
    const prereqId = STAGE_11_PREREQUISITE[entity.id];
    if (prereqId) {
      const prereq = findEntityById(prereqId, 11);
      if (!prereq || prereq.maxCount <= 0) return undefined;
      const count = getEntityCount(purchasedEntities, prereq);
      return count < prereq.maxCount ? prereq : undefined;
    }
    // Entries without a chain entry are unlocked from the start (e.g. the
    // Earth Formation anchor itself).
    return undefined;
  }

  // Rarity gating for stages 3+ (must buy all of previous rarity first)
  if (isRarityLocked(entity, purchasedEntities)) {
    // Return the first unpurchased entity of the previous rarity as the "prerequisite"
    const prevRarity = RARITY_ORDER[RARITY_ORDER.indexOf(entity.rarity) - 1];
    const missing = getEntitiesForStage(entity.stageId)
      .filter((e) => e.rarity === prevRarity)
      .find((e) => getEntityCount(purchasedEntities, e) === 0);
    return missing;
  }

  // Other stages: simple anchor rule.
  const anchor = getStageAnchorEntity(entity.stageId);
  if (!anchor) return undefined;
  if (entityMatchesId(anchor, entity.id)) return undefined;
  if (anchor.maxCount <= 0) return undefined;
  const anchorCount = getEntityCount(purchasedEntities, anchor);
  return anchorCount < anchor.maxCount ? anchor : undefined;
}

/** Legacy name retained for callers that just need the boolean. */
export function isEntityLockedByAnchor(
  entity: StageEntity,
  purchasedEntities: PurchasedEntityEntry[],
): boolean {
  return getEntityLockPrerequisite(entity, purchasedEntities) !== undefined;
}
