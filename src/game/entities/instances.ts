/**
 * P6 — inventory instance model (save v25). The inventory is now FLAT: each
 * EntityInstance is ONE physical copy with a unique `instanceId` (count stays 1).
 * Stacks of identical copies are exploded on the v24→v25 migration. Equip slots,
 * enhancement and fusion all act on specific instanceIds, so two copies of one
 * item can sit in two slots at different levels.
 */
import { entityMatchesId } from './stageItems';
import type { EntityInstance, StageEntity } from './types';

let instanceSeq = 0;

/** A unique id for a fresh copy. Not derived from game state (pure-enough: ids
 *  never affect logic, only identity — like the existing Date.now() use). */
export function newInstanceId(entityId: string): string {
  instanceSeq += 1;
  const rnd = Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000) % 100000;
  return `${entityId}#${instanceSeq.toString(36)}${rnd.toString(36)}`;
}

/** Make a fresh flat copy (count 1) of an entity id. */
export function makeInstance(entityId: string, fields: Partial<EntityInstance> = {}): EntityInstance {
  return { entityId, instanceId: newInstanceId(entityId), count: 1, level: 1, ...fields };
}

/** All owned copies of an entity id (alias-aware). */
export function getCopies(inventory: EntityInstance[], entity: StageEntity): EntityInstance[] {
  return inventory.filter((e) => entityMatchesId(entity, e.entityId));
}

/** The instanceId of the first equippable/fuseable copy of `entity` that is NOT
 *  in any of the given reserved (equipped) slots — or null if none free. Prefers
 *  the LOWEST-level copy so the player keeps their enhanced copy as fodder last. */
export function pickFreeCopyId(
  inventory: EntityInstance[],
  entity: StageEntity,
  reserved: ReadonlySet<string>,
): string | null {
  // A copy's slot key is its instanceId; legacy/unmigrated copies that lack one
  // fall back to their entityId (so a single such copy still equips, matching v24
  // — only id-bearing copies support two-of-the-same-in-two-slots).
  const free = getCopies(inventory, entity)
    .map((e) => ({ e, id: e.instanceId ?? e.entityId }))
    .filter(({ id }) => !reserved.has(id))
    .sort((a, b) => (a.e.level ?? 1) - (b.e.level ?? 1));
  return free[0]?.id ?? null;
}

/** The set of every instanceId currently sitting in an equip slot. */
export function reservedInstanceIds(
  equippedSlots: string[],
  riftSlots: string[],
  wildSlot: string,
): Set<string> {
  const s = new Set<string>();
  for (const id of equippedSlots) if (id) s.add(id);
  for (const id of riftSlots) if (id) s.add(id);
  if (wildSlot) s.add(wildSlot);
  return s;
}
